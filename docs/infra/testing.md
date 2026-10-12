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

**Fixed 2026-10-10: resync could undo a change.** `mergeListResync` protected only ids still in `pendingIds` when the fetch *returned*, so a check or remove saved while a resync fetch was in flight was undone in the UI by the older fetch result. Now every id whose write finishes or whose Realtime event arrives during the fetch is collected (`utils/changes-during-fetch.ts`) and keeps its local version. The last test in `realtime-sync.e2e.ts` covers it (no longer `test.fail()`; verified to fail again with the fix disabled).

**Fixed 2026-10-10: Realtime events of one row can arrive out of order.** Found while verifying the resync fix; this, not the resync, is what made "shopping: checking or removing an item while its add is saving" in `lists.e2e.ts` fail in roughly 1 of 10 runs. When an item's INSERT and its UPDATE are committed within about 50 ms, Realtime sometimes delivers the UPDATE echo *before* the INSERT echo (recorded frames: UPDATE `checked: true`, `commit_timestamp` …35.485, followed by INSERT `checked: false`, `commit_timestamp` …35.436). Applied in arrival order, the stale INSERT unchecked the item in the UI until a reload; the server kept the check. Now `ListRealtimeEvent` carries the payload's `commit_timestamp` (`commitTimestamp`), and each store drops an event committed before the newest one it has seen for the same item (`utils/realtime-event-order.ts`, bookkeeping outside store state like `inserts-in-flight.ts`). Chosen by the user over the narrower "ignore an INSERT for an item already in state", since it also covers two swapped UPDATEs. Limits: commit timestamps have millisecond resolution, so two events of one item committed in the same millisecond still go by arrival; and the local soft-delete guard in `applyListRealtimeEvent` stays, since a local delete has no commit timestamp. The last test in `realtime-sync.e2e.ts` forces the order by holding the INSERT frame back until the UPDATE has arrived (`holdReceivedFrames` in `realtime-socket.ts`); verified to fail with the check disabled in the shopping store (to-dos use the same wiring and weren't checked separately). The formerly flaky test then passed 10 of 10 repeats.

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
