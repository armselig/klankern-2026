# Releases

The history of the automated releases and the changelog, oldest first. The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## Releases: automated versions and changelog (built 2026-10-10, v1.0.0 released the same day)

Every push to `main` is now a release, cut by semantic-release in `.github/workflows/release.yml`: the version follows from the commit messages since the last tag, and `CHANGELOG.md` (at the git root until 2026-10-11, since then `app/CHANGELOG.md`), the version in `app/package.json`, the tag and the GitHub release are written by the workflow. How it works day to day is in `CLAUDE.md` ("Releases"). Since 2026-10-12 the Nuxt project is the git root: where this file says `app/CHANGELOG.md`, `app/package.json`, `app/package-lock.json`, `app/.prettierignore` or `app/.output`, the file or folder is at the root now, and `.releaserc.yaml` names no paths (see "The move to the git root" in [`infra/project-layout.md`](project-layout.md)).

Decisions:

- **Every push to `main`, not a release pull request.** Netlify deploys every push to `main`, so that push already is the release. The price is a bot commit on `main` after almost every push: the workflow fast-forwards `develop` to it, and both local branches have to be pulled before the next push.
- **The first release is 1.0.0 and lists the whole history** (the 20 `feat` and `fix` commits so far, plus whatever the first push adds). semantic-release has no 0.x mode: without a tag it starts at 1.0.0.
- **Not gated on CI.** Netlify doesn't wait for CI either, so the tag marks what was deployed. Gating would also delay the release commit by a full CI run, and `develop` would more often have moved on by then.
- **Own package in `.github/release`.** In `app/package.json` the tooling would add 348 lockfile entries (it bundles the npm CLI) to every Netlify build and to the CI job that holds the secret key. The release job installs only this package, with `--ignore-scripts` and without the npm cache, because it can write to the repository.
- **The version is shown in the footer** (`Version X.Y.Z`, from `runtimeConfig.public.appVersion`, read from `package.json` at build time). So the release commit has no `[skip ci]`: Netlify builds twice per release, and until the second build is live the site shows the previous version.
- **commitlint in a `commit-msg` hook** (`@commitlint/config-conventional`, 45 lockfile entries, none with install scripts). All 59 earlier commit messages pass it unchanged.
- The GitHub plugin's comments and labels on issues and pull requests are off, so the job needs only `contents: write`.

Found while building it:

- `conventional-changelog-conventionalcommits` 10.x does not work with the notes plugin semantic-release ships ("Missing helper"); 9.3.1 is the version that plugin is tested with.
- `--dry-run` skips exactly the steps that needed checking (changelog, version bump, commit). The setup was instead run for real in a scratch clone against a scratch bare repository, with the files as committed apart from the GitHub plugin: a first release (1.0.0, three files in the commit, tag on it, `develop` fast-forwarded), a run with nothing to release, and a `fix` commit giving 1.0.1.
- **A leftover `app/.output` breaks the local `pwa` e2e project.** If `app/.output/public` exists from an earlier `nuxt generate` without the Netlify preset, a later `netlify serve` build takes the old HTML from there for every route that folder has, instead of rendering it; the pages then point at script files that no longer exist, and the four `pwa.e2e.ts` tests fail on "Sign in to Klankern". Deleting `app/.output` fixes it: the leftover found here was deleted on 2026-10-10, and the four tests pass again. Not caused by the release work, and CI and Netlify build from a fresh checkout. Why the prerender step reads that folder was not traced in Nitro's source then, so the folder could come back with the next local `nuxt generate`. Traced and fixed on 2026-10-11, see "The `pwa` e2e project and a leftover `.output`" in [`infra/testing.md`](testing.md).

Tests: `app-version.e2e.ts` (the footer shows the version from `package.json`; written first and seen to fail), and the `a11y` and `pwa` specs pass with the change.

**First real run, 2026-10-10: v1.0.0.** `develop` and `main` were pushed together, and the "Release" workflow passed on its first run, in 26 seconds:

- The release commit `chore(release): 1.0.0` is on `main` with exactly `CHANGELOG.md`, `app/package.json` and `app/package-lock.json` in it, and the tag `v1.0.0` is on that commit.
- `CHANGELOG.md` has 21 entries (the 20 earlier `feat` and `fix` commits and the footer version), and the GitHub release is published.
- `develop` was fast-forwarded to the release commit, and no workflow run started for it.
- The CI runs for the pushed commit passed on both branches, the new `app-version.e2e.ts` included.

**Four more releases on 2026-10-11: v1.1.0, v1.2.0, v1.3.0 and v1.3.1.** Each was a push of `develop` and `main` together, and the "Release" workflow passed every time, as did CI on both branches.

