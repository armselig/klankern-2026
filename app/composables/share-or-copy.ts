/** How a message left the app, or didn't. */
export type ShareOutcome =
  /** Handed to the device's share sheet. */
  | "shared"
  /** The member closed the share sheet; nothing is wrong. */
  | "closed"
  /** No share sheet, or it refused: the message is in the clipboard. */
  | "copied"
  /** Neither worked; the caller shows the message to select by hand. */
  | "manual";

/** The parts of `navigator` this needs, so it can be tested without one. */
export interface ShareTarget {
  share?: (data: { text: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

/**
 * Hands a message to the device's share sheet, or copies it where there is
 * none. Plain function taking the target, like the *-actions modules.
 *
 * It must be called straight from the member's press, with nothing awaited
 * before: a browser opens the share sheet only during a gesture.
 */
export async function shareOrCopy(
  target: ShareTarget,
  text: string,
): Promise<ShareOutcome> {
  if (target.share) {
    try {
      await target.share({ text });
      return "shared";
    } catch (e) {
      // Closing the sheet rejects with an AbortError; that is a decision,
      // not a failure, and nothing is copied behind the member's back.
      if (e instanceof Error && e.name === "AbortError") return "closed";
    }
  }
  try {
    if (!target.clipboard) return "manual";
    await target.clipboard.writeText(text);
    return "copied";
  } catch {
    return "manual";
  }
}
