import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve, dirname, sep} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(process.argv[2] || '');
if (!output.toLowerCase().startsWith(resolve(root, 'build').toLowerCase() + sep))
  throw new Error('Installer license output must stay in the project build directory.');
const native = resolve(root, 'licenses/native/microsoft-vc14');
const provenance = JSON.parse(await readFile(resolve(native, 'provenance.json'), 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
for (const [file, expected] of [
  [provenance.sourceDocument, provenance.sourceDocumentSha256],
  [provenance.textFile, provenance.textSha256],
]) {
  const path = resolve(native, file);
  if (!path.startsWith(native + sep) || hash(await readFile(path)) !== expected)
    throw new Error(`Microsoft runtime license provenance mismatch: ${file}`);
}
const mit = await readFile(resolve(root, '../LICENSE'), 'utf8');
const runtime = await readFile(resolve(native, provenance.textFile), 'utf8');
const introduction = `BlitzDic: Lizenzbedingungen / License terms

Der eigene BlitzDic-Quellcode steht unter der MIT-Lizenz in Abschnitt 1.
Die Microsoft-Bedingungen in Abschnitt 2 gelten ausschließlich für die
enthaltenen Microsoft-Visual-C++-Laufzeitdateien. Sie ändern die MIT-Lizenz
des BlitzDic-Codes und die Lizenzen anderer Komponenten nicht.
Die jeweiligen Modell- und Drittanbieterlizenzen liegen im Lizenzordner der App.
Der vollständige Originaltext von Microsoft ist dort auch als DOCX enthalten.
Mit der Zustimmung im Setup akzeptieren Sie die für diese Komponenten geltenden
nachstehenden Bedingungen. Die Microsoft-Weitergaberechte des Herausgebers
ergeben sich gesondert aus dessen Visual-Studio-Lizenz.

1. BLITZDIC — MIT LICENSE

`;
const text = '\ufeff' + introduction + mit.trim() +
  '\n\n2. MICROSOFT VISUAL C++ V14 REDISTRIBUTABLE AND RUNTIME\n\n' + runtime;
await writeFile(output, text, {encoding: 'utf8', flag: 'wx'});
await writeFile(resolve(dirname(output), 'Installer-license-provenance.json'),
  JSON.stringify({file: 'Installer-LICENSE.txt', sha256: hash(Buffer.from(text)),
    microsoftSourceURL: provenance.sourceURL,
    microsoftOriginalSha256: provenance.sourceDocumentSha256,
    microsoftTextSha256: provenance.textSha256,
    blitzDicMitSha256: hash(Buffer.from(mit))}, null, 2) + '\n', {flag: 'wx'});
console.log('Verified Microsoft original/text hashes and generated scoped installer license.');
