// Uniform notation for doses, intake schedules and vital signs in a medical dictation.
// The speech models already write numbers as digits ("5 mg", "2,5 mg"), but schedules come out as
// "100" or "1 0 1" and some units stay spelled out ("1,3 Milligramm pro Deziliter"). Only text right
// after a number is touched, so "Milligramm" in a sentence without a dose stays.

const number = String.raw`\d+(?:[.,]\d+)?`;
const units = [
  ['Milligramm', 'mg'], ['Mikrogramm', 'µg'], ['Nanogramm', 'ng'], ['Kilogramm', 'kg'], ['Gramm', 'g'],
  ['Milliliter', 'ml'], ['Millimol', 'mmol'], ['Mikromol', 'µmol'], ['internationale Einheiten', 'IE'],
  ['Millimeter Quecksilbersäule', 'mmHg'],
];
const per = [['Deziliter', 'dl'], ['Milliliter', 'ml'], ['Liter', 'l'], ['Kilogramm', 'kg'], ['Minute', 'min']];
// Spelling slips of the recognizer ("Dezilliter", "Dezilitr") count too.
const loose = word => word.replace(/l/g, 'l+').replace(/ä/g, '(?:ä|ae)').replace(/er$/, 'e?r');
const alternatives = list => list.map(([spoken]) => loose(spoken).replace(/ /g, String.raw`\s+`)).join('|');
const lookup = (list, spoken) => list.find(([word]) => new RegExp(`^${loose(word).replace(/ /g, String.raw`\s+`)}$`, 'iu').test(spoken))?.[1];

const written = ['mg', 'µg', 'ng', 'kg', 'g', 'ml', 'mmol', 'µmol', 'IE'];
const unitPattern = new RegExp(String.raw`(?<=(?:^|[^\p{L}\d])${number}\s+)(${alternatives(units)}|${written.join('|')})(?:\s+pro\s+(${alternatives(per)}))?(?![\p{L}])`, 'giu');
// "72 pro Minute" -> "72/min": only for minutes, "pro Tag" or "pro Woche" stay as words.
const perMinute = new RegExp(String.raw`(?<=(?:^|[^\p{L}\d]))(${number})\s+pro\s+Minute(?![\p{L}])`, 'giu');
// Intake schedule after a dose: "5 mg 100", "1000 mg 1 0 1", "50 µg 1-0-0-1".
const doseUnit = String.raw`(?:mg|µg|g|ml|IE|Einheiten|Tropfen|Hübe|Hub|Tabletten|Tablette|Kapseln|Kapsel|Stück)`;
const schedulePattern = new RegExp(String.raw`(?<=(?:^|[^\p{L}\d])${number}\s+${doseUnit}\s+)([0-4])[\s-]?([0-4])[\s-]?([0-4])(?:[\s-]?([0-4]))?(?![\d,.]?\d)(?!\s*(?:mg|µg|g|ml|IE|Stück|Stk|Tabletten|Tbl|Kapseln|Packung|Packungen|Tropfen)(?![\p{L}]))`, 'gu');
// "Blutdruck 135 zu 85" -> "Blutdruck 135/85".
const pressurePattern = new RegExp(String.raw`(?<=\b(?:Blutdruck|RR)(?:\s+(?:von|bei|beträgt|liegt\s+bei))?\s+)(\d{2,3})\s+(?:zu|über)\s+(\d{2,3})(?!\d)`, 'giu');

// "5mg" -> "5 mg", as Whisper sometimes writes it.
const gluedUnit = new RegExp(String.raw`(?<![\p{L}\d.,])(${number})(mg|µg|ng|kg|ml|mmol|µmol|IE)(?![\p{L}])`, 'gu');

export function formatDoses(input) {
  let text = String(input);
  const changes = [];
  const replace = (pattern, make) => {
    text = text.replace(pattern, (...match) => {
      const to = make(...match);
      if (to !== match[0]) changes.push({ from: match[0], to });
      return to;
    });
  };
  replace(gluedUnit, (all, value, unit) => `${value} ${unit}`);
  replace(unitPattern, (all, unit, denominator) => {
    const short = lookup(units, unit) ?? written.find(word => word.toLowerCase() === unit.toLowerCase()) ?? unit;
    return denominator ? `${short}/${lookup(per, denominator)}` : short;
  });
  replace(perMinute, (all, value) => `${value}/min`);
  // Four digits only with gaps ("1 0 1 0"): "5 mg 2023" may be a year.
  replace(schedulePattern, (all, ...digits) => {
    const parts = digits.slice(0, 4).filter(digit => digit !== undefined);
    return parts.length === 4 && /^\d{4}$/.test(all) ? all : parts.join('-');
  });
  replace(pressurePattern, (all, systolic, diastolic) => `${systolic}/${diastolic}`);
  return { text, changes };
}
