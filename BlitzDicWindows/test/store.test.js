import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { PrivateStore } from '../src/store.js';
import { mkdir } from 'node:fs/promises';

async function fixture() {
  // Keep test artifacts inside the project; no recursive deletion.
  await mkdir('.runtime/store-tests', { recursive: true });
  const dir = await mkdtemp(resolve('.runtime/store-tests/case-'));
  const key = randomBytes(32);
  const crypto = {
    encrypt(text) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv); const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), data]); },
    decrypt(data) { const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12)); decipher.setAuthTag(data.subarray(12, 28)); return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'); },
  };
  return { dir, store: new PrivateStore(dir, crypto) };
}
test('keys and transcripts never appear in persisted payload', async () => {
  const { dir, store } = await fixture();
  const settings = await store.settings(); settings.provider.apiKey = 'SECRET_API_KEY';
  await store.saveSettings(settings);
  await store.appendHistory({ text: 'PRIVATE_TRANSCRIPT' });
  assert.equal((await store.settings()).provider.apiKey, 'SECRET_API_KEY');
  assert.equal((await store.history())[0].text, 'PRIVATE_TRANSCRIPT');
  assert.equal((await readFile(join(dir, 'settings.bin'))).includes('SECRET_API_KEY'), false);
  assert.equal((await readFile(join(dir, 'history.bin'))).includes('PRIVATE_TRANSCRIPT'), false);
});
test('concurrent history updates retain all entries and apply retention', async () => {
  const { store } = await fixture();
  await Promise.all(Array.from({ length: 20 }, (_, id) => store.appendHistory({ id }, 10)));
  assert.deepEqual((await store.history()).map(x => x.id), [19,18,17,16,15,14,13,12,11,10]);
  await store.clearHistory(); assert.deepEqual(await store.history(), []);
});
test('corrupt ciphertext is preserved and never replaced by defaults', async () => {
  const { dir, store } = await fixture();
  const file = join(dir, 'history.bin'); await writeFile(file, 'broken');
  await assert.rejects(store.appendHistory({ text: 'new' }), /nicht entschlüsselt/);
  assert.equal(await readFile(file, 'utf8'), 'broken');
});

test('meeting-name updates serialize with appends and cannot recreate missing entries', async () => {
  const {dir, store} = await fixture();
  await store.appendMeeting({id: 'old', transcript: 'Sprecher 1: Original.'});
  await Promise.all([store.updateMeeting('old', entry => ({...entry, speakerNames: [{section: 0, speaker: 1, name: 'PRIVATE_NAME'}]})),
    store.appendMeeting({id: 'new', transcript: 'New source'})]);
  const entries = await store.meetings();
  assert.deepEqual(entries.map(entry => entry.id), ['new', 'old']);
  assert.equal(entries[1].transcript, 'Sprecher 1: Original.');
  assert.equal(entries[1].speakerNames[0].name, 'PRIVATE_NAME');
  assert.equal((await readFile(join(dir, 'meetings.bin'))).includes('PRIVATE_NAME'), false);
  await store.clearMeetings();
  await assert.rejects(store.updateMeeting('old', entry => entry), /nicht mehr vorhanden/);
  assert.deepEqual(await store.meetings(), []);
});
