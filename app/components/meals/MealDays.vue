<script setup lang="ts">
import { mdiPlus } from "@quasar/extras/mdi-v7";
import { Dialog, Notify } from "quasar";
import { putMealsOnShoppingList } from "~/composables/meals-on-shopping-list";
import type { MealReactionChoice } from "~/types/kids";
import type { MealPlanEntry, MealSlot } from "~/types/meal-plan";
import type { LocalDate } from "~/utils/local-date";
import { HELD_REMOVAL_MS } from "~/stores/meal-plan";

/**
 * The days of the plan a page shows, a week or a trip: each day's meals,
 * dinner first, with a way to add one, and each entry's menu (move, remove,
 * make a recipe of it, mark it as cooked, record what the kids made of it).
 * A day "Fill my week" proposes a dinner for shows it in place of "Add
 * dinner"; the week holds the proposal. Under the days, the button that
 * puts the ingredients of what is planned from today on on the shopping
 * list. It renders and wires; the order, the days and the run are worked
 * out in utils/ and composables/.
 */
const props = defineProps<{
  householdId: string;
  days: LocalDate[];
  today: LocalDate;
  /** The dinners proposed by "Fill my week", by day, before they are
   * planned. */
  drafts?: Readonly<Record<LocalDate, { name: string; locked: boolean }>>;
  /** A proposed dinner can be swapped for another recipe. */
  canReroll?: boolean;
}>();
const emit = defineEmits<{
  toggleDraftLock: [day: LocalDate];
  rerollDraft: [day: LocalDate];
}>();
const mealPlanStore = useMealPlanStore();
const recipeStore = useRecipeStore();
const shoppingStore = useShoppingStore();
const kidsStore = useKidsStore();
const router = useRouter();

const range = computed(() => ({
  from: props.days[0]!,
  to: props.days.at(-1)!,
}));

watch(range, (wanted) => void mealPlanStore.load(props.householdId, wanted), {
  immediate: true,
});
onMounted(() => {
  void recipeStore.load(props.householdId);
  // Not waited for: without the children, an entry only lacks its line
  // about them and the menu item that records it.
  void kidsStore.load(props.householdId);
});
// Leaving the page sends what is held for "Undo": nobody can press it now.
onBeforeUnmount(() => void mealPlanStore.flushHeldRemovals());

/** Loading never shows as an empty plan: the days are drawn once fetched,
 * and once the recipes are, since every recipe would be "removed" before. */
const loaded = computed(
  () =>
    mealPlanStore.householdId === props.householdId &&
    mealPlanStore.isLoaded(range.value) &&
    recipeStore.householdId === props.householdId,
);
const failed = computed(
  () => !loaded.value && !mealPlanStore.loading && !!mealPlanStore.error,
);

/** The live entries of the days shown. */
const shownEntries = computed(() =>
  mealPlanStore.visible.filter(
    (entry) => range.value.from <= entry.date && entry.date <= range.value.to,
  ),
);

const OTHER_SLOTS = SLOTS_IN_ORDER.filter((slot) => slot !== "dinner");

const dayRows = computed(() =>
  props.days.map((day) => {
    const ofDay = shownEntries.value.filter((entry) => entry.date === day);
    return {
      day,
      label: formatWeekday(day),
      isToday: day === props.today,
      // Dinner always, since its row is where one is added; the others
      // only when something is planned in them.
      slots: SLOTS_IN_ORDER.map((slot) => ({
        slot,
        label: slotLabel(slot),
        entries: ofDay.filter((entry) => entry.slot === slot),
      })).filter((row) => row.slot === "dinner" || row.entries.length > 0),
    };
  }),
);

/** What an entry is called; null when its recipe was removed. */
function nameOf(entry: MealPlanEntry): string | null {
  if (entry.title) return entry.title;
  return (entry.recipe_id && recipeStore.find(entry.recipe_id)?.title) || null;
}

/** Shows that a write failed: the entry is back as it was. */
function notifyFailure() {
  Notify.create({
    message: "Could not save. Check your connection and try again.",
    color: "negative",
    textColor: "on-accent",
    attrs: { "data-testid": TEST_IDS.errorMessage },
  });
}

