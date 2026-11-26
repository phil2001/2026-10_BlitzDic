"""Builds src/medical-terms-de-generated.txt, the extended dictionary of the term correction.

Usage: python scripts/build-medical-lexicon.py <folder with the source data> [--report]

The source data is downloaded by hand and is not part of the repository:
  icd10gm2026syst-ueberl_*/Klassifikationsdateien/icd10gm2026syst.txt   (BfArM, ICD-10-GM 2026)
  ops2027syst_meta/Klassifikationsdateien/ops2027syst_kodes.txt         (BfArM, OPS 2027)
  German_MeSH_2026.csv                                                   (ZB MED, German MeSH, CC BY 4.0)
  article-57-product-data_en.xlsx                                        (EMA, Article 57 product data)

Only single words of at least seven letters are kept: the correction never touches shorter words.
English words from MeSH synonyms ("Mixture") and words only MeSH lists that Windows already knows
("Planeten") are left out; see unwanted(). The script therefore runs on Windows with German
spelling (speech/blitzdic-uia.exe, see build-uia.ps1).
From the EMA data only products authorised in Austria or for the whole EU are used, without homeopathic potencies
and without company names. Substances are named in English there ("Amlodipine"); a German
form ("Amlodipin") is only taken when another source spells it the same way.
"""
import csv
import glob
import os
import re
import sys
from collections import Counter, defaultdict

MIN_LENGTH = 7
WORD = re.compile(r"[^\W\d_]+(?:-[^\W\d_]+)*")
LETTERS = re.compile(r"[^\W\d_]+")
HEADER = """\
# Erweitertes medizinisches Wörterbuch für die Nachkorrektur (Diktatsprache "Medizinisches Deutsch").
# Automatisch erzeugt mit scripts/build-medical-lexicon.py; nicht von Hand ändern.
# Begriffe aus medical-terms-de.txt und eigene Begriffe aus den Einstellungen haben Vorrang.
#
# Quellen (einzelne Wörter, keine Kodes, Gliederung oder Texte der Werke):
# - ICD-10-GM Version 2026 und OPS Version 2027, Systematische Verzeichnisse, herausgegeben vom
#   Bundesinstitut für Arzneimittel und Medizinprodukte (BfArM) im Auftrag des Bundesministeriums
#   für Gesundheit unter Beteiligung der Arbeitsgruppe ICD des Kuratoriums für Fragen der
#   Klassifikation im Gesundheitswesen (KKG). ICD-10-GM beruht auf der ICD-10 der WHO
#   (© Weltgesundheitsorganisation 1992) und der ICD-10-AM (© Commonwealth of Australia 1998).
# - Deutscher MeSH 2026, © ZB MED – Informationszentrum Lebenswissenschaften, Lizenz CC BY 4.0
#   (https://creativecommons.org/licenses/by/4.0/); nur die deutschen Bezeichnungen, als Wortliste.
# - Article 57 product data (Stand 05.11.2026), © European Medicines Agency; in Österreich
#   und EU-weit zugelassene Arzneimittel, nur Produktnamen und Wirkstoffe als Wortliste.
"""

SALTS = {'hydrochloride', 'sodium', 'potassium', 'calcium', 'magnesium', 'monohydrate', 'dihydrate',
         'trihydrate', 'hemihydrate', 'anhydrous', 'maleate', 'besilate', 'besylate', 'mesilate',
         'tartrate', 'succinate', 'fumarate', 'citrate', 'sulfate', 'phosphate', 'acetate', 'bromide',
         'hydrobromide', 'dipropionate', 'propionate', 'valerate', 'hyclate', 'tosilate', 'medoxomil'}
GERMAN_ENDINGS = [('ine', 'in'), ('ide', 'id'), ('ate', 'at'), ('one', 'on'), ('ole', 'ol'), ('ene', 'en'),
                  ('yde', 'yd'), ('ase', 'ase'), ('', '')]
# International nonproprietary names with these endings are taken without a second source.
INN = re.compile(r'(vir|mab|nib|tid|pril|sartan|olol|alol|azol|cillin|mycin|micin|oxacin|statin|parin|prost|setron|'
                 r'azepam|olam|dipin|cept|xaban|gatran|gliptin|gliflozin|fungin|tidin|prazol|tropin|relin|pressin|cain|'
                 r'triptan|profen|fenac|cyclin|conazol|retin|fentanil|olon|dronat|lukast|semid|thiazid|platin|rubicin|'
                 r'mustin|trexat|sone|setan|lizumab|ximab|tinib|ciclib|lisib|parib|denib|navir|buvir|previr|asvir|'
                 r'tegravir|ciclovir|terol|teren|zosin|tiazem|amil|oxetin|pramin|triptylin|apin|idon|peridol|'
                 r'barbital|zepin|cyclovir|floxacin|penem|cefalin|kinase|plase|semid|gutid|glutid|natid|lutid|'
                 r'formin|glinid|glitazon|clidin|tropium|onium|curonium|metason|nisolon|sonid|cortolon)$')
POTENCY = re.compile(r'\b[DC]\d+\b|mother tincture|\bdil\.|glückselig|\bspag\.|\bsicc\.|\btrit\.', re.I)


