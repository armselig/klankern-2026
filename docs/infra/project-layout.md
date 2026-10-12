# Project layout

Where the Nuxt project sits in the repository, oldest first. The plan for the move to the git root is in [`infra/project-layout-plan.md`](project-layout-plan.md). The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## The move to the git root (built 2026-10-12, not on `main` yet)

Steps 1 to 11 of the plan are done (see "Plan: the Nuxt project moves to the git root" in [`infra/project-layout-plan.md`](project-layout-plan.md)), on the branch `chore/folder-structure` in a `git worktree`, as four commits: the formatting, the move with the edits of step 4, the Markdown linter with its fixes, and this documentation. Step 12 is left: nothing is pushed, and the user has not yet looked at Netlify's own build settings. "What a person has to do" in the same file still holds as written.

On `main` since 2026-10-12, so step 12 is done. The first deploy in the new layout was broken; see "The move to the git root on `main`, and a broken deploy" in [`infra/deploy-and-pwa.md`](deploy-and-pwa.md).

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
