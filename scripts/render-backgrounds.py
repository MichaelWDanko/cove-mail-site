"""Rebuild decorative PNG backgrounds using only Python's standard library.

Run: python3 scripts/render-backgrounds.py
Rasterizing the gradients avoids repeated software gradient shading on scroll.
"""
from pathlib import Path
import math
import struct
import zlib

OUTPUT = Path(__file__).resolve().parents[1] / 'assets' / 'backgrounds'
OUTPUT.mkdir(parents=True, exist_ok=True)


def png(name, width, height, pixel):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    rows = b''.join(b'\0' + bytes(v for x in range(width) for v in pixel(x, y)) for y in range(height))
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    data += chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b'')
    (OUTPUT / name).write_bytes(data)
    print(name, len(data), 'bytes')


def mix(a, b, t):
    return tuple(round(x + (y - x) * max(0, min(1, t))) for x, y in zip(a, b))


def hero(x, y):
    t = y / 1999
    color = mix((247, 251, 250), (237, 246, 243), t / .45) if t < .45 else mix((237, 246, 243), (253, 252, 248), (t - .45) / .55)
    alpha = .045 * max(0, 1 - t / .84)
    for line in (x < 2, y % 116 < 2):
        if line:
            color = mix(color, (8, 127, 134), alpha)
    return (*color, 255)


def connection(x, y):
    color = (16, 42, 58)
    alpha = .05 * max(0, 1 - y / 1999 / .72)
    for line in (x < 2, y % 116 < 2):
        if line:
            color = mix(color, (91, 202, 208), alpha)
    return (*color, 255)


def glow(x, y):
    radius = math.hypot(x - 255.5, y - 255.5) / (255.5 * math.sqrt(2))
    if radius < .42:
        rgba = mix((42, 176, 177, 51), (221, 239, 233, 20), radius / .42)
    else:
        rgba = (221, 239, 233, round(20 * max(0, 1 - (radius - .42) / .28)))
    return rgba


png('hero.png', 116, 2000, hero)
png('connection.png', 116, 2000, connection)
png('glow.png', 512, 512, glow)
png('utility.png', 1, 512, lambda x, y: (*mix((247, 251, 250), (234, 244, 241), y / 511), 255))
png('pricing-glow.png', 512, 512, lambda x, y: (43, 176, 177, round(36 * max(0, 1 - math.hypot(x - 255.5, y - 255.5) / 255.5))))
