"""Explicit, hash-pinned acquisition of local auxiliary speaker models.

--verify-only performs no network requests. Existing mismatched files are retained
and rejected; neither directories nor files are deleted by this script.
"""
import argparse
import hashlib
import json
from pathlib import Path
import tarfile
import urllib.request

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'speech/diarization-models.json').read_text(encoding='utf-8'))
parser = argparse.ArgumentParser()
parser.add_argument('--verify-only', action='store_true')
args = parser.parse_args()
destination = root / 'models/diarization'


def check(path, expected):
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise RuntimeError(f'Prüfsumme stimmt nicht: {path}. Datei bleibt erhalten.')


def acquire(path, url, expected):
    if path.exists():
        check(path, expected)
        return
    if args.verify_only:
        raise RuntimeError(f'Modell fehlt: {path}. Zuerst scripts/setup-diarization.py ausführen.')
    path.parent.mkdir(parents=True, exist_ok=True)
    # Validate before publishing the downloaded bytes to the model directory.
    with urllib.request.urlopen(url, timeout=120) as response:
        content = response.read()
    if hashlib.sha256(content).hexdigest() != expected:
        raise RuntimeError(f'Download-Prüfsumme stimmt nicht: {url}')
    with path.open('xb') as handle:
        handle.write(content)


for filename, spec in manifest['files'].items():
    target = destination / filename
    if target.exists():
        check(target, spec['sha256'])
    elif 'url' in spec:
        acquire(target, spec['url'], spec['sha256'])
    else:
        if args.verify_only:
            raise RuntimeError(f'Modell fehlt: {target}')
        archive_spec = manifest['archive']
        archive = root / '.runtime/pyannote-segmentation-3-0.tar.bz2'
        acquire(archive, archive_spec['url'], archive_spec['sha256'])
        with tarfile.open(archive, 'r:bz2') as tar:
            matches = [member for member in tar.getmembers() if member.isfile() and Path(member.name).name == filename]
            if len(matches) != 1: raise RuntimeError('Mehrdeutiger Modellinhalt im Archiv.')
            content = tar.extractfile(matches[0]).read()
        if hashlib.sha256(content).hexdigest() != spec['sha256']:
            raise RuntimeError('Extrahiertes Modell stimmt nicht mit der Prüfsumme überein.')
        destination.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as handle: handle.write(content)
    print(f'Verifiziert: {filename}')
