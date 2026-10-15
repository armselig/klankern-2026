# Meal planner: the e2e tests that failed on CI

## The e2e tests failed on CI: a clock ahead of the session (fixed 2026-10-15)

On CI for v1.11.0, the first run of `meal-plan.e2e.ts` there, all three tests timed out right after `openSignedIn`: the header never showed the signed-in member. The other 36 e2e tests passed.

- **Cause.** Each test pinned Playwright's clock to 12:30 or 17:30 of the device's day (`todayAt`). `openSignedIn` hands the browser a real session, whose access token expires an hour after the real time. On page load `@nuxtjs/supabase` sets the user from `getClaims()`, and auth-js checks the token's `exp` against the browser's `Date.now()`, which is the pinned clock. CI runs in UTC and started the tests at about 10:45, so 12:30 was more than an hour ahead, the token counted as expired and the user stayed empty. The session itself stayed, so the data still loaded: that is why the 17:30 step passed locally although it lies hours ahead, since nothing there looks at the header. Locally the tests had only been run shortly after 12:30 Berlin time, when the pinned time lay in the past.
- **Reproduced** with the device's time zone: at 10:55 UTC the test "a day that is not a Monday opens its week" failed under `TZ=Etc/GMT+1` (09:55 local) with the error from CI, and passed under `TZ=Europe/Berlin` (12:55 local).
- **Fix.** The tests pin the clock to yesterday at 12:30 and 17:30 (`yesterdayAt`), which lies in the past at any time of day; a token whose expiry is still ahead passes the check, whatever its issue time. The test of the week takes its `?week=` day from the same pinned moment instead of the real date. No app code changed.
- **Verified** by running the whole file under `TZ=Etc/GMT+1`, `Europe/Berlin` and `Etc/GMT-12` (10:00, 13:00 and 23:01 local): 3 passed each time. The whole e2e suite was not run locally; CI runs it with the push.
- The rule is in the root `CLAUDE.md`, under "What the tests need".
