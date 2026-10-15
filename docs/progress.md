# Klankern — Progress

The current state of the project: what is built, where it deviates from [`plan.md`](./plan.md) and what comes next. It is kept to two printed pages. How each part came about (the decisions, the bugs found, what was checked by hand) is in the topic files that [`CLAUDE.md`](./CLAUDE.md) lists; the rules for the code are in the root `CLAUDE.md`.

**Resuming in a new session**: the last release is v1.11.0 (2026-10-15), slice 1a of the meal planner. Before it the same day, v1.10.0: slice 3 of the vacation planner and the version moved into the menus. Each release and how it was checked is in [`infra/releases.md`](infra/releases.md). On `develop` and not released: the fix of the meal plan's e2e tests and documentation, none of which makes a release. Read this file, then the topic files for what you are about to touch. The repo and these docs are the source of truth, not any prior chat history.

## Status

| Part                             | Status                                                 | History                                                              |
| -------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| 1. Scaffold and git hooks        | ✅ Done                                                | [`infra/project-layout.md`](infra/project-layout.md)                 |
| 2. Schema and RLS                | ✅ Done, RLS suite against Supabase Cloud              | [`features/auth-and-households.md`](features/auth-and-households.md) |
| 3. Auth and household join       | ✅ Done, clicked through                               | [`features/auth-and-households.md`](features/auth-and-households.md) |
| 4–6. To-dos, live sync, shopping | ✅ Done, clicked through and e2e                       | [`features/lists-and-realtime.md`](features/lists-and-realtime.md)   |
| 7–8. PWA and deploy to Netlify   | ✅ Done, checked on the deployed site and on Android   | [`infra/deploy-and-pwa.md`](infra/deploy-and-pwa.md)                 |
| 9. Whiteboard                    | ✅ Done, tried on a phone with a second member         | [`features/whiteboard.md`](features/whiteboard.md)                   |
| 10. Recipes                      | ✅ Done, tried on a phone and on the deployed site     | [`features/recipes.md`](features/recipes.md)                         |
| Dashboard with live tiles        | ✅ Released 1.5.0                                      | [`features/dashboard.md`](features/dashboard.md)                     |
| Vacation planner, slices 1–3     | ✅ Released 1.6.0 to 1.10.0; slice 3 not tried by hand | [`features/vacations/`](features/vacations/CLAUDE.md)                |
| Meal planner, slice 1a           | ✅ Released 1.11.0; not tried by hand                  | [`features/meal-planner.md`](features/meal-planner.md)               |

## What's built

Nuxt 4 as an SPA (`ssr: false`) with Quasar, Pinia and `@vite-pwa/nuxt`, on Supabase Cloud through `@nuxtjs/supabase`; served by Netlify as a static build. Every feature follows the layers of "Architecture" in the root `CLAUDE.md`.

- `app/`: the source, by Nuxt 4's folders (`composables/`, `stores/`, `utils/`, `types/`, `components/` with one folder per feature, `pages/`).
- `supabase/migrations/`: `0001` to `0018`, all applied to the cloud project.
- `tests/`: `rls/` (one spec per feature against Supabase Cloud), `e2e/` (Playwright, projects `dev` and `pwa`), `support/` (fixtures and UI steps shared by both).
- `public/`, `scripts/`, `netlify.toml`: the static files, the icon generator and the build settings.
- `.github/`: the CI and release workflows, and the release tooling as a package of its own.

**Tests**: Vitest, 745 tests in 46 files, the RLS suite included (CI, 2026-10-15). Playwright, 39 tests in 15 files and two projects. CI on `develop` on 2026-10-15 passed 38 of them, the meal plan's three included after their fix (see "The e2e tests failed on CI: a clock ahead of the session" in [`features/meal-planner.md`](features/meal-planner.md)); "a wrong code shows an error" in `auth.e2e.ts` failed, because the error message did not show, and was not looked into.

## Deviations from the plan

- **The Nuxt project is the git root**, not the plan's `app/` folder (2026-10-12). See "The move to the git root" in [`infra/project-layout.md`](infra/project-layout.md).
- **No local Supabase stack.** Development and tests run against Supabase Cloud, the plan's fallback.
- **No dev container, and production on Netlify instead of Podman** (2026-10-10). The Podman setup is deferred, not dropped. See "No dev container, Podman deferred" in [`infra/deploy-and-pwa.md`](infra/deploy-and-pwa.md).

## Environment

`.env` at the git root (gitignored, see `.env.example`) holds `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_DB_PASSWORD` and `SUPABASE_SECRET_KEY`. The last two are for test tooling only and never reach the client.

## Next steps

[`features/header.md`](features/header.md) and [`ui/theme-and-contrast.md`](ui/theme-and-contrast.md) name a few things nobody has looked at yet, mostly in dark mode.

1. The meal planner. Try slice 1a on a phone. On 2026-10-28, run the query of "Measuring whether it is used" in [`features/meal-planner.md`](features/meal-planner.md): if fewer than 4 of the 14 days since the release have a dinner, slices 2 and 3 wait. Next is slice 1b: the other slots, the move dialog, the trip's view and the shopping run from the plan.
2. The vacation planner. Try slice 3 on two phones: "After a deploy" in [`features/vacations/slice-3.md`](features/vacations/slice-3.md). The app is to get notifications in place of "Tell them"; nothing plans them yet.
3. Write a README. Deferred (2026-10-14).
4. A guard against the cause of the broken first deploy after the move to the git root, proposed and not built. See "The move to the git root on `main`, and a broken deploy" in [`infra/deploy-and-pwa.md`](infra/deploy-and-pwa.md).
5. Separate development from production: a dev Supabase project, a staging site from `develop` and migrations applied by a workflow. Not approved; four decisions are open. See "Plan: separate development from production" in [`infra/environments.md`](infra/environments.md).
6. Split [`infra/testing.md`](infra/testing.md) and [`infra/environments.md`](infra/environments.md), both past 2,500 words, the next time they are touched.
7. Optional, later: the Podman production setup.