def words(text):
    """Words of a text with a flag telling whether they start a sentence-like unit."""
    for match in WORD.finditer(text):
        before = text[:match.start()].rstrip(' "„(')
        yield match.group(), (not before or before[-1] in '.:;!?')


class Collector:
    def __init__(self):
        self.forms = defaultdict(Counter)   # lower-case word -> spellings, weighted
        self.sources = defaultdict(set)
        self.german = set()    # Words seen in a German-only context
        self.english = set()   # Words of the English MeSH texts

    def add(self, text, source, initial_weight=0.1, german=True):
        for word, initial in words(text):
            for part in LETTERS.findall(word):
                if len(part) < MIN_LENGTH:
                    continue
                key = part.lower()
                self.forms[key][part] += initial_weight if initial and part[0].isupper() else 1
                self.sources[key].add(source)
                if german:
                    self.german.add(key)

    def spelling(self, key):
        return self.forms[key].most_common(1)[0][0]


def read_lines(path):
    data = open(path, 'rb').read()
    for encoding in ('utf-8', 'cp1252'):
        try:
            return data.decode(encoding).splitlines()
        except UnicodeDecodeError:
            pass
    raise ValueError(path)


def icd(collector, root):
    path = glob.glob(os.path.join(root, 'icd10gm*syst*', 'Klassifikationsdateien', 'icd10gm2026syst.txt'))[0]
    for line in read_lines(path):
        code, _, text = line.partition(';')
        if code != 'UNDEF':
            collector.add(text, 'icd')


def ops(collector, root):
    path = glob.glob(os.path.join(root, 'ops*syst*', 'Klassifikationsdateien', 'ops*syst_kodes.txt'))[0]
    for line in read_lines(path):
        fields = line.split(';')
        for text in fields[10:13]:   # Titles of the levels; field 8 repeats them joined with ":".
            collector.add(text, 'ops')


def mesh(collector, root):
    lines = read_lines(os.path.join(root, 'German_MeSH_2026.csv'))
    for line in lines[1:]:
        line = line.rstrip(';')
        if line.startswith('"') and line.endswith('"'):
            line = line[1:-1].replace('""', '"')
        row = next(csv.reader([line]))
        if len(row) < 3 or '[' in row[2]:
            continue   # "[Dokumenttyp]" and similar publication labels
        english, german = row[1].strip(), row[2].strip()
        complete = len(row) == 10   # Longer rows have unquoted commas; their columns are uncertain.
        for text in [english] + (row[5:7] if complete else []):
            collector.english.update(word.lower() for word in LETTERS.findall(text))
        if german == english and ' ' in german:
            continue   # Untranslated English phrases ("Community-Based Participatory Research")
        # Inverted headings ("Epilepsie, Reflex-") are not sentences: no capital at a comma.
        # A translated or single-word label is German; synonyms may be English ("Functional Food").
        collector.add(german.replace(', ', ' '), 'mesh')
        for text in row[7].split(' | ') if complete else []:
            collector.add(text.replace(', ', ' '), 'mesh', german=False)


def ema(collector, root):
    from openpyxl import load_workbook   # Only needed here.
    sheet = load_workbook(os.path.join(root, 'article-57-product-data_en.xlsx'), read_only=True).worksheets[0]
    companies, substances = set(), set()
    for row in sheet.iter_rows(values_only=True):
        name, substance, _, country, holder = (row + (None,) * 5)[:5]
        if country not in ('Austria', 'European Union') or not name or not substance:
            continue
        if POTENCY.search(str(substance)):
            continue
        companies.update(part.lower() for part in LETTERS.findall(str(holder or '')))
        collector.add(str(name), 'ema-name', initial_weight=1)
        for item in re.split(r'\s*[|,]\s*', str(substance)):
            parts = item.split()
            if parts and all(part.lower() in SALTS for part in parts[1:]):
                substances.add(parts[0])
    # Company names are no medical terms ("Hameln", "Aptapharma").
    for key in list(collector.forms):
        if key in companies and collector.sources[key] == {'ema-name'}:
            del collector.forms[key], collector.sources[key]
    return substances


def german_substances(collector, substances):
    taken, missing = [], []
    for substance in sorted(substances):
        if len(substance) < MIN_LENGTH or not substance.isalpha():
            continue
        lower = substance.lower()
        candidates = [lower[:len(lower) - len(end)] + german for end, german in GERMAN_ENDINGS if lower.endswith(end)]
        confirmed = next((c for c in candidates if c in collector.forms and collector.sources[c] - {'ema-substance'}), None)
        if not confirmed:
            confirmed = next((c for c in candidates if INN.search(c)), None)
            if confirmed:
                collector.forms[confirmed][confirmed.capitalize()] += 1
        if confirmed:
            collector.sources[confirmed].add('ema-substance')
            taken.append(confirmed)
        else:
            missing.append(substance)
    return taken, missing


