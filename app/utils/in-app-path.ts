/**
 * Whether a remembered address may be opened after sign-in: only a path
 * inside the app. The address comes from a cookie, which a script on the
 * page could have written, so it is not trusted: "//example.org" is another
 * host to a browser, as "/\example.org" is to some, and a full address is
 * one outright.
 */
export function isInAppPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith("/")) return false;
  if (path.startsWith("//") || path.startsWith("/\\")) return false;
  // A backslash or a control character anywhere has no place in a path the
  // app wrote itself.
  return ![...path].some(
    (character) => character === "\\" || character.charCodeAt(0) < 0x20,
  );
}
