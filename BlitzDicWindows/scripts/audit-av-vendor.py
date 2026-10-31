"""Compare installed PyAV DLLs with its pinned upstream Windows vendor archive.

This audits provenance, not licensing compliance. Renaming/repairing DLL imports
can change whole-file hashes without changing executable machine-code sections.
No downloaded code is executed or extracted from the archive.
"""
import argparse
import hashlib
import importlib.metadata as metadata
import json
from pathlib import Path
import re
import tarfile
import av
import pefile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_SHA = '5c7bfb8c375fd8e908c06c57cab41666fd5d84af2f47b648760534bf49dc8df2'
BUILD_COMMIT = 'fab22bcb12748a05f86683ac632fdb96994d970e'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def executable_sections(data):
    with pefile.PE(data=data, fast_load=True) as binary:
        sections = {section.Name.rstrip(b'\0').decode('ascii'): digest(section.get_data())
                    for section in binary.sections if section.Characteristics & 0x20000000}
    if not sections:
        raise ValueError('Binary has no executable sections')
    return sections


def audit(archive):
    if metadata.version('av') != '16.0.1':
        raise ValueError('This pinned upstream comparison applies only to av 16.0.1')
    if digest(archive.read_bytes()) != ARCHIVE_SHA:
        raise ValueError('Vendor archive hash differs from the published GitHub release asset')
    records = []
    directory = Path(av.__file__).resolve().parent.parent / 'av.libs'
    with tarfile.open(archive) as source:
        originals = {Path(member.name).name.lower(): member for member in source
                     if member.isfile() and member.name.startswith('bin/') and member.name.lower().endswith('.dll')}
        for binary in sorted(directory.glob('*.dll')):
            original_name = re.sub(r'-[0-9a-f]{32}(?=\.dll$)', '', binary.name, flags=re.I).lower()
            if original_name not in originals:
                raise ValueError(f'Installed DLL missing from pinned vendor: {binary.name}')
            original = source.extractfile(originals[original_name]).read()
            installed = binary.read_bytes()
            source_sections, installed_sections = executable_sections(original), executable_sections(installed)
            if source_sections != installed_sections:
                raise ValueError(f'Executable sections differ: {binary.name}')
            records.append({'file': binary.name, 'vendorFile': original_name,
                            'vendorSha256': digest(original), 'installedSha256': digest(installed),
                            'identicalBytes': original == installed,
                            'executableSections': source_sections})
    if not records:
        raise ValueError('No installed PyAV DLLs found')
    return {'scope': 'Installed av.libs from official av 16.0.1 Windows wheel, not the entire application',
            'pyavVersion': metadata.version('av'),
            'pyavCommit': '7687256d87f22f78cb75bb4aba94dc6e504c9983',
            'pyavVendorConfig': 'https://github.com/PyAV-Org/PyAV/blob/7687256d87f22f78cb75bb4aba94dc6e504c9983/scripts/ffmpeg-latest.json',
            'vendorRelease': '8.0-2', 'vendorBuildCommit': BUILD_COMMIT,
            'vendorArchive': {'url': 'https://github.com/PyAV-Org/pyav-ffmpeg/releases/download/8.0-2/ffmpeg-win_amd64.tar.gz',
                              'sha256': ARCHIVE_SHA},
            'upstreamConfigurePatch': f'https://github.com/PyAV-Org/pyav-ffmpeg/blob/{BUILD_COMMIT}/patches/ffmpeg.patch',
            'interpretation': 'All executable sections match. This does not assert whole-file equality after wheel repair.',
            'releaseApproved': False,
            'reviewRequired': ['The upstream configure patch moves libx264/libx265 from the GPL list to the version3 list.',
                               'The LGPL string returned by the patched DLLs is not sufficient license evidence.',
                               'Replace with an unmodified-source build without GPL/nonfree dependencies and supply matching source/notices.'],
            'binaries': records}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--archive', type=Path, default=ROOT / '.runtime/native-provenance/ffmpeg-win_amd64-8.0-2.tar.gz')
    args = parser.parse_args()
    destination = args.output.resolve()
    if not destination.is_relative_to(ROOT) or destination.exists():
        raise SystemExit('Output must be a new file inside BlitzDicWindows')
    report = audit(args.archive)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'binaries': len(report['binaries']),
                      'identicalBytes': sum(item['identicalBytes'] for item in report['binaries']),
                      'identicalExecutableSections': len(report['binaries']), 'releaseApproved': False}))
