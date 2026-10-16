import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { flavors } from "@catppuccin/palette";
import { describe, expect, it } from "vitest";
import {
  contrast,
  mixInOklab,
  over,
  type Rgb,
} from "../../tests/support/color-contrast";

// Read from disk: Vitest hands out a stylesheet that is imported as empty.
const themeStylesheet = readFileSync(
  resolve(import.meta.dirname, "../assets/css/theme.css"),
  "utf8",
);

const MODES = ["latte", "mocha"] as const;
type Mode = (typeof MODES)[number];
type ColorName = keyof typeof flavors.latte.colors;

/** A color of the palette by its name in theme.css (`peach`, `subtext1`). */
function paletteColor(mode: Mode, name: string): Rgb {
  const color = flavors[mode].colors[name as ColorName];
  if (!color) throw new Error(`no ${mode} color named ${name}`);
  return color.rgb;
}

const COLOR = String.raw`var\(--ctp-(latte|mocha)-(\w+)\)`;
const TRANSLUCENT = String.raw`rgb\(var\(--ctp-(?:latte|mocha)-(\w+)-rgb\)\s*\/\s*([\d.]+)\)`;
const MIX_WITH_TEXT = String.raw`color-mix\(\s*in oklab,\s*var\(--ctp-latte-(\w+)\)\s+(\d+)%,\s*var\(--ctp-latte-text\)\s*\)`;

/** The body of the rule that starts at `start` in the stylesheet, up to
 * its matching brace. */
function ruleBody(start: string): string {
  const from = themeStylesheet.indexOf(start);
  if (from < 0) throw new Error(`no rule ${start}`);
  let depth = 0;
  for (let i = themeStylesheet.indexOf("{", from); ; i++) {
    if (themeStylesheet[i] === "{") depth++;
    if (themeStylesheet[i] === "}" && --depth === 0)
      return themeStylesheet.slice(from, i + 1);
  }
}

const STRONG_SHADES = ruleBody(
  "@supports (color: color-mix(in oklab, red, red))",
);

/** The value of a custom property, `light-dark(...)` and all. */
function declaration(property: string, source = themeStylesheet): string {
  const match = new RegExp(`${property}:\\s*(light-dark\\([^;]*\\));`).exec(
    source,
  );
  if (!match) throw new Error(`no ${property}`);
  return match[1]!;
}

/** A token that is a light-dark() of two palette colors. */
function opaqueToken(property: string): Record<Mode, Rgb> {
  const match = new RegExp(
    String.raw`^light-dark\(\s*${COLOR},\s*${COLOR}\s*\)$`,
  ).exec(declaration(property));
  if (match?.[1] !== "latte" || match[3] !== "mocha")
    throw new Error(`${property} is not a light-dark() of Latte and Mocha`);
  return {
    latte: paletteColor("latte", match[2]!),
    mocha: paletteColor("mocha", match[4]!),
  };
}

interface Translucent {
  name: string;
  color: Rgb;
  alpha: number;
}

/** A token that is a light-dark() of two palette colors at an alpha. */
function translucentToken(property: string): Record<Mode, Translucent> {
  const match = new RegExp(
    String.raw`^light-dark\(\s*${TRANSLUCENT},\s*${TRANSLUCENT}\s*\)$`,
  ).exec(declaration(property));
  if (!match) throw new Error(`${property} is not a translucent light-dark()`);
  const [, latte, latteAlpha, mocha, mochaAlpha] = match;
  return {
    latte: {
      name: latte!,
      color: paletteColor("latte", latte!),
      alpha: Number(latteAlpha),
    },
    mocha: {
      name: mocha!,
      color: paletteColor("mocha", mocha!),
      alpha: Number(mochaAlpha),
    },
  };
}

/** A strong shade: the light-mode accent, mixed with Latte's text or not,
 * and the dark-mode accent. */
function strongShade(feature: string): Record<Mode, Rgb> & { hue: string } {
  const value = declaration(`--feature-${feature}-strong`, STRONG_SHADES);
  const match = new RegExp(
    String.raw`^light-dark\(\s*(?:${MIX_WITH_TEXT}|var\(--ctp-latte-(\w+)\)),\s*var\(--ctp-mocha-(\w+)\)\s*\)$`,
  ).exec(value);
  if (!match) throw new Error(`--feature-${feature}-strong: ${value}`);
  const [, mixed, share, plain, mocha] = match;
  const hue = mixed ?? plain!;
  const accent = paletteColor("latte", hue);
  return {
    hue,
    latte: share
      ? mixInOklab(accent, Number(share), paletteColor("latte", "text"))
      : accent,
    mocha: paletteColor("mocha", mocha!),
  };
}

const FEATURES = [...themeStylesheet.matchAll(/--feature-([a-z]+):/g)].map(
  ([, name]) => name!,
);

const page = opaqueToken("--theme-page");
const surface = opaqueToken("--theme-surface");
const text = opaqueToken("--theme-text");
const muted = opaqueToken("--theme-text-muted");
const red = opaqueToken("--q-negative");
const veil = translucentToken("--theme-veil-on-surface");
/** --theme-separator, black or white at a percentage. */
const separator = (() => {
  const match =
    /^light-dark\(\s*rgb\(0 0 0 \/ (\d+)%\),\s*rgb\(255 255 255 \/ (\d+)%\)\s*\)$/.exec(
      declaration("--theme-separator"),
    );
  if (!match) throw new Error("--theme-separator is not black and white");
  return {
    latte: { color: { r: 0, g: 0, b: 0 }, alpha: Number(match[1]) / 100 },
    mocha: { color: { r: 255, g: 255, b: 255 }, alpha: Number(match[2]) / 100 },
  };
})();
/** How far a translucent edge stands out from what it is drawn on. */
const edgeContrast = (edge: { color: Rgb; alpha: number }, ground: Rgb) =>
  contrast(over(edge.color, edge.alpha, ground), ground);
