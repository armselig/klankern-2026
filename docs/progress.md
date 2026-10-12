# Klankern — Progress

The current state of the project against the milestones in [`plan.md`](./plan.md): what is built, where it deviates from the plan and what comes next. How each part came about (the decisions, the bugs found, what was checked by hand) is in the topic files that [`CLAUDE.md`](./CLAUDE.md) lists.

**Resuming in a new session**: the last release is v1.5.0 (2026-10-12), and nothing but documentation is unreleased. Read this file, then the topic files for what you are about to touch. The repo and these docs are the source of truth, not any prior chat history.

## Status at a glance

| Milestone | Status |
|---|---|
| 1. Scaffold + tooling + git hooks | ✅ Done |
| 2. Schema + RLS + two-JWT test | ✅ Done — RLS test passing against Supabase Cloud |
| 3. Auth + household join flow | ✅ Done — clicked through in a browser (OTP login, invite, join) |
| 4. Shared to-do list CRUD | ✅ Done — clicked through in a browser (add, toggle, remove, reload, second member sees the list) |
| 5. Realtime sync for to-dos | ✅ Done — proven by the Playwright e2e test (two browsers, incl. reconnect) |
| 6. Shared shopping list | ✅ Done — CRUD + live sync, covered by unit tests and the Playwright e2e test |
| 7. PWA installability pass | ✅ Done — installability, offline page, update notice and install button covered by the Playwright `pwa` project; the install button also checked by hand in Chrome. Installing on Android moves to milestone 8 (needs HTTPS) |
| 8. Deploy (Netlify; containers deferred) | ✅ Done — deployed to Netlify from `main`; routing and response headers checked on the deployed URL, and login, join link, install, offline page, the Android install and the update notice checked there in a browser |
| 9. Shared whiteboard | ✅ Built — drawing, eraser, undo, clear and live sync, covered by unit, RLS and Playwright e2e tests, and tried by hand on a phone and with a second member |
| 10. Shared recipes | ✅ Built — write, read, edit and remove recipes with live sync, and put a recipe's ingredients on the shopping list; covered by unit, RLS and Playwright e2e tests, and clicked through in a browser by one member |

## What's built

**Stack as scaffolded**: Nuxt **4** (not 3 — 4 is what `nuxi init` installs now; API is compatible, folder convention differs: app code lives under `app/app/`, not `app/`), SPA mode (`ssr: false`), `nuxt-quasar-ui`, `@vite-pwa/nuxt`, `@nuxtjs/supabase`, Pinia. Backend is a Supabase Cloud project.

