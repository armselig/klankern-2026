# Vacation planner: engineering review of the design review's changes

The third engineering pass over the vacation planner's plan. The design review it checks is "Design review" in [`features/vacations-design-review.md`](./vacations-design-review.md); the two earlier passes are in [`features/vacations-review.md`](./vacations-review.md). The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## Engineering review of the design review's changes (2026-10-12)

The design review changed things the engineering reviews had checked: the "Vacations" tile moved into slice 1, a vacation is no longer past by its end date alone, slice 2 got a message per person with a second kind of link, a "Tell them" link carries a task through sign-in, and a vacation is edited in place. Only these changes were checked against the code. Nothing of the feature was built at the time.

### Decisions (user, 2026-10-12)

1. **The tile reports a failed load with the tile component's own text.** `DashboardTile.vue` has one fixed text for every tile, "Couldn't load this. Reload the page to try again." The design review's own text for this tile would have needed a setting on the shared component with one user. Not chosen: that setting.
2. **The list's upper group has no heading**; only "Past" is headed. The design review kept a trip in the upper group until it is unpacked and called that group "Upcoming", which is wrong for a trip that is over. Not chosen: "Now and next", and keeping "Upcoming".
3. **With several current vacations, the tile shows the one that starts first, and "and N more"**, as the other tiles cut a list short. After a trip, the one the household is back from stands in front of the next one until it is unpacked. Not chosen: the first alone (a second trip would be invisible), and an order by importance (the open "Afterwards" tasks would drop off the tile as soon as another trip is planned).
4. **The page's head is a component of its own**, `VacationHeader.vue`: title, dates, the stage line, "Ready to go", the edit mode and "Remove vacation". The page's view keeps loading, the phases, "Only my tasks" and the landing of a link. That makes ten components. Not chosen: nine, with a view that carries two modes and five concerns.

### What the changes need to be true

- **A link's parameters are read once and then removed from the address.** The sign-in module remembers the whole address, parameters included, so a task's link survives sign-in. Left in the address, a parameter would mark the row again and tick "Only my tasks" again on every reload, against "it is stored nowhere".
- **The page waits for its first load before it acts on a link.** Before that, the row to scroll to does not exist.
- **Both kinds of link are built and read in one module**, `utils/vacation-link.ts`, as plain functions with unit tests. The sentence builder writes the links and the page reads them, so the parameters' names live in one place. A parameter is only a key to find a row in the page's state.
- **The helper that decides a trip's stage also picks the tile's vacation**, so the tile, the list and the page cannot disagree. It takes today's date as a parameter.
- **The 14 days are date arithmetic on local dates**, done in one time base and compared as `YYYY-MM-DD`, with tests at a month's end.
- **The sentence for a person has a singular and a plural.**

### Tests

The changes add 21 paths, none tested yet because none is built: eleven in unit tests (the stage at its edges, the open phases, the stage line, the tile's choice, both links built and read, the sentence for a person, the texts under "Only my tasks"), ten in the browser. The browser paths ride on tests that were planned already: the tile on `dashboard.e2e.ts`, which finds tiles by name and counts none; folding, editing in place, the row's menu and the focus rules on journeys 1 and 2; the restored address on the case planned for `auth.e2e.ts`, which now uses an address with a parameter. No sign-in is added.

### Accepted as it is

- The stage is not worked out again at midnight. A page left open overnight shows yesterday's stage until it renders again.

### Not verified

- Whether the focus stays on a tick box when its row moves to the end of its phase. A browser may drop the focus of an element that is moved; the assertion planned in journey 1 will show, and the focus is then set again after the move.
- The earlier figure of 18 places where the browser suite signs in was not counted again. A listing of the call lines gives 21, which is another measure: one line is in a helper several tests use, one in a loop. It is counted properly when journey 1 is written.
- No second reviewer read this pass.
