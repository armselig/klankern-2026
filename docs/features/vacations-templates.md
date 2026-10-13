# Vacation planner: the templates

What the two templates of the vacation planner hold and how that was decided. The design is "Design: a vacation planner" in [`features/vacations.md`](./vacations.md). The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## The house and hotel templates (decided 2026-10-13, not built yet)

The design asked the user for the "before" list of the household's last trip as the first draft of the house template. The user handed it over on 2026-10-13: 21 entries in German, with a mark on the two that a hotel stay does not need. The names of who did each task, which the design also asked for as a first "Who has what", were not on it; they are needed for slice 2 at the earliest.

Most entries are things to pack ("Sleeping bags"), three are tasks ("Book the ferry"). The list covers the time before the trip only.

### Decisions (user, 2026-10-13)

1. **The titles are English.** The list was translated. The app's texts are English, and the scope review had named "English text in the code" as a debt, which it stays. Not chosen: German as written, which would put German tasks into an English interface.
2. **A title is worded as on paper**: a noun for a thing to pack, a verb only where the list had one. The approved screens show tasks with a verb ("Pack the kids' clothes"); those were examples. Not chosen: a verb in every title, with which most titles would start with "Pack".
3. **The entries that fit this household alone stay**: the ferry, the Tiptoi, the kids' phone, the baby monitor, the iPad, and the laptop with LAN and HDMI. This is an exception to the design's rule that nothing in the feature is specific to one household. A template is copied into a vacation, where any task can be removed, and this household's next trip is the first use. The entries are to be generalized when another household is to use the app. Not chosen: generalizing them now ("Book the journey"), and leaving them out.
4. **What the list does not cover was drafted in the session and approved by the user**: the house's own tasks before the trip, and every task of "During" and "Afterwards". Not chosen: a second list written by the user, and leaving the two later phases nearly empty.
5. **The hotel template leaves out two entries of the list**, see open decision 7 under "Open decisions" in [`features/vacations.md`](./vacations.md).

### The templates

The hotel template is the tasks both kinds share; the house template adds its own. That is the design's rule, so the hotel has no task of its own, such as checking out.

Before, in this order. The first 21 are the list's entries in the list's order; the last two are from the design's "Templates".

| Task                                    | House | Hotel |
| --------------------------------------- | ----- | ----- |
| Clothes                                 | yes   | yes   |
| Toothbrushes                            | yes   | yes   |
| iPad                                    | yes   | yes   |
| Charging cables                         | yes   | yes   |
| Baby monitor                            | yes   | yes   |
| Sleeping bags                           | yes   | yes   |
| Mud and rain gear                       | yes   | yes   |
| Rubber boots                            | yes   | yes   |
| Bike helmets                            | yes   | yes   |
| Cooking and kitchen utensils            | yes   | no    |
| Coffee pot and espresso powder          | yes   | no    |
| Games, puzzles                          | yes   | yes   |
| Books                                   | yes   | yes   |
| First-aid kit, medication               | yes   | yes   |
| Book the ferry                          | yes   | yes   |
| Check the car and fill the tank         | yes   | yes   |
| Headphones                              | yes   | yes   |
| Paper and pens                          | yes   | yes   |
| Charge the Tiptoi and put it in the car | yes   | yes   |
| Kids' phone                             | yes   | yes   |
| Laptop, LAN, HDMI                       | yes   | yes   |
| Plan the meals                          | yes   | no    |
| Shop for the first evening              | yes   | no    |

During:

| Task                                    | House | Hotel | From        |
| --------------------------------------- | ----- | ----- | ----------- |
| Pack for the way home                   | yes   | yes   | the session |
| Check every room for things left behind | yes   | yes   | the session |
| Empty the fridge                        | yes   | no    | the session |
| Clean the house before leaving          | yes   | no    | the design  |
| Take the rubbish out                    | yes   | no    | the screens |
| Return the key                          | yes   | no    | the design  |

Afterwards:

| Task                     | House | Hotel | From        |
| ------------------------ | ----- | ----- | ----------- |
| Unpack the car           | yes   | yes   | the screens |
| Wash the clothes         | yes   | yes   | the session |
| Put the suitcases away   | yes   | yes   | the session |
| Refill the first-aid kit | yes   | yes   | the session |

A house vacation starts with 33 tasks, a hotel vacation with 25.

### What differs from the approved screens

- "Return the key" is under "During". The screen of a trip that is over shows it under "Afterwards", but the key goes back on the last day of the trip, when the page still shows "During".
- The screens' other example tasks ("Check passports and ID cards", "Ask the neighbours to water the plants", "Book the house") are in neither template. They were written to fill the screens, and the list has none of them.

### Not verified

- Nobody has planned a trip with these templates. The tasks of "During" and "Afterwards" are a guess that the first trip checks.