/** Where the add dialog puts what is chosen; null while it is closed. */
const addTarget = ref<{ day: LocalDate; slot: MealSlot } | null>(null);
const addOpen = computed({
  get: () => addTarget.value !== null,
  set: (open) => {
    if (!open) addTarget.value = null;
  },
});

async function addEntry(choice: {
  recipeId: string | null;
  title: string | null;
}) {
  const target = addTarget.value;
  if (!target) return;
  const saved = await mealPlanStore.add({
    date: target.day,
    slot: target.slot,
    ...choice,
  });
  if (!saved) notifyFailure();
}

/** The entry the move dialog moves. It stays set after the dialog closed,
 * until the dialog has gone, so the focus can go back to the entry. */
const moving = ref<MealPlanEntry | null>(null);
const moveOpen = ref(false);

function openMove(entry: MealPlanEntry) {
  moving.value = entry;
  moveOpen.value = true;
}

/** The rows, by entry id, to put the focus back on one. */
const entryRows = new Map<string, { focusMore: () => void }>();
function rememberRow(id: string, row: unknown) {
  if (row) entryRows.set(id, row as { focusMore: () => void });
  else entryRows.delete(id);
}

/** Puts the focus back on the menu button of the entry the dialog was
 * opened for, wherever the entry is now. Quasar would give it back to the
 * menu's "Move", which has gone with the menu. An entry moved to a day that
 * is not shown has no row, and the focus stays where it is. */
function moveDialogGone() {
  const entry = moving.value;
  moving.value = null;
  if (entry) entryRows.get(entry.id)?.focusMore();
}

async function moveEntry(target: { date: LocalDate; slot: MealSlot }) {
  const entry = moving.value;
  if (!entry) return;
  const moved = await mealPlanStore.move(entry.id, target.date, target.slot);
  if (!moved) notifyFailure();
}

/** The entry whose reactions the dialog records. It stays set after the
 * dialog closed, until the dialog has gone, as for the move dialog. */
const reacting = ref<MealPlanEntry | null>(null);
const reactionOpen = ref(false);

function openReactions(entry: MealPlanEntry) {
  reacting.value = entry;
  reactionOpen.value = true;
}

function reactionDialogGone() {
  const entry = reacting.value;
  reacting.value = null;
  if (entry) entryRows.get(entry.id)?.focusMore();
}

/** Whether the menu of an entry offers to record the kids' reactions. */
function canRecord(entry: MealPlanEntry): boolean {
  return (
    kidsStore.children.length > 0 && canRecordReactions(entry, props.today)
  );
}

/** The line about the kids under an entry, only where what was recorded
 * counts: a dinner skipped or moved ahead after a refusal shows none, as
 * the record and the suggestions leave it out. */
function noteOf(entry: MealPlanEntry): string | null {
  if (!canRecord(entry)) return null;
  return reactionNote(kidsStore.reactionsById, kidsStore.children, entry.id);
}

/** Saves what the dialog says for each child; only what changed is sent
 * (see setReaction). The notice names no child. */
async function saveReactions(choices: Record<string, MealReactionChoice>) {
  const entry = reacting.value;
  if (!entry) return;
  const saved = await Promise.all(
    Object.entries(choices).map(([childId, choice]) =>
      kidsStore.setReaction(entry.id, childId, choice),
    ),
  );
  if (saved.includes(false)) notifyFailure();
}

async function markCooked(entry: MealPlanEntry) {
  await mealPlanStore.setSkipped(entry.id, false);
  if (mealPlanStore.entriesById[entry.id]?.skipped_at) notifyFailure();
}

/** Opens the form for a new recipe with the entry's title in it; saving the
 * recipe puts it in the entry's place (see RecipeEditor.vue). */
function makeRecipeOf(entry: MealPlanEntry) {
  void router.push({
    path: ROUTES.recipeNew,
    query: { entry: entry.id, title: entry.title ?? "" },
  });
}

/**
 * Takes an entry out of the plan. One whose ingredients are on the shopping
 * list is asked about first; any other is hidden at once with "Undo", and
 * its removal is sent once the notice has gone.
 */
