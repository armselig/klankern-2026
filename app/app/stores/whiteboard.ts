import { defineStore } from 'pinia'
import type { ItemsById } from '~/types/list'
import type { BoardStroke, BoardStrokeRealtimeEvent, StrokeShape } from '~/types/whiteboard'
import {
  fetchBoardStrokes,
  fetchOrCreateBoard,
  insertBoardStroke,
  softDeleteAllBoardStrokes,
  softDeleteBoardStrokeRemote,
} from '~/composables/whiteboard-actions'
import { errorMessage } from '~/utils/error-message'
import { createChangesDuringFetch } from '~/utils/changes-during-fetch'
import { createInsertsInFlight } from '~/utils/inserts-in-flight'
import { createRealtimeEventOrder } from '~/utils/realtime-event-order'
import {
  confirmListItem,
  mergeListResync,
  softDeleteListItem,
  upsertListItem,
} from '~/utils/list-state'
import {
  applyStrokeRealtimeEvent,
  lastUndoableStrokeId,
  softDeleteAllStrokes,
  visibleStrokes,
} from '~/utils/whiteboard-state'

/** Strokes still being saved; see createInsertsInFlight. */
const insertsInFlight = createInsertsInFlight()

/** Strokes changed while a resync fetch is in flight; see createChangesDuringFetch. */
const changesDuringFetch = createChangesDuringFetch()

/** Drops Realtime events delivered out of commit order; see createRealtimeEventOrder. */
const realtimeEventOrder = createRealtimeEventOrder()

