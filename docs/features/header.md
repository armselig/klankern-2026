# Header and account menu

The history of the header and the account menu, oldest first. The current state is in [`progress.md`](../progress.md); [`README.md`](../README.md) lists the other topic files.

## Header shows the signed-in user (2026-10-08)

The layout header shows the signed-in user's avatar, which opens the account menu with the email and "Sign out" (see "Header: wordmark and account menu"). Signed out, it shows a "Log in" link, except on `/login` and `/join/<code>` (a detour from the join page to `/login` would drop the invite code). Tested in a browser by the user.

## Header: wordmark and account menu (built 2026-10-11)

The header had become too full for a phone: title, "Install app", avatar, email and "Sign out" in one row, with the email cut to a few letters. It now holds the app's name on the left and one or two round buttons on the right. This replaces "The header on a narrow phone" in [`features/avatars.md`](avatars.md) and the header description under milestone 4.

Decided with the user:

- **The app's name is the `<h1>` of every page** and links to the dashboard. The page titles (To-dos, Shopping, Whiteboard) and the card titles (sign in, join, set up a household, the household's name) are `<h2>`. The invite dialog's title is still a `<div>`.
- **The avatar is in the account button** and so is always on screen. Its menu (`components/user/AccountMenu.vue`) shows the whole email address, "Invite a family member" and "Sign out".
- **"Invite a family member" moved from the dashboard into that menu.** It is only there while the household store holds a household.
- **"Install app" is an icon-only button** with that `aria-label` and a tooltip. It stays in the header because the offer also comes on the login page, where there is no account menu. "Log in" keeps its label.

How it is built:

- **The wordmark** is Roboto 700 with a hand-drawn pen stroke under it, an inline SVG that is hidden from assistive technology, so the link's name stays "Klankern". No new font or dependency. Hover and keyboard focus thicken the stroke; focus also draws a white outline. Quasar styles a bare `h1` at 6rem, so the layout's scoped style resets it.
- **The account button's name is "Account, `<email>`"**, and the avatar inside has no label. The e2e helpers find the signed-in user by that name (`accountButton` in `tests/support/e2e-ui.ts`), since the address is no longer text in the header.
- **The menu is `role="group"`, and its entries are real buttons.** `role="menu"` allows only menu items, and the address is none; a clickable `q-item` is a list item with no role that says it can be pressed.
- **`InviteDialog` no longer has its own button.** It is a dialog with a `v-model`, rendered beside the menu, and asks for a code each time it opens. Inside the menu it would be removed together with the menu's content.
- **Closing the invite dialog puts the keyboard focus on the account button.** The menu entry that opened the dialog is gone by then, and the focus was left on `<body>`. `a11y.e2e.ts` checks it.
- Signing out stays in the layout, which holds the Supabase client; the menu emits `signOut`.
- The wordmark link and the header buttons are 44px high.

**The account button as a pill, and stronger highlights** (same day, user decision): the bare avatar didn't look like a button, and the hover was hard to see, because the avatar hid most of Quasar's veil.

- The button is a pill on a slightly darker blue (15% black) with the avatar and a chevron. While the menu is open the pill is darker (40%) and the chevron points up. A tooltip says "Account".
- Hover and keyboard focus put a white ring around the avatar; focus also draws a white outline around the pill.
- **Every highlight in the header is a 30% veil** instead of Quasar's 15 to 22% (`.app-header` in `layouts/default.vue`). It is still black, so the contrast only rises. This holds for "Install app" and "Log in" too.
- The wordmark gets the same 30% behind it on hover and focus, and its pen stroke thickens from 2 to 4.5px.
- Hover rules are inside `@media (any-hover: hover)`, as Quasar's are, so a hover doesn't stick after a tap on a phone.
- `a11y.e2e.ts` checks the veil's 30% on the account button. Seen in screenshots at 375px: at rest, hovered, open and the wordmark hovered. The keyboard focus outline of the pill has not been looked at.

Tests:

- `signOut` and the invite steps open the account menu first (`openAccountMenu`). `a11y.e2e.ts` scans the open menu, and checks the dark hover highlight on the account button instead of on "Sign out".
- **A scan right after the menu opens fails on contrast**: the menu fades in, and axe measures the half-transparent text. The same happens to the invite dialog's scan while the menu fades out. `untilFadesEnd` in `a11y.e2e.ts` waits for the page's animations.
- axe still can't judge the header itself (see "Hover and focus contrast on the primary color" in [`ui/theme-and-contrast.md`](../ui/theme-and-contrast.md)), so the wordmark's contrast is not scanned. It is white on the primary color, like the header's text before.

## The version moved from the footer into the menus (2026-10-14, user decision)

The layout's footer ("© armselig · Version X.Y.Z") is gone, and the copyright with it. The version is at the bottom of the account menu, under a separator, in a smaller (0.8125rem) muted line (`<app-version>`, `components/layout/`).

- **Signed out, a "About" button (info icon) sits in the header** (`<version-menu>`), beside "Log in" and alone on `/login` and `/join/<code>`, where "Log in" is hidden. Its menu holds only the version. The user wanted the version to stay readable without an account, which the account menu alone could not give.
- The test ids stayed in `TEST_IDS.layout` (`appVersion`, plus `versionButton` and `versionMenu`).

Tests:

- `app-version.e2e.ts` has two tests: the version menu on `/login` (no sign-in), and the account menu of a disposable member. Both compare with `package.json`.
- `a11y.e2e.ts` scans the open version menu in both modes, and the open account menu with the version in it (the muted text passed).
- Not looked at by eye: the two menus at 375px in light and dark mode.
