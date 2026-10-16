# Environments

Which environments the app has and what each one talks to, oldest first. The current state is in [`progress.md`](../progress.md); [`README.md`](../README.md) lists the other topic files.

## Plan: separate development from production (discussed 2026-10-12, not implemented yet)

Discussed with the user on 2026-10-12. Several decisions are made and four are open (see "Open decisions"). Nothing of it is done, and the plan as a whole is not approved yet. This section holds what was found out and decided, and the order of the work; the exact commands are worked out when it is carried out.

Paths are written for the layout with the Nuxt project at the git root. That move is on `develop` and not on `main` yet (see "The move to the git root" in [`infra/project-layout.md`](project-layout.md)), and it touches files this plan changes too: `netlify.toml`, both workflows and the root `CLAUDE.md`. On `main` since 2026-10-12.

### What is shared today

There is one Supabase project, and everything uses it. The frontend is already separate (`nuxt dev` runs locally, Netlify builds only `main`), so this is a question of the backend.

- The RLS and e2e suites run in the production database. They create disposable users and delete households with the secret key, which bypasses RLS (`deleteTestData` in `tests/support/supabase-fixtures.ts`). A bug in a fixture could delete real households.
- The production secret key and database password are in `.env` on the developer's machine and in GitHub's secrets. Nothing in production needs either one, since there is no server.
- A migration's first run is on real data. The free plan has no downloadable backups.
- `.mcp.json` gives an agent SQL write access to production.
- Test sign-ins and real sign-ins share one project's auth limits. This is why CI runs one at a time and why Netlify's deploy previews and branch deploys are off.

### Target

| Environment | Frontend                              | Supabase project | Used by                                  |
| ----------- | ------------------------------------- | ---------------- | ---------------------------------------- |
| production  | Netlify, production deploy of `main`  | production       | the family                               |
| staging     | Netlify, branch deploy of `develop`   | dev              | the user and test users, on real devices |
| dev         | `nuxt dev` on the developer's machine | dev              | development, the test suites, CI         |

### Decisions (user, 2026-10-12)

- Development and production get separate backends.
- There is a staging frontend that is reachable from the internet, for testing on different devices: a Netlify branch deploy of `develop`.
- The user and test users sign in on staging. So the dev project needs real email: custom SMTP and both code templates, as production has.
- Dev and staging carry an environment label, in the header next to the wordmark or in the footer, and in the manifest. Production carries none.
- Migrations are applied by automation, after an approval.

### Open decisions

1. **The Supabase slot.** The user is not sure a second free project is possible. It shows in the Supabase dashboard, under the organization's projects. If the slot is taken: free one, or go to the Pro plan (see "The backend: options and costs").
2. **The form of the approval.** Proposed: a workflow the user starts by hand now, and GitHub's reviewer gate later if the repository becomes public (see "Migrations").
3. **Migrations on dev without asking each time.** Proposed: yes, since nothing real lives there. Anything that touches production still needs the user's go-ahead.
4. **Where the label sits.** Proposed: a small badge next to "Klankern" in the header, because it is on every screen (see "The environment label").

### The backend: options and costs (checked 2026-10-12)

| Option                                             | Cost                                                       | Notes                                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A second Cloud project on the free plan            | none                                                       | The working assumption. Needs a free slot: the plan allows two active projects.          |
| Pause or delete a project that is no longer needed | none                                                       | Frees a slot; paused projects reportedly don't count.                                    |
| Pro plan, dev as a second project                  | $25 a month, plus about $10 a month for the second project | Neither project pauses, and production gets daily backups.                               |
| Pro plan, dev as a persistent branch               | about the same (a branch starts at $0.01344 an hour)       | Supabase's GitHub integration applies migrations on merge, but it expects pull requests. |

A free project is paused after about a week of low activity and has to be restored by hand in the dashboard. This matters twice:

- A paused dev project stops CI, the pre-push hook and staging.
- Production loses the activity that the test suites generate today and depends on real use alone.

### The staging frontend

Netlify calls a build of a branch a "branch deploy"; "deploy previews" are builds of pull requests, which this project doesn't use, and they stay off. The branch deploy of `develop` gets a stable HTTPS address of its own, so the PWA can be installed from it. It is a separate origin: its service worker, its session and its installed app are apart from production's.