export const useWhiteboardStore = defineStore('whiteboard', {
  state: () => ({
    householdId: null as string | null,
    boardId: null as string | null,
    strokesById: {} as ItemsById<BoardStroke>,
    /** Ids with a write still in flight; a resync must not overwrite them
     * with a fetch that may predate the write. */
    pendingIds: [] as string[],
    /** Ids of the strokes this member drew since the board was loaded, oldest
     * first: what "Undo" works through. In state, because the toolbar shows
     * whether there is anything to undo. */
    drawnIds: [] as string[],
    loading: false,
    error: null as string | null,
  }),
  getters: {
    visible: (state) => visibleStrokes(state.strokesById),
    undoableId: (state) => lastUndoableStrokeId(state.strokesById, state.drawnIds),
  },
  actions: {
    /** Loads (creating if needed) the household's single shared board and its strokes. */
    async init(householdId: string) {
      this.loading = true
      this.error = null
      try {
        this.householdId = householdId
        const board = await fetchOrCreateBoard(useSupabaseClient(), householdId)
        if (board.id !== this.boardId) this.drawnIds = []
        this.boardId = board.id
        const strokes = await fetchBoardStrokes(useSupabaseClient(), board.id)
        this.strokesById = Object.fromEntries(strokes.map((stroke) => [stroke.id, stroke]))
      } catch (e) {
        this.error = errorMessage(e)
      } finally {
        this.loading = false
      }
    },

    /** Folds a stroke change from the household's Realtime channel into state. */
    applyRealtimeEvent(event: BoardStrokeRealtimeEvent) {
      if (!realtimeEventOrder.accept(event.new.id, event.commitTimestamp)) return
      changesDuringFetch.record(event.new.id)
      this.strokesById = applyStrokeRealtimeEvent(this.strokesById, event, this.boardId)
    },

    /** Repairs state after a (re)connect, since Realtime doesn't replay missed
     * events. Skipped until init() has loaded the board (the channel can
     * connect first) and while init() is still fetching. */
    async resync() {
      const boardId = this.boardId
      if (!boardId || this.loading) return
      const changes = changesDuringFetch.start()
      try {
        const strokes = await fetchBoardStrokes(useSupabaseClient(), boardId)
        if (boardId !== this.boardId) return
        const keepLocalIds = [...this.pendingIds, ...changes.stop()]
        this.strokesById = mergeListResync(this.strokesById, strokes, keepLocalIds)
      } catch (e) {
        this.error = errorMessage(e)
      } finally {
        changes.stop()
      }
    },

    /** Runs a server write while its stroke id counts as pending (see
     * pendingIds). Its end counts as a change: a write that finishes while a
     * resync fetch is in flight is no longer pending when the fetch returns,
     * yet the fetch may predate it. */
    async withPending(id: string, write: () => Promise<void>) {
      this.pendingIds = [...this.pendingIds, id]
      try {
        await write()
      } finally {
        changesDuringFetch.record(id)
        // Only this write's entry: a stroke's add and its removal can be
        // pending at the same time.
        const index = this.pendingIds.indexOf(id)
        this.pendingIds = this.pendingIds.filter((_, i) => i !== index)
      }
    },

    /** Optimistic add of a finished stroke: it stays on the board under a
     * client-generated id while it is saved, then gets reconciled (not
     * duplicated) once the server confirms it, keeping an erase or undo made
     * in the meantime. */
    async draw(shape: StrokeShape) {
      if (!this.boardId || !this.householdId) throw new Error('not_initialized')
      const userId = useSupabaseUser().value?.sub
      if (!userId) throw new Error('not_authenticated')
      const id = crypto.randomUUID()
      const optimistic: BoardStroke = {
        id,
        board_id: this.boardId,
        household_id: this.householdId,
        color: shape.color,
        width: shape.width,
        points: shape.points,
        created_by: userId,
        created_at: new Date().toISOString(),
        deleted_at: null,
      }
      this.strokesById = upsertListItem(this.strokesById, optimistic)
      this.drawnIds = [...this.drawnIds, id]
      const boardId = this.boardId
      const householdId = this.householdId

      await this.withPending(id, async () => {
        try {
          const confirmed = await insertsInFlight.track(
            id,
            insertBoardStroke(useSupabaseClient(), { ...shape, id, boardId, householdId }),
          )
          this.strokesById = confirmListItem(this.strokesById, optimistic, confirmed)
        } catch (e) {
          const { [id]: _removed, ...rest } = this.strokesById
          this.strokesById = rest
          this.drawnIds = this.drawnIds.filter((drawnId) => drawnId !== id)
          this.error = errorMessage(e)
        }
      })
    },

    /** Optimistic soft delete (the eraser, and undo); the server update waits
     * for the stroke's add to be saved. A stroke already removed is left
     * alone: the eraser passes over the same spot many times in one drag. */
    async remove(id: string) {
      const previous = this.strokesById[id]
      if (!previous || previous.deleted_at) return
      this.strokesById = softDeleteListItem(this.strokesById, id)
      await this.withPending(id, async () => {
        await insertsInFlight.settled(id)
        // The add failed and took the stroke with it: nothing left to update.
        if (!this.strokesById[id]) return
        try {
          await softDeleteBoardStrokeRemote(useSupabaseClient(), id)
        } catch (e) {
          this.strokesById = upsertListItem(this.strokesById, previous)
          this.error = errorMessage(e)
        }
      })
    },

    /** Removes the newest stroke this member drew that is still on the board. */
    async undo() {
      const id = this.undoableId
      if (id) await this.remove(id)
    },

    /** Optimistically removes every stroke, then clears the board on the
     * server in one statement. That statement only reaches saved rows, so it
     * waits for the adds still on their way. Not tracked as pending: the
     * strokes are tombstones meanwhile, which a resync never overwrites. */
    async clear() {
      const boardId = this.boardId
      if (!boardId) return
      const cleared = this.visible
      if (cleared.length === 0) return
      this.strokesById = softDeleteAllStrokes(this.strokesById)
      try {
        await Promise.all(cleared.map((stroke) => insertsInFlight.settled(stroke.id)))
        await softDeleteAllBoardStrokes(useSupabaseClient(), boardId)
      } catch (e) {
        if (boardId === this.boardId) {
          // Back on the board, except a stroke whose own add failed meanwhile.
          const restored = cleared.filter((stroke) => this.strokesById[stroke.id])
          this.strokesById = {
            ...this.strokesById,
            ...Object.fromEntries(restored.map((stroke) => [stroke.id, stroke])),
          }
        }
        this.error = errorMessage(e)
      }
    },
  },
})
