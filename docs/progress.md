# Klankern — Progress

The current state of the project against the milestones in [`plan.md`](./plan.md): what is built, where it deviates from the plan and what comes next. How each part came about (the decisions, the bugs found, what was checked by hand) is in the topic files that [`CLAUDE.md`](./CLAUDE.md) lists.

**Resuming in a new session**: the last release is v1.6.0 (2026-10-13), slice 1 of the vacation planner. Unreleased since then: slice 2 of the vacation planner, a `feat` commit on `develop` that also closes a gap in the live sync of every feature, and before it a change of how the tests sign in. Read this file, then the topic files for what you are about to touch. The repo and these docs are the source of truth, not any prior chat history.

## Status at a glance

| Milestone                                | Status                                                                                                                                                                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Scaffold + tooling + git hooks        | ✅ Done                                                                                                                                                                                                                       |
| 2. Schema + RLS + two-JWT test           | ✅ Done — RLS test passing against Supabase Cloud                                                                                                                                                                             |
| 3. Auth + household join flow            | ✅ Done — clicked through in a browser (OTP login, invite, join)                                                                                                                                                              |
| 4. Shared to-do list CRUD                | ✅ Done — clicked through in a browser (add, toggle, remove, reload, second member sees the list)                                                                                                                             |
| 5. Realtime sync for to-dos              | ✅ Done — proven by the Playwright e2e test (two browsers, incl. reconnect)                                                                                                                                                   |
| 6. Shared shopping list                  | ✅ Done — CRUD + live sync, covered by unit tests and the Playwright e2e test                                                                                                                                                 |
| 7. PWA installability pass               | ✅ Done — installability, offline page, update notice and install button covered by the Playwright `pwa` project; the install button also checked by hand in Chrome. Installing on Android moves to milestone 8 (needs HTTPS) |
| 8. Deploy (Netlify; containers deferred) | ✅ Done — deployed to Netlify from `main`; routing and response headers checked on the deployed URL, and login, join link, install, offline page, the Android install and the update notice checked there in a browser        |
| 9. Shared whiteboard                     | ✅ Built — drawing, eraser, undo, clear and live sync, covered by unit, RLS and Playwright e2e tests, and tried by hand on a phone and with a second member                                                                   |
| 10. Shared recipes                       | ✅ Built — write, read, edit and remove recipes with live sync, and put a recipe's ingredients on the shopping list; covered by unit, RLS and Playwright e2e tests, and clicked through in a browser by one member            |

## What's built

**Stack as scaffolded**: Nuxt **4** (not 3 — 4 is what `nuxi init` installs now; API is compatible, folder convention differs: the source lives under `app/`, not beside the configuration), SPA mode (`ssr: false`), `nuxt-quasar-ui`, `@vite-pwa/nuxt`, `@nuxtjs/supabase`, Pinia. Backend is a Supabase Cloud project.

**Project layout** (relative to the git root, which is the Nuxt project):

```text
app/
  types/            database.types.ts (generated), household.ts, synced-row.ts, list.ts, todo.ts,
                    shopping.ts, whiteboard.ts, recipe.ts, vacation.ts, dashboard.ts
  composables/      current-user.ts, household-actions.ts, todo-actions.ts, shopping-actions.ts,
                    whiteboard-actions.ts, recipe-actions.ts, vacation-actions.ts,
                    household-realtime.ts, reset-stores-on-user-change.ts,
                    use-gravatar-hash.ts (+ .spec.ts siblings),
                    use-household-realtime.ts, use-reset-stores-on-user-change.ts,
                    use-pwa-update-notice.ts
  utils/            position.ts, list-state.ts, shopping-state.ts, error-message.ts,
                    inserts-in-flight.ts, changes-during-fetch.ts, realtime-event-order.ts,
                    whiteboard-state.ts, whiteboard-geometry.ts, recipe-state.ts, recipe-draft.ts,
                    gravatar.ts, avatar-rosette.ts, person-badge.ts, email.ts (+ .spec.ts siblings),
                    whiteboard-pen.ts, ink.ts (+ .spec.ts), routes.ts,
                    list-preview.ts, whiteboard-preview.ts (+ .spec.ts siblings),
                    vacation-state.ts, vacation-templates.ts, vacation-share.ts,
                    local-date.ts, in-app-path.ts (+ .spec.ts siblings)
  stores/           household.ts, todos.ts, shopping.ts, whiteboard.ts, recipes.ts, vacations.ts
  pages/            login.vue, confirm.vue, index.vue, todos.vue, shopping.vue, whiteboard.vue,
                    join/[code].vue, recipes/{index,new}.vue, recipes/[id]/{index,edit}.vue,
                    vacations/{index,new,[id]}.vue
  components/       household/{CreateHouseholdForm,InviteDialog,MemberRoster}.vue,
                    dashboard/{DashboardTile,TileListPreview,VacationTile}.vue,
                    todo/{TodoList,TodoItem}.vue, shopping/{ShoppingList,ShoppingItem}.vue,
                    whiteboard/{SharedWhiteboard,WhiteboardToolbar,WhiteboardSurface,WhiteboardStroke,WhiteboardPreview}.vue,
                    recipe/{RecipeList,RecipeView,RecipeIngredients,RecipeEditor,RecipeForm}.vue,
                    vacation/{VacationList,VacationForm,VacationView,VacationHeader,VacationPhase,VacationTask,
                              FairShare,VacationPeople,RejectDialog,PersonAvatar}.vue,
                    user/{UserAvatar,AccountMenu}.vue
  layouts/          default.vue
  assets/css/       theme.css (the colors of light and dark mode), hover-contrast.css, touch-target.css
public/                 offline.html, icons, favicon.ico, robots.txt, _redirects (Netlify fallback for client-side routes)
scripts/                generate-pwa-icons.mjs (writes the app icons and the favicon in `public/`)
supabase/migrations/    0001_households.sql … 0016_vacation_people.sql
tests/support/          supabase-fixtures.ts (disposable users/households/invites via the Admin API, shared by RLS + e2e),
                        e2e-ui.ts (sign-in and list steps through the real UI), realtime-socket.ts (cut/watch the Realtime socket, hold back frames),
                        fake-supabase-client.ts (fake query builder + client for the `*-actions.spec.ts` unit tests)
tests/rls/              household-isolation.spec.ts (two-JWT RLS proof against Supabase Cloud)
tests/unit/             environment.spec.ts (the Vitest environment mounts a Vue component)
tests/e2e/              Playwright `dev` project (against `nuxt dev`): auth, household, lists, realtime-sync,
                        session-switch, whiteboard, recipes, vacations, avatars, dashboard, a11y, app-version (*.e2e.ts); `pwa` project: pwa.e2e.ts (production build)
netlify.toml            build settings for Netlify
.github/                the CI and release workflows, and the release tooling as a package of its own (`.github/release`)
docs/                   this documentation
```

