# E2E failures on CI

The e2e tests that failed on CI and what was found about each, oldest first. Split from [`infra/testing.md`](testing.md) on 2026-10-15, without a change to the sections' text; the tests' other history is there. The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

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

## A wrong code that showed no error (2026-10-15)

CI on `develop` on 2026-10-15, the run after the fix of the meal plan's e2e tests (see "The e2e tests failed on CI: a clock ahead of the session" in [`features/meal-planner.md`](../features/meal-planner.md)), passed 38 of the 39 e2e tests. "a wrong code shows an error" in `auth.e2e.ts` failed, because the error message did not show. Not looked into.
