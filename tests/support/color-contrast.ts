/**
 * The color arithmetic of the theme's contrast spec: what the browser makes
 * of a `color-mix()` and of a translucent color over another, and the WCAG
 * contrast of the result. The a11y scan sees only what is on screen; this
 * computes the pairs it can't see, such as a hovered button on a tint, from
 * the palette's values.
 */

/** An sRGB color with channels from 0 to 255. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** An sRGB channel without its gamma, from 0 to 1. */
function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** The WCAG 2.1 relative luminance of a color. */
function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** The WCAG 2.1 contrast ratio of two opaque colors. */
export function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (light! + 0.05) / (dark! + 0.05);
}

/** A color at `alpha` laid over an opaque one, as the browser blends them:
 * channel by channel in sRGB. */
export function over(color: Rgb, alpha: number, background: Rgb): Rgb {
  const blend = (top: number, bottom: number) =>
    alpha * top + (1 - alpha) * bottom;
  return {
    r: blend(color.r, background.r),
    g: blend(color.g, background.g),
    b: blend(color.b, background.b),
  };
}

type Oklab = [l: number, a: number, b: number];

function toOklab({ r, g, b }: Rgb): Oklab {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([okL, okA, okB]: Oklab): Rgb {
  const l = (okL + 0.3963377774 * okA + 0.2158037573 * okB) ** 3;
  const m = (okL - 0.1055613458 * okA - 0.0638541728 * okB) ** 3;
  const s = (okL - 0.0894841775 * okA - 1.291485548 * okB) ** 3;
  const gamma = (value: number) => {
    const c = Math.min(1, Math.max(0, value));
    return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  };
  return {
    r: gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

/** `color-mix(in oklab, first <share>%, second)` of two opaque colors. */
export function mixInOklab(first: Rgb, share: number, second: Rgb): Rgb {
  const [a, b] = [toOklab(first), toOklab(second)];
  const weight = share / 100;
  return fromOklab([
    a[0] * weight + b[0] * (1 - weight),
    a[1] * weight + b[1] * (1 - weight),
    a[2] * weight + b[2] * (1 - weight),
  ]);
}