ADJECTIVE = re.compile(r'(isch|lich|ig|iv|är|al|ell|ös|ent|ant|end|ierend|iert|haft|bar|los|frei|artig|förmig|'
                       r'abhängig|bedingt|assoziiert|induziert|spezifisch|ähnlich)(e|en|er|es|em)?$')


def clean(collector, protected):
    keys = set(collector.forms)
    result = {}
    for key in keys:
        spelling = collector.spelling(key)
        # Seen only at the start of a title: an adjective is written in lower case ("Bariatrisch").
        if spelling[0].isupper() and all(form[0].isupper() for form in collector.forms[key])                 and max(collector.forms[key].values()) < 1 and ADJECTIVE.search(key):
            spelling = spelling[0].lower() + spelling[1:]
        if re.search(r'[A-ZÄÖÜ].*[A-ZÄÖÜ]', spelling):
            continue   # The correction never changes words with two capitals.
        if key in protected:
            continue
        # Old spelling and transliterations stay out when the current spelling is listed.
        if 'ß' in key and key.replace('ß', 'ss') in keys:
            continue
        if re.search(r'ae|oe|ue', key):
            umlauts = re.sub('ae', 'ä', re.sub('oe', 'ö', re.sub('ue', 'ü', key)))
            if umlauts != key and umlauts in keys:
                continue
        result[key] = spelling
    return result


def misspelled(words, helper):
    """Words the German Windows spell checker rejects."""
    import json
    import subprocess
    process = subprocess.Popen([helper, '--spell-service'], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               encoding='utf-8')
    result = set()
    try:
        for start in range(0, len(words), 500):
            process.stdin.write(json.dumps({'language': 'de', 'words': words[start:start + 500]}) + '\n')
            process.stdin.flush()
            answer = json.loads(process.stdout.readline())
            if 'error' in answer:
                raise RuntimeError(f'Rechtschreibprüfung: {answer["error"]}')
            result.update(answer['misspelled'])
    finally:
        process.stdin.close()
        process.wait(10)
    return result


def unwanted(collector, new, helper):
    """Words left out after asking the German Windows spell checker.

    - English words: rejected and in the English MeSH texts ("Mixture"), unless a German-only
      source (ICD, OPS, Austrian products, a translated MeSH heading) has them. Translated MeSH
      headings still carry English words ("Cell Sorting"), so a word only MeSH lists counts as
      English as soon as the English texts have it. Drug names spelled alike in both languages stay.
    - Words only MeSH lists that Windows knows ("Reserve", "Planeten"): MeSH reaches far beyond
      medicine, and a known word is no rare term the recognizer would miss.
    """
    rejected = misspelled(sorted(new.values()), helper)
    english, known = set(), set()
    for key, spelling in new.items():
        mesh_only = collector.sources[key] == {'mesh'}
        if spelling in rejected:
            if key in collector.english and (mesh_only or key not in collector.german) and not INN.search(key):
                english.add(key)
        elif mesh_only:
            known.add(key)
    return english, known


def main():
    root = sys.argv[1]
    here = os.path.dirname(os.path.abspath(__file__))
    handmade = os.path.join(here, '..', 'src', 'medical-terms-de.txt')
    target = os.path.join(here, '..', 'src', 'medical-terms-de-generated.txt')
    listed, protected = set(), set()
    for line in open(handmade, encoding='utf-8'):
        line = line.split('#')[0].strip()
        if line.startswith('!'):
            protected.update(part.lower() for part in LETTERS.findall(line[1:]))
        elif line:
            listed.update(part.lower() for part in LETTERS.findall(line))
    collector = Collector()
    icd(collector, root)
    ops(collector, root)
    mesh(collector, root)
    substances = ema(collector, root)
    taken, missing = german_substances(collector, substances)
    terms = clean(collector, protected)
    new = {key: spelling for key, spelling in terms.items() if key not in listed}
    english, known = unwanted(collector, new, os.path.join(here, '..', 'speech', 'blitzdic-uia.exe'))
    new = {key: spelling for key, spelling in new.items() if key not in english and key not in known}
    print(f'Ausgelassen: {len(english)} englische Wörter, {len(known)} bekannte Wörter nur aus MeSH.')
    with open(target, 'w', encoding='utf-8', newline='\n') as output:
        output.write(HEADER + '\n')
        for key in sorted(new, key=lambda k: (k, new[k])):
            output.write(new[key] + '\n')
    per_source = Counter(source for key in new for source in collector.sources[key])
    print(f'{len(new)} Begriffe geschrieben.')
    print('Je Quelle:', dict(sorted(per_source.items())))
    print(f'EMA-Wirkstoffe: {len(taken)} mit deutscher Schreibung bestätigt, {len(missing)} ohne Bestätigung ausgelassen.')
    if '--sources' in sys.argv:   # Word and its sources, for comparing dictionaries.
        with open(sys.argv[sys.argv.index('--sources') + 1], 'w', encoding='utf-8', newline='\n') as output:
            for key in sorted(new):
                output.write(f"{new[key]}\t{','.join(sorted(collector.sources[key]))}\n")
    if '--report' in sys.argv:
        print('Ausgelassen, z. B.:', ', '.join(missing[:60]))


if __name__ == '__main__':
    main()