**Design pattern used throughout**: business logic lives in plain `composables/*-actions.ts` functions that take a `SupabaseClient` as a parameter, unit-tested with a mocked client (no Nuxt runtime needed). Pinia stores are thin — they call `useSupabaseClient()`/`useSupabaseUser()` and delegate to those functions. State-transition logic that needs testing on its own (optimistic add/dedup, soft-delete, sort order) is further extracted into pure reducer functions in `utils/`. List logic that doesn't depend on the item type (dedup, soft delete, Realtime events, reconnect merge) is **generic** over `ListItem` (`types/list.ts`) in `utils/list-state.ts` and shared by every list; only the actions, store, components and list-specific ordering are per list. The whiteboard follows it too (see "Milestone 9" in [`features/whiteboard.md`](features/whiteboard.md)), and so do the recipes (see "Milestone 10" in [`features/recipes.md`](features/recipes.md)).

**Testing**: Vitest, 499 tests in 34 files passing (including the RLS suite) (`npm test`, run 2026-10-13). Playwright e2e (`npm run test:e2e`, 34 tests in 13 files and two projects; see "Milestone 5" in [`features/lists-and-realtime.md`](features/lists-and-realtime.md), "Milestone 7" in [`infra/deploy-and-pwa.md`](infra/deploy-and-pwa.md) and "E2E gap review" in [`infra/testing.md`](infra/testing.md)) is separate and not in the pre-push hook; CI runs it on every push to `main` and `develop` (see "CI" in [`infra/ci.md`](infra/ci.md)). Husky pre-commit (lint-staged: eslint --fix + prettier, and markdownlint-cli2 --fix before prettier on Markdown files), commit-msg (commitlint) and pre-push (type check and full test suite) are wired and verified firing through git's actual hook dispatcher — not just callable manually. The hooks are in `.husky`, and `npm ci` points `core.hooksPath` at `.husky/_`. The Markdown files (`docs/`, the root `CLAUDE.md`) are formatted by Prettier and linted for their structure by `npm run lint:md`, in CI too.

**Database types**: generated from the live schema via `supabase gen types typescript`, saved to `app/types/database.types.ts`, picked up automatically by `@nuxtjs/supabase`'s default `types` path. Re-run after any migration changes:

```bash
npx supabase gen types typescript --db-url "$DB_URL" --schema public > app/types/database.types.ts
npx prettier --write app/types/database.types.ts
```

## Other notable decisions / deviations from the plan

