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
