# Rules for the code

The rules for working on the code, one file per topic. The root `CLAUDE.md` holds only a pointer here, because no `CLAUDE.md` may exceed 500 characters. Read this file before any work, then the files below for what the task touches.

## What this is

Klankern is a family-organizer PWA: shared to-do and shopping lists, a shared whiteboard, shared recipes and a vacation planner per household, synced live. Nuxt 4 SPA (`ssr: false`) + Quasar (`nuxt-quasar-ui`) + Pinia + `@vite-pwa/nuxt`, backed by Supabase Cloud (Postgres, Auth via email OTP, Realtime) through `@nuxtjs/supabase`.

- `docs/plan.md` is the original design and milestone list.
- `docs/progress.md` is the current state: what is built, the decisions that deviate from the plan, and the next steps. Read it before larger work.
- The history of each feature, of the app's look and of the tooling (decisions, bugs already found, what was checked by hand) is in topic files under `docs/`. `docs/README.md` lists them and holds the rules for writing documentation. When a milestone or notable fix lands, update its topic file and `docs/progress.md`.

## The rule files

- [`commands.md`](./commands.md): "Layout", "Commands" and "What the tests need": where the project sits, the commands, single tests, and what the unit, RLS and e2e tests, the git hooks and CI need.
- [`architecture.md`](./architecture.md): "Layers", "Shared list logic" and "Realtime": how a feature is split, the rules every synced store follows, what differs per store, the bookkeeping, and the one channel per household.
- [`database.md`](./database.md): "Database and security" and "Migrations and types": RLS, the SECURITY DEFINER functions, the rules that came out of bugs, applying migrations and generating the types.
- [`delivery.md`](./delivery.md): "Deployment" and "Releases": the static build on Netlify and the releases by semantic-release.
- [`look.md`](./look.md): "Colors and contrast", "Feature colors", "Corners and edges" and "Motion": the theme's tokens, text on accents, tints and edges, hover and focus, the inks, a color per feature with its tint and strong shade, the radius scale, cards and shadows, and the rules for animation.
- [`conventions.md`](./conventions.md): "Conventions and gotchas": the user id, routes, icons, avatars, the dashboard's tiles, the layout for small screens, the e2e tests' ids, and the gotchas of Vue and Quasar.

## Writing the rule files

- **A rule file is the present, and it is overwritten**, as `progress.md` is. It holds no dated sections; how a rule came about goes into the topic file of the thing it concerns.
- **A rule stands once**, in the file of its topic. A new topic gets a file of its own and a line in the list above.
- **No `CLAUDE.md` may exceed 500 characters.** It points to files and holds no rules itself; `node .claude/hooks/docs-check.mjs` reports one that is longer (`claude-md-size`).

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. Route only to skills in the session's available-skills list; answer directly for quick questions or small scoped edits.

Key routing rules:

- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy → never /ship or /land-and-deploy: a release is a push of `develop` and `main`, and semantic-release owns the version and the changelog (see "Releases" in `rules/delivery.md`)
