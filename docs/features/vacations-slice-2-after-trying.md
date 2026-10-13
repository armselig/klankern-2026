# Vacation planner: slice 2 after the user tried it

What the user changed in the second slice of the vacation planner after trying it, before it was released. How the slice was built is in [`features/vacations-slice-2.md`](./vacations-slice-2.md) (this file was split off it on 2026-10-13), and the current state is in [`progress.md`](../progress.md).

## The task's row back to one line (2026-10-13)

The user tried the built slice and reported that the list was too long to scan: "the vacation to-dos with 2 lines of text make the list way too long and confusing", it took long to scroll, and there was no overview of what needs doing.

Measured at 375 px, a row with its second line was 97 px high against 53 px for the title alone, so "Before" with the house template's 23 tasks was about 2,230 px, nearly four screens. And the second line said the same on most rows, "I'll take it" and "Give to…", so rows did not differ to the eye.

That second line was decided in the design review (decisions 2 and 11 of "Design review" in [`features/vacations-design-review.md`](./vacations-design-review.md)), on text and drawings, to make giving a task as easy as keeping it. The user chose again, from three drawn alternatives:

- **Chosen: a person button in line 1.** Between the title and "More", a round button shows who has the task: the person's picture, or a dashed circle with a plus for nobody. Pressing it lists "Me", the other people and, for a task that is someone's, "Nobody". Taking and giving are both two taps, through one control that is on every open row. "Reject" moved into the menu of the member's own task. Only a rejected task has a second line, for the reason, and the "Tell them" line still appears after giving or rejecting.
- Not chosen: a second line only on tasks that are someone's (free tasks would need the menu to be taken, and the list grows back as tasks are given out), and a compact view beside the rows as they were (two modes, and the default keeps the problem).

Afterwards a row is 53 px and a rejected one 99 px; "Before" with 23 tasks, one of them rejected, is 1,378 px. Every control is still at least 44 px, and no page scrolls sideways.

The button's name says who has the task before the task's title ("Yours: Clothes", "sam: Clothes", "Nobody yet: Clothes"), since the picture says nothing to a screen reader; a tooltip shows the same. The journey, the accessibility scan and the helpers were changed to the new controls; the scans pass in light and dark mode.

Not verified: whether a new member understands the dashed circle without being told. The words "I'll take it" are gone from the row.

## “Tell them” removed (2026-10-13)

The user tried the built slice and had "Tell them" removed before it was released: it did not work on a desktop, and the app is to get notifications later, which is what "Tell them" stood in for.

What went:

- The line "Given to sam." with its "Tell them" button after giving or rejecting a task, and the entry in the row's menu.
- The share button of a person in "Who has what".
- The sentences, the share sheet and the copy fallback (`composables/share-or-copy.ts`), and both kinds of link with the page's landing at a task (`utils/vacation-link.ts`): a link to a task had no other source.
- Their tests: 14 unit tests, two steps of browser journey 2, and the assertions on the line elsewhere.

What stays:

- **Sign-in leads back to the page that was asked for.** It was added for these links and holds for every address of the app, such as a vacation's page sent by hand. Its test in `auth.e2e.ts` stays.
- Everything else of the slice: people, giving, taking and rejecting, "Who has what", "Only my tasks".

A member again learns of an assignment or a rejection only by opening the app: the dashboard's tile says how many tasks are theirs and how many came back. That is the state the design started from ("No notifications in the first version"), and the failure the scope review named, one partner never opening the app, is open again until notifications exist.

What "did not work on a desktop" was, is not known. A desktop browser has no share sheet, so the app copied the sentence and said "Message copied"; whether that failed or was not what the user expected was not looked into, since the feature went.

Not verified: nothing of "Tell them" was ever tried on a phone.

After the removal: 486 unit and isolation tests, and the two vacation journeys, the accessibility scans and the auth tests pass.

## “Who has what” as a strip of names (2026-10-13)

The user reported that the overview takes up a lot of the screen and that the tasks are only reached by scrolling. Measured at 375x667 on a trip with four people: "Who has what" was 278 px high, 42% of the screen, with one 44 px row per person and one for "Nobody yet" in a bordered box. The first phase's heading began at 581 px, so no task was on the screen.

