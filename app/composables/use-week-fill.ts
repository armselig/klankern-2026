import type { Ref } from "vue";
import { COOKED_LOOKBACK_WEEKS } from "~/utils/meal-week";
import { repertoireSuggester } from "~/utils/meal-suggester";
import type { LocalDate } from "~/utils/local-date";
import type { WeekDraft } from "~/utils/week-fill";

/** Where the device remembers that the member dismissed the note about a
 * small repertoire: it is said once, not on every fill. */
const SMALL_NOTE_KEY = "klankern.fill.smallRepertoireNoteDismissed";

function readSmallNoteDismissed(): boolean {
  try {
    return localStorage.getItem(SMALL_NOTE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * "Fill my week" for the week shown: which days are open, the proposal for
 * them with its locks and re-rolls, and planning it. The proposal is held
 * here, on this device, until it is planned; leaving the week drops it. The
 * rules are in utils/week-fill.ts and utils/meal-suggester.ts; this wires
 * them to the stores.
 */
export function useWeekFill(
  householdId: Ref<string>,
  monday: Ref<LocalDate>,
  now: Ref<Date>,
) {
  const mealPlanStore = useMealPlanStore();
  const recipeStore = useRecipeStore();
  const kidsStore = useKidsStore();

  /** The first day a dinner is proposed for: the Tonight tile's day. */
  const firstDay = computed(() =>
    tonightDay(localDateOf(now.value), now.value.getHours()),
  );
  const days = computed(() => weekDays(monday.value));
  const sunday = computed(() => days.value.at(-1)!);
  /** A week that is over has nothing to fill. */
  const isFillable = computed(() => firstDay.value <= sunday.value);

  /** The days the proposal looks at: the lookback before the first day,
   * which tells what was cooked when, up to the end of the week. */
  const neededRange = computed(() => ({
    from: addDays(firstDay.value, -COOKED_LOOKBACK_WEEKS * 7),
    to: sunday.value,
  }));
  watch(
    [householdId, neededRange, isFillable],
    ([id, range, fillable]) => {
      if (fillable) void mealPlanStore.load(id, range);
    },
    { immediate: true },
  );

  /** Everything the proposal depends on is here. The children may have
   * failed to load: the proposal then only lacks what they refused. */
  const ready = computed(
    () =>
      isFillable.value &&
      mealPlanStore.householdId === householdId.value &&
      mealPlanStore.isLoaded(neededRange.value) &&
      recipeStore.householdId === householdId.value &&
      (kidsStore.householdId === householdId.value ||
        (!kidsStore.loading && !!kidsStore.error)),
  );

  const openDays = computed(() =>
    isFillable.value
      ? openDinnerDays(mealPlanStore.visible, days.value, firstDay.value)
      : [],
  );

  const context = computed(() => ({
    recipes: recipeStore.visible,
    entries: mealPlanStore.visible,
    demoted: new Set(
      refusalsByRecipe(
        kidsStore.children,
        kidsStore.reactionsById,
        mealPlanStore.visible,
        firstDay.value,
      ).keys(),
    ),
  }));

  /** The proposal as made; null while there is none. */
  const draftAsMade = ref<WeekDraft | null>(null);
  /** The proposal for the days that are still open. */
  const draft = computed(() =>
    draftAsMade.value
      ? draftOnOpenDays(draftAsMade.value, openDays.value)
      : null,
  );
  watch(monday, () => (draftAsMade.value = null));
  // Every proposed day was planned meanwhile, on another device too.
  watch(draft, (shown) => {
    if (shown && Object.keys(shown).length === 0) draftAsMade.value = null;
  });

  const canFill = computed(
    () =>
      ready.value &&
      openDays.value.length > 0 &&
      recipeStore.visible.length > 0 &&
      draft.value === null,
  );

  function start() {
    if (!canFill.value) return;
    draftAsMade.value = startWeekDraft(
      repertoireSuggester,
      context.value,
      openDays.value,
    );
  }

  function toggleLock(day: LocalDate) {
    if (draft.value) draftAsMade.value = toggleDraftLock(draft.value, day);
  }

  function reroll(day: LocalDate) {
    if (draft.value)
      draftAsMade.value = rerollDraftDay(
        repertoireSuggester,
        context.value,
        draft.value,
        day,
      );
  }

  function rerollRest() {
    if (draft.value)
      draftAsMade.value = rerollUnlocked(
        repertoireSuggester,
        context.value,
        draft.value,
      );
  }

  function cancel() {
    draftAsMade.value = null;
  }

  /** The proposal by day as the days show it: a name and the lock. */
  const draftRows = computed(() => {
    if (!draft.value) return undefined;
    return Object.fromEntries(
      Object.entries(draft.value).map(([day, dinner]) => [
        day,
        {
          name: recipeStore.find(dinner.recipeId)?.title ?? "",
          locked: dinner.locked,
        },
      ]),
    );
  });

  const smallNoteDismissed = ref(readSmallNoteDismissed());
  function dismissSmallNote() {
    smallNoteDismissed.value = true;
    try {
      localStorage.setItem(SMALL_NOTE_KEY, "1");
    } catch {
      // Not remembered on this device; the note is gone until the next visit.
    }
  }
  const choiceLine = computed(() =>
    fillChoiceLine(
      recipeStore.visible.length,
      Object.keys(draft.value ?? {}).length,
      smallNoteDismissed.value,
    ),
  );

  const saving = ref(false);
  /**
   * Plans every proposed dinner, each as the add dialog would, so each
   * shows at once and a refused one is taken back by the store. The
   * proposal is dropped afterwards; a dinner that could not be saved leaves
   * its day open, to fill again.
   *
   * @returns the notice to show
   */
  async function save() {
    const shown = draft.value;
    if (!shown || saving.value) return null;
    saving.value = true;
    try {
      const results = await Promise.all(
        Object.entries(shown).map(([date, dinner]) =>
          mealPlanStore.add({
            date,
            slot: "dinner",
            recipeId: dinner.recipeId,
            title: null,
          }),
        ),
      );
      draftAsMade.value = null;
      return plannedDinnersNotice(
        results.filter(Boolean).length,
        results.length,
      );
    } finally {
      saving.value = false;
    }
  }

  return {
    ready,
    canFill,
    openDays,
    draft,
    draftRows,
    choiceLine,
    canReroll: computed(() => recipeStore.visible.length > 1),
    saving,
    start,
    toggleLock,
    reroll,
    rerollRest,
    cancel,
    save,
    dismissSmallNote,
  };
}
