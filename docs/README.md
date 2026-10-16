# Documentation

Guidance for reading and writing the files in `docs/`. The rules for the code are in [`rules/`](./rules/README.md) and are not repeated here.

A topic file written before 2026-10-16 refers to a section of the root `CLAUDE.md` by its name, such as "Releases" or "What the tests need". That section now stands in a file of `rules/` under the same heading; [`rules/README.md`](./rules/README.md) says which (see "CLAUDE.md files of at most 500 characters" in [`infra/project-layout.md`](./infra/project-layout.md)).

## Where things are

Start with `progress.md`, then read the topic files for what you are about to touch.

- [`progress.md`](./progress.md): the current state. The milestones and features, what is built, the deviations from the plan, the environment and the next steps.
- [`plan.md`](./plan.md): the original design and milestone list.
- [`rules/`](./rules/README.md): the rules for the code, one file per topic, moved out of the root `CLAUDE.md` on 2026-10-16. Its `README.md` lists them.
- [`supabase-support-repro.md`](./supabase-support-repro.md): the write-up of the `INSERT ... RETURNING` finding with its reproduction.

**Features** (`features/`)

- [`auth-and-households.md`](./features/auth-and-households.md): sign-in by email code, households and invites, with the click-through of milestones 3 and 4. Also the database rules that came out of them: RLS and `RETURNING`, function privileges, the migrations workflow.
- [`lists-and-realtime.md`](./features/lists-and-realtime.md): milestones 5 and 6, the live sync of the to-dos and the shopping list.
- [`whiteboard.md`](./features/whiteboard.md): milestone 9, the shared whiteboard.
- [`recipes.md`](./features/recipes.md): milestone 10, the shared recipes.
- [`dashboard.md`](./features/dashboard.md): the dashboard with live tiles.
- [`vacations/`](./features/vacations/README.md): the vacation planner, in a folder of its own with seventeen files: its design, the reviews of the design, and how each slice was built and changed. Its `README.md` lists them, in the order to read them, and says where new material goes. All three slices are built and released; the children as people of a trip are built, not released.
- [`meal-planner/`](./features/meal-planner/README.md): the meal planner, in a folder of its own with eight files: why it exists and the slices, slice 1a (plan table, store, `/meals`, Tonight tile), slice 1b (all slots, move dialog, trip view, shopping run, the old trip meals removed), slice 2 (the kids: reactions, `/kids`, the Tonight demotion), slice 3 ("Fill my week": a draft proposal with lock and re-roll), the query that counts planned days, the e2e tests that failed on CI because of a pinned clock, and the redesign of the week, "the week at a glance". Its `README.md` lists them. Slices 1a, 1b, 2 and 3 are released.
- [`avatars.md`](./features/avatars.md): the members' avatars, rosette and Gravatar.
- [`header.md`](./features/header.md): the header with the wordmark and the account menu.

**Look of the app, across features** (`ui/`)

- [`theme-and-contrast.md`](./ui/theme-and-contrast.md): the Catppuccin theme with light and dark mode, the contrast of hover and focus, the success notices.
- [`icons-fonts-and-markup.md`](./ui/icons-fonts-and-markup.md): the icon strategy, the fonts that were tried and dropped, the rules for markup and formatting and the mobile viewport.
- [`playful-look/`](./ui/playful-look/README.md): issue #9, a more colorful and playful look, in a folder of its own with nine files: the plan (what the palette allows by contrast, an accent per feature with a darker shade for light mode, four slices), the design (tokens, shapes, states, motion and small celebrations) its design review and its eng review of 2026-10-16 (with the eng review's ledger in two files), and how slices 1 to 3 were built. Its `README.md` lists them. Slices 1 (tokens and shape), 2 (color on the screens) and 3 (motion) are released (1.13.2).

**Tests, build and delivery** (`infra/`)

