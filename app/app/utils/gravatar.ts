/**
 * Gravatar finds a person's picture by a hash of their email address. The
 * rules here are Gravatar's own (docs.gravatar.com, "Creating the hash"), so
 * the hash is the one their picture is stored under.
 */

const GRAVATAR_AVATAR_URL = "https://gravatar.com/avatar";

/**
 * The hash Gravatar knows an email address by: SHA-256 of the address,
 * trimmed and in lower case, as hex. Asynchronous because Web Crypto is, and
 * it only exists in a secure context (HTTPS or localhost).
 */
export async function gravatarHash(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * The address of the picture for a hash, `sizePx` wide and high. `d=404`
 * makes Gravatar answer 404 when the person has no picture, instead of
 * sending a placeholder of its own, so the app can show its own drawing.
 * No rating parameter: without one Gravatar only serves pictures rated `g`.
 */
export function gravatarUrl(hash: string, sizePx: number): string {
  return `${GRAVATAR_AVATAR_URL}/${hash}?s=${sizePx}&d=404`;
}
