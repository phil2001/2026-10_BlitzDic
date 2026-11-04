import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const manifest = JSON.parse(await readFile(new URL('../licenses/speech-models.json', import.meta.url), 'utf8'));
const modelRoot = resolve(process.argv[2] || resolve(import.meta.dirname, '../models'));

for (const [preset, { sha256 }] of Object.entries(manifest)) {
  const directory = resolve(modelRoot, preset);
  const files = (await readdir(directory)).filter(name => name !== '.cache');
  if (files.length !== Object.keys(sha256).length || files.some(name => !Object.hasOwn(sha256, name))) {
    throw new Error(`Dateiliste entspricht nicht dem Modellmanifest: ${preset}`);
  }
  for (const [name, expected] of Object.entries(sha256)) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(resolve(directory, name))) hash.update(chunk);
    if (hash.digest('hex') !== expected) throw new Error(`SHA-256 stimmt nicht überein: ${preset}/${name}`);
  }
  console.log(`Verifiziert: ${preset} (${files.length} Dateien)`);
}
