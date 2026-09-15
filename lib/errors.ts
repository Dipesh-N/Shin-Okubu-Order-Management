/**
 * Pulls a readable message out of whatever was thrown.
 *
 * Supabase rejects with a PostgrestError, which is a plain object rather than
 * an Error instance — so `err instanceof Error` is false and the real cause
 * ("column orders.is_takeout does not exist") gets replaced by a generic
 * fallback. That turns a one-line fix into a guessing game, so check for a
 * message property too.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message;

  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}
