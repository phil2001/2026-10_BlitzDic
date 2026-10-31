import { app } from 'electron';
import { resolve } from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { windowsCrypto } from '../src/windows-storage.js';
import { PrivateStore } from '../src/store.js';
app.setPath('userData', resolve('.runtime/electron-storage-check'));
app.whenReady().then(async () => {
try {
  await mkdir('.runtime/store-tests', { recursive: true });
  const directory = await mkdtemp(resolve('.runtime/store-tests/dpapi-'));
  const store = new PrivateStore(directory, await windowsCrypto());
  const settings = await store.settings(); settings.provider.apiKey = 'test-secret-only';
  await store.saveSettings(settings);
  const second = new PrivateStore(directory, await windowsCrypto());
  if ((await second.settings()).provider.apiKey !== 'test-secret-only') throw new Error('Round trip failed');
  if ((await readFile(resolve(directory, 'settings.bin'))).includes('test-secret-only')) throw new Error('Plaintext persisted');
  await writeFile('.runtime/storage-verification.json', JSON.stringify({ passed: true, platform: process.platform, electron: process.versions.electron, directory }, null, 2));
  app.exit(0);
} catch (error) {
  await writeFile('.runtime/storage-verification.json', JSON.stringify({ passed: false, error: error.message }));
  app.exit(1);
}
});