- **The branch deploy must get the dev project's `SUPABASE_URL` and `SUPABASE_KEY`.** Proposed: `[context.develop.environment]` in `netlify.toml`. The values are then reviewed in git and can't be forgotten in a settings page. Both are public, since they ship in the bundle, and the dev project's address is in the repository anyway once `.mcp.json` names it. The other way is Netlify's UI, which can hold a different value per deploy context.
- **Staging needs a `noindex`.** `public/robots.txt` allows everything, and Netlify adds `X-Robots-Tag: noindex` to deploy previews and old deploys only, not to the latest branch deploy.
- **Cost.** On Netlify's credit-based plans a production deploy costs 15 credits (the free plan has 300 a month) and branch deploys are free. On an older plan every build uses build minutes. Which plan the site is on can't be seen from the repository.
- **Netlify builds `develop` without waiting for CI**, so a commit that fails the checks lands on staging too.
- **Every release rebuilds staging once more**, because the release workflow fast-forwards `develop`. Harmless.
- **Staging is public.** Anyone who has the address can sign up into the dev database, as anyone can in production.

### The environment label

Proposed design: `nuxt.config.ts` reads Netlify's `CONTEXT` variable at build time. Under `nuxt dev` the label is "dev", on the branch deploy "staging", and in a production build there is none. The manifest's `name` and `short_name` carry it too, because two installed apps that are both called "Klankern" can't be told apart on a phone.

- `develop` carries the last release's version number while it holds unreleased commits. The proposal is to show the commit beside the version on staging.
- The label also shows a staging build that was given production's values by mistake, as long as the person looking knows which data to expect.
- Tests: one in the `dev` Playwright project (the label is there) and one in the `pwa` project (a production build has none). `a11y.e2e.ts` will scan the badge, so its contrast on the header is calculated first (see "Conventions and gotchas" in the root `CLAUDE.md`).

### Migrations

1. **Dev.** A migration is applied to dev while it is being developed, because the pre-push hook runs the RLS suite against dev. CI on `develop` applies whatever is still pending before its tests, as a safety net.
2. **Production.** A workflow "Migrate production", started by hand on `develop`. It lists the pending migrations, then applies them. Starting it is the approval.
3. **Release.** `main` is pushed afterwards, as today. A check on `main` fails if production still has pending migrations. It is a job of its own with read permission only, not a step of the release job: that job can write to the repository and installs nothing but the release tooling, on purpose. The check can only report a forgotten migration; Netlify has built `main` by then.

GitHub's own gate would be an environment with a required reviewer, where the job waits for a click. For a private repository that needs a paid organization plan; for a public one it is free. The repository is private today.

- **Order.** Netlify builds `main` the moment it is pushed, so the migration has to be applied before that push. In between, production runs the old code on the new schema, and installed apps keep an old bundle for longer still. Migrations have to stay backward compatible.
- **The production database password goes into GitHub's secrets** for that workflow. The secret key leaves GitHub with the split; the password does not.
- **The workflows probably can't use a project's direct database address.** It is expected to be IPv6 only, and GitHub's runners to have no IPv6; the session pooler's address is the way around it (see "Not verified").
- **Types** (`app/types/database.types.ts`) are generated from dev.

### Steps

#### The backend

1. Settle the slot (open decision 1). The user creates the dev project, in production's region and on the same Postgres major version (17).
2. Apply `0001`–`0014` to dev with `supabase db push`. This is the first proof that the migrations rebuild the schema from nothing.
3. Compare the two schemas (a schema-only dump of each). Whatever exists only in production was changed by hand and becomes a migration. `db push --dry-run` against production must report nothing pending.
4. Bring over the settings that exist only in the dashboard. Copied from production: the "Magic link" and "Confirm signup" templates with `{{ .Token }}`, the code's length and expiry, the auth rate limits. Set for dev, not copied: the Site URL (the staging address, with the local dev server as an additional redirect URL) and SMTP with credentials of its own. See "Resolved: login emails contained no OTP code" in [`features/auth-and-households.md`](../features/auth-and-households.md). Try `supabase config push`, so that these settings live in `supabase/config.toml` from then on.
5. Point `.env`, the GitHub secrets and `.mcp.json` at dev. Run `npm test` and `npm run test:e2e`, then let CI run once.
6. Create the user's account and a household in dev, for working by hand.
7. Rotate production's secret key and database password. Until then the old copies still work.
8. Count the test users that crashed runs left in production (their addresses end in `TEST_EMAIL_DOMAIN` from `supabase-fixtures.ts`). Delete them and their households only with the user's go-ahead.
9. Optional: the fixtures refuse to run against production's address.

