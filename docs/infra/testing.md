# Testing

The history of the end-to-end tests and their tooling, oldest first. The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## E2E gap review (2026-10-09)

Playwright arrived only in milestone 5, so milestones 3–4 had never been tested end to end. The review added these specs (the Playwright project `sync` is now `dev` and runs every spec except `pwa.e2e.ts`):

- `auth.e2e.ts`: the auth guard (signed out, `/`, `/todos` and `/shopping` redirect to `/login`; `/join/<code>` stays reachable), the session surviving a reload, sign-out locking the pages again, a wrong code, "Use a different email".
- `household.e2e.ts`: creating a household as a new user, joining through the invite link from the invite dialog (signed out, with the join page's own sign-in; and signed in, joining right away), unknown/expired/used-up codes.
- `lists.e2e.ts`: add (Enter and button), empty input ignored, focus kept, check, remove, state after a reload, for both lists; plus checking/removing an item while its add is still saving.
- `session-switch.e2e.ts`: two users of different households in one tab, without a page load in between.
- `pwa.e2e.ts`: the update notice (served through a local proxy that changes `sw.js`, since Playwright's routing doesn't see the browser's own service-worker update check) and the install button (synthetic `beforeinstallprompt`).
- `a11y.e2e.ts`: axe (`@axe-core/playwright`) on every page, failing on serious/critical WCAG 2.1 A/AA findings.

Each new test was checked to fail with its feature broken (auth guard exclude, removed refocus, removed update notice, and the bugs below before their fixes).

**Bugs found and fixed:**

1. Supabase errors showed as "unknown_error": supabase-js returns PostgREST errors as plain objects, so `e instanceof Error` never matched. `utils/error-message.ts` reads both; the join page explains an invalid or expired invite in a sentence.
2. A check or remove made while the item's add was still saving was lost: the PATCH could reach the server before the INSERT (0 rows updated), and the insert's confirmed row undid the check in the UI. Updates now wait for the item's insert (`utils/inserts-in-flight.ts`), and `confirmListItem` keeps fields changed locally. `withPending` now removes only its own `pendingIds` entry.
3. Signing out didn't clear the stores, so the next user in the same tab first joined the previous household's Realtime channel (RLS kept the data out). `useResetStoresOnUserChange` (in the layout, before `useHouseholdRealtime`) resets the stores whenever the user id changes.
4. No page had a `<title>`, and the grey text of checked items and empty lists had a contrast of about 2.7:1. Pages now set titles via `useHead` (template in `app.vue`; the route announcer now reads them out), and the text uses `text-grey-8`.

**Fixed 2026-10-10: resync could undo a change.** `mergeListResync` protected only ids still in `pendingIds` when the fetch _returned_, so a check or remove saved while a resync fetch was in flight was undone in the UI by the older fetch result. Now every id whose write finishes or whose Realtime event arrives during the fetch is collected (`utils/changes-during-fetch.ts`) and keeps its local version. The last test in `realtime-sync.e2e.ts` covers it (no longer `test.fail()`; verified to fail again with the fix disabled).

**Fixed 2026-10-10: Realtime events of one row can arrive out of order.** Found while verifying the resync fix; this, not the resync, is what made "shopping: checking or removing an item while its add is saving" in `lists.e2e.ts` fail in roughly 1 of 10 runs. When an item's INSERT and its UPDATE are committed within about 50 ms, Realtime sometimes delivers the UPDATE echo _before_ the INSERT echo (recorded frames: UPDATE `checked: true`, `commit_timestamp` …35.485, followed by INSERT `checked: false`, `commit_timestamp` …35.436). Applied in arrival order, the stale INSERT unchecked the item in the UI until a reload; the server kept the check. Now `ListRealtimeEvent` carries the payload's `commit_timestamp` (`commitTimestamp`), and each store drops an event committed before the newest one it has seen for the same item (`utils/realtime-event-order.ts`, bookkeeping outside store state like `inserts-in-flight.ts`). Chosen by the user over the narrower "ignore an INSERT for an item already in state", since it also covers two swapped UPDATEs. Limits: commit timestamps have millisecond resolution, so two events of one item committed in the same millisecond still go by arrival; and the local soft-delete guard in `applyListRealtimeEvent` stays, since a local delete has no commit timestamp. The last test in `realtime-sync.e2e.ts` forces the order by holding the INSERT frame back until the UPDATE has arrived (`holdReceivedFrames` in `realtime-socket.ts`); verified to fail with the check disabled in the shopping store (to-dos use the same wiring and weren't checked separately). The formerly flaky test then passed 10 of 10 repeats.

**Running e2e tests repeatedly**: long `--repeat-each` runs made sign-ins time out (the session cookie never appears) once a run did more than about 30 sign-ins within 5 minutes — presumably Supabase's rate limit on OTP verifications, not checked in the dashboard. Keep repeat runs below that or pause between them.

## The `pwa` e2e project and a leftover `.output` (fixed 2026-10-11)

The `pwa` project had failed twice on a blank page (see "Found on the way" under "Milestone 9" in [`features/whiteboard.md`](../features/whiteboard.md) and "Found while building it" under "Releases" in [`infra/releases.md`](releases.md)). The cause is now traced in Nitro (2.13.4) and removed in `nuxt.config.ts`.

**Cause.** The Netlify preset (`netlify-static`) sets both of Nitro's output directories to `dist`, and Nitro empties only those before a build, so `.output` is left alone. The prerenderer is a second Nitro instance with the preset `nitro-prerender`, created from the config without the Netlify preset: its `output.publicDir` is the default, `.output/public`, and Nitro afterwards points only its `output.dir` at the main build's. That preset has `serveStatic: true`, so its static handler comes first and answers `/login` with an existing `.output/public/login/index.html`. The route is never rendered, and the old page is written into `dist`. With the plain `static` preset both instances use `.output/public`, which is emptied first, so `nuxt generate` on its own is fine; so are CI and Netlify, which build from a fresh checkout.

**It does not always fail.** This time the leftover came from a `nuxt generate` of the same source. The old pages named script files that the new build wrote as well, so all four tests passed, on pages that carried the old build id and the version before the last release. The tests fail only once the hashed name of a script has changed, which is why it looked random.

**Changes.**

- `nuxt.config.ts` gives the prerenderer the build's own public directory: a `nitro:init` hook registers Nitro's `prerender:config` hook and sets `output.publicDir` to the main instance's. With the Netlify preset that is `dist`, which every build empties before it prerenders, as it does `.output/public` with the `static` preset.
- `pwa.e2e.ts` has a fifth test: the build id in the served page is the one in `/_nuxt/builds/latest.json`.
- The `pwa` web server command writes a leftover login page into `.output/public` before `netlify serve` (`playwright.config.ts`), so that test exercises the hook on every run, in CI too. A first version of the command deleted `.output` instead; that hid the problem from the test and removed a local `nuxt build` with every e2e run.

Written test first. With the leftover planted and no hook, the build shipped the planted file as `dist/login/index.html` and the test failed; with the hook all five pass and the leftover is still in place. Also checked by hand, comparing whole builds apart from the build id and timestamps: a Netlify build without any `.output`, as on Netlify, has the same files with the same contents with and without the hook, so what gets deployed is unchanged, and the same again as a build with the leftover present. A plain `nuxt generate` still renders its nine pages, with matching build ids.

Worth knowing: the hook relies on how Nitro builds its prerenderer, which no documentation promises. If the fifth test fails after an upgrade, read `prerender()` in Nitro's source again.

## Signing in without the form (2026-10-13)

With the vacation planner's first journey the `dev` project signed in through the login form 30 times in a run of five minutes, which is Supabase's limit for verified codes, and the journeys of the next two slices would have gone past it (see "Tests" under "Slice 1: a trip checklist from a template" in [`features/vacations/slice-1.md`](../features/vacations/slice-1.md)). The user chose to take the form out of the tests that are not about it.

- `openSignedIn` gives the browser a session of the test user as the app stores one, in its cookie, and opens the dashboard. The session comes from a sign-in with the user's password, which the limit does not count: every test user has always been signed in that way once, for its API client, and the suite created some 25 of them per run without trouble.
- Each call makes a session of its own. A sign-out ends all sessions of a user, and several tests share one user.
- The form is still used where it is the subject: `auth.e2e.ts`, the invite flows of `household.e2e.ts` and the second user of `session-switch.e2e.ts`. That is 7 form sign-ins in a run. (9 since the case for the sign-in return was added to `auth.e2e.ts` the same day, see "Tests" in [`features/vacations/slice-2.md`](../features/vacations/slice-2.md).)
- `session-switch.e2e.ts` now answers the request for a code itself before its second user signs in; the form sign-in of its first user used to do that.

The whole suite passed afterwards, 32 tests. What it no longer does 23 times is type a code into the form; the form's own tests are unchanged.

Not verified: that the limit is the one for verified codes. It fits what was seen, a suite that passed with 30 form sign-ins beside some 25 password sign-ins, but Supabase's settings were not read.

## The focus taken from "Change people" in journey 2 (2026-10-13)

After the release of 1.7.0, CI on `main` failed three times in a row, twice in journey 2 of `vacations.e2e.ts`: after "Done" in "Change people" the button "Change people" did not have the focus. The run on `develop` for the same code passed, and so had the test on this machine every time. The same failure was in a run from before that day's work, so the day's changes were not its cause.

Reproduced with a script that gives a task from the menu and opens and closes "Change people" right away: "Change people" gets the focus, and a moment later it is on the task's person button. Quasar's menu gives the focus back to its button when it closes, and holds that back while any popup is still opening or closing; here that is the button's tooltip. So the focus arrives late, and takes itself from wherever it has gone in between. The test went on to "Change people" before it had arrived.

Fixed in the test: after giving the task it waits until the focus is inside the task's button. With that the script kept the focus on "Change people" in 12 of 12 tries, at normal speed and with the processor slowed 4 and 8 times. Waiting for the menu to be gone was tried first and was not enough.

- The focus is on a span inside a Quasar button, so `toBeFocused()` on the button fails; the test asks whether the button contains the focused element.
- In the app this can take the focus from a control that is reached within a moment of choosing from a task's menu. Not changed: it needs a person to be faster than the tooltip's fading.

The other three failures of those runs were a to-do list, a shopping list and the recipes not shown within 15 seconds after a reload. Not explained. Browser tests were run from this machine against the same cloud project during all three runs, which the queueing of CI runs is meant to prevent; whether that was the cause is not known.

Explained the same evening, with the run after the test's fix: journey 2 passed, and one test failed the same way, `auth.e2e.ts` after its reload, with no browser test running from this machine. So those runs were not the cause. The run's trace shows it: after the reload the page asked Supabase's auth service for its keys and for the user, and the answers took 2.9 and 10.0 seconds, where the same request for the user had taken 0.13 seconds before the reload. The page asks for the household only after that, so the 15 seconds of the test were over before the dashboard had anything to show. The app's code is not involved in the wait. Not known: why the auth service was slow that evening; the project had seen several hundred disposable users and sign-ins from tests that day.

## A slow auth service and a refused insert on CI (2026-10-14)

CI on `main` for v1.8.1 failed in browser journey 1 of the vacations: the task "Sunscreen" that A added never appeared on B's page. The trace showed why. Before the insert, `insertVacationTask` asks Supabase's auth service for the user (`getCurrentUserId`, a call to `/auth/v1/user`), and that answer took 19.8 seconds. The test waited 15 seconds for the task on B, failed, and its `afterAll` deleted the household. The insert left A's browser only after that, and was refused with "new row violates row-level security policy for table \"vacation_tasks\"" (42501), since A was no longer a member of any household. The same journey passed on `main` and `develop` for the commit before and in every local run that day. It is the slow auth service of "The focus taken from \"Change people\" in journey 2", not the app's code or the test.

- A refused write after a failed test is not a second bug: the cleanup has removed the household under it.
- The same day CI on `develop` failed once in `session-switch.e2e.ts`, where B's shopping list did not show within 15 seconds. Its trace was not looked at; a slow auth service is the likely cause.
- Proposed and not decided: every add of a task, a list item or a stroke waits for that call to the auth service, although the store knows the user already (`useSupabaseUser().value?.sub`). Handing the id to the actions would take one request out of every add, and a slow auth service out of the path of a write. Not built. (Built the same day another way, at the user's request: `getCurrentUserId` reads the id from the session the client holds, `auth.getSession()`, which supabase-js reads before every request to send its token anyway. One function instead of seven actions and their stores; the server checks a write against that token, so the id is as good as the auth service's answer.)

Later the same day CI failed three more times, in three other tests, all with Supabase's auth service answering slowly or not at all:

- `develop`, with the fix above (`household.e2e.ts`, "a list page without a household points to the dashboard"): after the reload the page's only request to Supabase was the auth service's key set, `/auth/v1/.well-known/jwks.json`, which had no answer within the test's 15 seconds. `@nuxtjs/supabase` fetches it to check the session's token before the app asks for anything, so the household was never looked up. The fix above doesn't reach this request.
- The re-run on `main` for v1.8.1, still without the fix (`recipes.e2e.ts`): A's shopping list did not show within 15 seconds, the failure `session-switch.e2e.ts` had on `develop`. Opening a list there still waits for `/auth/v1/user`.
- The same re-run (`a11y.e2e.ts`, light mode): the scan of the empty list of vacations found a Quasar notification below 4.5:1 (`.q-notification__message`). It is most likely the notice of the step before, about ingredients put on the shopping list, still fading out on a slow runner; a fading notice is translucent. Not looked into further; the scan of that notice itself passes. (At the user's request the test now waits until that notice is gone before it goes on, the same day.)

Not known: why the auth service was slow; it was again a day with several hundred disposable users and sign-ins from tests.

## A reload that cancelled an insert (2026-10-14)

CI on `main` for v1.9.0 failed in `lists.e2e.ts`, "shopping: add with and without quantity, check and remove are saved": after the reload only "Milk" and not "Apples (6)" was expected, and only one of the two was there. The trace showed three inserts, Apples, Bread and Milk. Two were answered; Milk's had no answer 2.3 seconds later, when the test reloaded the page, and the reload cancelled it. Milk was never saved. The test waited for its tick of Apples and its removal of Bread, and each of those waits for its own item's insert, but nothing waited for Milk's. The same code passed on `develop`.

- **`untilAdded`** (`tests/support/e2e-ui.ts`, beside `untilSaved`) does what adds a list item and waits until the server has answered its insert. The test adds Milk with it.
- **The other reloads were checked** and need no such wait: the to-do test's reload follows a tick and a removal of its only two items; the tests of an add still being saved poll the database first; and in the whiteboard, recipe and vacation journeys every change before a reload has first shown up on the other member's page, so the server had it.
- **Not explained:** in one local run after the change, "checking or removing an item while its add is saving" failed once, after its reload: the database already had the item ticked, but the page did not show it within 15 seconds. The re-run passed, as did the whole spec once more (4); its trace was overwritten by the re-run before it was read.

## The RLS suite in four files that run in parallel (2026-10-14)

`tests/rls/household-isolation.spec.ts` took 19 to 21 seconds for its 101 tests. Setup (about 1.5 s) and teardown (about 0.4 s) were not the cause: the tests ran one after another, and each waited on one to three round trips of 45 to 180 ms to Supabase Cloud.

- **Four specs, one per feature**: `household-isolation` (households, invites, lists), `whiteboard-isolation`, `recipe-isolation` and `vacation-isolation`, with the row builders in `tests/support/rls-rows.ts`. Vitest runs files in parallel on separate workers, and each file makes its own disposable users and households, so they don't share state.
- **Inside a file**: the tables of independent rejections use `it.concurrent.each`, independent calls in one test use `Promise.all`, and `beforeAll` and `deleteTestData` run their independent calls in parallel.
- **Result**: the same 101 tests in about 7 seconds (6.5 to 7.8 s over four runs).
- **The vacation spec stays in order** except for its rejection tables: its tests build on what an earlier one leaves (a task's assignee, who is on the trip, the exact list of people). Making them concurrent would break them.
- **A new table's spec** goes into the file of its feature, or into a new file, not back into one big file; that keeps the files parallel.
- **More users per run**: about 10 disposable users instead of 3, which adds to the several hundred a day mentioned in "A slow auth service and a refused insert on CI" above. The fixtures sign in with a password, which is not counted against the OTP rate limit of "Running e2e tests repeatedly" (see "E2E gap review" above); not checked in Supabase's settings.
