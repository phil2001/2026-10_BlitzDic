// Provider semantics ported from BlitztextShared/AI/AIClient.swift (MIT).
export const providers = Object.freeze({
  ollama: { label: 'Ollama', baseURL: 'http://127.0.0.1:11434/v1', local: true },
  lmstudio: { label: 'LM Studio', baseURL: 'http://127.0.0.1:1234/v1', local: true },
  openAI: { label: 'OpenAI', baseURL: 'https://api.openai.com/v1', key: true },
  anthropic: { label: 'Anthropic', baseURL: 'https://api.anthropic.com/v1', key: true },
  gemini: { label: 'Google Gemini', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', key: true },
  mistral: { label: 'Mistral', baseURL: 'https://api.mistral.ai/v1', key: true },
  openRouter: { label: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1', key: true },
  custom: { label: 'Eigene API', baseURL: '' },
});

export function validateConfig(config, { requireModel = true } = {}) {
  const provider = providers[config.provider];
  if (!provider) throw new Error('Unbekannter Anbieter.');
  const suppliedAddress = config.baseURL?.trim();
  if (config.location === 'lan' && !suppliedAddress)
    throw new Error('Bitte die Adresse des KI-Computers im Netzwerk eingeben.');
  let url;
  try { url = new URL(suppliedAddress || provider.baseURL); }
  catch { throw new Error('Bitte eine gültige Serveradresse eingeben.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Serveradresse muss HTTP(S) ohne Zugangsdaten, Abfrage oder Fragment verwenden.');
  if (!['local', 'lan', 'api'].includes(config.location)) throw new Error('Verarbeitungsort fehlt.');
  const loopback = ['localhost', 'localhost.', '[::1]'].includes(url.hostname) ||
    /^127(?:\.\d{1,3}){3}$/.test(url.hostname) || /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]+\]$/.test(url.hostname);
  if (config.location === 'local' && !loopback)
    throw new Error('Lokale Verarbeitung benötigt localhost oder eine Loopback-Adresse.');
  if (config.location === 'lan' && (loopback || ['0.0.0.0', '[::]'].includes(url.hostname)))
    throw new Error('Für die Netzwerkverarbeitung den Hostnamen oder die IP-Adresse des KI-Computers eingeben.');
  if (config.location === 'api' && url.protocol !== 'https:')
    throw new Error('Externe APIs benötigen HTTPS.');
  if (requireModel && !config.model?.trim()) throw new Error('Bitte ein Modell auswählen oder eingeben.');
  if (provider.key && !config.apiKey?.trim()) throw new Error('Für diesen Anbieter fehlt der API-Key.');
  if (provider.local && url.pathname === '/') url.pathname = '/v1';
  return { ...config, baseURL: url.href.replace(/\/+$/, ''), model: config.model?.trim() };
}

async function request(config, route, body, options = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (config.provider === 'anthropic') {
    headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 120000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response;
  try {
    response = await fetch(`${config.baseURL}/${route}`, {
      method: body ? 'POST' : 'GET', headers,
      body: body ? JSON.stringify(body) : undefined,
      signal, redirect: 'error',
    });
  } catch {
    if (options.signal?.aborted) throw new Error('Abgebrochen.');
    if (timeout.aborted) throw new Error('Zeitüberschreitung beim Modellserver.');
    throw new Error('Modellserver nicht erreichbar. Adresse und Serverstatus prüfen.');
  }
  if (!response.ok) {
    await response.body?.cancel();
    // Do not expose echoed prompts, audio or credentials from server error bodies.
    if ([401, 403].includes(response.status)) throw new Error('API-Key wurde abgelehnt.');
    if (response.status === 429) throw new Error('Anfragelimit oder Guthaben erschöpft.');
    throw new Error(`Modellserver meldet HTTP ${response.status}.`);
  }
  try {
    const json = await response.json();
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('Invalid response');
    return json;
  } catch {
    if (options.signal?.aborted) throw new Error('Abgebrochen.');
    if (timeout.aborted) throw new Error('Zeitüberschreitung beim Modellserver.');
    throw new Error('Modellserver hat keine gültige JSON-Antwort geliefert.');
  }
}

export async function listModels(input, options) {
  const config = validateConfig(input, { requireModel: false });
  const json = await request(config, 'models', undefined, options);
  if (!Array.isArray(json.data)) throw new Error('Modellliste hat ein unbekanntes Format.');
  return [...new Set(json.data.map(item => item?.id).filter(id => typeof id === 'string' && id))];
}

export async function complete(input, instruction, text, options) {
  const config = validateConfig(input);
  const anthropic = config.provider === 'anthropic';
  const body = anthropic
    ? { model: config.model, max_tokens: 16000, system: instruction, messages: [{ role: 'user', content: text }] }
    : { model: config.model, messages: [{ role: 'system', content: instruction }, { role: 'user', content: text }], stream: false };
  const json = await request(config, anthropic ? 'messages' : 'chat/completions', body, options);
  if (json.stop_reason === 'refusal' || json.choices?.[0]?.message?.refusal)
    throw new Error('Modell hat die Anfrage abgelehnt.');
  const result = anthropic
    ? (Array.isArray(json.content) ? json.content.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('') : undefined)
    : json.choices?.[0]?.message?.content;
  if (typeof result !== 'string' || !result.trim()) throw new Error('Keine Textantwort vom Modell erhalten.');
  if (json.stop_reason === 'max_tokens' || json.choices?.[0]?.finish_reason === 'length')
    throw new Error('Modellantwort wurde abgeschnitten. Bitte Text kürzen oder Modell wechseln.');
  return result.trim();
}

export const testConnection = (config, options) => complete(config, 'Antworte nur mit OK.', 'Test', options);
