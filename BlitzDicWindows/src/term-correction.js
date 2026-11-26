// Conservative correction of near-miss technical terms in a local transcript.
// Speech models mostly miss rare terms by a letter or two ("Apexaban"); a word is
// only replaced when it is long, unknown and very close to exactly one listed term.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const correctionDefaults = Object.freeze({ threshold: 0.8, minLength: 7 });
// German inflection endings: "druckdolentes", "Pneumonien" and "Parese" are known forms.
const endings = ['ern', 'ens', 'en', 'er', 'es', 'em', 'e', 'n', 's'];
const letters = /\p{L}+/gu;
const fold = word => word.toLocaleLowerCase('de');
const addressed = /(?:^|[^\p{L}])(?:Frau|Herrn?|Familie|Fam\.|Dr\.|Prof\.|Mag\.|Ing\.|DI|DDr\.|Univ\.-Prof\.|OA|OÄ|Prim\.)\s+$/u;

// Lines starting with "!" protect a word: never changed, never the result of a correction.
export function parseLexicon(text) {
  const lines = text.split(/\r?\n/).map(line => line.replace(/#.*/, '').trim()).filter(Boolean);
  return { terms: lines.filter(line => !line.startsWith('!')), protect: lines.filter(line => line.startsWith('!')).map(line => line.slice(1).trim()) };
}

const lexiconFile = name => parseLexicon(readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8'));
let medical;
// The hand-made dictionary, and as background the list generated from ICD-10-GM, OPS, German MeSH
// and the EMA product data (scripts/build-medical-lexicon.py).
export const medicalLexicon = () => medical ??= (() => {
  const { terms, protect } = lexiconFile('./medical-terms-de.txt');
  return { terms, protect, background: lexiconFile('./medical-terms-de-generated.txt').terms };
})();

// Edit distance, or limit + 1 as soon as it must exceed limit. Rows are reused between calls.
let rows = [new Int32Array(64), new Int32Array(64)];
function distance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  if (b.length >= rows[0].length) rows = [new Int32Array(b.length + 1), new Int32Array(b.length + 1)];
  let [previous, current] = rows;
  for (let j = 0; j <= b.length; j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const letter = a.charCodeAt(i - 1);
    current[0] = i; let lowest = i;
    for (let j = 1; j <= b.length; j++) {
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (letter === b.charCodeAt(j - 1) ? 0 : 1));
      current[j] = value;
      if (value < lowest) lowest = value;
    }
    if (lowest > limit) return limit + 1;
    [previous, current] = [current, previous];
  }
  return previous[b.length];
}

// Sound of a word, after the Kölner Phonetik: letters that sound alike share a digit ("c"/"k", "c"/"z"
// before e and i, "t"/"d", "v"/"f", "ph"/"f"), "h" is silent and doubled sounds count once. Unlike the original, every
// vowel group stays as "0", so "Pantoprazul" and "Pantoprazol" sound alike, "druckdolente" and
// "druckdolent" do not.
const vowels = new Set('aeiouyäöüj');
export function soundKey(word) {
  const w = fold(word).replace(/ß/g, 's').replace(/[^a-zäöü]/g, '');
  let code = '';
  for (let i = 0; i < w.length; i++) {
    const c = w[i], before = w[i - 1] ?? '', after = w[i + 1] ?? '';
    let digit;
    if (vowels.has(c)) digit = '0';
    else if (c === 'h') continue;
    else if (c === 'b') digit = '1';
    else if (c === 'p') digit = after === 'h' ? '3' : '1';
    else if (c === 'd' || c === 't') digit = 'csz'.includes(after) && after ? '8' : '2';
    else if ('fvw'.includes(c)) digit = '3';
    else if ('gkq'.includes(c)) digit = '4';
    else if (c === 'c') digit = 'eiyäö'.includes(after || '-') || (before && 'sz'.includes(before)) ? '8' : '4';  // "Diclofenac" like "k"
    else if (c === 'x') digit = 'ckq'.includes(before) && before ? '8' : '48';
    else if (c === 'l') digit = '5';
    else if (c === 'm' || c === 'n') digit = '6';
    else if (c === 'r') digit = '7';
    else if (c === 's' || c === 'z') digit = '8';
    else continue;
    for (const d of digit) if (code.at(-1) !== d) code += d;
  }
  return code;
}

const letterPairs = key => {
  const pairs = new Set();
  for (let i = 1; i < key.length; i++) pairs.add(key.slice(i - 1, i + 1));
  return pairs;
};

// Background terms are corrected to like terms, but a large generated list also holds everyday
// words ("flimmern"): they do not stop two unknown words from being joined ("Vorhof flimmern").
export function createCorrector(terms, { protect = [], background = [], threshold = correctionDefaults.threshold, minLength = correctionDefaults.minLength, soundAlike = true } = {}) {
  const spelling = new Map(), known = new Set(), knownMain = new Set(), cache = new Map();
  const keys = [], byPair = new Map();  // letter pair -> indexes of listed terms containing it
  const bySound = new Map();  // sound key -> listed terms
  const target = new Set([...terms, ...background]), main = new Set([...terms, ...protect]);
  for (const term of [...terms, ...protect, ...background]) {
    for (const [word] of String(term).normalize('NFC').matchAll(letters)) {
      const key = fold(word);
      if (key.length < 3) continue;
      const sets = main.has(term) ? [known, knownMain] : [known];
      for (const set of sets) {
        set.add(key);
        for (const ending of endings) if (key.endsWith(ending) && key.length - ending.length >= 4) set.add(key.slice(0, -ending.length));
      }
      if (!target.has(term) || spelling.has(key)) continue;  // The first spelling wins, so own terms come first.
      spelling.set(key, word);
      const id = keys.push(key) - 1;
      for (const pair of letterPairs(key)) {
        if (!byPair.has(pair)) byPair.set(pair, []);
        byPair.get(pair).push(id);
      }
      if (soundAlike) {
        const sound = soundKey(key);
        if (!bySound.has(sound)) bySound.set(sound, []);
        bySound.get(sound).push(key);
      }
    }
  }
  const inSet = (set, key) => set.has(key) || endings.some(ending => key.endsWith(ending) && set.has(key.slice(0, -ending.length)));
  const isKnown = key => inSet(known, key), isKnownMain = key => inSet(knownMain, key);
  const shared = new Uint16Array(keys.length);

  // Closest listed term, or null when none is close enough or two are equally close.
  // One edit removes at most two letter pairs, so only terms sharing most pairs are compared in full;
  // for words of five letters and more, every close term shares at least one pair.
  // The last two letters must match, so the word form stays: "bronchoskopisch" never becomes
  // "Bronchoskopie", "lymphozytäre" never "Lymphozytose".
  // A misheard term that sounds the same ("Pantoprazul", "Metoprolohl", "Novalgen"): the ending may
  // differ here in a vowel or a silent "h". That can change a word form too ("Patientin" would become
  // "Patienten"), so correct words rely on the spelling guard in correctRecognized. The first letter (c, k and z count as
  // one) and three quarters of the letters must match, and the closest such term must be the only one.
  const initial = key => /^[ckz]/.test(key) ? 'k' : key[0];
  const soundsLike = key => {
    let best = null, tie = false;
    for (const candidate of bySound.get(soundKey(key)) ?? []) {
      if (initial(candidate) !== initial(key)) continue;
      const longest = Math.max(key.length, candidate.length), limit = Math.floor(longest / 4);
      const edits = distance(key, candidate, limit);
      if (edits > limit) continue;
      const score = 1 - edits / longest;
      if (!best || score > best.score) { best = { score, key: candidate }; tie = false; }
      else if (score === best.score) tie = true;
    }
    return tie ? null : best;
  };

  const closest = key => {
    if (cache.has(key)) return cache.get(key);
    const pairs = letterPairs(key), touched = [], tail = key.slice(-2);
    for (const pair of pairs) for (const id of byPair.get(pair) ?? []) if (shared[id]++ === 0) touched.push(id);
    let best = null, tie = false;
    for (const id of touched) {
      const count = shared[id], candidate = keys[id];
      shared[id] = 0;
      if (!candidate.endsWith(tail)) continue;
      const longest = Math.max(key.length, candidate.length), limit = Math.floor(longest * (1 - threshold) + 1e-9);
      if (count < pairs.size - 2 * limit) continue;
      const edits = distance(key, candidate, limit);
      if (edits > limit) continue;
      const score = 1 - edits / longest;
      if (!best || score > best.score) { best = { score, key: candidate }; tie = false; }
      else if (score === best.score && candidate !== best.key) tie = true;
    }
    const result = (tie ? null : best) ?? soundsLike(key);
    if (cache.size > 50000) cache.clear();
    cache.set(key, result);
    return result;
  };

  // The whole word only: setting an ending aside turned "Depression" into "Depressivn".
  // Listed spelling; a lower-case term (adjective) is capitalized at the start of a sentence only.
  const suggest = (word, sentenceStart, joined = false) => {
    const key = fold(word);
    if (key.length < minLength || (!joined && isKnown(key)) || /\p{Lu}.*\p{Lu}/u.test(word)) return null;
    const best = closest(key);
    if (!best) return null;
    let term = spelling.get(best.key);
    if (sentenceStart && /^\p{Ll}/u.test(term)) term = term[0].toLocaleUpperCase('de') + term.slice(1);
    return { score: best.score, text: term };
  };

  return {
    // allow({ words, score }) may veto a proposed change, for example after a spelling check.
    correct(input, allow = () => true) {
      const text = String(input).normalize('NFC');
      const words = [...text.matchAll(letters)], changes = [];
      let output = '', position = 0;
      for (let index = 0; index < words.length; index++) {
        const word = words[index][0], start = words[index].index, next = words[index + 1], options = [];
        // A name after a form of address or a title stays as dictated ("Frau Kometter", "Dr. Mairhofer").
        if (/\p{Lu}/u.test(word[0]) && addressed.test(text.slice(Math.max(0, start - 24), start))) continue;
        const sentenceStart = /^\p{Lu}/u.test(word) && /(?:^|[.!?\n])[\s"„»(]*$/u.test(text.slice(Math.max(0, start - 8), start));
        const single = suggest(word, sentenceStart);
        if (single) options.push({ ...single, end: start + word.length, words: [word] });
        // A compound split by the recognizer ("Vorhof flimmern"): two unknown words, never a known one
        // plus its neighbor, and only when the joined word is nearly exact.
        if (next && word.length >= 5 && next[0].length >= 3 && text.slice(start + word.length, next.index) === ' ' &&
            !isKnownMain(fold(word)) && !isKnownMain(fold(next[0]))) {
          const joined = suggest(word + fold(next[0]), sentenceStart, true);
          if (joined && joined.score >= 0.9) options.push({ ...joined, end: next.index + next[0].length, words: [word, next[0]] });
        }
        options.sort((a, b) => b.score - a.score || a.words.length - b.words.length);
        const chosen = options.find(option => option.text !== text.slice(start, option.end) && allow({ words: option.words, score: option.score }));
        if (!chosen) continue;
        changes.push({ from: text.slice(start, chosen.end), to: chosen.text });
        output += text.slice(position, start) + chosen.text;
        position = chosen.end;
        if (chosen.words.length === 2) index++;
      }
      return { text: output + text.slice(position), changes };
    },
  };
}

let memo = { key: null, corrector: null };
// Own terms always; the medical dictionary only for "Medizinisches Deutsch".
export function termCorrector(settings) {
  if (settings?.termCorrection === false) return null;
  const own = (settings?.modeSettings?.customTerms ?? []).filter(term => typeof term === 'string' && term.trim());
  const withMedical = settings?.speech?.language === 'de-medical';
  if (!own.length && !withMedical) return null;
  const key = JSON.stringify([withMedical, own]);
  if (memo.key !== key) {
    const lexicon = withMedical ? medicalLexicon() : { terms: [], protect: [], background: [] };
    memo = { key, corrector: createCorrector([...own, ...lexicon.terms], { protect: lexicon.protect, background: lexicon.background }) };
  }
  return memo.corrector;
}

// Spelling guard: a word is only replaced when the Windows spell checker also reports it as
// misspelled, so a correct word next to a listed term ("Infektion" next to "Inspektion") stays.
// Two correctly spelled words are joined only into exactly a listed term ("Vorhof flimmern").
// Without a spell checker nothing is changed: correctionSkipped tells the caller.
export async function correctRecognized(recognized, settings, { misspelled } = {}) {
  const unchanged = { ...recognized, corrections: [] };
  const corrector = termCorrector(settings);
  if (!corrector) return unchanged;
  const segments = Array.isArray(recognized.segments) ? recognized.segments : null;
  const texts = [recognized.text, ...(segments ?? []).map(segment => segment?.text).filter(text => typeof text === 'string')];
  const proposed = new Set();
  for (const text of texts) corrector.correct(text, ({ words }) => { for (const word of words) proposed.add(word); return false; });
  if (!proposed.size) return unchanged;
  let wrong = null;
  try {
    const result = misspelled ? await misspelled([...proposed], settings?.speech?.language === 'en' ? 'en' : 'de') : null;
    if (Array.isArray(result)) wrong = new Set(result);
  } catch {}
  if (!wrong) return { ...unchanged, correctionSkipped: true };
  const allow = ({ words, score }) => words.some(word => wrong.has(word)) || (words.length === 2 && score === 1);
  const { text, changes } = corrector.correct(recognized.text, allow);
  return {
    ...recognized, text, corrections: changes,
    segments: segments ? segments.map(segment => typeof segment?.text === 'string' ? { ...segment, text: corrector.correct(segment.text, allow).text } : segment) : recognized.segments,
  };
}
