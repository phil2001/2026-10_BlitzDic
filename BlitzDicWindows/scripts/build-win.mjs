import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`;
const buildRoot = `build/${id}`, output = `dist/windows-${id}`;
const speechOutput = `dist/speech-${id}`;
const python = resolve(root, '.runtime/venv/Scripts/python.exe');
async function run(command, args) {
  await new Promise((accept, reject) => {
    const child = spawn(command, args, {cwd: root, stdio: 'inherit', windowsHide: true, shell: false});
    child.on('error', reject);
    child.on('exit', code => code === 0 ? accept() : reject(new Error(`${command} failed (${code})`)));
  });
}
for (const file of ['models/whisper/model.bin', 'models/parakeet-ultra/encoder-model.int8.onnx',
  'models/parakeet-ultra/decoder_joint-model.int8.onnx']) await access(resolve(root, file));
await mkdir(resolve(root, buildRoot), {recursive: true});
console.log(`Build: ${id}\nInstaller output: ${output}`);
await run(python, ['scripts/setup-diarization.py', '--verify-only']);
await run(python, ['scripts/collect-licenses.py', `${buildRoot}/licenses`]);
await run(python, ['scripts/native-inventory.py', `${buildRoot}/licenses/native-binaries.json`]);
await run(`${process.env.SystemRoot}/System32/WindowsPowerShell/v1.0/powershell.exe`,
  ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/build-speech.ps1',
    '-OutputDirectory', speechOutput, '-WorkDirectory', `${buildRoot}/speech`]);
await run(python, ['scripts/map-native-package.py', `${buildRoot}/licenses/native-binaries.json`,
  `${speechOutput}/blitzdic-speech`, `${buildRoot}/licenses/native-package-map.json`]);
let config = await readFile(resolve(root, 'electron-builder.yml'), 'utf8');
config = config.replace('output: dist/windows', `output: ${output}`)
  .replace('from: dist/speech/blitzdic-speech', `from: ${speechOutput}/blitzdic-speech`)
  .replace('extraResources:', `extraResources:\n  - from: ${buildRoot}/licenses\n    to: licenses/dependencies`);
const configFile = `${buildRoot}/electron-builder.yml`;
await writeFile(resolve(root, configFile), config);
await run(process.execPath, ['node_modules/electron-builder/cli.js', '--win', '--x64', '--publish', 'never', '--config', configFile]);
await writeFile(resolve(root, `${buildRoot}/build-result.json`), JSON.stringify({id, output, speechOutput}, null, 2));
console.log(`Windows package built in ${output}. License inventory: ${buildRoot}/licenses/inventory.json`);