/** What a feature's color is laid on: the page and a surface. */
const grounds = (mode: Mode) => [page[mode], surface[mode]];

describe("the theme's feature tokens", () => {
  it("has the features the plan names", () => {
    expect(FEATURES.toSorted()).toEqual(
      [
        "household",
        "meals",
        "recipes",
        "shopping",
        "todos",
        "vacations",
        "whiteboard",
      ].toSorted(),
    );
  });

  it("gives every feature its color, its tint and its strong shade, all of one hue", () => {
    for (const feature of FEATURES) {
      const color = opaqueToken(`--feature-${feature}`);
      const tint = translucentToken(`--feature-${feature}-tint`);
      const strong = strongShade(feature);
      for (const mode of MODES)
        expect(tint[mode].color, `${feature} tint, ${mode}`).toEqual(
          color[mode],
        );
      const edge = translucentToken(`--feature-${feature}-edge`);
      for (const mode of MODES)
        expect(edge[mode].color, `${feature} edge, ${mode}`).toEqual(
          color[mode],
        );
      expect(paletteColor("latte", strong.hue), feature).toEqual(color.latte);
      expect(strong.mocha, feature).toEqual(color.mocha);
    }
  });

  // An older browser can't mix them; there the token is missing, and each
  // use names a color that passes instead.
  it("declares the strong shades only where color-mix() is supported", () => {
    const outside = themeStylesheet.replace(STRONG_SHADES, "");
    expect(outside).not.toMatch(/--feature-[a-z]+-strong:/);
  });
});

describe("the contrast of the feature tokens", () => {
  it("keeps every strong shade at 3:1 or more on the page, a surface and its own tint", () => {
    for (const feature of FEATURES) {
      const strong = strongShade(feature);
      const tint = translucentToken(`--feature-${feature}-tint`);
      for (const mode of MODES)
        for (const ground of grounds(mode).flatMap((ground) => [
          ground,
          over(tint[mode].color, tint[mode].alpha, ground),
        ]))
          expect(
            contrast(strong[mode], ground),
            `${feature}, ${mode}`,
          ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps text, muted text, a hovered flat button and red text at 4.5:1 or more on every tint", () => {
    for (const feature of FEATURES) {
      const tint = translucentToken(`--feature-${feature}-tint`);
      for (const mode of MODES)
        for (const ground of grounds(mode)) {
          const tinted = over(tint[mode].color, tint[mode].alpha, ground);
          const hovered = over(veil[mode].color, veil[mode].alpha, tinted);
          const pairs = {
            text: contrast(text[mode], tinted),
            muted: contrast(muted[mode], tinted),
            "hovered flat button": contrast(text[mode], hovered),
            red: contrast(red[mode], tinted),
          };
          for (const [pair, ratio] of Object.entries(pairs))
            expect(
              ratio,
              `${pair} on ${feature}, ${mode}`,
            ).toBeGreaterThanOrEqual(4.5);
        }
    }
  });

  // A card in a feature's color is as clearly a card as a plain one, and
  // its edge only says which feature: no stronger than it has to be, and
  // below the 3:1 of something that means "look here".
  it("keeps every feature's edge as visible as the separator, no more than needed, and below 3:1", () => {
    for (const feature of FEATURES) {
      const edge = translucentToken(`--feature-${feature}-edge`);
      for (const mode of MODES) {
        const ratios = grounds(mode).map((ground) => ({
          edge: edgeContrast(edge[mode], ground),
          weaker: edgeContrast(
            { ...edge[mode], alpha: edge[mode].alpha - 0.05 },
            ground,
          ),
          separator: edgeContrast(separator[mode], ground),
        }));
        const label = `${feature} edge, ${mode}`;
        for (const ratio of ratios) {
          expect(ratio.edge, label).toBeGreaterThanOrEqual(ratio.separator);
          expect(ratio.edge, label).toBeLessThan(3);
        }
        expect(
          ratios.some((ratio) => ratio.weaker < ratio.separator),
          label,
        ).toBe(true);
      }
    }
  });

  it("keeps the Tonight tile's tint at 6% in light mode and 8% in dark mode", () => {
    const tint = translucentToken("--feature-meals-tint");
    expect([tint.latte.alpha, tint.mocha.alpha]).toEqual([0.06, 0.08]);
  });

  it("keeps selected text at 4.5:1 or more", () => {
    const selection = translucentToken("--theme-selection");
    for (const mode of MODES)
      for (const ground of grounds(mode))
        expect(
          contrast(
            text[mode],
            over(selection[mode].color, selection[mode].alpha, ground),
          ),
          mode,
        ).toBeGreaterThanOrEqual(4.5);
  });
});

// The helper's arithmetic, against figures worked out when the theme was
// built (docs/ui/theme-and-contrast.md, docs/ui/playful-look/design.md).
describe("the contrast arithmetic", () => {
  it("reproduces known figures", () => {
    const latte = (name: string) => paletteColor("latte", name);
    const base = latte("base");
    const peach6 = over(latte("peach"), 0.06, base);
    expect(contrast(latte("blue"), base)).toBeCloseTo(4.34, 2);
    expect(contrast(latte("text"), peach6)).toBeCloseTo(6.64, 2);
    expect(
      contrast(latte("text"), over(latte("text"), 0.25, peach6)),
    ).toBeCloseTo(4.56, 2);
    expect(
      contrast(mixInOklab(latte("peach"), 78, latte("text")), base),
    ).toBeGreaterThan(3);
    expect(contrast(latte("peach"), base)).toBeLessThan(3);
  });
});
