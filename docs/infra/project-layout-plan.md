# Project layout: the plan for the move

The plan to move the Nuxt project from `app/` to the git root. How the move went is in [`infra/project-layout.md`](project-layout.md), which held this plan until the file was split on 2026-10-12. The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## Plan: the Nuxt project moves to the git root (written and approved 2026-10-12, not implemented yet)

The Nuxt project is the folder `app/`, and Nuxt 4 keeps its source in a folder of the same name, so every source file is under `app/app/`. The user wants the contents of the outer `app/` at the git root. This section is the plan for that. The user approved it on 2026-10-12. Nothing of it is done yet: it is carried out later, in a workspace of its own, on its own branch.

Carried out on 2026-10-12 as far as step 11, and step 12 on the same day; see "The move to the git root" in [`infra/project-layout.md`](project-layout.md).

### What changes and what doesn't

Everything under `app/` moves as one unit, so nothing inside it has to change: no source file, no test, no relative import, not the Vitest globs, not the Playwright paths, not `nuxt.config.ts` (`./app/utils/routes` and `./package.json` stay right). `scripts/generate-pwa-icons.mjs` writes to `public/` relative to where it is started, which becomes the root. The comments that say `app/assets/css/theme.css` (in `public/offline.html` and in that script) are right after the move as they are.

What changes is the handful of files that describe the nesting: `netlify.toml`, both workflows, `.releaserc.yaml`, the three git hooks, the `prepare` script, the two `.gitignore` files and the documentation.

Checked on 2026-10-12 in a throwaway clone: the move commands under "Steps" record 164 files as renames with 100% similarity, and `git log --follow` on a moved file reaches its whole history (a plain `git log <path>` stops at the move).

### Decisions (user, 2026-10-12)

- The move is wanted, but not yet: later, in a new workspace with its own branch.
- `app/README.md` is the untouched Nuxt starter text and would become the repository's front page. It is deleted with the move; a README for the project is written later.
- `docs/` is formatted with Prettier once and stays under `format:check`.
- The Markdown files get a linter, and the bold lines that stand in for headings become real headings; see "A linter for the Markdown files".
- The user checks Netlify's own build settings; see "What a person has to do".

### What is gained and what it costs

Gained: the repository has the layout Nuxt 4 expects, with the project at the root and the source in `app/`. Every command runs from the root, and an editor opened on the repository finds the TypeScript, ESLint and Prettier configuration. Four workarounds go: `base = "app"` in `netlify.toml`, `working-directory: app` in the CI workflow, the three paths in `.releaserc.yaml`, and the `cd` in the `prepare` script and in each hook.

The costs:

- The root grows from 11 tracked entries to 29, the project's configuration beside `docs/`, `.agents/` and `.github/`.
- Prettier, run as `prettier --check .`, sees the whole repository. On 2026-10-12 twelve files outside `app/` failed it: seven in `docs/`, `.releaserc.yaml`, `.mcp.json` and three in `.agents/`. lint-staged starts to format staged files in `docs/` and `.github/` on commit, which it doesn't do today.
- ESLint and the type check gain nothing: no JavaScript, TypeScript or Vue file is tracked outside `app/`, and the `tsconfig` files Nuxt generates name `app/`, `shared/`, `server/` and `nuxt.config.*`, not the root.
- The release configuration changes, and `--dry-run` doesn't run the steps that change (see "Releases" in the root `CLAUDE.md`).
- `CHANGELOG.md` returns to the root, a day after it was moved into `app/` (see "Changelog moved into `app/`" in [`infra/releases.md`](releases.md)). It stays beside `package.json`, which was the reason for that move.
- About 40 lines that mention `app/` in the root `CLAUDE.md` and in `docs/` have to be read one by one. A search and replace can't do it: `app/utils/routes.ts` is right after the move, `app/package.json` is wrong, and both match the same pattern.

### Traps

- **The git hooks stop without a word.** Husky sets `core.hooksPath` in the repository's configuration, today to `app/.husky/_`. When that folder is not there, git runs no hook and says nothing; when the folder is there but the hook file isn't, Husky's runner ends with success. So after the move, commits and pushes go unchecked until `prepare` has run in the new layout.
- **A `git worktree` shares that setting with the main checkout.** Whichever of the two ran `prepare` last has working hooks, and the other one has none. A separate clone has its own configuration and avoids this. With a worktree, run `npm run prepare` in the checkout you are about to commit in, and look at `git config --get core.hooksPath`.
- **`.env` is not tracked.** A new workspace has none, and it must be copied in only after the merged `.gitignore` is at the root, or `git add -A` stages the secrets.
- **Never delete the old folder with `rm -rf app`.** In a checkout that has been worked in, it holds `.env` beside the folders that can be rebuilt.
- **A checkout that pulls the move keeps its ignored files where they were**, which is then inside the source folder: `app/node_modules`, `app/.nuxt`, `app/dist`, `app/.env`. The type check includes everything under `app/`. Clean up before pulling (see "What a person has to do"). Netlify's build cache was such a checkout (2026-10-12); see "The move to the git root on `main`, and a broken deploy" in [`infra/deploy-and-pwa.md`](deploy-and-pwa.md).
- **`app/app` has to become `app/`**, where the outer folder still is, so it goes by way of a temporary name.
- **CI runs only for `main` and `develop`.** The branch is checked on the developer's machine; GitHub first checks it when `develop` gets it.
- **The `dev` e2e project reuses whatever answers on port 3000.** A `nuxt dev` still running from another checkout would be what gets tested.

