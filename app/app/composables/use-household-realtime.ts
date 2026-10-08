import { subscribeToHouseholdChanges } from './household-realtime'

/**
 * Keeps one Realtime channel open for the signed-in user's household and
 * routes its changes into the stores. Mounted once in the default layout
 * rather than inside a feature component, so every list (to-dos, shopping)
 * shares the channel instead of opening its own.
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
  const shoppingStore = useShoppingStore()

  const householdId = computed(() => (user.value ? (householdStore.household?.id ?? null) : null))

  watch(
    householdId,
    (id, _previousId, onCleanup) => {
      if (!id) return
      const unsubscribe = subscribeToHouseholdChanges(client, id, {
        onTodoItemChange: (event) => todoStore.applyRealtimeEvent(event),
        onShoppingItemChange: (event) => shoppingStore.applyRealtimeEvent(event),
        onSubscribed: () => {
          void todoStore.resync()
          void shoppingStore.resync()
        },
      })
      onCleanup(unsubscribe)
    },
    { immediate: true },
  )
}
