import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type { Board, BoardStroke, StrokeShape } from '~/types/whiteboard'
import { getCurrentUserId } from './current-user'

type Client = SupabaseClient<Database>

/**
 * Plain, framework-agnostic whiteboard operations -- see household-actions.ts
 * for why these are kept separate from the Pinia store.
 */

/** Strokes fetched per request. Below PostgREST's row limit (1000 unless the
 * project lowers it), so a page shorter than this is certainly the last one. */
export const STROKE_PAGE_SIZE = 500

/**
 * One shared board per household: find it, or create it on first use. The
 * insert ignores a conflict on the household (the table allows one board
 * each), so two members opening the whiteboard for the first time at the
 * same moment end up on the same board; it is read back afterwards because
 * an ignored insert returns no row.
 */
export async function fetchOrCreateBoard(client: Client, householdId: string): Promise<Board> {
  const { data: existing, error: fetchError } = await client
    .from('boards')
    .select()
    .eq('household_id', householdId)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (existing) return existing

  const { error: createError } = await client
    .from('boards')
    .upsert({ household_id: householdId }, { onConflict: 'household_id', ignoreDuplicates: true })
  if (createError) throw createError

  const { data: created, error: readError } = await client
    .from('boards')
    .select()
    .eq('household_id', householdId)
    .single()
  if (readError) throw readError
  return created
}

/**
 * Every stroke of the board that isn't erased. A board easily holds more
 * strokes than one request returns (handwriting is a stroke per letter), so
 * this pages through them. The pages are cut by id, not by offset: a stroke
 * erased between two requests would shift an offset and make the next page
 * skip a row. The order is the caller's to establish (see visibleStrokes).
 */
export async function fetchBoardStrokes(client: Client, boardId: string): Promise<BoardStroke[]> {
  const strokes: BoardStroke[] = []
  let afterId: string | null = null
  for (;;) {
    let query = client
      .from('board_strokes')
      .select()
      .eq('board_id', boardId)
      .is('deleted_at', null)
      .order('id')
      .limit(STROKE_PAGE_SIZE)
    if (afterId) query = query.gt('id', afterId)
    const { data, error } = await query
    if (error) throw error
    // `points` is jsonb, so the generated type is Json; the table's check
    // constraint guarantees the array of numbers.
    const page = data as BoardStroke[]
    strokes.push(...page)
    const last = page.at(-1)
    if (!last || page.length < STROKE_PAGE_SIZE) return strokes
    afterId = last.id
  }
}

/** Inserts with a client-supplied id so the store's optimistic stroke and the
 * server-confirmed row share one key (see utils/list-state.ts). */
export async function insertBoardStroke(
  client: Client,
  stroke: StrokeShape & { id: string; boardId: string; householdId: string },
): Promise<BoardStroke> {
  const userId = await getCurrentUserId(client)
  const { data, error } = await client
    .from('board_strokes')
    .insert({
      id: stroke.id,
      board_id: stroke.boardId,
      household_id: stroke.householdId,
      color: stroke.color,
      width: stroke.width,
      points: stroke.points,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data as BoardStroke
}

export async function softDeleteBoardStrokeRemote(client: Client, id: string): Promise<void> {
  const { error } = await client
    .from('board_strokes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/**
 * Clears the board for everyone: soft-deletes every stroke on it in one
 * statement, including one another member saved a moment ago and this client
 * hasn't seen yet. Selected by board rather than by a list of ids, which
 * would not fit in a request URL for a full board.
 */
export async function softDeleteAllBoardStrokes(client: Client, boardId: string): Promise<void> {
  const { error } = await client
    .from('board_strokes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('board_id', boardId)
    .is('deleted_at', null)
  if (error) throw error
}
