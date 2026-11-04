import { mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`;
const buildRoot = `build/${id}`, output = `dist/windows-${id}`;
const speechOutput = `dist/speech-${id}`;
const runtime = await realpath(resolve(root, '.runtime'));
const python = resolve(root, process.env.BLITZDIC_BUILD_PYTHON || '.runtime/venv/Scripts/python.exe');
if (!(await realpath(python)).toLowerCase().startsWith(runtime.toLowerCase() + sep))
  throw new Error('Build-Python muss im Projektordner .runtime liegen.');
process.env.BLITZDIC_BUILD_PYTHON = python;
async function run(command, args) {
  await new Promise((accept, reject) => {
    const child = spawn(command, args, {cwd: root, stdio: 'inherit', windowsHide: true, shell: false});
    child.on('error', reject);
    child.on('exit', code => code === 0 ? accept() : reject(new Error(`${command} failed (${code})`)));
  });
}
await run(process.execPath, ['scripts/verify-models.mjs']);
await mkdir(resolve(root, buildRoot), {recursive: true});
console.log(`Build: ${id}\nInstaller output: ${output}`);
await run(python, ['scripts/setup-diarization.py', '--verify-only']);
await run(python, ['scripts/collect-licenses.py', `${buildRoot}/licenses`]);
await run(python, ['scripts/native-inventory.py', `${buildRoot}/licenses/native-binaries.json`, '--require-clean-ffmpeg']);
await run(`${process.env.SystemRoot}/System32/WindowsPowerShell/v1.0/powershell.exe`,
  ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/build-speech.ps1',
    '-OutputDirectory', speechOutput, '-WorkDirectory', `${buildRoot}/speech`]);
await run(python, ['scripts/map-native-package.py', `${buildRoot}/licenses/native-binaries.json`,
  `${speechOutput}/blitzdic-speech`, `${buildRoot}/licenses/native-package-map.json`,
  `${buildRoot}/speech/work/blitzdic-speech/Analysis-00.toc`, '--require-trusted-origins']);
let config = await readFile(resolve(root, 'electron-builder.yml'), 'utf8');
config = config.replace('output: dist/windows', `output: ${output}`)
  .replace('from: dist/speech/blitzdic-speech', `from: ${speechOutput}/blitzdic-speech`)
  .replace('extraResources:', `extraResources:\n  - from: ${buildRoot}/licenses\n    to: licenses/dependencies`);
const configFile = `${buildRoot}/electron-builder.yml`;
await writeFile(resolve(root, configFile), config);
await run(process.execPath, ['node_modules/electron-builder/cli.js', '--win', '--x64', '--publish', 'never', '--config', configFile]);
await writeFile(resolve(root, `${buildRoot}/build-result.json`), JSON.stringify({id, output, speechOutput}, null, 2));
console.log(`Windows package built in ${output}. License inventory: ${buildRoot}/licenses/inventory.json`);
