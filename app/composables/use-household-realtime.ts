import { subscribeToHouseholdChanges } from "./household-realtime";

/**
 * Keeps one Realtime channel open for the signed-in user's household and
 * routes its changes into the stores. Mounted once in the default layout
 * rather than inside a feature component, so every feature (to-dos, shopping,
 * whiteboard, recipes, vacations) shares the channel instead of opening its
 * own.
 *
 * Keyed on the user as well as the household, so the channel closes the
 * moment the user signs out, independent of when useResetStoresOnUserChange
 * clears the household store. The channel is removed when the key changes
 * or becomes null, and when the calling component's scope is disposed.
 */
export function useHouseholdRealtime() {
  const client = useSupabaseClient();
  const user = useSupabaseUser();
  const householdStore = useHouseholdStore();
  const todoStore = useTodoStore();
  const shoppingStore = useShoppingStore();
  const whiteboardStore = useWhiteboardStore();
  const recipeStore = useRecipeStore();
  const vacationStore = useVacationStore();

  const householdId = computed(() =>
    user.value ? (householdStore.household?.id ?? null) : null,
  );

  watch(
    householdId,
    (id, _previousId, onCleanup) => {
      if (!id) return;
      const unsubscribe = subscribeToHouseholdChanges(client, id, {
        onTodoItemChange: (event) => todoStore.applyRealtimeEvent(event),
        onShoppingItemChange: (event) =>
          shoppingStore.applyRealtimeEvent(event),
        onBoardStrokeChange: (event) =>
          whiteboardStore.applyRealtimeEvent(event),
        onRecipeChange: (event) => recipeStore.applyRealtimeEvent(event),
        onVacationChange: (event) => vacationStore.applyVacationEvent(event),
        onVacationTaskChange: (event) => vacationStore.applyTaskEvent(event),
        onVacationPersonChange: (event) =>
          vacationStore.applyPersonEvent(event),
        onVacationMealChange: (event) => vacationStore.applyMealEvent(event),
        onSubscribed: () => {
          void todoStore.resync();
          void shoppingStore.resync();
          void whiteboardStore.resync();
          void recipeStore.resync();
          void vacationStore.resync();
        },
      });
      onCleanup(unsubscribe);
    },
    { immediate: true },
  );
}
