# Vacation planner: slice 2's title, names and pictures

More of what the user changed in the second slice of the vacation planner after trying it, before it was released: "Edit" beside the title, the picture of a person without an account, and a member's name as text. Split on 2026-10-15, without a change to the sections' text, from [`features/vacations/slice-2-after-trying.md`](./slice-2-after-trying.md), which holds the other changes of the same day. How the slice was built is in [`features/vacations/slice-2.md`](./slice-2.md), and the current state is in [`progress.md`](../../progress.md).

## “Edit” beside the title (2026-10-13)

At the user's request the "Edit" button of a vacation's page moved from a row of its own under the dates to the right of the title and the dates. It keeps its icon, its label and its 44 px; the title and the line under it wrap beside it. That frees 48 px: the first phase's heading begins at 331 px of a 375x667 screen, and five tasks are on it without scrolling. With the two changes to "Who has what" the tasks start 250 px higher than on the morning of the same day (581 px).

"Ready to go" stands under the dates as before, beside the button. Checked in light and dark mode at 375x667; the two vacation journeys and the accessibility scans pass.

Not verified: a long title, which now wraps after about 250 px instead of the page's width.

## A picture for a person without an account (2026-10-13)

The user reported that the people without an account could not be told apart on a vacation's page, least of all on a phone: all of them had the same grey icon, and in a task's row the picture is all that says whose the task is.

Such a person now has the first two letters of the name on a disc in one of the avatars' eight inks (`utils/person-badge.ts`, `PersonAvatar.vue`). The ink follows from the person's id, so it is the same on every device and stays when the person is renamed; the letters follow the name. A member keeps the rosette or the photo, and a household member who is not on the trip keeps the generic icon until their address is known.

- **Two letters, not one.** The first version had one, and on the trip it was tried with, "Mia" and "Max" got the same ink and so the same picture. With eight inks that happens to two people in one of eight cases, and siblings' names start alike often enough. "Mi" and "Ma" differ whatever the ink.
- **The letters are in the text color on a disc tinted with the ink, and the ink itself is a ring.** Text in an ink or on one is below 4.5:1 for most of the eight in light mode. Calculated for all eight on the theme's surface in both modes: at a quarter of the ink the weakest pair is 4.6:1 (red in light mode, the dark ink in dark mode), and the disc uses a fifth.
- **Not chosen:** a background color alone, which the user suggested as possibly enough (two people can share one of eight, and a color alone says nothing to someone who can't tell the colors apart), and a rosette from the id as the members have (at 24 px rosettes are hard to tell apart, and people with and without an account would look alike).

Tests: seven unit tests for the letters and the ink (499 unit and isolation tests in all). The two vacation journeys and the accessibility scans pass; the scans see a person without an account in "Who has what" and in a task's menu. Checked in light and dark mode at 375x667 with five such people.

Not verified: a name in a script without upper case, or one that starts with an emoji, on a real page. Two people whose names start with the same two letters and who get the same ink still look alike; nothing handles that.

## A member's name is not a field (2026-10-13)

In "Change people" every name was a field, a member's too. The user asked for a member's name to be text: the app has no feature for a member to carry a name of their own, and the name on a trip comes from the member's address. The name of a person without an account stays a field, since it was typed there and may need correcting.

Only the list changed (`VacationPeople.vue`). The store's `renamePerson` and the table accept a new name for any person as before; nothing in the app offers it for a member any more. A member renamed on a trip before this keeps that name, and it can no longer be changed there.

Tests: journey 2 of `vacations.e2e.ts` checks that "Mia" has a field and the other member has none.

Not verified: whether any member was renamed on a real trip before the change.

## A child of the household is no longer a typed name (2026-10-16)

The statements above that a child on a trip is a person without an account, with a name typed for them, are overtaken: the household's children can be picked for a trip and keep their name and badge from the list under "Kids". A typed name remains for someone without an account, such as a guest. See "Children as people of a trip" in [`features/vacations/kids-on-trips.md`](./kids-on-trips.md).
