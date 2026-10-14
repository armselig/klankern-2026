# Documentation

Guidance for reading and writing the files in `docs/`. The rules for the code are in the root `CLAUDE.md` and are not repeated here.

## Where things are

Start with `progress.md`, then read the topic files for what you are about to touch.

- [`progress.md`](./progress.md): the current state. The milestones, what is built and where it is, the deviations from the plan, the environment and the next steps.
- [`plan.md`](./plan.md): the original design and milestone list.
- [`supabase-support-repro.md`](./supabase-support-repro.md): the write-up of the `INSERT ... RETURNING` finding with its reproduction.

**Features** (`features/`)

- [`auth-and-households.md`](./features/auth-and-households.md): sign-in by email code, households and invites, with the click-through of milestones 3 and 4. Also the database rules that came out of them: RLS and `RETURNING`, function privileges, the migrations workflow.
- [`lists-and-realtime.md`](./features/lists-and-realtime.md): milestones 5 and 6, the live sync of the to-dos and the shopping list.
- [`whiteboard.md`](./features/whiteboard.md): milestone 9, the shared whiteboard.
- [`recipes.md`](./features/recipes.md): milestone 10, the shared recipes.
- [`dashboard.md`](./features/dashboard.md): the dashboard with live tiles.
- [`vacations/`](./features/vacations/CLAUDE.md): the vacation planner, in a folder of its own with eleven files: its design, the reviews of the design, and how each slice was built and changed. Its `CLAUDE.md` lists them, in the order to read them, and says where new material goes. Slices 1 and 2 are built and released.
- [`avatars.md`](./features/avatars.md): the members' avatars, rosette and Gravatar.
- [`header.md`](./features/header.md): the header with the wordmark and the account menu.

**Look of the app, across features** (`ui/`)

- [`theme-and-contrast.md`](./ui/theme-and-contrast.md): the Catppuccin theme with light and dark mode, the contrast of hover and focus, the success notices.
- [`icons-fonts-and-markup.md`](./ui/icons-fonts-and-markup.md): the icon strategy, the fonts that were tried and dropped, the rules for markup and formatting and the mobile viewport.

**Tests, build and delivery** (`infra/`)

- [`testing.md`](./infra/testing.md): the review of the e2e tests' gaps with the bugs it found, running e2e tests repeatedly, the `pwa` project and a leftover `.output`.
- [`test-ids.md`](./infra/test-ids.md): how the e2e tests find elements, by `data-testid` and no longer by text: what was decided, what Quasar made of it, and the type check for the tests.
- [`ci.md`](./infra/ci.md): the checks on GitHub.
- [`deploy-and-pwa.md`](./infra/deploy-and-pwa.md): milestones 7 and 8, the installable app and its deployment to Netlify; the broken deploy after the move to the git root.
- [`releases.md`](./infra/releases.md): the automated releases, each release so far, the changelog.
- [`project-layout.md`](./infra/project-layout.md): where the Nuxt project sits in the repository: how the move from `app/` to the git root went, and the Markdown linter that came with it.
- [`project-layout-plan.md`](./infra/project-layout-plan.md): the plan for that move: what changes, the traps, the steps, what a person has to do, and the plan for the Markdown linter.
- [`environments.md`](./infra/environments.md): which environments the app has; the plan to separate development from production, with a dev Supabase project and a staging site.

## Writing documentation

- **`progress.md` is the present, and it is overwritten.** When something changes, replace the old statement; don't keep it beside the new one. It holds no history: how something came about belongs in a topic file. When a milestone, a feature or a notable fix lands, update what it touches there: the status table, the layout listing, the test counts, the last release and the next steps.
- **A topic file is history, and it grows.** Its sections are dated and stand oldest first; a new one goes at the end. A section is not rewritten later. When a later change overtakes a statement, add a dated remark at that place that names where the newer state is ("Fixed 2026-10-11, see …").
- **Where new material goes.** A new feature gets a file of its own in `features/`. A feature whose history needs several files gets a folder there with a `CLAUDE.md` of its own, as the vacation planner has; that file lists the folder's files, and the list above has one line for the folder. A fix, a later decision or a check by hand goes into the file of the thing it concerns. What touches several files is written once, where its cause is, and referred to from the others.
- **Split a file that has grown.** A topic file past about 2,500 words is split the next time it is touched, along its sections, so that each file covers one thing. If `progress.md` grows past about 2,000 words, it has collected history; move that out.
- **The list above is part of the change.** A new, renamed or split file gets its line there in the same commit, and the references to the old place are corrected (search `docs/` and the root `CLAUDE.md` for the file's and the sections' names).
- **A section's heading says what it is and when**: `## Dashboard with live tiles (built 2026-10-11)`. Dates are `YYYY-MM-DD`, without a time.
- **References name the section.** Within a file: the section's name in quotes. To another file: the name in quotes and a relative link to the file, shown as its path from `docs/`, as in ``see "Milestone 8" in [`infra/deploy-and-pwa.md`](../infra/deploy-and-pwa.md)``. Don't link to a heading's anchor, since headings carry dates and change, and don't refer to a section by its position ("the next section").
- **Write what the code and the git history don't tell**: why something was decided and what was rejected, how a bug showed and how its fix was verified, what was tried by hand and by whom, and what was knowingly left undone.
- **A rule for future work goes into the root `CLAUDE.md`, once.** The topic file tells how the rule came about.
- **Prettier keeps the form and a linter the structure.** `npm run format` formats the files, and `npm run lint:md` (markdownlint-cli2) checks what Prettier can't. A heading is a real heading, never a bold line standing in for one. A code block names its language. A placeholder in angle brackets is written as code (`` `<hash>` ``): outside code Markdown reads it as HTML, and a renderer drops it. Neither tool checks that a link to another file leads somewhere, nor any rule of this list.
- **Nothing local or personal.** No machine paths, host quirks, account names, email addresses or ids of a site or project, and never a secret: the repository may become public.
