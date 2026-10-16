# Delivery

How the app is deployed and released. Part of the rules for the code; [`README.md`](./README.md) lists the others.

## Deployment

Production is Netlify, serving the static output of `nuxt generate`; there is no server and no Netlify Function. `netlify.toml` sets the build (`npm run generate`, publish `dist`) and no base directory; Netlify's own build settings must not name one either, and they can't be seen from the repository. Netlify builds every push to `main` on its own, independently of CI.

- The fallback for client-side routes (`/join/<code>`) is `public/_redirects`, not `netlify.toml`: Nitro's Netlify preset writes its own catch-all into `_redirects` unless one is there, and that file wins.
- Netlify's environment holds only `SUPABASE_URL` and `SUPABASE_KEY`, baked into the bundle at build time.
- `NODE_VERSION` in `netlify.toml` is exact; raise it together with `engines` in `package.json`.
- Deploy previews and branch deploys stay off: they would all use the one production Supabase project.

## Releases

Every push to `main` is a release. `.github/workflows/release.yml` runs semantic-release (`.releaserc.yaml` at the git root), which works out the next version from the Conventional Commits since the last `vX.Y.Z` tag: `fix`, `perf` and `refactor` give a patch, as does a revert whose message starts with `revert:` or `Revert` and keeps the line "This reverts commit `<hash>`.", `feat` a minor, `!` or a `BREAKING CHANGE:` footer a major, and a push with none of these releases nothing (`docs`, `test`, `chore`, `ci`, `build`, `style`). `feat` is for something the app could not do before; a change to how something existing looks or works is a `refactor`. It writes `CHANGELOG.md`, bumps `version` in `package.json` and `package-lock.json`, pushes both to `main` as a `chore(release): X.Y.Z` commit, tags that commit and creates the GitHub release. Don't edit `CHANGELOG.md` or the version by hand.

- **The release commit is made on `main` by the workflow**, which then fast-forwards `develop` to it. Both local branches are one commit behind after a release; `git pull --ff-only` them before the next push. If `develop` moved on in the meantime, the fast-forward step fails and `develop` has to be rebased onto `main`. It also fails when `main` got a change under `.github/workflows/` that `develop` didn't have yet, because the workflow's token may not push workflow files; push `develop` before `main` (`git push origin develop main`), or repair it with `git push origin main:develop`.
- The release does not wait for CI, and its commit starts no workflow run, because it is pushed with the workflow's own token. Netlify does build it, and has to: the menus show `runtimeConfig.public.appVersion`, which `nuxt.config.ts` reads from `package.json` at build time. So the release commit's message must not contain `[skip ci]`.
- The tooling is a package of its own in `.github/release`, with its own lockfile, so that neither the Netlify build nor the CI checks install it. Run its `npm` commands there. `conventional-changelog-conventionalcommits` stays on 9.x until `@semantic-release/release-notes-generator` ships `conventional-changelog-writer` 9; with 10.x the notes step fails with "Missing helper".
- `CHANGELOG.md` is listed in `.prettierignore`: Prettier would reject the generated format, and `format:check` would fail on every release commit. The Markdown linter leaves it out too (`.markdownlint-cli2.jsonc`).
- `--dry-run` skips the steps that write the changelog, the version and the commit. To try a change to the release config, run a real release in a scratch clone whose only remote is a scratch bare repository, with the GitHub plugin removed and no token set. Give the remote as a `file://` URL, because the notes step fails with "Invalid URL" on a plain path, and start semantic-release with `--no-ci`, because outside a CI system it otherwise falls back to a dry run.
