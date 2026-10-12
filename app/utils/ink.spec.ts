import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AVATAR_INKS } from "./avatar-rosette";
import { INK_VALUES, inkPaint, type InkName } from "./ink";
import { PEN_COLORS } from "./whiteboard-pen";

// Read from disk: Vitest hands out a stylesheet that is imported as empty.
const themeStylesheet = readFileSync(
  resolve(import.meta.dirname, "../assets/css/theme.css"),
  "utf8",
);

/** Whether the stylesheet gives a custom property a Latte color for light
 * mode and a Mocha color for dark mode. */
function hasColorForBothModes(property: string): boolean {
  return new RegExp(
    `${property}:\\s*light-dark\\(\\s*var\\(--ctp-latte-\\w+\\),\\s*var\\(--ctp-mocha-\\w+\\)\\s*\\)`,
  ).test(themeStylesheet);
}

describe("inkPaint", () => {
  it("draws an ink in the theme's color for it", () => {
    expect(inkPaint(INK_VALUES.red)).toBe("var(--ink-red)");
  });

  it("leaves a color that is none of the inks as it is stored", () => {
    expect(inkPaint("#123456")).toBeUndefined();
  });

  it("knows every pen of the whiteboard and every ink of the avatars", () => {
    for (const { value } of PEN_COLORS) expect(inkPaint(value)).toBeDefined();
    for (const value of AVATAR_INKS) expect(inkPaint(value)).toBeDefined();
  });
});

// The names tie utils/ink.ts to the stylesheet, and nothing else would
// notice an ink without a color: its strokes would be drawn in black.
describe("the theme's ink colors", () => {
  it("has a color for every ink in light and in dark mode", () => {
    for (const name of Object.keys(INK_VALUES) as InkName[]) {
      expect(hasColorForBothModes(`--ink-${name}`), name).toBe(true);
    }
  });

  it("has a color name for the toolbar's control of every pen", () => {
    for (const { color } of PEN_COLORS) {
      expect(themeStylesheet, color).toContain(`.text-${color} {`);
    }
  });
});
