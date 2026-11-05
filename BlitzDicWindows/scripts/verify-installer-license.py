"""Read the first license page in this project's NSIS 3 Unicode/Deflate output.

This is a static artifact check, not a visual or interactive installation test.
Layout reference: NSIS Source/exehead/fileform.h (firstheader, header, page).
https://github.com/kichik/nsis/blob/master/Source/exehead/fileform.h
"""
import argparse
from pathlib import Path
import struct
import zlib

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('installer', type=Path)
parser.add_argument('license', type=Path)
args = parser.parse_args()
with args.installer.open('rb') as stream:
    prefix = stream.read(1024 * 1024)
    signature = prefix.find(b'\xef\xbe\xad\xdeNullsoftInst')
    if signature < 4:
        raise SystemExit('NSIS first header not found')
    offset = signature - 4
    flags, _, _, _, _, header_size, following_size = struct.unpack_from('<7I', prefix, offset)
    if flags & 1 or not 0 < header_size < 16 * 1024 * 1024:
        raise SystemExit('Expected an installer with a bounded NSIS header')
    if offset + following_size != args.installer.stat().st_size:
        raise SystemExit('Unexpected NSIS extent; this verifier expects unsigned build output')
    size = struct.unpack_from('<I', prefix, offset + 28)[0]
    if not size & 0x80000000 or size & 0x7fffffff > 16 * 1024 * 1024:
        raise SystemExit('Expected a compressed NSIS header of bounded size')
    stream.seek(offset + 32)
    compressed = stream.read(size & 0x7fffffff)
decoder = zlib.decompressobj(-15)
header = decoder.decompress(compressed, header_size + 1)
if not decoder.eof or len(header) != header_size:
    raise SystemExit('NSIS Deflate header size mismatch')
pages_offset, page_count = struct.unpack_from('<2I', header, 4)
sections_offset = struct.unpack_from('<I', header, 12)[0]
# These output files use 32-bit NSIS page records with callbacks (16 integers).
if not page_count or pages_offset + page_count * 64 != sections_offset:
    raise SystemExit('Unexpected NSIS page record layout')
page = struct.unpack_from('<16i', header, pages_offset)
if page[1] != 0:  # PWP_LICENSE, before directory/installation pages
    raise SystemExit('The first setup page is not the required license page')
strings_offset = struct.unpack_from('<I', header, 28)[0]
license_offset = strings_offset + page[12] * 2  # page.parms[1]
if page[12] < 0 or not 0 <= license_offset < len(header) - 2:
    raise SystemExit('License page text offset is invalid')
if struct.unpack_from('<H', header, license_offset)[0] != 0x11:
    raise SystemExit('Expected the Unicode license text marker')
end = next((index for index in range(license_offset + 2, len(header) - 1, 2)
            if header[index:index + 2] == b'\0\0'), None)
if end is None:
    raise SystemExit('The compiled license has no UTF-16 terminator')
actual = header[license_offset + 2:end].decode('utf-16le')
expected = args.license.read_text(encoding='utf-8-sig')
if actual.replace('\r\n', '\n') != expected:
    raise SystemExit('The complete compiled license differs from the reviewed build text')
print('PASS: first compiled setup page references the complete generated license text')