### Steps

In a fresh clone (or worktree), on a new branch such as `build/project-root`. None of the commit types used here (`style`, `build`, `docs`) makes a release.

1. **Format first.** In `app/`: `npm ci`, then `npx prettier --write ../docs ../CLAUDE.md ../.releaserc.yaml ../.mcp.json`. Commit as `style: …`. On its own, so that the move stays a commit of renames.
2. **Clear what the install left in `app/`.** `git clean -ndX app` lists the ignored files; in a fresh workspace expect `node_modules`, `.nuxt` and `.husky/_`, and no `.env`. Then `git clean -fdX app`.
3. **Move.** The shell has to be `bash`:

   ```bash
   git mv app/app app-src
   for entry in $(git ls-files app | cut -d/ -f2 | sort -u); do
     case "$entry" in
       .gitignore | README.md) ;;
       *) git mv "app/$entry" "$entry" ;;
     esac
   done
   git rm app/README.md
   { printf '\n'; cat app/.gitignore; } >> .gitignore
   git rm app/.gitignore
   git add .gitignore
   # Refuses if anything is left in the folder, and that is the point.
   if [ -d app ]; then rmdir app; fi
   git mv app-src app
   ```

   Then tidy the merged `.gitignore` by hand: the line for `.github/release/node_modules` is covered by `node_modules`.

4. **Edit the files that describe the nesting**, for the same commit:
   - `package.json`: `"prepare": "husky"`.
   - `.husky/commit-msg`, `.husky/pre-commit`, `.husky/pre-push`: without the line `cd app`.
   - `.prettierignore`: add `.agents` and `skills-lock.json`. The skills are another project's files, and the lock file records a hash of them. `CHANGELOG.md` stays listed.
   - `netlify.toml`: `base` goes, with the comments about it; the comment on the redirects names `public/_redirects`.
   - `.github/workflows/ci.yml`: no `working-directory`; `node-version-file: .nvmrc`; `cache-dependency-path: package-lock.json` stays written out, because `.github/release` holds a second lock file; the uploaded folders are `test-results` and `playwright-report`.
   - `.github/workflows/release.yml`: `node-version-file: .nvmrc`, and the comment at its top.
   - `.releaserc.yaml`: `changelogFile`, `pkgRoot` and the git plugin's `assets` go, because the plugins' defaults are the three files at the root. `changelogTitle`, `npmPublish: false` and `message` stay. The comments say why the defaults fit now.
