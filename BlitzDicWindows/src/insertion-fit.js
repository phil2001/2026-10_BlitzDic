// Port of BlitztextMac/Services/InsertionFitter.swift (MIT).
// Only dictation edges change; context stays local to insertion, never the LLM.
const functionWords = new Set(`aber als also am an auch auf aus außerdem bei bin bis bitte
da dabei dafür damit danach dann darum das dass dein deine dem den denn der des deshalb
die dies diese diesem diesen dieser dieses doch du durch eigentlich ein eine einem einen
einer eines er es etwa falls für gegen gerade gern gerne heute hier ich im in ins ist ja
jetzt kein keine man mein meine mit nach natürlich nicht noch nun nur ob oder ohne schon
sehr sind so sonst sowie statt trotzdem um und uns unser unsere unter vielleicht vom von
vor war was weil wenn wer wie wir wo zu zum zur zwar
a about after also and are as at be because but by for from if is it its just maybe my
not of on or our than that the then there these they this those to we what when where
which while who with you your`.split(/\s+/));

export function fitInsertion(text, before = '', after = '') {
  // Older/unsupported capture adapters can omit context: retain exact text.
  if (typeof before !== 'string' || typeof after !== 'string') return text;
  let result = text.trim();
  if (!result) return text;
  const previous = [...before].at(-1);
  const trimmed = before.replace(/[ \t\u00a0]+$/u, '');
  const last = [...trimmed].at(-1);
  const first = [...result][0];
  if ((!last || /[\r\n.!?…\u2028\u2029]/u.test(last)) && /\p{Ll}/u.test(first)) {
    result = first.toUpperCase() + result.slice(first.length);
  } else if (last && /[\p{L}\p{N},;\-–]/u.test(last)) {
    const word = result.match(/^\p{L}+/u)?.[0] ?? '';
    if (/^\p{Lu}\p{Ll}*$/u.test(word) && functionWords.has(word.toLowerCase()))
      result = result[0].toLowerCase() + result.slice(1);
  }
  if (previous && !/\s/u.test(previous) && !/^[,.;:!?)\]}…]/u.test(result) &&
      !'([{„‚@#_'.includes(previous)) {
    const preceding = [...before].at(-2);
    const alone = !preceding || /\s/u.test(preceding) || '([{'.includes(preceding);
    if ('-/–'.includes(previous) ? alone : !('"\'“‘«»'.includes(previous) && alone))
      result = ' ' + result;
  }
  const next = [...after][0];
  if (next) {
    if (result.endsWith('.') && ('.,;:!?'.includes(next) ||
        (/^[ \t]*\p{Ll}/u.test(after) && /\p{L}{4,}\.$/u.test(result))))
      result = result.slice(0, -1);
    if (/[\p{L}\p{N}„(]/u.test(next)) result += ' ';
  }
  return result;
}
