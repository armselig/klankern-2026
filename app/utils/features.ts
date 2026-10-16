import {
  mdiBagSuitcaseOutline,
  mdiCartOutline,
  mdiChefHat,
  mdiDraw,
  mdiFormatListChecks,
  mdiHumanChild,
  mdiSilverwareForkKnife,
} from "@quasar/extras/mdi-v7";

/**
 * The app's features, each with its color in assets/css/theme.css. The keys
 * are the tokens' names (`--feature-todos`, `--feature-todos-strong` …), so
 * a tile or a heading finds its color from the key alone.
 *
 * The meals and the Tonight tile share `meals`; the household and its kids
 * share `household`, whose icon is the kids' page's.
 */
export const FEATURE_ICONS = {
  todos: mdiFormatListChecks,
  shopping: mdiCartOutline,
  meals: mdiSilverwareForkKnife,
  recipes: mdiChefHat,
  vacations: mdiBagSuitcaseOutline,
  whiteboard: mdiDraw,
  household: mdiHumanChild,
} as const;

export type FeatureKey = keyof typeof FEATURE_ICONS;

/**
 * The CSS variables a feature is drawn with, each with what a browser
 * without `color-mix()` gets instead (see "Feature colors" in
 * docs/rules/look.md): the strong shade exists only where the browser can
 * mix it.
 */
export function featureColors(feature: FeatureKey) {
  const strong = `--feature-${feature}-strong`;
  return {
    "--feature-accent": `var(--feature-${feature})`,
    "--feature-tint": `var(--feature-${feature}-tint)`,
    "--feature-edge": `var(--feature-${feature}-edge)`,
    "--feature-icon": `var(${strong}, var(--theme-text))`,
    "--feature-outline": `var(${strong}, var(--theme-outline))`,
  };
}