5. **Install, and commit the move.** `npm ci` at the root; `git config --get core.hooksPath` must then print `.husky/_`. Stage the edits of step 4 and commit as `build: …`. Netlify and CI build every push, so the move and those edits are one commit. The pre-commit hook goes over all the renamed files, which takes a moment and should change none of them.
6. **Check that the hooks are alive**, now that nothing is staged: `git commit --allow-empty -m "no type"` must be rejected by commitlint. If that commit gets through, the hooks are not running; take it back with `git reset --soft HEAD~1` and find out why before going on.
7. **Copy `.env`** from the old checkout to the root. `git check-ignore -v .env` must name a rule, and `git status` must not show the file.
8. **Check.** `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, then `npm run test:e2e` with no other `nuxt dev` running and no CI run under way (the sign-in limit). The `pwa` project builds through `netlify.toml`, so it is the local test of the Netlify change.
9. **Rehearse a release** the way the root `CLAUDE.md` describes under "Releases": in a scratch clone whose only remote is a scratch bare repository, without the GitHub plugin and without a token, with one throwaway `fix:` commit. The clone has to have the moved layout as its `main`, the only branch that is released from, and semantic-release has to be started with `--no-ci`: outside a CI system it otherwise falls back to a dry run by itself. The release commit must hold exactly `CHANGELOG.md`, `package.json` and `package-lock.json`, the changelog must continue the existing one under its title, and the tag must be on that commit.
10. **The Markdown linter**, as a commit of its own (`build: …`), with the fixes for what it finds; see "A linter for the Markdown files".
11. **Documentation**, as `docs: …`:
    - The root `CLAUDE.md`: "Layout" shrinks to the source folder being `app/`; the commands, `.env`, `.output/public`, "Deployment", "Releases" and "Migrations and types" lose the outer folder.
    - `progress.md` is rewritten where it is: the layout listing, the environment, the path of the generated types.
    - The topic files are not rewritten. Each overtaken statement gets a dated remark that points here: in [`infra/releases.md`](releases.md), [`infra/deploy-and-pwa.md`](deploy-and-pwa.md), [`ui/theme-and-contrast.md`](../ui/theme-and-contrast.md) and [`features/auth-and-households.md`](../features/auth-and-households.md). `plan.md` is the original design and stays.
    - This file gets a new section at its end that tells what was done and what turned out differently. Since the split of 2026-10-12 that section is in [`infra/project-layout.md`](project-layout.md).
12. **Bring it to `main`.** If `develop` moved on in the meantime, rebase onto it and look for strays: `git ls-files app/app` must print nothing, and `app/` must hold only the nine source entries. Whatever was written in `docs/` on `develop` after step 1 has never been formatted, so run `npm run format`, commit what it changes as `style: …`, and repeat the checks of step 8. Fast-forward `develop`, push it, wait for CI, then push `main`. `develop` goes first because the workflows changed (see "Releases" in the root `CLAUDE.md`). If `develop` carries a `feat` or `fix` by then, this push is also the first real release with the new configuration.

### What a person has to do

- **Reminder for the user: look at Netlify's own build settings before the push to `main`.** Base directory, package directory and publish directory must not name `app`; `netlify.toml` no longer sets a base that would overrule them. This can't be seen from the repository. A build that fails is not published, and the last deploy stays live. Read through Netlify's API on 2026-10-12, after the push: the base directory is empty.
- After the deploy: the footer shows the version, a `/join/<code>` link opens the app, and an installed app shows the update notice. The first build on Netlify and the first CI run start without their caches. Wrong for Netlify (2026-10-12): its cache brought `app/node_modules` back, and the first deploy was broken; see "The move to the git root on `main`, and a broken deploy" in [`infra/deploy-and-pwa.md`](deploy-and-pwa.md). Looked at on 2026-10-12, after the repair: the footer shows the version, and a `/join/<code>` link opens the app. The update notice in an installed app is still to be looked at.
- In every other checkout, before pulling the move: move `app/.env` out of the repository for a moment (and `app/supabase/.temp`, if the Supabase CLI's link to the project is in use), run `git clean -ndX app` to see what would go and `git clean -fdX app` to remove it, pull, put `.env` at the root, run `npm ci`, and check `core.hooksPath` as in step 5. Done for the main checkout on 2026-10-12.

### A linter for the Markdown files

Decided: `markdownlint-cli2`, added after the move, when its configuration can sit at the root beside the files it reads. Before the move it would have to reach out of `app/` into `docs/`.

Measured on 2026-10-12 with version 0.23.3 over `docs/` and the root `CLAUDE.md`, 18 files:

- With its default rules, 576 findings. 526 are lines longer than 80 characters, and the docs write a paragraph as one line on purpose. Most of the rest is spacing, which Prettier settles.
- After Prettier, and with the style the linter ships for use beside Prettier (`markdownlint/style/prettier`, which turns off line length and every spacing rule), 21 findings in 9 files are left, and those are about structure.
- 15 are a bold line standing in for a heading ("Tests", "Not included") in the feature files.
- 3 are code blocks without a language.
- 3 are placeholders in angle brackets outside code, `<hash>` and `<email>`. Markdown reads them as HTML, and a renderer drops them. These are defects in what a reader sees.

So Prettier keeps the form and the linter would keep the structure, and the two don't overlap. What it does not do: it doesn't check that a link to another file leads somewhere, and it knows none of the rules in [`CLAUDE.md`](../CLAUDE.md), such as the date in a heading.

How it would be wired: a `.markdownlint-cli2.jsonc` at the root that extends that style, respects `.gitignore` and leaves out `CHANGELOG.md`, `.agents` and `.claude`; a script `lint:md`; a step in the CI workflow; and for staged `*.md` files in lint-staged, before Prettier. The 21 findings are fixed in the commit that adds it.

The 15 bold lines become real headings, one level below the section they stand in, and the rule against them stays on (user, 2026-10-12). Only the markup of those lines changes; their sections are not rewritten.

### Considered and not chosen

- **Renaming the outer folder**, to `web/` for example. It ends the doubled name with the same edits and without Prettier's wider reach, but it keeps every workaround listed above.
- **Moving the source up instead**, with Nuxt's `srcDir`. It goes against Nuxt 4's layout and changes the relative imports of every test.
