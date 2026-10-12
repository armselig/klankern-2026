# Icons, fonts and markup

The history of the icons, the fonts and the rules for markup and formatting, oldest first. The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## Icon strategy (2026-10-10)

Icons are SVG paths from **Material Design Icons v7** (`@quasar/extras`, now a direct dependency), imported where they are used (`import { mdiDeleteOutline } from '@quasar/extras/mdi-v7'`, `:icon="mdiDeleteOutline"`), so only the icons a screen uses are bundled. `quasar.iconSet` is `svg-mdi-v7`, which also makes the icons Quasar's own components draw (select arrows, clear buttons, …) SVG. Chosen by the user over staying with text labels, the Material Icons web font, Iconify and hand-picked SVG files; MDI over Material Icons for its larger catalogue.

- **The "no icon font" setup never worked as intended.** `nuxt-quasar-ui` adds the font of the configured `iconSet` (default `material-icons`) to `extras.fontIcons` on its own (`autoIncludeIconSet`), so `fontIcons: []` had no effect and every production build shipped the 128 KB Material Icons font unused. With an SVG `iconSet` it is gone; `fontIcons: []` was removed from the config.
- **Never use a string icon name** (`icon="delete"`): without the font it renders as literal text.
- **Existing buttons**: the per-row "Remove" button of both lists is icon-only with `aria-label="Remove"` (keeps rows narrow on phones); Add, Copy, "Invite a family member", the dashboard's To-dos/Shopping and the header's Install app/Sign out/Log in (since 2026-10-11 "Install app" is icon-only, and "Invite a family member" and "Sign out" are in the account menu) have an icon next to their label. Form submit buttons, "Use a different email" and "Close" stay text only. Accessible names are unchanged, so the e2e helpers needed no change.
- **Test**: `lists.e2e.ts` checks that the Remove button contains an `svg` and no text; verified to fail with a string icon name.
- Not auto-imported via `extras.svgIcons`: that would register about 7,400 global names.

Checked by the user in a browser (2026-10-10).

## Formatting and markup rules, and the mobile viewport (2026-10-11)

The tooling now holds the formatting, the spelling of component tags and the screen the e2e tests run at. `CLAUDE.md` ("Conventions and gotchas") records them, together with two rules that no tool checks: build mobile-first, and favor progressive enhancement.

- **Prettier runs with its defaults** (80 columns, semicolons, double quotes); `.prettierrc.json` is empty.
- **Components are kebab-case in markup** (`<nuxt-link>`, `<q-btn>`, `<invite-dialog>`): ESLint's `vue/component-name-in-template-casing`, also for components it can't see registered. File names stay PascalCase.
- **The Playwright `dev` project runs at 375x667**, an iPhone SE, the reference screen for the mobile-first rule. The `pwa` project keeps Playwright's default viewport.
- The whole code base was reformatted once under the new rules (`prettier --write .` and `eslint --fix`, 97 files, no change in behaviour), in a commit of its own.

## Fonts: two replacements tried, Roboto stays (2026-10-11)

The font is Roboto again, shipped by Quasar (`quasar.extras.font: 'roboto-font'`), as before. Two replacements were built and dropped the same day, both on the user's decision after seeing them:

- **Stacks of the device's own fonts** (modernfontstacks.com: Slab Serif, Geometric Humanist, Monospace Slab Serif), with no font shipped. They come out as a different font on each system, which can't be checked without owning each, and the result looked cheap and unmatched. Never committed.
- **Bitter, Nunito Sans and JetBrains Mono from the `@fontsource` packages**, shipped with the app so that every device shows the same page. Released as 1.3.0 and reverted in the next release.

Kept from it: `vite.build.assetsInlineLimit` in `nuxt.config.ts`, which stops Vite from writing a font file under 4 KB into the stylesheet. With Roboto it changes nothing yet (its smallest file is just above that), so it only guards a later change of fonts.

Worth knowing for a next attempt: a `@fontsource` weight is one file per script with its own `unicode-range`, so only the Latin file is fetched; `public/offline.html` is not built and can't name the build's hashed font files, so it needs copies at fixed addresses, precached by the service worker; and none of these fonts has emoji, which stay the device's own.
