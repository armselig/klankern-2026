import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { flavors } from "@catppuccin/palette";

// The header's colors in light mode (app/assets/css/theme.css): the primary
// color, which is also pwa.manifest.theme_color, and the text on it. An icon
// file holds one set of colors, whatever the device's mode.
const { mauve, base } = flavors.latte.colors;
const BRAND = [mauve.rgb.r, mauve.rgb.g, mauve.rgb.b];
const GLYPH = [base.rgb.r, base.rgb.g, base.rgb.b];

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
    return GLYPH;
  }
  return BRAND;
}

// The mean color of samples x samples points within a pixel. More than one
// sample softens the glyph's edges, which a 32px icon needs and a 512px
// one does not.
function sampledPixelAt(x, y, size, maskablePadding, samples) {
  const sum = [0, 0, 0];
  for (let row = 0; row < samples; row++) {
    for (let column = 0; column < samples; column++) {
      const color = pixelAt(
        x + (column + 0.5) / samples - 0.5,
        y + (row + 0.5) / samples - 0.5,
        size,
        maskablePadding,
      );
      for (let channel = 0; channel < 3; channel++)
        sum[channel] += color[channel];
    }
  }
  return sum.map((channel) => Math.round(channel / samples ** 2));
}

function makePng(size, { maskablePadding = false, samples = 1 } = {}) {
  const rowBytes = size * 3;
  const raw = Buffer.alloc((rowBytes + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const [r, g, b] = sampledPixelAt(x, y, size, maskablePadding, samples);
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

// An .ico file with one picture: a directory of a single entry, then the
// picture, which may be a PNG as it is.
function makeIco(size, png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // number of pictures

  const entry = Buffer.alloc(16);
  entry[0] = size; // width
  entry[1] = size; // height
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(24, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12); // where the PNG starts

  return Buffer.concat([header, entry, png]);
}

const FAVICON_SIZE = 32;

writeFileSync(
  "public/favicon.ico",
  makeIco(FAVICON_SIZE, makePng(FAVICON_SIZE, { samples: 4 })),
);
writeFileSync("public/pwa-192.png", makePng(192));
writeFileSync("public/pwa-512.png", makePng(512));
writeFileSync(
  "public/pwa-512-maskable.png",
  makePng(512, { maskablePadding: true }),
);
console.log("Generated the favicon and the PWA icons in public/");
