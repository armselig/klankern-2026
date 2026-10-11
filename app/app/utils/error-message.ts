/**
 * The message of anything a failed call throws. supabase-js hands PostgREST
 * errors over as plain objects (`{ message, code, ... }`), not Error
 * instances, so an `instanceof Error` check alone would lose their message.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof e.message === "string"
  ) {
    return e.message;
  }
  return "unknown_error";
}
