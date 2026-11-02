// Generates the placeholder app icons (graphite ground, teal ring) as PNGs without any dependency.
// Usage: node tools/icons/generate-app-icons.mjs
import { Buffer } from "node:buffer";
import { writeFileSync } from "node:fs";
import { URL } from "node:url";
import { deflateSync } from "node:zlib";

const GROUND = [0x12, 0x16, 0x1c];
const TEAL = [0x2e, 0xc4, 0xb6];

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const centre = size / 2;
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x + 0.5 - centre, y + 0.5 - centre) / size;
      const colour = distance > 0.22 && distance < 0.32 ? TEAL : GROUND;
      raw.set(colour, row + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const icons = { "icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180 };
for (const [name, size] of Object.entries(icons)) {
  writeFileSync(new URL(`../../apps/web/public/${name}`, import.meta.url), png(size));
}
