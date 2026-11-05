import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkRelease, supportInfo, releasesURL} from '../src/releases.js';

const stable = (tag = 'v0.3.10') => ({tag_name: tag, draft: false, prerelease: false,
  assets: [{name: 'BlitzDic Setup 0.3.10.exe', size: 123,
    browser_download_url: `${releasesURL}/download/${tag}/BlitzDic%20Setup%200.3.10.exe`}]});
const fixture = data => ({fetchImpl: async () => Response.json(data)});

test('release check distinguishes stable upgrades, development builds and missing Windows installers', async () => {
  assert.deepEqual(await checkRelease('0.3.9', fixture(stable())), {state: 'available', version: 'v0.3.10'});
  assert.equal((await checkRelease('0.3.10-dev.20', fixture(stable()))).state, 'available');
  assert.equal((await checkRelease('0.3.10', fixture(stable()))).state, 'current');
  assert.equal((await checkRelease('0.3.11-dev.0', fixture(stable()))).state, 'current');
  assert.equal((await checkRelease('0.3.9', fixture({...stable(), assets: []}))).state, 'no-windows-installer');
  const foreign = stable(); foreign.assets[0].browser_download_url = 'https://other.example/setup.exe';
  assert.equal((await checkRelease('0.3.9', fixture(foreign))).state, 'no-windows-installer');
});

test('update check contacts only the fork endpoint with no user data and rejects redirects', async () => {
  const result = await checkRelease('0.3.10-dev.20', {fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.github.com/repos/phil2001/2026-10_BlitzDic/releases/latest');
    assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit');
    assert.equal(options.body, undefined); assert.equal(options.headers.Authorization, undefined);
    return new Response(null, {status: 404});
  }});
  assert.deepEqual(result, {state: 'unpublished'});
});

test('update failures are bounded, useful and do not echo server content', async () => {
  for (const data of [null, {...stable(), draft: true}, {...stable(), prerelease: true}, stable('v0.3.11-beta.1'), stable('<script>')])
    await assert.rejects(checkRelease('0.3.10', fixture(data)), /Veröffentlichung/);
  await assert.rejects(checkRelease('broken', fixture(stable())), /Versionsnummer/);
  await assert.rejects(checkRelease('0.3.10', {fetchImpl: async () => new Response('private', {status: 403})}), /Anfragelimit/);
  await assert.rejects(checkRelease('0.3.10', {fetchImpl: async () => new Response('x'.repeat(256 * 1024 + 1))}), /gültigen/);
  await assert.rejects(checkRelease('0.3.10', {fetchImpl: async () => {throw new Error('secret');}}), /nicht erreichbar/);
});

test('support template includes only explicit build/system fields and excludes supplied settings or transcripts', () => {
  const text = supportInfo({version: '0.3.10', platform: 'win32', arch: 'x64', release: '10.0.26200',
    apiKey: 'secret-value', history: 'private-transcript', username: 'private-user'});
  assert.match(text, /BlitzDic 0.3.10/); assert.match(text, /win32 10.0.26200 \(x64\)/);
  for (const value of ['secret-value', 'private-transcript', 'private-user']) assert.ok(!text.includes(value));
});
