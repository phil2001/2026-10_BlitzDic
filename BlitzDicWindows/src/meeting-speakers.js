export const speakerSectionHeading = 'Aufnahmeabschnitt (Sprecherkennungen gelten nur hier):';
const speakerLine = /^Sprecher ((?:[1-9]|1\d|20)(?: \/ (?:[1-9]|1\d|20))*)( \(überlappend\))?:[ \t]?/u;
const key = (section, speaker) => `${section}:${speaker}`;

function lines(source, visit) {
  let section = 0;
  // Preserve line endings and every utterance character, including quoted labels.
  return source.replace(/[^\r\n]+/gu, line => {
    if (line === speakerSectionHeading) section++;
    const match = line.match(speakerLine);
    return match ? visit(line, match, section) : line;
  });
}

export function meetingSpeakers(source) {
  if (typeof source !== 'string' || source.length > 500000) throw new Error('Ungültiges Meeting-Transkript.');
  const found = new Map();
  lines(source, (_line, match, section) => {
    for (const value of match[1].split(' / ')) {
      const speaker = Number(value);
      found.set(key(section, speaker), {section, speaker});
    }
    return _line;
  });
  return [...found.values()];
}

export function normalizeSpeakerNames(source, names = []) {
  const available = new Set(meetingSpeakers(source).map(slot => key(slot.section, slot.speaker)));
  if (!Array.isArray(names) || names.length > available.size) throw new Error('Ungültige Sprecherzuordnung.');
  const seen = new Set();
  return names.map(item => {
    if (!item || !Number.isInteger(item.section) || !Number.isInteger(item.speaker) ||
        !available.has(key(item.section, item.speaker)) || typeof item.name !== 'string')
      throw new Error('Sprecherzuordnung passt nicht zum Transkript.');
    const identity = key(item.section, item.speaker);
    if (seen.has(identity)) throw new Error('Ein Sprecher darf pro Abschnitt nur einen Namen haben.');
    seen.add(identity);
    const name = item.name.trim();
    if (!name || name.length > 80 || /[\p{Cc}:\/]/u.test(item.name))
      throw new Error('Sprechername: 1 bis 80 Zeichen, ohne Zeilenumbrüche, Steuerzeichen, Doppelpunkt oder Schrägstrich.');
    return {section: item.section, speaker: item.speaker, name};
  });
}

export function namedMeetingTranscript(source, names = []) {
  const aliases = new Map(normalizeSpeakerNames(source, names).map(item => [key(item.section, item.speaker), item.name]));
  const result = lines(source, (line, match, section) => {
    const ids = match[1].split(' / ').map(Number);
    if (!ids.some(speaker => aliases.has(key(section, speaker)))) return line;
    const label = ids.map(speaker => aliases.get(key(section, speaker)) ?? `Sprecher ${speaker}`).join(' / ');
    // Change the label only, never identical words inside the utterance.
    return `${label}${match[2] ?? ''}:` + match[0].slice(match[0].indexOf(':') + 1) + line.slice(match[0].length);
  });
  if (result.length > 500000) throw new Error('Transkript mit Sprechernamen überschreitet 500.000 Zeichen.');
  return result;
}
