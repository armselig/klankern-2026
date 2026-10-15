import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";
import type {
  HouseholdChild,
  HouseholdChildRealtimeEvent,
  MealReaction,
  MealReactionRealtimeEvent,
} from "~/types/kids";
import type { ListRealtimeEvent } from "~/types/list";
import type { MealPlanEntry, MealPlanRealtimeEvent } from "~/types/meal-plan";
import type { RecipeChange, RecipeRealtimeEvent } from "~/types/recipe";
import type { ShoppingItem } from "~/types/shopping";
import type { RowRealtimeEvent } from "~/types/synced-row";
import type { TodoItem } from "~/types/todo";
import type {
  Vacation,
  VacationPerson,
  VacationPersonRealtimeEvent,
  VacationRealtimeEvent,
  VacationTask,
  VacationTaskRealtimeEvent,
} from "~/types/vacation";
import type {
  BoardStrokeChange,
  BoardStrokeRealtimeEvent,
} from "~/types/whiteboard";

type Client = SupabaseClient<Database>;

/** The fields of a realtime-js INSERT or UPDATE payload the stores need. */
interface RowChangePayload<T extends { id: string }> {
  eventType: RowRealtimeEvent<T>["eventType"];
  new: T;
  commit_timestamp: string;
}

/** Keeps realtime-js's payload shape out of the stores and reducers. */
function toRowRealtimeEvent<T extends { id: string }>(
  payload: RowChangePayload<T>,
): RowRealtimeEvent<T> {
  return {
    eventType: payload.eventType,
    new: payload.new,
    commitTimestamp: payload.commit_timestamp,
  };
}

export interface HouseholdChangeListeners {
  onTodoItemChange: (event: ListRealtimeEvent<TodoItem>) => void;
  onShoppingItemChange: (event: ListRealtimeEvent<ShoppingItem>) => void;
  onBoardStrokeChange: (event: BoardStrokeRealtimeEvent) => void;
  onRecipeChange: (event: RecipeRealtimeEvent) => void;
  onVacationChange: (event: VacationRealtimeEvent) => void;
  onVacationTaskChange: (event: VacationTaskRealtimeEvent) => void;
  onVacationPersonChange: (event: VacationPersonRealtimeEvent) => void;
  onMealPlanEntryChange: (event: MealPlanRealtimeEvent) => void;
  onHouseholdChildChange: (event: HouseholdChildRealtimeEvent) => void;
  onMealReactionChange: (event: MealReactionRealtimeEvent) => void;
  /** Fires on the first subscribe and on every automatic rejoin after a
   * dropped connection; postgres_changes has no replay, so this is the cue
   * to refetch. It fires a second time once the server says that the
   * changes are flowing (see subscribeToHouseholdChanges). */
  onSubscribed: () => void;
}

/**
 * One channel per household rather than per table, because a server-side
 * filter supports only a single `column=eq.value`; each synced table adds its
 * listeners to this same channel. Plain function taking the
 * client, like the *-actions modules, so it can be tested with a mock.
 *
 * Only INSERT and UPDATE are subscribed: DELETE events can't be filtered and
 * bypass RLS, and the app never hard-deletes (deletes are soft UPDATEs).
 *
 * A joined channel does not deliver changes yet: the server reports
 * "Subscribed to PostgreSQL" about half a second after the join (measured
 * 2026-10-13), and a change made in between is in neither the refetch at
 * the join nor an event. So that report is a second cue to refetch.
 *
 * @returns a function that removes the channel
 */
