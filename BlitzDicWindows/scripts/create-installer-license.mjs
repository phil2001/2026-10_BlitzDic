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
const sdkRoot = resolve(root, 'licenses/native/windows-sdk-10.0.28000.2270');
const sdkOrigin = JSON.parse(await readFile(resolve(sdkRoot, 'provenance.json'), 'utf8'));
for (const item of sdkOrigin.files) {
  const path = resolve(sdkRoot, item.path);
  if (!path.startsWith(sdkRoot + sep) || hash(await readFile(path)) !== item.sha256)
    throw new Error(`Windows SDK license provenance mismatch: ${item.path}`);
}
if (hash(await readFile(resolve(root, 'node_modules/electron/dist', sdkOrigin.dllName))) !== sdkOrigin.dllSha256)
  throw new Error('The Electron D3D file differs from the recorded Microsoft SDK redistributable.');
const sdkTerms = await readFile(resolve(sdkRoot, sdkOrigin.textFile), 'utf8');
const introduction = `BlitzDic: Lizenzbedingungen / License terms

Der eigene BlitzDic-Quellcode steht unter der MIT-Lizenz in Abschnitt 1.
Die Microsoft-Bedingungen in Abschnitt 2 gelten ausschließlich für die
enthaltenen Microsoft-Visual-C++-Laufzeitdateien. Abschnitt 3 enthält die
Windows-SDK-Bedingungen für die enthaltene Microsoft-Datei d3dcompiler_47.dll.
Die MIT-Lizenz des BlitzDic-Codes und die Lizenzen anderer Komponenten bleiben
in ihrem jeweiligen Geltungsbereich bestehen.
Die jeweiligen Modell- und Drittanbieterlizenzen liegen im Lizenzordner der App.
Die Microsoft-Originaltexte liegen dort zusätzlich als DOCX beziehungsweise RTF.
Mit der Zustimmung im Setup akzeptieren Sie die für diese Komponenten geltenden
nachstehenden Bedingungen. Für die Weitergabe gelten außerdem die jeweiligen
Microsoft-Bedingungen für den Herausgeber.

1. BLITZDIC — MIT LICENSE

`;
const text = '\ufeff' + introduction + mit.trim() +
  '\n\n2. MICROSOFT VISUAL C++ V14 REDISTRIBUTABLE AND RUNTIME\n\n' + runtime +
  '\n\n3. MICROSOFT WINDOWS SDK — D3DCOMPILER_47.DLL\n\n' + sdkTerms;
await writeFile(output, text, {encoding: 'utf8', flag: 'wx'});
await writeFile(resolve(dirname(output), 'Installer-license-provenance.json'),
  JSON.stringify({file: 'Installer-LICENSE.txt', sha256: hash(Buffer.from(text)),
    microsoftSourceURL: provenance.sourceURL,
    microsoftOriginalSha256: provenance.sourceDocumentSha256,
    microsoftTextSha256: provenance.textSha256,
    windowsSdkSourceURL: sdkOrigin.licenseURL,
    windowsSdkOriginalSha256: sdkOrigin.originalLicenseSha256,
    windowsSdkTextSha256: sdkOrigin.textSha256,
    windowsSdkDllSha256: sdkOrigin.dllSha256,
    blitzDicMitSha256: hash(Buffer.from(mit))}, null, 2) + '\n', {flag: 'wx'});
console.log('Verified Microsoft runtime/SDK originals, D3D provenance and scoped installer license.');