**Project layout** (relative to `app/`, the Nuxt project root):
```
app/app/
  types/            database.types.ts (generated), household.ts, synced-row.ts, list.ts, todo.ts,
                    shopping.ts, whiteboard.ts, recipe.ts, dashboard.ts
  composables/      current-user.ts, household-actions.ts, todo-actions.ts, shopping-actions.ts,
                    whiteboard-actions.ts, recipe-actions.ts,
                    household-realtime.ts, reset-stores-on-user-change.ts,
                    use-gravatar-hash.ts (+ .spec.ts siblings),
                    use-household-realtime.ts, use-reset-stores-on-user-change.ts,
                    use-pwa-update-notice.ts
  utils/            position.ts, list-state.ts, shopping-state.ts, error-message.ts,
                    inserts-in-flight.ts, changes-during-fetch.ts, realtime-event-order.ts,
                    whiteboard-state.ts, whiteboard-geometry.ts, recipe-state.ts, recipe-draft.ts,
                    gravatar.ts, avatar-rosette.ts, email.ts (+ .spec.ts siblings),
                    whiteboard-pen.ts, ink.ts (+ .spec.ts), routes.ts,
                    list-preview.ts, whiteboard-preview.ts (+ .spec.ts siblings)
  stores/           household.ts, todos.ts, shopping.ts, whiteboard.ts, recipes.ts
  pages/            login.vue, confirm.vue, index.vue, todos.vue, shopping.vue, whiteboard.vue,
                    join/[code].vue, recipes/{index,new}.vue, recipes/[id]/{index,edit}.vue
  components/       household/{CreateHouseholdForm,InviteDialog,MemberRoster}.vue,
                    dashboard/{DashboardTile,TileListPreview}.vue,
                    todo/{TodoList,TodoItem}.vue, shopping/{ShoppingList,ShoppingItem}.vue,
                    whiteboard/{SharedWhiteboard,WhiteboardToolbar,WhiteboardSurface,WhiteboardStroke,WhiteboardPreview}.vue,
                    recipe/{RecipeList,RecipeView,RecipeIngredients,RecipeEditor,RecipeForm}.vue,
                    user/{UserAvatar,AccountMenu}.vue
  layouts/          default.vue
  assets/css/       theme.css (the colors of light and dark mode), hover-contrast.css
app/public/                 offline.html, icons, favicon.ico, robots.txt, _redirects (Netlify fallback for client-side routes)
app/scripts/                generate-pwa-icons.mjs (writes the app icons and the favicon in `public/`)
app/supabase/migrations/   0001_households.sql … 0014_recipes.sql
app/tests/support/          supabase-fixtures.ts (disposable users/households/invites via the Admin API, shared by RLS + e2e),
                            e2e-ui.ts (sign-in and list steps through the real UI), realtime-socket.ts (cut/watch the Realtime socket, hold back frames),
                            fake-supabase-client.ts (fake query builder + client for the `*-actions.spec.ts` unit tests)
app/tests/rls/              household-isolation.spec.ts (two-JWT RLS proof against Supabase Cloud)
app/tests/unit/             environment.spec.ts (the Vitest environment mounts a Vue component)
app/tests/e2e/              Playwright `dev` project (against `nuxt dev`): auth, household, lists, realtime-sync,
                            session-switch, whiteboard, recipes, avatars, dashboard, a11y, app-version (*.e2e.ts); `pwa` project: pwa.e2e.ts (production build)
netlify.toml                at the git root: build settings for Netlify
```

**Design pattern used throughout**: business logic lives in plain `composables/*-actions.ts` functions that take a `SupabaseClient` as a parameter, unit-tested with a mocked client (no Nuxt runtime needed). Pinia stores are thin — they call `useSupabaseClient()`/`useSupabaseUser()` and delegate to those functions. State-transition logic that needs testing on its own (optimistic add/dedup, soft-delete, sort order) is further extracted into pure reducer functions in `utils/`. List logic that doesn't depend on the item type (dedup, soft delete, Realtime events, reconnect merge) is **generic** over `ListItem` (`types/list.ts`) in `utils/list-state.ts` and shared by every list; only the actions, store, components and list-specific ordering are per list. The whiteboard follows it too (see "Milestone 9" in [`features/whiteboard.md`](features/whiteboard.md)), and so do the recipes (see "Milestone 10" in [`features/recipes.md`](features/recipes.md)).

**Testing**: Vitest, 271 tests in 27 files passing (including the RLS suite) (`npm test`, run 2026-10-12). Playwright e2e (`npm run test:e2e`, 31 tests in 12 files and two projects; see "Milestone 5" in [`features/lists-and-realtime.md`](features/lists-and-realtime.md), "Milestone 7" in [`infra/deploy-and-pwa.md`](infra/deploy-and-pwa.md) and "E2E gap review" in [`infra/testing.md`](infra/testing.md)) is separate and not in the pre-push hook; CI runs it on every push to `main` and `develop` (see "CI" in [`infra/ci.md`](infra/ci.md)). Husky pre-commit (lint-staged: eslint --fix + prettier) and pre-push (full test suite) are wired and verified firing through git's actual hook dispatcher — not just callable manually. Note the project lives one directory below the git root (`app/` inside `klankern-2026/`), which needed a non-default Husky setup (`prepare` script does `cd .. && husky app/.husky`, and `core.hooksPath` points at `app/.husky/_`) since Husky's own `.git` detection assumes the package.json directory *is* the repo root.