function removeEntry(entry: MealPlanEntry) {
  if (entry.on_shopping_list_at) {
    Dialog.create({
      title: "Remove this meal?",
      message: "Its ingredients stay on the shopping list. Remove the entry?",
      // No color for the flat button; see SharedWhiteboard.vue.
      cancel: withTestId(
        { label: "Cancel", flat: true, color: undefined },
        TEST_IDS.confirmDialog.cancel,
      ),
      ok: withTestId(
        { label: "Remove", color: "negative", unelevated: true },
        TEST_IDS.confirmDialog.ok,
      ),
    }).onOk(async () => {
      await mealPlanStore.remove(entry.id);
      if (mealPlanStore.entriesById[entry.id]?.deleted_at === null)
        notifyFailure();
    });
    return;
  }
  mealPlanStore.holdRemoval(entry.id);
  const name = nameOf(entry);
  Notify.create({
    message: name ? `${name} removed` : "Meal removed",
    timeout: HELD_REMOVAL_MS,
    color: "primary",
    textColor: "on-accent",
    actions: [
      withTestId(
        {
          label: "Undo",
          color: "on-accent",
          handler: () => mealPlanStore.undoRemoval(entry.id),
        },
        TEST_IDS.meals.undoRemoval,
      ),
    ],
  });
}

/** What the shopping run would cover: the shown days from today on. */
const run = computed(() =>
  planShoppingRun(shownEntries.value, props.today, (id) =>
    recipeStore.find(id),
  ),
);
const putting = ref(false);
/** What stays under the button after a run stopped at a meal, until a later
 * run goes through. */
const runFailure = ref<string | null>(null);

/** Puts the ingredients of the planned meals on the shopping list. The list
 * has to be loaded first: it is the shopping page that usually does. */
async function putOnShoppingList() {
  putting.value = true;
  runFailure.value = null;
  const leftOut = run.value.leftOut;
  try {
    await shoppingStore.ensureLoaded(props.householdId);
    // Loading failed; the store's error says why.
    if (!shoppingStore.listId) {
      runFailure.value =
        shoppingStore.error ?? "The shopping list could not be loaded.";
      return;
    }
    const outcome = await putMealsOnShoppingList(run.value.pending, {
      addAll: (entries) => shoppingStore.addAll(entries),
      markMealOnList: (id) => mealPlanStore.markOnShoppingList(id),
    });
    if (outcome.items > 0) {
      Notify.create({
        // One message, not a caption: Quasar dims a caption below 4.5:1 on
        // the primary color.
        message: shoppingRunNotice(outcome.items, leftOut).join(". "),
        // Not "positive": see RecipeView.vue.
        color: "primary",
        textColor: "on-accent",
        attrs: { "data-testid": TEST_IDS.meals.putOnListNotice },
      });
    }
    if (outcome.failure) {
      runFailure.value = putOnListFailureLine(
        outcome.failure.title,
        outcome.meals,
      );
    }
  } finally {
    putting.value = false;
  }
}
</script>

