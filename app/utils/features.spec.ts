import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURE_ICONS, featureColors, type FeatureKey } from "./features";

// Read from disk: Vitest hands out a stylesheet that is imported as empty.
const themeStylesheet = readFileSync(
  resolve(import.meta.dirname, "../assets/css/theme.css"),
  "utf8",
);

const FEATURES = Object.keys(FEATURE_ICONS) as FeatureKey[];

describe("the features", () => {
  it("are the features that have colors in the theme", () => {
    const themed = [...themeStylesheet.matchAll(/--feature-([a-z]+):/g)].map(
      ([, name]) => name,
    );
    expect(FEATURES.toSorted()).toEqual(themed.toSorted());
  });

  it("name only tokens the theme declares", () => {
    for (const feature of FEATURES)
      for (const value of Object.values(featureColors(feature)))
        for (const [, token] of value.matchAll(/var\((--feature-[a-z-]+)/g))
          expect(themeStylesheet, `${feature}: ${token}`).toMatch(
            new RegExp(`${token}:`),
          );
  });

  // The strong shade exists only where the browser can mix it; an icon
  // falls back to the text's color and an edge to the outline, both of
  // which hold 3:1.
  it("give the strong shade a fallback at every use", () => {
    expect(featureColors("recipes")).toMatchObject({
      "--feature-icon": "var(--feature-recipes-strong, var(--theme-text))",
      "--feature-outline":
        "var(--feature-recipes-strong, var(--theme-outline))",
    });
  });
});