#### Staging

10. Build the environment label with its tests, before the branch deploy is turned on, so that the first staging build carries it.
11. The dev values for `develop` and the `noindex`, then, in Netlify, branch deploys for `develop` alone.
12. Check that staging talks to dev: the label, the host of the requests in the browser's network panel, and a household that exists only in dev.
13. By hand on real devices: sign-in with an emailed code, install, the offline page, the update notice.

#### The migration workflows

14. The step in the CI workflow, the "Migrate production" workflow and the check on `main`, as under "Migrations".

#### Documentation

15. The root `CLAUDE.md`: "What the tests need", the CI comment, "Deployment" (the line that says branch deploys stay off), "Migrations and types". (2026-10-16: these sections are now in `rules/commands.md`, `rules/delivery.md` and `rules/database.md`, see "CLAUDE.md files of at most 500 characters" in [`infra/project-layout.md`](project-layout.md).) `progress.md`: the environment section and the next steps. Dated remarks in [`infra/ci.md`](ci.md), [`infra/deploy-and-pwa.md`](deploy-and-pwa.md) and [`features/auth-and-households.md`](../features/auth-and-households.md). A new section at the end of this file tells what was done and what turned out differently.

### Traps

- **A branch deploy without its own values is built with production's.** Staging would then show the family's data under unreleased code, and nothing would fail.
- **Supabase's built-in mailer delivers only to members of the Supabase organization.** A test user's first code request fails with "Email address not authorized" until custom SMTP is set. A new address gets the "Confirm signup" template, not "Magic link".
- **The dev project and production share one quota at the email provider** if both send through the same account.
- **`supabase/config.toml` holds the local stack's defaults today.** `config push` sends what the file says, so read what it would change before running it against either project.
- **CI stays one run at a time.** CI, local runs and the people on staging share dev's sign-in limits. The limit on code verifications is per IP address (360 an hour, in bursts of up to 30).
- **A workflow that is started by hand has to be on the default branch first.** "Migrate production" can't be started on `develop` before its file has reached `main`. And a push to `main` that brings a workflow file `develop` doesn't have yet is the case where the release's fast-forward of `develop` fails (see "Releases" in the root `CLAUDE.md`): push `develop` first.
- **`.mcp.json` decides where an agent's SQL goes.** After the switch, production can no longer be read through it either.

### What a person has to do

- Supabase: look at the slot, create the project, set up SMTP and the templates, rotate the keys.
- The email provider: a second API key for dev.
- Netlify: find out which plan the site is on, turn on the branch deploy of `develop`.
- GitHub: replace the three secrets, add the database password for the migration workflow.
- Invite the test users to staging.

### Considered and not chosen

- **A local Supabase stack in CI only.** It covers the tests, but staging needs a backend that is reachable from the internet, and the pre-push hook runs against a cloud project (see "Other notable decisions / deviations from the plan" in [`progress.md`](../progress.md)).
- **A separate schema inside the production project.** Users, rate limits and the secret key would still be shared.
- **A second Netlify site that builds `develop` as its production branch.** It can't be given the wrong backend by an omission, but on a credit-based plan each of its deploys costs credits.
- **Production deploys started by the workflow** (a Netlify build hook after the migration, with git-triggered production builds ignored). It removes the two-step routine of migrating and then pushing; it is more wiring, and can follow if that routine proves annoying.

### Not verified

Each of these was assumed or read in a third-party source on 2026-10-12, and is checked when the step that needs it is carried out.

- The free plan's limit of two active projects, and that paused projects don't count towards it.
- That Netlify's free plan allows a different value per deploy context in the UI, and whether a value in `netlify.toml` wins over one set in the UI.
- That GitHub's runners can't reach a project's direct database address, and that `supabase db push` works through the session pooler.
- That a workflow started by hand runs only once its file is on the default branch.
- How a `noindex` is set for one deploy context only.
- Which settings `supabase config push` covers.
- Which GitHub plan a reviewer gate needs on a private repository.
- What `CONTEXT` is under `netlify serve --offline`, which serves the build that the `pwa` project tests.
- Whether the Supabase MCP server can be added a second time, read-only, for production.