<template>
  <div>
    <q-spinner
      v-if="!loaded && !failed"
      color="primary"
      size="2em"
      :data-testid="TEST_IDS.meals.loading"
    />
    <p
      v-else-if="failed"
      class="text-negative"
      :data-testid="TEST_IDS.meals.failure"
    >
      Couldn't load the plan. Reload the page to try again.
    </p>
    <template v-else>
      <p
        v-if="shownEntries.length === 0"
        class="text-muted"
        :data-testid="TEST_IDS.meals.empty"
      >
        Planned meals appear here.
      </p>
      <!-- role="list" because Safari stops announcing a list once its
           bullets are styled away. -->
      <ul role="list" class="meal-days">
        <li
          v-for="day in dayRows"
          :key="day.day"
          class="meal-days__day"
          :data-testid="TEST_IDS.meals.day"
        >
          <h3 class="meal-days__day-heading">
            {{ day.label
            }}<span v-if="day.isToday" class="text-primary"> · Today</span>
          </h3>
          <section
            v-for="row in day.slots"
            :key="row.slot"
            :aria-label="`${row.label}, ${day.label}`"
            :data-testid="TEST_IDS.meals.slot"
          >
            <!-- Dinner is the day's main row and goes without a label. -->
            <h4
              v-if="row.slot !== 'dinner'"
              class="meal-days__slot-heading"
              :data-testid="TEST_IDS.meals.slotHeading"
            >
              {{ row.label }}
            </h4>
            <ul role="list" class="meal-days__entries">
              <meal-entry
                v-for="entry in row.entries"
                :key="entry.id"
                :ref="(row) => rememberRow(entry.id, row)"
                :entry="entry"
                :name="nameOf(entry)"
                :can-record-reactions="canRecord(entry)"
                :reaction-note="noteOf(entry)"
                @move="openMove"
                @reactions="openReactions"
                @remove="removeEntry"
                @make-recipe="makeRecipeOf"
                @mark-cooked="markCooked"
              />
              <meal-draft-row
                v-if="row.slot === 'dinner' && drafts?.[day.day]"
                :name="drafts[day.day]!.name"
                :day-label="day.label"
                :locked="drafts[day.day]!.locked"
                :can-reroll="canReroll"
                @toggle-lock="emit('toggleDraftLock', day.day)"
                @reroll="emit('rerollDraft', day.day)"
              />
            </ul>
            <q-btn
              v-if="row.slot === 'dinner' && !drafts?.[day.day]"
              flat
              no-caps
              align="left"
              :icon="mdiPlus"
              label="Add dinner"
              :aria-label="`Add dinner on ${day.label}`"
              class="touch-target full-width"
              :data-testid="TEST_IDS.meals.add"
              @click="addTarget = { day: day.day, slot: 'dinner' }"
            />
          </section>
          <div class="meal-days__other-slots">
            <q-btn
              v-for="slot in OTHER_SLOTS"
              :key="slot"
              flat
              dense
              no-caps
              :icon="mdiPlus"
              :label="slotLabel(slot)"
              :aria-label="`Add ${slot} on ${day.label}`"
              class="touch-target"
              :data-testid="TEST_IDS.meals.addOtherSlot"
              @click="addTarget = { day: day.day, slot }"
            />
          </div>
        </li>
      </ul>

      <div class="q-mt-md">
        <q-btn
          v-if="run.pending.length > 0"
          unelevated
          no-caps
          color="primary"
          class="touch-target"
          :loading="putting"
          :label="putOnListLabel(ingredientCount(run.pending))"
          :data-testid="TEST_IDS.meals.putOnList"
          @click="putOnShoppingList"
        />
        <p
          v-if="runFailure"
          class="text-negative q-mt-sm"
          role="alert"
          :data-testid="TEST_IDS.meals.putOnListFailure"
        >
          {{ runFailure }}
        </p>
      </div>
    </template>

    <add-meal-dialog
      v-model="addOpen"
      :day-label="addTarget ? formatWeekday(addTarget.day) : ''"
      :slot-label="addTarget ? slotLabel(addTarget.slot) : ''"
      :recipes="recipeStore.visible"
      @choose="addEntry"
    />
    <move-meal-dialog
      v-if="moving"
      v-model="moveOpen"
      :name="nameOf(moving) ?? 'this meal'"
      :from-date="moving.date"
      :from-slot="moving.slot as MealSlot"
      :today="today"
      @choose="moveEntry"
      @hide="moveDialogGone"
    />
    <reaction-dialog
      v-if="reacting"
      v-model="reactionOpen"
      :name="nameOf(reacting) ?? 'this meal'"
      :children="kidsStore.children"
      :initial="
        reactionChoicesOf(
          kidsStore.reactionsById,
          kidsStore.children,
          reacting.id,
        )
      "
      @save="saveReactions"
      @hide="reactionDialogGone"
    />
  </div>
</template>

<style scoped>
/* One bordered list of days, no card per day. */
.meal-days {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--theme-outline);
  border-radius: 4px;
}

.meal-days__day {
  padding: 8px 12px;
}

.meal-days__day + .meal-days__day {
  border-top: 1px solid var(--theme-outline);
}

/* Quasar styles bare h3 and h4 as display lines. */
.meal-days__day-heading,
.meal-days__slot-heading {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.5rem;
  letter-spacing: normal;
}

.meal-days__slot-heading {
  margin-top: 4px;
  font-weight: 400;
  color: var(--theme-text-muted);
}

.meal-days__entries {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* The other slots' add buttons share one line, so a day stays short. */
.meal-days__other-slots {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
