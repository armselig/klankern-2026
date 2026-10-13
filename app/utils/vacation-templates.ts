import type {
  VacationKind,
  VacationPhase,
  VacationTemplateTask,
} from "~/types/vacation";

/**
 * The tasks a new vacation starts with. A template is copied once, when the
 * vacation is added; from then on its tasks are ordinary rows, and a change
 * here never reaches an existing vacation.
 *
 * The hotel template is the tasks both kinds share, and the house template
 * adds what cooking and a house bring. So there is one list, and an entry
 * says when it is the house's alone.
 *
 * The entries before the trip are one household's own list, in its order;
 * the rest was drafted for it. Some name things only that household has.
 * See "The house and hotel templates" in docs/features/vacations-templates.md
 * for what was decided and what is to change when other households use the
 * app.
 */
interface TemplateEntry {
  title: string;
  houseOnly?: true;
}

const ENTRIES: Record<VacationPhase, readonly TemplateEntry[]> = {
  before: [
    { title: "Clothes" },
    { title: "Toothbrushes" },
    { title: "iPad" },
    { title: "Charging cables" },
    { title: "Baby monitor" },
    { title: "Sleeping bags" },
    { title: "Mud and rain gear" },
    { title: "Rubber boots" },
    { title: "Bike helmets" },
    { title: "Cooking and kitchen utensils", houseOnly: true },
    { title: "Coffee pot and espresso powder", houseOnly: true },
    { title: "Games, puzzles" },
    { title: "Books" },
    { title: "First-aid kit, medication" },
    { title: "Book the ferry" },
    { title: "Check the car and fill the tank" },
    { title: "Headphones" },
    { title: "Paper and pens" },
    { title: "Charge the Tiptoi and put it in the car" },
    { title: "Kids' phone" },
    { title: "Laptop, LAN, HDMI" },
    { title: "Plan the meals", houseOnly: true },
    { title: "Shop for the first evening", houseOnly: true },
  ],
  // What is done on the last day is "during": the page shows that phase
  // until the end date has passed.
  during: [
    { title: "Pack for the way home" },
    { title: "Check every room for things left behind" },
    { title: "Empty the fridge", houseOnly: true },
    { title: "Clean the house before leaving", houseOnly: true },
    { title: "Take the rubbish out", houseOnly: true },
    { title: "Return the key", houseOnly: true },
  ],
  after: [
    { title: "Unpack the car" },
    { title: "Wash the clothes" },
    { title: "Put the suitcases away" },
    { title: "Refill the first-aid kit" },
  ],
};

/** The phases in the order a trip goes through them, which is also the
 * order of a vacation's page. */
export const VACATION_PHASES: readonly VacationPhase[] = [
  "before",
  "during",
  "after",
];

/** The tasks a new vacation of this kind is filled with, each with its
 * place in its phase. */
export function templateTasks(kind: VacationKind): VacationTemplateTask[] {
  return VACATION_PHASES.flatMap((phase) =>
    ENTRIES[phase]
      .filter((entry) => kind === "house" || !entry.houseOnly)
      .map((entry, index) => ({
        phase,
        title: entry.title,
        position: index + 1,
      })),
  );
}
