// Generates Khamari PWA PNG icons (no external deps). Run: npm run icons
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');
fs.mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  return zlib.crc32 ? zlib.crc32(buf) : manualCrc(buf);
}
function manualCrc(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x / size, y / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const EMERALD = [6, 78, 59, 255];
const AMBER = [245, 158, 11, 255];
const WHITE = [250, 248, 242, 255];

// scale: shrink artwork inside safe zone (maskable); rounded: rounded-square corners
function makePixel({ scale, rounded }) {
  return (u, v) => {
    if (rounded) {
      const r = 0.2;
      const dx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0);
      const dy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
      if (dx * dx + dy * dy > r * r) return [0, 0, 0, 0];
    }
    const x = (u - 0.5) / scale;
    const y = (v - 0.5) / scale;
    // amber sun
    if ((x - 0.0) ** 2 + (y + 0.2) ** 2 < 0.16 ** 2) return AMBER;
    // stem
    if (Math.abs(x) < 0.025 && y > -0.05 && y < 0.34) return WHITE;
    // leaves (ellipses)
    const leaf = (cx, cy, rx, ry, rot) => {
      const px = x - cx, py = y - cy;
      const c = Math.cos(rot), s = Math.sin(rot);
      const lx = px * c + py * s, ly = -px * s + py * c;
      return (lx / rx) ** 2 + (ly / ry) ** 2 < 1;
    };
    if (leaf(-0.14, 0.12, 0.15, 0.065, -0.6) || leaf(0.14, 0.04, 0.15, 0.065, 0.6)) return WHITE;
    return EMERALD;
  };
}

fs.writeFileSync(path.join(outDir, 'icon-192.png'), png(192, makePixel({ scale: 1, rounded: true })));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), png(512, makePixel({ scale: 1, rounded: true })));
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), png(512, makePixel({ scale: 0.7, rounded: false })));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), png(180, makePixel({ scale: 0.9, rounded: false })));
console.log('Icons written to', outDir);
