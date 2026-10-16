/**
 * The leave hook of a list's `<transition-group>`: a row that is fading out
 * is gone for the person already, so it can no longer be pressed, focused
 * or read out while it leaves. The e2e helpers skip what is inside
 * `[inert]` for the same reason.
 *
 * One argument only: a leave hook that also takes `done` makes Vue wait for
 * it instead of the CSS transition, and under reduced motion the row would
 * then stay instead of going at once.
 */
export function makeLeavingRowInert(el: Element) {
  (el as HTMLElement).inert = true;
}

/**
 * Where a checkbox's box is on the screen, for a celebration to burst from:
 * the box itself (Quasar's `.q-checkbox__inner`), not the whole checkbox
 * with its title. Read at the tap, before the row moves (a ticked shopping
 * item slides to the end of the list).
 */
export function tickBoxRect(checkbox: Element | undefined | null): DOMRect {
  const box = checkbox?.querySelector(".q-checkbox__inner") ?? checkbox;
  return box?.getBoundingClientRect() ?? new DOMRect();
}
