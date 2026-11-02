import {modes} from './modes.js';
import {modeForApp} from './app-modes.js';

// Keep only the canonical host, never a path, query, fragment or credentials.
export function websiteHost(input) {
  if (typeof input !== 'string' || !input.trim() || input.length > 8192 || /\s/.test(input.trim())) return null;
  try {
    const url = new URL(input.includes('://') ? input.trim() : `https://${input.trim()}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    let host = url.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    if (host.startsWith('[') && host.endsWith(']')) return host; // URL validated IPv6.
    if (host.length > 253 || (!host.includes('.') && host !== 'localhost') ||
        !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
    return host;
  } catch {return null;}
}

export function normalizeWebsiteModes(value = []) {
  if (!Array.isArray(value) || value.length > 200) throw new Error('Höchstens 200 Website-Regeln sind möglich.');
  const seen = new Set();
  return value.map(rule => {
    const host = websiteHost(rule?.host);
    if (!host || !Object.hasOwn(modes, rule?.mode))
      throw new Error('Website-Regeln: domain.de => verbatim, clean, calm oder emoji. HTTP(S)-Adressen ohne Zugangsdaten verwenden.');
    if (seen.has(host)) throw new Error(`Doppelte Website-Regel: ${host}`);
    seen.add(host); return {host, mode: rule.mode};
  });
}

export function parseWebsiteModes(text) {
  if (typeof text !== 'string' || text.length > 50000) throw new Error('Website-Regeln sind zu lang.');
  return normalizeWebsiteModes(text.split('\n').filter(line => line.trim()).map(line => {
    const match = /^\s*(.+?)\s*=>\s*(\w+)\s*$/.exec(line);
    if (!match) throw new Error('Website-Regeln: domain.de => verbatim, clean, calm oder emoji');
    return {host: match[1], mode: match[2]};
  }));
}

export function modeForContext(requested, {executable, host}, settings, available = () => true) {
  if (requested !== 'verbatim') return requested;
  host = websiteHost(host);
  let selected = null;
  if (host && Array.isArray(settings.websiteModes)) {
    for (const rule of settings.websiteModes) {
      if (typeof rule?.host !== 'string' || !Object.hasOwn(modes, rule.mode)) continue;
      const candidate = websiteHost(rule.host);
      if (candidate && (host === candidate || host.endsWith(`.${candidate}`)) &&
          (!selected || candidate.length > selected.host.length)) selected = {host: candidate, mode: rule.mode};
    }
  }
  if (selected && available(selected.mode)) return selected.mode;
  const appMode = modeForApp(requested, executable, settings.appModes);
  return available(appMode) ? appMode : requested;
}