- [`new-synced-store.md`](./infra/new-synced-store.md): the checklist for a new table that is shared by a household and kept live: migration, store, wiring, tests, documentation.
- [`testing.md`](./infra/testing.md): the review of the e2e tests' gaps with the bugs it found, running e2e tests repeatedly, the `pwa` project and a leftover `.output`, signing in without the form, the RLS suite run in parallel.
- [`e2e-failures-on-ci.md`](./infra/e2e-failures-on-ci.md): the e2e tests that failed on CI and what was found: a focus that arrived late, a slow auth service, a reload that cancelled an insert, a wrong code that showed no error.
- [`test-ids.md`](./infra/test-ids.md): how the e2e tests find elements, by `data-testid` and no longer by text: what was decided, what Quasar made of it, and the type check for the tests.
- [`ci.md`](./infra/ci.md): the checks on GitHub.
- [`deploy-and-pwa.md`](./infra/deploy-and-pwa.md): milestones 7 and 8, the installable app and its deployment to Netlify; the broken deploy after the move to the git root.
- [`releases.md`](./infra/releases.md): the automated releases, each release so far, the changelog.
- [`project-layout.md`](./infra/project-layout.md): where the Nuxt project sits in the repository: how the move from `app/` to the git root went, and the Markdown linter that came with it.
- [`project-layout-plan.md`](./infra/project-layout-plan.md): the plan for that move: what changes, the traps, the steps, what a person has to do, and the plan for the Markdown linter.
- [`environments.md`](./infra/environments.md): which environments the app has; the plan to separate development from production, with a dev Supabase project and a staging site.

## Writing documentation

- **`progress.md` is the present, and it is overwritten.** When something changes, replace the old statement; don't keep it beside the new one. It holds no history: how something came about belongs in a topic file. When a milestone, a feature or a notable fix lands, update what it touches there: the status table, the test counts, the last release and the next steps. It names folders, not files: a file-by-file listing went stale with every new file and was dropped (2026-10-15).
- **A topic file is history, and it grows.** Its sections are dated and stand oldest first; a new one goes at the end. A section is not rewritten later. When a later change overtakes a statement, add a dated remark at that place that names where the newer state is ("Fixed 2026-10-11, see …").
- **Where new material goes.** A new feature gets a file of its own in `features/`. A feature whose history needs several files gets a folder there with a `README.md` of its own, as the vacation planner has, and a `CLAUDE.md` that only points to it; the `README.md` lists the folder's files, and the list above has one line for the folder. A fix, a later decision or a check by hand goes into the file of the thing it concerns. What touches several files is written once, where its cause is, and referred to from the others.
- **Split a file that has grown.** A topic file past about 2,500 words is split the next time it is touched, along its sections, so that each file covers one thing. `progress.md` stays within two printed pages, about 1,000 words; past that it has collected history or detail, which goes into the topic files.
- **The list above is part of the change.** A new, renamed or split file gets its line there in the same commit, and the references to the old place are corrected (search `docs/` for the file's and the sections' names).
- **A section's heading says what it is and when**: `## Dashboard with live tiles (built 2026-10-11)`. Dates are `YYYY-MM-DD`, without a time.
- **References name the section.** Within a file: the section's name in quotes. To another file: the name in quotes and a relative link to the file, shown as its path from `docs/`, as in ``see "Milestone 8" in [`infra/deploy-and-pwa.md`](../infra/deploy-and-pwa.md)``. Don't link to a heading's anchor, since headings carry dates and change, and don't refer to a section by its position ("the next section").
- **Write what the code and the git history don't tell**: why something was decided and what was rejected, how a bug showed and how its fix was verified, what was tried by hand and by whom, and what was knowingly left undone.
- **A rule for future work goes into the file of `rules/` it concerns, once.** The topic file tells how the rule came about. A rule file is the present and is overwritten; it has no dated sections.
- **No `CLAUDE.md` exceeds 500 characters.** It points to a `README.md` and holds no rules; the docs check reports one that is longer.
- **Prettier keeps the form and a linter the structure.** `npm run format` formats the files, and `npm run lint:md` (markdownlint-cli2) checks what Prettier can't. A heading is a real heading, never a bold line standing in for one. A code block names its language. A placeholder in angle brackets is written as code (`` `<hash>` ``): outside code Markdown reads it as HTML, and a renderer drops it. Neither tool checks that a link to another file leads somewhere, nor any rule of this list.
- **Nothing local or personal.** No machine paths, host quirks, account names, email addresses or ids of a site or project, and never a secret: the repository may become public.
