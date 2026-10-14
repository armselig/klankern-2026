import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The caller's id for the created_by/user_id columns, shared by every
 * *-actions module that writes one.
 *
 * Read from the session the client holds, not asked of the auth service
 * (`getUser`): supabase-js reads the same session before every request to
 * send its token, so this costs no request, and the server checks the write
 * against that token anyway. Asking the auth service put a request before
 * every add, and on 2026-10-14 its answer took 19.8 seconds on CI (see "A
 * slow auth service and a refused insert on CI" in docs/infra/testing.md).
 */
export async function getCurrentUserId(
  client: SupabaseClient,
): Promise<string> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("not_authenticated");
  return data.session.user.id;
}
