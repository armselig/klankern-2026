/**
 * The part of an email address in front of the `@`. The app has no display
 * names, so this is the closest thing to a name it can show for a member
 * where the whole address doesn't fit. An address without an `@` is returned
 * as it is.
 */
export function emailLocalPart(email: string): string {
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}
