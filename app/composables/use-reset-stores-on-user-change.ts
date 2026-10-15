import { resetStoresOnUserChange } from "./reset-stores-on-user-change";

/**
 * Clears every store that holds a user's data when the signed-in user
 * changes (see resetStoresOnUserChange). Called once in the default layout,
 * before useHouseholdRealtime.
 */
export function useResetStoresOnUserChange() {
  const user = useSupabaseUser();
  resetStoresOnUserChange(
    () => user.value?.sub,
    [
      useHouseholdStore(),
      useTodoStore(),
      useShoppingStore(),
      useWhiteboardStore(),
      useRecipeStore(),
      useVacationStore(),
      useMealPlanStore(),
    ],
  );
}