The user chose a strip from four ways to shorten it. Each person is an avatar, the name and the number of open tasks, one after the other, wrapping onto a second line; "Nobody yet" stands last without an avatar. The heading, "Change people", the list and its order are unchanged, so a person without open tasks is still listed with 0. Nothing in the strip is pressed, so a line is 36 px and not the 44 px of a control.

- **The bars are gone.** The number was always the text and the bar only repeated it; who carries more is now read from the numbers.
- **A name is cut short at 6.5rem**, so that two long names share a line; "(you)" stands beside the name and is never cut off. With two names as long as a test user's (26 characters) and two short ones the strip is two lines.

After the change the block is 120 px and the first phase's heading begins at 423 px: three tasks are on the screen without scrolling. Checked in light and dark mode at 375x667.

Not chosen: folding the overview behind one line (it would hide who carries nothing, which is what it is there to show), moving it below the phases (the same, under up to 33 tasks), and names that are buttons and filter the tasks to one person, which would also replace "Only my tasks". The last frees the most and reverses a decision of the design review; it is open as a later step. (Built the same day, see "The names of “Who has what” filter the tasks".)

Not verified: a trip with more than five people, where the strip takes a third line, and whether the numbers alone show an uneven share as quickly as the bars did.

## The names of “Who has what” filter the tasks (2026-10-13)

The step left open by the strip, built the same day at the user's request. Each line of "Who has what" is a button: pressed, every phase lists that person's open tasks alone, and the line "Nobody yet" lists the open tasks nobody has. Pressing it again, or another line, releases it. The checkbox "Only my tasks" and its row are gone; the member's own line does what it did. This reverses decision 9 of the design review ("Only my tasks" stands above the phases), which the user confirmed after being told what it gains.

What it gains is the filter, not the space. A pressed line has to be 44 px high where a line of text was 36 px, so the page is 44 px shorter than with the strip: the first phase's heading begins at 379 px, against 423 px with the strip and 581 px before both. Both numbers the overview raised a question about, what the other person has and what is still nobody's, are now one press away. A member who is not on the trip gets the filter too; the checkbox was hidden from them.

- **The pressed line has a frame, not a fill**, and `aria-pressed`. Under a fill the muted text of the page falls below 4.5:1; for the same reason "Nobody yet" is no longer muted, since hover and focus lay a veil over a button.
- **A filtered phase has its own texts**, as "Only my tasks" had. The member is spoken to ("2 of yours open", "Yours are done", "Nothing of yours here."), another person is named ("2 open for Mia", "Done for Mia", "Nothing for Mia here."), and for nobody's it is "2 without a person" and "Nothing without a person here.".
- **A line under the strip says what is shown and how to get back**, in place of "Untick to add tasks.": the fields for a new task are hidden in every filtered view. With a person's line pressed a new task would vanish as it is saved, being nobody's; with "Nobody yet" pressed it would not, and the field is hidden there too so that every filtered view is the same.
- **"Change people" releases the filter**, since the pressed line is then no longer there to be pressed again, and so does taking the person off the trip, on any member's device. The filter is stored nowhere and lasts for the visit, as before.
- **The filter holds only while the lines are shown.** Once the last open task is ticked, "Who has what" says "Nothing open." and has no line to press; a filter left on then hid the fields for a new task until the page was reloaded. Found in review before the commit was pushed and fixed the same day: one function, `shareView`, tells the component what to show and the page whether to filter.
- **The button's name is "Mia 1"**: the name and the number, with a space that takes no room in the row.

Tests: the helpers `openTasksIn`, `phaseSummaryIn` and `taskFilterHint` replace the two for "Only my tasks", with six unit tests in place of four, and three for `shareView` (491 unit and isolation tests in all). The step of browser journey 2 presses the member's line, then "Nobody yet", then releases it; the accessibility scan covers a pressed line in both modes. The two vacation journeys and the scans pass.

Not chosen: keeping the checkbox beside the buttons (two controls for one thing, and a longer page).

Not verified: whether a member finds out that a name can be pressed, since nothing but the line under a pressed one says so; a screen reader was not used; and the button's name does not say that the number counts open tasks.

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
