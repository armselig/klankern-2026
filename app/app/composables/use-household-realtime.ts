import { subscribeToHouseholdChanges } from './household-realtime'

/**
 * Keeps one Realtime channel open for the signed-in user's household and
 * routes its changes into the stores. Mounted once in the default layout
 * rather than inside a feature component, so later features (shopping) share
 * the channel instead of opening their own.
 *
 * Keyed on the user as well as the household: sign-out doesn't clear the
 * household store, so watching the household alone would leave the channel
 * open after sign-out. The channel is removed when the key changes or
 * becomes null, and when the calling component's scope is disposed.
 */
export function useHouseholdRealtime() {
  const client = useSupabaseClient()
  const user = useSupabaseUser()
  const householdStore = useHouseholdStore()
  const todoStore = useTodoStore()

  const householdId = computed(() => (user.value ? (householdStore.household?.id ?? null) : null))

  watch(
    householdId,
    (id, _previousId, onCleanup) => {
      if (!id) return
      const unsubscribe = subscribeToHouseholdChanges(client, id, {
        onTodoItemChange: (event) => todoStore.applyRealtimeEvent(event),
        onSubscribed: () => void todoStore.resync(),
      })
      onCleanup(unsubscribe)
    },
    { immediate: true },
  )
}
