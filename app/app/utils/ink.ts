/**
 * The pens' inks, for the whiteboard and the avatars. Each has two colors:
 *
 * - The value is what a stroke is stored with: '#rrggbb' in lower case, the
 *   only format the database accepts (migration 0012). It never changes, or
 *   the strokes already drawn would lose their pen.
 * - The paint is what a stroke is drawn with: the theme's color for that
 *   ink (`--ink-<name>` in assets/css/theme.css), so a drawing is readable
 *   on the light board and on the dark one.
 */
export const INK_VALUES = {
  black: "#212121",
  red: "#c62828",
  blue: "#1565c0",
  green: "#2e7d32",
  purple: "#6a1b9a",
  teal: "#00838f",
  orange: "#ef6c00",
  pink: "#ad1457",
} as const;

export type InkName = keyof typeof INK_VALUES;

const INK_NAMES = new Map<string, InkName>(
  (Object.entries(INK_VALUES) as [InkName, string][]).map(([name, value]) => [
    value,
    name,
  ]),
);

/**
 * The theme's color for a stored stroke color, as a CSS value. Undefined for
 * a color that is none of the inks: the database accepts any '#rrggbb', and
 * such a stroke keeps the color it was stored with.
 */
export function inkPaint(storedColor: string): string | undefined {
  const name = INK_NAMES.get(storedColor);
  return name && `var(--ink-${name})`;
}