export function subscribeToHouseholdChanges(
  client: Client,
  householdId: string,
  listeners: HouseholdChangeListeners,
): () => void {
  const filter = `household_id=eq.${householdId}`;
  const todoItems = { schema: "public", table: "todo_items", filter } as const;
  const shoppingItems = {
    schema: "public",
    table: "shopping_items",
    filter,
  } as const;
  const boardStrokes = {
    schema: "public",
    table: "board_strokes",
    filter,
  } as const;
  const recipes = { schema: "public", table: "recipes", filter } as const;
  const vacations = { schema: "public", table: "vacations", filter } as const;
  const vacationTasks = {
    schema: "public",
    table: "vacation_tasks",
    filter,
  } as const;

  const vacationPeople = {
    schema: "public",
    table: "vacation_people",
    filter,
  } as const;

  const mealPlanEntries = {
    schema: "public",
    table: "meal_plan_entries",
    filter,
  } as const;

  const householdChildren = {
    schema: "public",
    table: "household_children",
    filter,
  } as const;

  const mealReactions = {
    schema: "public",
    table: "meal_reactions",
    filter,
  } as const;

  const channel = client
    .channel(`household:${householdId}`)
    .on<TodoItem>(
      "postgres_changes",
      { ...todoItems, event: "INSERT" },
      (payload) => listeners.onTodoItemChange(toRowRealtimeEvent(payload)),
    )
    .on<TodoItem>(
      "postgres_changes",
      { ...todoItems, event: "UPDATE" },
      (payload) => listeners.onTodoItemChange(toRowRealtimeEvent(payload)),
    )
    .on<ShoppingItem>(
      "postgres_changes",
      { ...shoppingItems, event: "INSERT" },
      (payload) => listeners.onShoppingItemChange(toRowRealtimeEvent(payload)),
    )
    .on<ShoppingItem>(
      "postgres_changes",
      { ...shoppingItems, event: "UPDATE" },
      (payload) => listeners.onShoppingItemChange(toRowRealtimeEvent(payload)),
    )
    .on<BoardStrokeChange>(
      "postgres_changes",
      { ...boardStrokes, event: "INSERT" },
      (payload) => listeners.onBoardStrokeChange(toRowRealtimeEvent(payload)),
    )
    .on<BoardStrokeChange>(
      "postgres_changes",
      { ...boardStrokes, event: "UPDATE" },
      (payload) => listeners.onBoardStrokeChange(toRowRealtimeEvent(payload)),
    )
    .on<RecipeChange>(
      "postgres_changes",
      { ...recipes, event: "INSERT" },
      (payload) => listeners.onRecipeChange(toRowRealtimeEvent(payload)),
    )
    .on<RecipeChange>(
      "postgres_changes",
      { ...recipes, event: "UPDATE" },
      (payload) => listeners.onRecipeChange(toRowRealtimeEvent(payload)),
    )
    .on<Vacation>(
      "postgres_changes",
      { ...vacations, event: "INSERT" },
      (payload) => listeners.onVacationChange(toRowRealtimeEvent(payload)),
    )
    .on<Vacation>(
      "postgres_changes",
      { ...vacations, event: "UPDATE" },
      (payload) => listeners.onVacationChange(toRowRealtimeEvent(payload)),
    )
    .on<VacationTask>(
      "postgres_changes",
      { ...vacationTasks, event: "INSERT" },
      (payload) => listeners.onVacationTaskChange(toRowRealtimeEvent(payload)),
    )
    .on<VacationTask>(
      "postgres_changes",
      { ...vacationTasks, event: "UPDATE" },
      (payload) => listeners.onVacationTaskChange(toRowRealtimeEvent(payload)),
    )
    .on<VacationPerson>(
      "postgres_changes",
      { ...vacationPeople, event: "INSERT" },
      (payload) =>
        listeners.onVacationPersonChange(toRowRealtimeEvent(payload)),
    )
    .on<VacationPerson>(
      "postgres_changes",
      { ...vacationPeople, event: "UPDATE" },
      (payload) =>
        listeners.onVacationPersonChange(toRowRealtimeEvent(payload)),
    )
    .on<MealPlanEntry>(
      "postgres_changes",
      { ...mealPlanEntries, event: "INSERT" },
      (payload) => listeners.onMealPlanEntryChange(toRowRealtimeEvent(payload)),
    )
    .on<MealPlanEntry>(
      "postgres_changes",
      { ...mealPlanEntries, event: "UPDATE" },
      (payload) => listeners.onMealPlanEntryChange(toRowRealtimeEvent(payload)),
    )
    .on<HouseholdChild>(
      "postgres_changes",
      { ...householdChildren, event: "INSERT" },
      (payload) =>
        listeners.onHouseholdChildChange(toRowRealtimeEvent(payload)),
    )
    .on<HouseholdChild>(
      "postgres_changes",
      { ...householdChildren, event: "UPDATE" },
      (payload) =>
        listeners.onHouseholdChildChange(toRowRealtimeEvent(payload)),
    )
    // The column is text in the database; the check constraint keeps it to
    // the two reactions MealReaction names.
    .on<MealReaction>(
      "postgres_changes",
      { ...mealReactions, event: "INSERT" },
      (payload) => listeners.onMealReactionChange(toRowRealtimeEvent(payload)),
    )
    .on<MealReaction>(
      "postgres_changes",
      { ...mealReactions, event: "UPDATE" },
      (payload) => listeners.onMealReactionChange(toRowRealtimeEvent(payload)),
    )
    .on("system", {}, (message: { extension?: string; status?: string }) => {
      if (message.extension === "postgres_changes" && message.status === "ok")
        listeners.onSubscribed();
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") listeners.onSubscribed();
    });

  return () => {
    void client.removeChannel(channel);
  };
}
