import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BRAND = [0x19, 0x76, 0xd2]; // #1976D2, matches pwa.manifest.theme_color
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c;
  const table =
    crc32.table ??
    (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++)
          c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
      }
      return t;
    })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Simple centered monogram "K" drawn on a solid brand-colored square, as flat
// rectangles (no text-rendering lib available) so it still reads as a mark at
// small sizes, not just a blank swatch.
function pixelAt(x, y, size, maskablePadding) {
  const pad = maskablePadding ? size * 0.1 : 0;
  // Maskable icons must have the brand background bleed to the full edge —
  // the mask shape (circle, squircle, ...) clips this area, it must not be
  // left white or every mask shape shows a white ring around the glyph.
  if (x < pad || y < pad || x >= size - pad || y >= size - pad) return BRAND;

  // Work in a normalized 0..1 space within the (possibly padded) content box.
  const inner = size - pad * 2;
  const nx = (x - pad) / inner;
  const ny = (y - pad) / inner;

  // "K" glyph as three strokes: a vertical bar on the left, and two diagonal
  // arms meeting at mid-height on the right.
  const strokeW = 0.14;
  const leftBar = nx >= 0.28 && nx <= 0.28 + strokeW;
  const midY = 0.5;
  const armTop =
    Math.abs(ny - (0.5 - (nx - 0.42) * 1.1)) < strokeW * 0.8 &&
    nx >= 0.42 &&
    ny <= midY;
  const armBottom =
    Math.abs(ny - (0.5 + (nx - 0.42) * 1.1)) < strokeW * 0.8 &&
    nx >= 0.42 &&
    ny >= midY;

  if (
    nx >= 0.15 &&
    nx <= 0.85 &&
    ny >= 0.15 &&
    ny <= 0.85 &&
    (leftBar || armTop || armBottom)
  ) {
    return WHITE;
  }
  return BRAND;
}

function makePng(size, { maskablePadding = false } = {}) {
  const rowBytes = size * 3;
  const raw = Buffer.alloc((rowBytes + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelAt(x, y, size, maskablePadding);
      const px = rowStart + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

writeFileSync("public/pwa-192.png", makePng(192));
writeFileSync("public/pwa-512.png", makePng(512));
writeFileSync(
  "public/pwa-512-maskable.png",
  makePng(512, { maskablePadding: true }),
);
console.log("Generated PWA icons in public/");
