import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { complete, listModels, validateConfig } from '../src/providers.js';

async function server(t, handler) {
  const instance = createServer(handler);
  await new Promise(resolve => instance.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { instance.closeAllConnections(); instance.close(resolve); }));
  return { provider: 'ollama', location: 'local', model: 'installed-model', baseURL: `http://127.0.0.1:${instance.address().port}/v1` };
}

test('local mode rejects remote destinations and malformed URLs', () => {
  for (const baseURL of ['https://example.com/v1', 'file:///tmp/model', 'http://user:key@localhost/v1', 'http://localhost/v1?key=secret']) {
    assert.throws(() => validateConfig({ provider: 'custom', location: 'local', model: 'm', baseURL }));
  }
  assert.equal(validateConfig({ provider: 'lmstudio', location: 'local', model: 'm' }).baseURL, 'http://127.0.0.1:1234/v1');
  assert.equal(validateConfig({ provider: 'ollama', location: 'lan', model: 'm', baseURL: 'http://192.168.1.2:11434/v1/' }).baseURL, 'http://192.168.1.2:11434/v1');
});

test('LAN settings require a destination and infer /v1 only for standard model servers', () => {
  const config = { provider: 'lmstudio', location: 'lan', model: 'm' };
  for (const baseURL of ['', 'http://localhost.:1234', 'http://127.0.0.2:1234', 'http://[::ffff:127.0.0.1]:1234', 'http://0.0.0.0:1234', 'http://[::]:1234']) {
    assert.throws(() => validateConfig({ ...config, baseURL }), /KI-Computers/);
  }
  assert.equal(validateConfig({ ...config, baseURL: 'http://ki-pc:1234' }).baseURL, 'http://ki-pc:1234/v1');
  assert.equal(validateConfig({ ...config, baseURL: 'http://ki-pc:1234/proxy/v1/' }).baseURL, 'http://ki-pc:1234/proxy/v1');
  assert.equal(validateConfig({ ...config, provider: 'custom', baseURL: 'http://ki-pc:8080' }).baseURL, 'http://ki-pc:8080');
});

test('real HTTP model discovery and rewriting preserve path, roles and model', async t => {
  const config = await server(t, async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/v1/models') return res.end(JSON.stringify({ data: [{ id: 'a' }, { id: 'a' }, { id: 'b' }] }));
    assert.equal(req.url, '/v1/chat/completions');
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    assert.equal(body.model, 'installed-model');
    assert.deepEqual(body.messages, [{ role: 'system', content: 'instruction' }, { role: 'user', content: 'dictation' }]);
    res.end(JSON.stringify({ choices: [{ message: { content: ' Corrected text. ' }, finish_reason: 'stop' }] }));
  });
  const serverAddress = { ...config, baseURL: new URL(config.baseURL).origin };
  assert.deepEqual(await listModels(serverAddress), ['a', 'b']);
  assert.equal(await complete(serverAddress, 'instruction', 'dictation'), 'Corrected text.');
});

test('server errors do not leak echoed sensitive text', async t => {
  const config = await server(t, (req, res) => { res.writeHead(401); res.end('secret transcript'); });
  await assert.rejects(complete(config, 'private', 'private'), { message: 'API-Key wurde abgelehnt.' });
});

test('timeout and explicit cancellation terminate requests', async t => {
  const config = await server(t, () => {});
  await assert.rejects(complete(config, '', '', { timeoutMs: 30 }), /Zeitüberschreitung/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(complete(config, '', '', { signal: controller.signal }), /Abgebrochen/);
});

test('redirects are not followed with user text', async t => {
  const config = await server(t, (req, res) => { res.writeHead(307, { Location: 'https://example.com' }); res.end(); });
  await assert.rejects(complete(config, '', 'private'), /nicht erreichbar/);
});

test('truncated output is not accepted as a finished rewrite', async t => {
  const config = await server(t, (req, res) => res.end(JSON.stringify({ choices: [{ message: { content: 'Partial' }, finish_reason: 'length' }] })));
  await assert.rejects(complete(config, '', ''), /abgeschnitten/);
});
test('Anthropic uses Messages protocol and extracts only text blocks', async t => {
  const config = await server(t, async (req, res) => {
    assert.equal(req.url, '/v1/messages');
    assert.equal(req.headers['x-api-key'], 'test-key');
    assert.equal(req.headers.authorization, undefined);
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    assert.equal(body.system, 'instruction');
    assert.deepEqual(body.messages, [{ role: 'user', content: 'dictation' }]);
    res.end(JSON.stringify({ content: [{ type: 'thinking', thinking: 'hidden' }, { type: 'text', text: 'Result' }], stop_reason: 'end_turn' }));
  });
  config.provider = 'anthropic'; config.apiKey = 'test-key';
  assert.equal(await complete(config, 'instruction', 'dictation'), 'Result');
});
test('malformed top-level response produces a useful error', async t => {
  const config = await server(t, (req, res) => res.end('null'));
  await assert.rejects(complete(config, '', ''), /gültige JSON/);
});