- 1.1.0: the member avatars, the header with the account menu and the hover-contrast fix. 1.2.0: the theme. 1.3.0: the shipped fonts. 1.3.1: their revert.
- **v1.4.0, the same day**: milestone 10 and the fix for the lists created twice, again as one push of `develop` and `main`, with the workflow and CI on both branches passing. The fix has a commit of its own (`fix(lists): …`) so that the changelog lists it; its unique constraints are in the feature commit's migration, which is why the feature commit comes first.
- **v1.5.0, 2026-10-12**: the dashboard with live tiles and the fix of the success notices' colors, as one push of `develop` and `main`. The workflow and CI on both branches passed. That CI run was the first of the whole e2e suite after the change to `untilFadesEnd` (see "Dashboard with live tiles" in [`features/dashboard.md`](../features/dashboard.md)); before it, the suite had run once in full, with the account menu's scan failing. The release commit's Netlify deploy was `ready`, and the deployed page carried `appVersion:"1.5.0"`.
- **v1.6.0, 2026-10-13**: slice 1 of the vacation planner, as one push of `develop` and `main` after three documentation commits. The workflow and CI on both branches passed, and the user tried the deployed site the same day (see "After a deploy" in [`features/vacations/slice-1.md`](../features/vacations/slice-1.md)).
- **v1.7.0, 2026-10-13**: slice 2 of the vacation planner and what the user changed after trying it, with the dashboard's vacations tile and the tiles' order, as one push of `develop` and `main` with 13 commits. The workflow passed and `develop` was fast-forwarded. Netlify's deploy of the release commit was `ready`, and the deployed site was rendered in Chrome: the sign-in and join pages show "Version 1.7.0" without a page error, and signed in as a disposable member the dashboard has the tiles in the new order with the vacations tile's two links working, and a vacation's page shows the strip of names and the letters of people without an account. The pull request from `develop` to `main` that existed was closed unmerged before the push, and the planner's issues were deleted, at the user's request.
- **v1.8.0, 2026-10-14**: a new vacation starts empty or with an earlier trip's tasks in place of the templates, with Quasar's date picker; "Who has what" sorted by open tasks; and a task added under a person's line given to them. One push of `develop` and `main` with three commits, split by feature and each type-checked and unit-tested on its own before the push. The workflow and CI on `main` passed, and `develop` was fast-forwarded. CI on `develop`, for the same commit, failed once in `session-switch.e2e.ts` (B's shopping list did not show within 15 seconds); not looked into further, see "A slow auth service and a refused insert on CI" in [`infra/testing.md`](./testing.md) for the likely cause. Netlify's deploy of the release commit was `ready`, and the deployed site was rendered in Chrome: `/`, `/vacations/new` and `/join/abc` show "Version 1.8.0" without a page error. Signed-in pages of the deployed site were not looked at.
- **v1.8.1, 2026-10-14**: "Change people" in the frame of "Who has what", one `fix` commit. The workflow passed, Netlify's deploy was `ready`, and `/` and `/join/abc` of the deployed site show "Version 1.8.1" without a page error. CI on `main` failed in browser journey 1 of the vacations, because Supabase's auth service answered after 19.8 seconds; the CI run for `develop` was cancelled by the queue, which keeps one waiting run (see "A slow auth service and a refused insert on CI" in [`infra/testing.md`](./testing.md)).
- **Netlify's deploys can be read without the dashboard**: logged in, `npx netlify api listSiteDeploys --data '{"site_id":"<id>","per_page":2}'` lists them with their commit and state (`npx netlify sites:list --json` has the id), and the folder doesn't have to be linked. For v1.4.0 the release commit's deploy was `ready`, and the deployed page carried `appVersion:"1.4.0"`.
- **A revert releases a patch**, by the commit analyzer's default rules (`.releaserc.yaml` sets none of its own). The rule goes by what the parser recognises as a revert, not by the commit type: the message has to start with `revert:` or `Revert` and keep git's line "This reverts commit `<hash>`.", as the 1.3.1 commit did. A hand-written `revert: …` without that line releases nothing.
- Each release commit holds exactly `app/CHANGELOG.md`, `app/package.json` and `app/package-lock.json`, so the changelog's new place works (see "Changelog moved into `app/`").
- `develop` was fast-forwarded to the release commit every time.

**Netlify builds the release commit** (checked by the user on the deployed site, 2026-10-11): the footer reads `Version 1.3.1`, the version that only the release commit carries. Netlify reports nothing back to GitHub, so the footer is the place to see it.

Still open: the fast-forward step's failure paths (`develop` moved on, or workflow changes on `main` that `develop` lacks) have not happened yet.

## Changelog moved into `app/` (2026-10-11)

On the user's request `CHANGELOG.md` moved from the git root to `app/CHANGELOG.md`: `changelogFile` and the git plugin's `assets` in `.releaserc.yaml` point there, and `app/.prettierignore` lists the file, because Prettier rejects the generated format and `format:check` would fail on every release commit. `--dry-run` doesn't write the changelog, so the first real run of this path was the next release, 1.1.0, the same day: it and the three releases after it wrote `app/CHANGELOG.md` and committed it with the version bump.

Back at the git root since 2026-10-12, still beside `package.json`, which moved there with the whole Nuxt project (see "The move to the git root" in [`infra/project-layout.md`](project-layout.md)).

## A scope in every commit message (2026-10-14)

At the user's request commitlint requires a scope (`scope-empty: [2, "never"]` in `package.json`): `fix(auth): …`, never `fix: …`. Two commits of the same day had none (`docs: record releases 1.8.0 and 1.8.1 …` and `fix: take the user id from the session …`) and were already pushed to `develop`; they were left as they are.

Checked against messages piped into `npx commitlint`: one without a scope fails; one with a scope, the release workflow's `chore(release): 1.8.2` and a `Revert "…"` pass (commitlint ignores reverts and merges by default).
