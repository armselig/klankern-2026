import { watch, type WatchSource } from 'vue'

/** The part of a Pinia store this needs; options stores provide it. */
export interface ResettableStore {
  $reset(): void
}

/**
 * Resets the given stores whenever the signed-in user's id changes:
 * sign-out, another user signing in, or a session that ended in another tab.
 * Without it the next user in the same tab starts with the previous user's
 * household and lists in memory, and briefly joins that household's Realtime
 * channel. `flush: 'sync'` resets before any other watcher sees the new user.
 * Plain function (no Nuxt imports) so it can be unit tested.
 */
export function resetStoresOnUserChange(
  userId: WatchSource<string | null | undefined>,
  stores: ResettableStore[],
) {
  return watch(
    userId,
    () => {
      for (const store of stores) store.$reset()
    },
    { flush: 'sync' },
  )
}
