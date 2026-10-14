import { randomUUID } from "node:crypto";
import type { VacationPhase } from "../../app/types/vacation";
import { addDays, localDateOf } from "../../app/utils/local-date";
import type { TestUser } from "./supabase-fixtures";

// A new vacation starts empty or with copies of an earlier one's tasks. The
// tests that need tasks to work with add such an earlier trip first, through
// the function the app uses, and let the form copy it.

/** The title of the earlier trip; no other vacation in a test contains it. */
export const EARLIER_TRIP_TITLE = "Last summer in Denmark";

/** The earlier trip's tasks: 23 before, 6 during and 4 after the trip. */
const TASKS: Record<VacationPhase, string[]> = {
  before: [
    "Clothes",
    "Toothbrushes",
    "iPad",
    "Charging cables",
    "Baby monitor",
    "Sleeping bags",
    "Mud and rain gear",
    "Rubber boots",
    "Bike helmets",
    "Cooking and kitchen utensils",
    "Coffee pot and espresso powder",
    "Games, puzzles",
    "Books",
    "First-aid kit, medication",
    "Book the ferry",
    "Check the car and fill the tank",
    "Headphones",
    "Paper and pens",
    "Charge the Tiptoi and put it in the car",
    "Kids' phone",
    "Laptop, LAN, HDMI",
    "Plan the meals",
    "Shop for the first evening",
  ],
  during: [
    "Pack for the way home",
    "Check every room for things left behind",
    "Empty the fridge",
    "Clean the house before leaving",
    "Take the rubbish out",
    "Return the key",
  ],
  after: [
    "Unpack the car",
    "Wash the clothes",
    "Put the suitcases away",
    "Refill the first-aid kit",
  ],
};

/** Ticked on the earlier trip; a copy starts open. */
export const EARLIER_TRIP_DONE_TASK = "Clothes";

/** Removed from the earlier trip; a copy leaves it out. */
export const EARLIER_TRIP_REMOVED_TASK = "Old tent";

/**
 * Adds the earlier trip to the household as the member, a hundred days ago,
 * so it is over and unpacked and no page or tile counts it as current. One
 * of its tasks is ticked and one removed, as on a real trip.
 *
 * @returns the trip's id
 */
export async function addEarlierTrip(
  user: TestUser,
  householdId: string,
): Promise<string> {
  const today = localDateOf(new Date());
  const id = randomUUID();
  const titles = Object.entries(TASKS).flatMap(([phase, entries]) =>
    entries.map((title, index) => ({ phase, title, position: index + 1 })),
  );
  const tasks = [
    ...titles,
    {
      phase: "before",
      title: EARLIER_TRIP_REMOVED_TASK,
      position: titles.length + 1,
    },
  ].map((task) => ({ ...task, id: randomUUID() }));

  const { error } = await user.client.rpc("create_vacation", {
    p_vacation: {
      id,
      household_id: householdId,
      title: EARLIER_TRIP_TITLE,
      kind: "house",
      starts_on: addDays(today, -100),
      ends_on: addDays(today, -93),
    },
    p_tasks: tasks,
  });
  if (error) throw error;

  const idOf = (title: string) =>
    tasks.find((task) => task.title === title)!.id;
  const ticked = await user.client
    .from("vacation_tasks")
    .update({ done: true })
    .eq("id", idOf(EARLIER_TRIP_DONE_TASK));
  if (ticked.error) throw ticked.error;
  const removed = await user.client
    .from("vacation_tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", idOf(EARLIER_TRIP_REMOVED_TASK));
  if (removed.error) throw removed.error;
  return id;
}
