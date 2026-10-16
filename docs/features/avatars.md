# Member avatars

The history of the members' avatars, oldest first. The current state is in [`progress.md`](../progress.md); [`README.md`](../README.md) lists the other topic files.

## Member avatars from Gravatar (built 2026-10-10)

Every user has an avatar: the signed-in user's in the header (since 2026-10-11 as the account button), and one for each member of the household in a row on the dashboard (`MemberRoster`), under the household's name. The picture is the person's Gravatar; whoever has none gets a drawing the app makes itself.

Decided with the user:

- **Header and member row only.** No avatars on list items or strokes ("added by").
- **Members of a household can read each other's email address.** It is the avatar's accessible name and tooltip. The caption under an avatar is the part before the `@` (`utils/email.ts`), because the app has no display names.
- **The app draws the fallback itself**, rather than using one of Gravatar's generated defaults: it works offline and in tests and adds no further third-party content.
- **The header kept the email text and the "Sign out" button**, so the e2e sign-in helper was unchanged. No longer so since 2026-10-11 (see "Header: wordmark and account menu" in [`features/header.md`](header.md)).

**How an avatar is made** (`components/user/UserAvatar.vue`)

- `utils/gravatar.ts`: the hash is SHA-256 of the trimmed, lower-cased address (Web Crypto, no dependency), and the picture is `https://gravatar.com/avatar/<hash>?s=<px>&d=404`. `d=404` makes Gravatar answer 404 for a person without a picture, which the `<img>` reports as an error.
- `composables/use-gravatar-hash.ts` turns the asynchronous hash into a ref and drops a hash that arrives after the address has changed.
- **The drawing is a "pen rosette"** (`utils/avatar-rosette.ts`): a looped, spirograph-like figure as one closed whiteboard stroke (a `StrokeShape`, rendered by `WhiteboardStroke`) on a disc tinted with the ink. Five bytes of the hash pick the ink (8), the lobes (3 to 6), whether the loops point outward or inward, their depth (3 levels) and the rotation (2), which makes 384 pictures.
- The inks are a list of their own, not `PEN_COLORS`: the ink is picked by its place in the list, so a new whiteboard pen would otherwise change everyone's picture.
- The rosette shows as soon as the hash is known. The Gravatar `<img>` lies over it and is empty while it loads. On `load` the rosette is removed (a Gravatar may be transparent); on `error` (404 or offline) the image is. Until the hash is there, the avatar is a grey disc.
- The image is `loading="lazy"`, so a slow gravatar.com can't hold up the page's `load` event, and `referrerpolicy="no-referrer"`.
- With a `label` the avatar is `role="img"` with that name and `title`. Without one it is `aria-hidden`: the header, where the account button around it carries the name.

**The header on a narrow phone** (user decision; replaced on 2026-10-11, see "Header: wordmark and account menu" in [`features/header.md`](header.md)): the email gives way. The title keeps at least its own width, the email is cut with an ellipsis, "Sign out" doesn't wrap, and an avatar never shrinks (`flex-shrink: 0` in `UserAvatar`).

- Before, the title was the only part of the header that could shrink. With the avatar added it was squeezed to one letter at 360 px, and a long address wrapped onto three lines.
- Looked at in screenshots at 360, 412 and 1280 px: about 70 px (at 360) and 122 px (at 412) remain for the address, and nothing changes on a wide screen. No automated check.
- Not looked at: a 360 px header that also shows the "Install app" button.

**What leaves the app**: every avatar is a request to gravatar.com, which gets the viewer's IP address and the hash of the pictured person's email address. There is no server to proxy it through. Accepted by the user.

**Schema** (`0013_list_household_members.sql`, applied to the cloud project with `db push`, with the user's go-ahead)

- `list_household_members(p_household_id)` returns `user_id`, `email` and `joined_at` of a household's members, oldest membership first. SECURITY DEFINER with `search_path = ''`, because it reads `auth.users`. It checks `is_household_member` itself; a caller who is not a member gets no rows. `EXECUTE` is revoked from `public` and `anon`.
- No view over `auth.users`, no profile table, no trigger on `auth.users`.
- Checked before applying: the migration role (`postgres`) can read `auth.users` (`has_table_privilege`). Postgres checks a SQL function's privileges only when it is called, so a role without that privilege would have created a function that fails on first use.

### Code

- `fetchHouseholdMembers` (`household-actions.ts`); `members`, `membersError` and `fetchMembers()` in `stores/household.ts`.
- `fetchMembers` keeps its result only if the household is still the one it asked for. A fetch that ends after a user switch would otherwise show the previous household's addresses to the next user.
- `pages/index.vue` fetches the members when the household's id appears or changes; `MemberRoster` only renders. A fetch in the roster's own `onMounted` would run twice on every revisit, because `fetchMine()` swaps the whole card for the spinner and back.
- The full address is deliberately not in the roster's text: `getByText(user.email)` in the `auth`, `household` and `session-switch` specs would match twice.

### Tests

- Unit: `gravatar.spec.ts` (Gravatar's documented example hash), `avatar-rosette.spec.ts` (each of the 384 variants stays inside the disc, is closed and differs from the others), `email.spec.ts`, `use-gravatar-hash.spec.ts`, and `fetchHouseholdMembers` in `household-actions.spec.ts`.
- RLS: a member gets their household's addresses and none of another household's; a member of another household gets no rows; a signed-out client (`signedOut` in `supabase-fixtures.ts`) can't call the function.
- E2E: `avatars.e2e.ts` answers `**/gravatar.com/avatar/**` itself, so it doesn't depend on Gravatar. With a 404, everyone has the drawing and the requests carry the SHA-256 of the address; with a picture for one member, that member shows the photo.
- `session-switch` checks that none of the previous user's members are left, `household` that a newly created household shows its member, and `a11y` scans the dashboard with the roster.
- Seen to fail with the feature broken: the avatar spec with a wrong hash, without the `error` handler and without the `load` handler, and the `household` check with the members not fetched when the household appears. The roster checks added to `session-switch` and `a11y` were not broken on purpose.
- The other specs make real requests to gravatar.com for their disposable addresses, which answer 404. Nothing waits for them.

### Not included

- A member who joins while someone else has the dashboard open appears there on that person's next visit to the dashboard: `household_members` is not in the Realtime publication.
- Display names, uploading a picture, a way to opt out of Gravatar.

**Looked at, and not yet**: the rosettes were judged on a contact sheet of all shapes at 32, 48 and 96 px, and the header and the dashboard in screenshots from the e2e run (a stand-in picture for the Gravatar). A real Gravatar photo had not been seen in the app then; the user checked one on 2026-10-11, signed in with an address that has a Gravatar.

### Found on the way

- **A long-running `nuxt dev` keeps showing the old version in the menus**, and `app-version.e2e.ts` then fails locally. The version is read from `package.json` when the process starts. A dev server started before a release was pulled still served `0.0.0` after `package.json` said `1.0.0`, and the reload Nuxt does by itself after a change to `nuxt.config.ts` did not re-read it. Stop and start `npm run dev`. CI starts a fresh server, and the production build from the same run had `1.0.0`.
- The member row made the dashboard card taller, which uncovered the contrast problem of "Hover and focus contrast on the primary color" in [`ui/theme-and-contrast.md`](../ui/theme-and-contrast.md).
