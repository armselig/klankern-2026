# CI

The history of the checks that run on GitHub, oldest first. The current state is in [`progress.md`](../progress.md); [`README.md`](../README.md) lists the other topic files.

## CI (added 2026-10-10)

`.github/workflows/ci.yml` runs on every push to `main` and `develop` (a merged pull request is a push): lint, format check, typecheck, `npm test` (unit + RLS), then `npm run test:e2e` (both Playwright projects). The e2e tests had only ever been started by hand. The hooks are unchanged. Since 2026-10-12 the job runs from the git root instead of `app/`, and it lints the Markdown files after the code (see "The move to the git root" in [`infra/project-layout.md`](project-layout.md)).

- Needs the repository secrets `SUPABASE_URL`, `SUPABASE_KEY` and `SUPABASE_SECRET_KEY`.
- One run at a time for the whole repo (`concurrency`), since every run uses the same cloud project and its sign-in limit. A push to `develop` followed quickly by a merge to `main`, or a CI run overlapping a local e2e run, can still exceed that limit (see "Running e2e tests repeatedly" in [`infra/testing.md`](testing.md)); it shows as sign-in timeouts across specs, and rerunning the job later fixes it.
- Playwright uses the Chrome installed on the runner; a step checks it is there. No Playwright `retries`, on purpose: a retry spends sign-ins and hides flakiness.
- Traces of failed tests are uploaded as an artifact for 7 days. They contain the publishable key and sessions of disposable test users, not the secret key. Reconsider the upload if the repo becomes public.
- Actions are pinned to commit SHAs.

The first run passed everything except one e2e test: "a new version shows the update notice" (`pwa.e2e.ts`) failed with "execution context was destroyed". A race in the test, not in the app: after clicking "Reload", the poll for the `beforeUpdate` marker landed in the middle of the reload it was waiting for. The poll now treats that error as "not reloaded yet" and tries again.

**Fixed 2026-10-10: `signIn` returned before the app had left the login page.** "the session survives a reload" (`auth.e2e.ts`) failed in four CI runs in a row, on docs-only commits, while passing locally. The Playwright trace showed a race in the test helper, not in the app:

- `getByText(user.email)` was meant to match the header but matched the code step's own text ("We sent a login code to …"), so it passed before the code was even verified.
- The session cookie is written as the verify request returns, before `router.push(ROUTES.home)` in `login.vue` has finished. The test's reload then loaded `/login`, which is excluded from the auth guard and shows the login form to a signed-in user.

`signIn` now waits for the home URL and looks for the email inside the header (`getByRole('banner')`) before it waits for the cookie. The next CI run passed. Why the race started to lose every time in CI, without a code change, was not found.

Since 2026-10-13 `signIn` finds the header's account button by its test id and no longer by role and name; see "Test ids instead of text" in [`infra/test-ids.md`](./test-ids.md).

- The same CI run on `develop` once also failed "a signed-out family member joins through the invite link" (`household.e2e.ts`) with the 120 s test timeout, in the step where the member opens the join link. It overlapped with a local e2e run; not explained, and it has not recurred.
- Not changed: a signed-in user who opens `/login` directly sees the login form.

## A release no longer runs CI twice (2026-10-16)

The user found CI too slow: 20 to 30 minutes, with 10 as the aim. Measured on a green run of 19 minutes (run 38900048463): `npm ci` 50 s; lint, Markdown lint, format and typecheck 38 s; the unit and RLS tests 100 s; the two web servers, the `pwa` build included, about 20 s; and the e2e tests 15.2 minutes, 51 tests one after the other on one worker, of which the two signed-in walks of `a11y.e2e.ts` take 1.8 and 2.1 minutes.

A release pushes the same commit to `develop` and to `main`, and the concurrency group `supabase-cloud` runs the two runs one after the other, so a release took about 40 minutes to be green. Now a first job, `already-tested`, asks the GitHub API on `main` whether CI already passed for the same commit on `develop`; if it did, the job `checks` is skipped and the run is green. The job needs only `actions: read` and holds no secrets. Every other push to `main`, and every push to `develop`, runs every check. The query was tried on a commit that passed on `develop` (1 run) and on one that failed (0).

Proposed and not built:

- **Sharding the e2e tests over three runners**, with the static checks and the unit tests in a job of their own beside them: about 7 minutes a run, at three times the runner minutes.
- **Splitting the signed-in a11y walk** into one test per group of pages, so that no shard waits on its 2 minutes.
- **Starting the `pwa` build only where its project runs.** On CI both projects run in one job and the build takes about 20 s, so it saves time only together with the sharding, or locally.