- **The Nuxt project is the git root** (since 2026-10-12, deviating from the plan's `app/` folder, in which Nuxt 4's source folder of the same name gave `app/app/`). Every command runs from the root. See "The move to the git root" in [`infra/project-layout.md`](infra/project-layout.md).
- **No local Supabase stack.** Development and tests run directly against Supabase Cloud (the plan's fallback), and `supabase start` is not part of the workflow.
- **No dev container** (decided 2026-10-10, deviating from the plan's `Containerfile.dev` + `podman-compose.yml`). Development stays on the host: Node is pinned (`.nvmrc`, `engine-strict`), and the e2e tests drive the host's Chrome against the host's dev server. A dev container would add a `node_modules` volume, user-namespace mapping and a polling file watcher for little gain; add one if a second machine or contributor needs it. Production is hosted on Netlify instead of in a container (see "Milestone 8" in [`infra/deploy-and-pwa.md`](infra/deploy-and-pwa.md)). The Podman production setup is **deferred, not dropped**: if it is built later, it is `Containerfile.prod` (Node 24, not the plan's `node:22-slim`), Quadlet units and Caddy. A throwaway smoke test of a two-container Podman setup (Caddy proxying to a Node server, via compose and via plain `podman run`) passed beforehand.
- **Component path prefixing disabled** (`components: [{ path: '~/components', pathPrefix: false }]` in `nuxt.config.ts`) so `components/household/CreateHouseholdForm.vue` registers as `<CreateHouseholdForm>` rather than Nuxt's default `<HouseholdCreateHouseholdForm>`. Keep using subfolders per feature (`components/todo/`, `components/shopping/`, …) — this config makes that free.
- **Icons are SVG, not an icon font** (`quasar.iconSet: 'svg-mdi-v7'` in `nuxt.config.ts`). See "Icon strategy" in [`ui/icons-fonts-and-markup.md`](ui/icons-fonts-and-markup.md).
- **Route paths live in `ROUTES`** (`app/utils/routes.ts`, auto-imported; `nuxt.config.ts` imports it explicitly for the auth redirect config). Never write a literal path like `'/login'` in pages, components or config. Routing itself stays file-based, so renaming a route means changing `ROUTES` **and** renaming the file in `pages/`.
- **`household_id` is denormalized onto every item table** (`todo_items`, `shopping_items`, etc.) per the plan, specifically so RLS policies and Realtime channel filters don't need a join.

## Environment / secrets

`.env` at the git root (gitignored) holds: `SUPABASE_URL`, `SUPABASE_KEY` (publishable), `SUPABASE_DB_PASSWORD`, `SUPABASE_SECRET_KEY`. The DB password and secret key are **server-side/test-tooling only** — never read by `nuxt.config.ts`'s public runtime config, never shipped to the browser. The secret key in particular should stay out of anything client-facing permanently; it's only used by `tests/rls/` to provision disposable test users via the Admin API.

## Next steps

Every milestone of the plan is built. The four checks that were listed here are done (the Gravatar photo, the whiteboard by hand, the update notice and the footer version on the deployed site, all 2026-10-11). [`features/header.md`](features/header.md) and [`ui/theme-and-contrast.md`](ui/theme-and-contrast.md) still name a few things nobody has looked at, mostly in dark mode.

1. Try milestone 10 by hand where the click-through didn't reach: on a phone by touch, with a second member, in light mode and on the deployed site.
2. Try the dashboard on a phone by touch, and with a second member changing things.
3. After the move of the Nuxt project to the git root, which is on `main` since 2026-10-12: sign in on the deployed site and look at the update notice in an installed app. The first deploy in the new layout was broken and is repaired; a guard against its cause is proposed and not built. See "The move to the git root on `main`, and a broken deploy" in [`infra/deploy-and-pwa.md`](infra/deploy-and-pwa.md). Every other checkout is cleaned up before it pulls the move ("What a person has to do" in [`infra/project-layout-plan.md`](infra/project-layout-plan.md)).
4. Write a README for the project. The Nuxt starter text was deleted with the move.
5. Separate development from production: a dev Supabase project for development, the tests and CI, a staging site built from `develop`, and migrations applied by a workflow. Discussed on 2026-10-12, not approved as a whole and not started; four decisions are open, the first being whether a second Supabase project is possible on the current plan. See "Plan: separate development from production" in [`infra/environments.md`](infra/environments.md).
6. The vacation planner. Slice 1 of three is released (1.6.0, 2026-10-13) and the user tried it on the deployed site. Slice 2, fair share, is built the same day and not released: the people on a trip, tasks given, taken and rejected with a reason, "Who has what", whose lines filter the tasks by person, and sign-in leading back to the page that was asked for. After trying it the user had the task's row put back on one line, "Tell them" removed, and "Who has what" shortened to a strip of names that are buttons and filter the tasks in place of "Only my tasks", all before a release (see [`features/vacations-slice-2-after-trying.md`](features/vacations-slice-2-after-trying.md)); the app is to get notifications instead, which nothing plans yet. Migration 0016 is applied to the cloud project. The release is a push of `develop` and `main`; after it come the checks of "After a deploy" in [`features/vacations-slice-2.md`](features/vacations-slice-2.md), which need two phones; its items about "Tell them" no longer apply. Slice 3 is the meal plan that fills the shopping list (migration 0017). The design is in [`features/vacations.md`](features/vacations.md) and [`features/vacations-design-decisions.md`](features/vacations-design-decisions.md), the screens in [`features/vacations-screens.md`](features/vacations-screens.md), and what the reviews decided for slice 3 in [`features/vacations-review.md`](features/vacations-review.md), [`features/vacations-scope-review.md`](features/vacations-scope-review.md) and [`features/vacations-design-review.md`](features/vacations-design-review.md).
7. Optional, later: the Podman production setup (`Containerfile.prod`, Quadlet units, Caddy).
