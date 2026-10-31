import { modes } from './modes.js';

export function parseAppModes(text) {
  const rules = [], seen = new Set();
  for (const line of text.split('\n').filter(line => line.trim())) {
    const match = /^\s*([^\\/:*?"<>|=]+\.exe)\s*=>\s*(\w+)\s*$/i.exec(line);
    if (!match || !Object.hasOwn(modes, match[2]))
      throw new Error('Programmregeln: programm.exe => verbatim, clean, calm oder emoji');
    const executable = match[1].trim().toLowerCase();
    if (seen.has(executable)) throw new Error(`Doppelte Programmregel: ${executable}`);
    seen.add(executable); rules.push({ executable, mode: match[2] });
  }
  return rules;
}

// Explicit mode shortcuts retain their chosen mode. Only the default dictation
// shortcut uses the foreground application's saved preference.
export function modeForApp(requested, executable, rules = []) {
  if (requested !== 'verbatim' || typeof executable !== 'string') return requested;
  const rule = rules.find(rule => rule.executable?.toLowerCase() === executable.toLowerCase());
  return rule && Object.hasOwn(modes, rule.mode) ? rule.mode : requested;
}
