# Test ids

How the end-to-end tests find the elements of a page. The rule itself is in the root [`CLAUDE.md`](../../CLAUDE.md); the rest of the tests' history is in [`infra/testing.md`](./testing.md).

## Test ids instead of text (2026-10-13)

Until now the specs found nearly every element by what it says: 225 locators by role and name, 63 by text, 54 by label and 19 by CSS. A reworded label broke tests that were not about it, and a translation would have broken all of them. Now every element a test needs has a `data-testid`, and the specs and the helpers in `tests/support/e2e-ui.ts` find it by that. The rule is in the root `CLAUDE.md`.

Decided with the user before the work:

- **The attribute is `data-testid`**, Playwright's default, so the config names none.
- **The ids are one constant**, `TEST_IDS` in `app/utils/test-ids.ts`, for the templates and the tests alike.
- **Only the app's own words were replaced.** A row is still picked by the text the test typed into it, since that is the test's and not the app's.
- **Text the app puts together is still asserted**, found by id: the days until a trip, a phase's count, a tile's lines. Putting such values into attributes of their own was rejected: the test would stop checking what a person reads.
- **The ids are in the production build.** The `pwa` project runs against it, and stripping them would have cost a switch in the build for a few hundred bytes.
- **`a11y.e2e.ts` keeps its locators by role and name.** A locator by name failed when a control lost its name; one by id does not. That spec walks every page, so it is now the one that notices a missing or changed name, together with axe and with the names a spec asserts outright, such as whose a task is on its button.

What Quasar made of it:

- An attribute on `q-input` lands on the native field, and on `q-btn`, `q-checkbox` and `q-menu` on the element with the role, so `fill()`, `toBeChecked()` and `toBeFocused()` work on the id.
- `q-option-group` builds its radios itself and passes nothing on to them. A radio is found by the place of its option, and for that the lists of the whiteboard's tools and of the kinds of stay moved from their components into `utils/`.
- The plugin's dialogs and notices are built from objects. An unknown key reaches the button as an attribute, but the types don't allow it; `withTestId` adds it.
- All menus of a kind have one id, and a menu that was closed is still in the page while it fades. The first run found two lists of people at once. The helpers that open a menu now wait until none is left.

Also changed in the app: the footer's version is in an element of its own, and every place that shows an error has the one id `error-message`, which replaced the specs' look for the class `text-negative`.

Run on 2026-10-13, after the last change: the `dev` project in one run, 28 of 29 passed, and the 5 tests of the `pwa` project against a production build, all passed. The one failure is `app-version.e2e.ts`, which found the footer's element with 1.6.0 in it: the `nuxt dev` it reused had been started before the release (see "What the tests need" in the root `CLAUDE.md`). Not run against a fresh server: Nuxt refuses a second dev server in the same folder, and the running one was left alone.

## A type check for the tests (2026-10-13)

`TEST_IDS` was meant to turn a misspelled id into a type error, and in the tests it did not: `nuxt typecheck` reads `app/` and the server, and neither Playwright nor Vitest checks types, so `tests/` and `playwright.config.ts` had never been checked at all. `tests/tsconfig.json` now covers them, and `npm run typecheck` runs it after Nuxt's own check, so the pre-push hook and CI do too.

It extends `.nuxt/tsconfig.app.json` instead of standing alone, because the tests import files of the app, which use its aliases. Tried with a file that names `TEST_IDS.list.rowx`: the check fails with "Property 'rowx' does not exist". The 20 files it reads had no error of their own.

In the same change `.gstack` went into `.prettierignore`: `npm run format:check` failed on a file gstack writes there, which is not in git.
