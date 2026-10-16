# E2E failures on CI

The e2e tests that failed on CI and what was found about each, oldest first. Split from [`infra/testing.md`](testing.md) on 2026-10-15, without a change to the sections' text; the tests' other history is there. The current state is in [`progress.md`](../progress.md); [`README.md`](../README.md) lists the other topic files.

## The focus taken from "Change people" in journey 2 (2026-10-13)

After the release of 1.7.0, CI on `main` failed three times in a row, twice in journey 2 of `vacations.e2e.ts`: after "Done" in "Change people" the button "Change people" did not have the focus. The run on `develop` for the same code passed, and so had the test on this machine every time. The same failure was in a run from before that day's work, so the day's changes were not its cause.

Reproduced with a script that gives a task from the menu and opens and closes "Change people" right away: "Change people" gets the focus, and a moment later it is on the task's person button. Quasar's menu gives the focus back to its button when it closes, and holds that back while any popup is still opening or closing; here that is the button's tooltip. So the focus arrives late, and takes itself from wherever it has gone in between. The test went on to "Change people" before it had arrived.

Fixed in the test: after giving the task it waits until the focus is inside the task's button. With that the script kept the focus on "Change people" in 12 of 12 tries, at normal speed and with the processor slowed 4 and 8 times. Waiting for the menu to be gone was tried first and was not enough.

- The focus is on a span inside a Quasar button, so `toBeFocused()` on the button fails; the test asks whether the button contains the focused element.
- In the app this can take the focus from a control that is reached within a moment of choosing from a task's menu. Not changed: it needs a person to be faster than the tooltip's fading. (2026-10-16: on CI the focus later did not come back at all, and the app now sets it itself; see "The focus that never came back after a give".)

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

## A wrong code that showed no error (2026-10-15)

CI on `develop` on 2026-10-15, the run after the fix of the meal plan's e2e tests (see "The e2e tests failed on CI: a clock ahead of the session" in [`features/meal-planner/ci-clock-failure.md`](../features/meal-planner/ci-clock-failure.md)), passed 38 of the 39 e2e tests. "a wrong code shows an error" in `auth.e2e.ts` failed, because the error message did not show. Not looked into.

## A tile's corner pressed below the viewport (2026-10-16)

CI on `develop` for slice 4 of the playful look (run 38916969962) failed one soft check of the signed-in walk in dark mode, `a11y.e2e.ts`: "a press in a tile's corner is its link's" found no link (`null`) 8px inside the To-dos tile's bottom-right corner. The trace's frame of that moment shows the tile running past the bottom of the 667px viewport, under a tall Tonight tile. `scrollIntoViewIfNeeded()` leaves an element that is partly visible where it is, so the corner stayed below the viewport, where `elementFromPoint()` finds nothing. Whether it is below depends on the scroll position the hover and focus steps before it leave, which is why light mode and local runs passed. That was half of it. The first fix brought the whole card into view (`scrollIntoView({ block: "nearest" })`), and the check failed again on the next run (38923817473): the card's bottom now lay on the viewport's, and the point pressed, (173.5, 659), was on the floating button of Nuxt DevTools, which `nuxt dev` puts at the middle of the bottom edge (about x 172 to 202, y 640 to 667) and which the scans already leave out (`#nuxt-devtools-container`). The check now scrolls the card to the middle of the viewport (`block: "center"`), clear of the bottom edge and the button. The app was not at fault.

## A blank page while the signing keys didn't come (2026-10-16)

CI on `main` for the same commit (run 38916970192) failed once in `auth.e2e.ts` (line 78, "a full reload keeps the user signed in"): after the reload the account button did not appear within 15 seconds. The trace shows the page blank for all of that time, and the request for Supabase's signing keys (`/auth/v1/.well-known/jwks.json`) without an answer. `@nuxtjs/supabase`'s client plugin awaits `getClaims()` before the app starts (`dist/runtime/plugins/supabase.client.js`), and `getClaims()` fetches those keys, so while the request hangs, nothing renders. Before the reload the same request had answered in 0.9 seconds. Not changed: a person on a slow connection would see the same blank page; a limit on that wait would have to go into the plugin or around it.

## The focus that never came back after a give (2026-10-16)

From 2026-10-15 (`8c80205`) on, journey 2 of `vacations.e2e.ts` failed on CI in six runs (38806155303, 38877883098, 38900126248, 38923817473, 38928899660, 38935458714), always at the same place: the wait added in "The focus taken from \"Change people\" in journey 2" for the focus to be inside the iPad task's person button ran out after 15 seconds. It passed in between, on code that differed by a line of docs. The page's snapshot from the failure showed the task given to Mia and the counts right, no menu and no tooltip left in the page, and the focus on the page itself (`body`). So the focus was not late, as on 2026-10-13; it never came.

How a give goes, read from Quasar 2.35's source (its focus manager and the composable with which a menu gives the focus back) and seen with a script that logged every focus change: the test chooses the person about 50 ms after opening the list, before the list has finished opening; the chosen entry has the focus and is removed with the list, so the focus falls to `body` on every give, also on one that passes. Quasar then hands it back to the button it remembered when the list opened. It queues that step until no popup is opening or closing any more (here the button's tooltip), runs only the last queued step, and skips it silently when the remembered element is no longer in the page. On CI that step did not land; which of these it was is not known.

Not reproduced on this machine:

- A script of 24 gives (to Mia, from Mia to the other member, back to nobody, and after the "Nobody yet" line pressed twice as the journey does), at normal speed and with the processor slowed 4 and 8 times: the focus came back every time, about 300 ms after the list closed.
- A copy of journey 2 with that logging, the processor slowed 4 times: 3 of 3 passed. The same with every Supabase REST request of A's browser held back 250 ms: 3 of 3 passed. Delaying every request of the page by 250 ms made the sign-in run out before the journey began, so it showed nothing.
- The swap of the button's empty circle for the person's picture was suspected and ruled out: the focused element stayed in the page.
- Quasar's focus manager could not be looked into: `nuxt dev` serves Quasar prebundled, so the hook meant to read its queue never attached. The trace's page snapshots are stored as differences and were not rebuilt.

No CI run overlapped the runs from this machine.

Fixed in the app at the user's choice, rather than in the test: when the list closes after a person was chosen and the focus is on `body`, `VacationTask.vue` puts it on the person button itself (`keepFocusAfterGive`, on the menu's `hide`). Only then: when Quasar's own return lands nothing changes, a close by Escape or a click elsewhere is left to Quasar and to the click, and a focus set from outside Quasar is not its own return, which the tooltip can take for keyboard navigation and show. A keyboard or screen reader user could be left on the page after a give in the same way; whether that happens outside CI is not known. Not chosen: only waiting in the test for the list and the tooltip to be gone, which would no longer notice a lost focus.

The app's focus can come before Quasar's late return, so the journey now also waits for the tooltip to be gone before "Change people": Quasar runs a queued return before it removes the tooltip.

After the change `vacations.e2e.ts` passed on this machine, 3 of 3 journeys. Whether it holds on CI shows only there, with the next runs.
