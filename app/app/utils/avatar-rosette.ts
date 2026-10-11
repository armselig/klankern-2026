import type { StrokeShape } from "~/types/whiteboard";

/**
 * The picture a member has until a Gravatar picture is found for them: a
 * rosette, a looped figure like the ones a spirograph draws, as one closed
 * pen stroke. It is a whiteboard stroke in every respect (a StrokeShape,
 * rendered by WhiteboardStroke), so an avatar looks drawn with the
 * whiteboard's own pens.
 *
 * Everything about it follows from the hash of the member's email address,
 * so a member has the same picture on every device with nothing stored.
 */

/** The side of the square a rosette is drawn in, in its own units; the
 * avatar's disc fills that square. Like board units, fine enough for
 * integer points. */
export const ROSETTE_BOX = 1000;

/**
 * The pen colors a rosette can have: the whiteboard's four and four more of
 * the same depth. A list of its own rather than PEN_COLORS, because the ink
 * is picked by its place in the list: a pen added to the whiteboard would
 * otherwise give every member another picture.
 */
export const AVATAR_INKS = [
  "#212121",
  "#c62828",
  "#1565c0",
  "#2e7d32",
  "#6a1b9a",
  "#00838f",
  "#ef6c00",
  "#ad1457",
] as const;

const PEN_WIDTH = 64;

/** Kept free between the ink and the edge of the disc. */
const MARGIN = 90;

const LOBE_COUNTS = [3, 4, 5, 6] as const;

/**
 * How far the figure's loops reach, as multiples of the depth at which it has
 * sharp points instead: below 1 the figure is a rounded shape without loops,
 * above 1 its loops grow.
 */
const LOOP_DEPTHS = [0.55, 1.7, 3.2] as const;

/** Points per rosette. Enough for the tightest loops to stay round at the
 * largest size an avatar is shown in. */
const SAMPLES = 240;

/** One byte of a hex string; a text that is no hash counts as zeros. */
function hashByte(hash: string, index: number): number {
  return Number.parseInt(hash.slice(index * 2, index * 2 + 2), 16) || 0;
}

/** The option a byte of the hash selects. Each trait reads a byte of its
 * own, so the traits vary independently of each other. */
function optionForByte<T>(
  options: readonly T[],
  hash: string,
  index: number,
): T {
  return options[hashByte(hash, index) % options.length]!;
}

/**
 * The rosette for a hash, as a closed stroke in a ROSETTE_BOX square.
 *
 * The figure is the path of a pen on a small wheel that rolls along a circle
 * (a spirograph): the pen goes round the circle once while the wheel turns
 * `turns` times, which gives one lobe per `lobes`. Rolling inside the circle
 * (negative turns) makes the loops point outward, rolling outside makes them
 * point inward.
 */
export function avatarRosette(hash: string): StrokeShape {
  const color = optionForByte(AVATAR_INKS, hash, 0);
  const lobes = optionForByte(LOBE_COUNTS, hash, 1);
  const loopsPointInward = hashByte(hash, 2) % 2 === 1;
  const turns = loopsPointInward ? lobes + 1 : 1 - lobes;
  const depth = optionForByte(LOOP_DEPTHS, hash, 3) / Math.abs(turns);
  // A lobe points up, or the gap between two lobes does.
  const rotation =
    -Math.PI / 2 + (hashByte(hash, 4) % 2 === 1 ? Math.PI / lobes : 0);

  const center = ROSETTE_BOX / 2;
  // The pen is farthest from the center, 1 + depth, where both motions align.
  const scale = (center - MARGIN - PEN_WIDTH / 2) / (1 + depth);

  const points: number[] = [];
  // Up to and including SAMPLES: the last point is the first again.
  for (let sample = 0; sample <= SAMPLES; sample++) {
    const angle = (2 * Math.PI * sample) / SAMPLES;
    points.push(
      Math.round(
        center +
          scale *
            (Math.cos(angle + rotation) +
              depth * Math.cos(turns * angle + rotation)),
      ),
      Math.round(
        center +
          scale *
            (Math.sin(angle + rotation) +
              depth * Math.sin(turns * angle + rotation)),
      ),
    );
  }
  return { color, width: PEN_WIDTH, points };
}