**Database types**: generated from the live schema via `supabase gen types typescript`, saved to `app/app/types/database.types.ts`, picked up automatically by `@nuxtjs/supabase`'s default `types` path. Re-run after any migration changes:
```
npx supabase gen types typescript --db-url "$DB_URL" --schema public > app/types/database.types.ts
npx prettier --write app/types/database.types.ts
```

## Other notable decisions / deviations from the plan

- **No local Supabase stack.** Development and tests run directly against Supabase Cloud (the plan's fallback), and `supabase start` is not part of the workflow.
- **No dev container** (decided 2026-10-10, deviating from the plan's `Containerfile.dev` + `podman-compose.yml`). Development stays on the host: Node is pinned (`.nvmrc`, `engine-strict`), and the e2e tests drive the host's Chrome against the host's dev server. A dev container would add a `node_modules` volume, user-namespace mapping and a polling file watcher for little gain; add one if a second machine or contributor needs it. Production is hosted on Netlify instead of in a container (see "Milestone 8" in [`infra/deploy-and-pwa.md`](infra/deploy-and-pwa.md)). The Podman production setup is **deferred, not dropped**: if it is built later, it is `Containerfile.prod` (Node 24, not the plan's `node:22-slim`), Quadlet units and Caddy. A throwaway smoke test of a two-container Podman setup (Caddy proxying to a Node server, via compose and via plain `podman run`) passed beforehand.
- **Component path prefixing disabled** (`components: [{ path: '~/components', pathPrefix: false }]` in `nuxt.config.ts`) so `components/household/CreateHouseholdForm.vue` registers as `<CreateHouseholdForm>` rather than Nuxt's default `<HouseholdCreateHouseholdForm>`. Keep using subfolders per feature (`components/todo/`, `components/shopping/`, …) — this config makes that free.
- **Icons are SVG, not an icon font** (`quasar.iconSet: 'svg-mdi-v7'` in `nuxt.config.ts`). See "Icon strategy" in [`ui/icons-fonts-and-markup.md`](ui/icons-fonts-and-markup.md).
- **Route paths live in `ROUTES`** (`app/app/utils/routes.ts`, auto-imported; `nuxt.config.ts` imports it explicitly for the auth redirect config). Never write a literal path like `'/login'` in pages, components or config. Routing itself stays file-based, so renaming a route means changing `ROUTES` **and** renaming the file in `pages/`.
- **`household_id` is denormalized onto every item table** (`todo_items`, `shopping_items`, etc.) per the plan, specifically so RLS policies and Realtime channel filters don't need a join.

## Environment / secrets

`app/.env` (gitignored) holds: `SUPABASE_URL`, `SUPABASE_KEY` (publishable), `SUPABASE_DB_PASSWORD`, `SUPABASE_SECRET_KEY`. The DB password and secret key are **server-side/test-tooling only** — never read by `nuxt.config.ts`'s public runtime config, never shipped to the browser. The secret key in particular should stay out of anything client-facing permanently; it's only used by `tests/rls/` to provision disposable test users via the Admin API.

## Next steps

Every milestone of the plan is built. The four checks that were listed here are done (the Gravatar photo, the whiteboard by hand, the update notice and the footer version on the deployed site, all 2026-10-11). [`features/header.md`](features/header.md) and [`ui/theme-and-contrast.md`](ui/theme-and-contrast.md) still name a few things nobody has looked at, mostly in dark mode.

1. Try milestone 10 by hand where the click-through didn't reach: on a phone by touch, with a second member, in light mode and on the deployed site.
2. Try the dashboard on a phone by touch, and with a second member changing things.
3. Move the Nuxt project from `app/` to the git root, in a workspace and on a branch of its own. The plan is approved (2026-10-12) and written out step by step, with the Markdown linter that follows the move, in "Plan: the Nuxt project moves to the git root" in [`infra/project-layout.md`](infra/project-layout.md). The user checks Netlify's own build settings before the push to `main`.
4. Optional, later: the Podman production setup (`Containerfile.prod`, Quadlet units, Caddy).
