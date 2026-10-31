"""Render the original BlitzDic waveform mark as a multi-resolution Windows ICO."""
from pathlib import Path
import struct
import zlib
import numpy as np


def png(size):
    scale = 4
    y, x = np.mgrid[:size * scale, :size * scale] / (size * scale)
    pixels = np.zeros((size * scale, size * scale, 4), dtype=np.float32)
    radius = .18
    dx = np.maximum(np.maximum(radius - x, x - (1 - radius)), 0)
    dy = np.maximum(np.maximum(radius - y, y - (1 - radius)), 0)
    inside = dx * dx + dy * dy <= radius * radius
    pixels[inside] = [66, 76, 242, 255]
    for left, top, right, bottom in [(.22, .36, .32, .67), (.45, .18, .55, .82), (.68, .29, .78, .71)]:
        white = (x >= left) & (x <= right) & (y >= top) & (y <= bottom)
        pixels[white] = [255, 255, 255, 255]
    # Average premultiplied samples to avoid dark fringes at transparent corners.
    pixels[..., :3] *= pixels[..., 3:] / 255
    pixels = pixels.reshape(size, scale, size, scale, 4).mean(axis=(1, 3))
    alpha = pixels[..., 3:]
    pixels[..., :3] = np.divide(pixels[..., :3] * 255, alpha, out=np.zeros_like(pixels[..., :3]), where=alpha > 0)
    rows = pixels.astype(np.uint8)
    raw = b''.join(b'\0' + row.tobytes() for row in rows)
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


sizes = [16, 24, 32, 48, 64, 128, 256]
images = [png(size) for size in sizes]
offset = 6 + 16 * len(images)
entries = []
for size, data in zip(sizes, images):
    entries.append(struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(data), offset))
    offset += len(data)
target = Path(__file__).resolve().parents[1] / 'assets/blitzdic.ico'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_bytes(struct.pack('<HHH', 0, 1, len(images)) + b''.join(entries) + b''.join(images))
print(target)
