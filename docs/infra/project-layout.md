# Project layout

Where the Nuxt project sits in the repository, oldest first. The plan for the move to the git root is in [`infra/project-layout-plan.md`](project-layout-plan.md). The current state is in [`progress.md`](../progress.md); [`README.md`](../README.md) lists the other topic files.

## The move to the git root (built 2026-10-12, not on `main` yet)

(On `main` since 2026-10-12, so step 12 is done. The first deploy in the new layout was broken; see "The move to the git root on `main`, and a broken deploy" in [`infra/deploy-and-pwa.md`](deploy-and-pwa.md).)

Steps 1 to 11 of the plan are done (see "Plan: the Nuxt project moves to the git root" in [`infra/project-layout-plan.md`](project-layout-plan.md)), on the branch `chore/folder-structure` in a `git worktree`, as four commits: the formatting, the move with the edits of step 4, the Markdown linter with its fixes, and this documentation. Step 12 is left: nothing is pushed, and the user has not yet looked at Netlify's own build settings. "What a person has to do" in the same file still holds as written.

### What was checked

- The move commit holds 164 renames, 159 of them unchanged and five edited in the same commit (`package.json`, the three hooks, `.prettierignore`). The pre-commit hook went over all of them and changed none.
- After `npm ci` at the root, `core.hooksPath` is `.husky/_`, and a commit with the message "no type" was rejected by commitlint.
- `npm run lint`, `format:check`, `typecheck` and `npm test` (271 tests in 27 files) pass, and so does `npm run test:e2e` (31 tests, both projects). The `pwa` project built through `netlify.toml` without `base`.
- The rehearsed release made 1.5.1 from a throwaway `fix:`. Its commit held exactly `CHANGELOG.md`, `package.json` and `package-lock.json`, the changelog continued under its one title, the tag was on that commit and on the scratch remote, and the message had no `[skip ci]`. So the three plugins' defaults are the right files.
- Before the move, a search confirmed what the plan claims: nothing under the old `app/` reached out of it, and no tracked file outside the plan's list named it.

### What turned out differently

- **The scratch remote has to be a `file://` URL.** With a plain path as the remote, the release got as far as the notes and failed there with "TypeError: Invalid URL", because the notes generator builds its links from the repository's URL. The rule is in the root `CLAUDE.md` now ("Releases").
- **The linter's `ignores` need a leading `**/`.** With `CHANGELOG.md`, `.agents` and `.claude` as the plan has them, a run over the repository left those files out, but lint-staged passes absolute paths, and then they were linted: tried by hand with two absolute paths. A changed skill file would have been rewritten on commit by `--fix`. With `**/CHANGELOG.md`, `**/.agents/**` and `**/.claude/**` they are left out both ways.
- **Markdown has its own entry in lint-staged.** `*.md` was taken out of the entry it shared with JSON, YAML, CSS and HTML: lint-staged runs the entries a file matches at the same time, and the linter has to finish before Prettier starts. The linter runs with `--fix` there, as ESLint does.
- **The worktree did what "Traps" in [`infra/project-layout-plan.md`](project-layout-plan.md) says.** From the `npm ci` of step 5 on, the main checkout, still in the old layout, runs no hooks. It gets them back when it pulls the move and runs `npm ci`. It pulled the move on 2026-10-12, and its hooks ran on the next commit.

The linter found the 21 things measured for the plan, and Prettier changed nine of the twelve files that failed it; the other three are the skill files that `.prettierignore` leaves out.

## The scaffold: Nuxt 4 and the git hooks (built 2026-10-07, written down 2026-10-15)

Moved here from `progress.md` when that file was cut to two pages.

- **Nuxt 4, not the plan's Nuxt 3**: 4 is what `nuxi init` installed. The API is compatible; the folder convention differs, with the source in `app/` and not beside the configuration.
- **The git hooks were checked through git's own hook dispatcher**, by real commits and pushes, not only by calling the scripts: pre-commit (lint-staged), commit-msg (commitlint) and pre-push (type check and the full test suite). The hooks are in `.husky`, and `npm ci` points `core.hooksPath` at `.husky/_`.

## CLAUDE.md files of at most 500 characters (decided and built 2026-10-16)

The user set a new rule for the project: no `CLAUDE.md` may exceed 500 characters. The four there were had 35,365 (the root), 7,953 (`docs/`), 5,176 (`features/vacations/`) and 2,535 characters (`features/meal-planner/`).

- **The rules for the code moved to `rules/`, read on demand.** The user chose that over keeping them loaded through `@` imports in the root `CLAUDE.md`, which would have kept the file short and the context as large as before. The root `CLAUDE.md` now says what the app is and points to [`rules/README.md`](../rules/README.md), which lists the rule files. The text moved word for word, and each section kept its heading, so a topic file that names a section of "the root `CLAUDE.md`" can still be followed by name: "Layout", "Commands" and "What the tests need" are in `rules/commands.md`; "Layers", "Shared list logic" and "Realtime" in `rules/architecture.md`; "Database and security" and "Migrations and types" in `rules/database.md`; "Deployment" and "Releases" in `rules/delivery.md`; "Conventions and gotchas" in `rules/conventions.md`; "What this is" and "Skill routing" in `rules/README.md`. The only changes to the text are the references between the sections, which now name the file, and the placeholder in the migrations' file name, now `<NNNN>_<name>`.
- **The lists of the documentation are `README.md` files.** `docs/CLAUDE.md` and the two feature folders' became `README.md`, each beside a `CLAUDE.md` of one line that points to it, so that it still loads when a file in the folder is read. The opening lines of the topic files, `progress.md`, `infra/new-synced-store.md`, `infra/test-ids.md`, the `docs-updater` and `test-writer` agents and the `docs-audit` skill were changed to the new places; the dated sections that name the root `CLAUDE.md` were left as they were.
- **The docs check enforces it.** `.claude/hooks/docs-check.mjs` reports every `CLAUDE.md` that git tracks or would track and that has more than 500 characters (`claude-md-size`), reads its lists from the `README.md` files, and leaves the `CLAUDE.md` pointers out of the duplicate check, since they are alike on purpose. Its findings were compared before and after the move: the same, under the new file names.
