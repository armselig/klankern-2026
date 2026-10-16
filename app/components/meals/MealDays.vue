<script setup lang="ts">
import { mdiChevronDown, mdiPlus } from "@quasar/extras/mdi-v7";
import { Dialog, Notify } from "quasar";
import { putMealsOnShoppingList } from "~/composables/meals-on-shopping-list";
import type { MealReactionChoice } from "~/types/kids";
import type { MealPlanEntry, MealSlot } from "~/types/meal-plan";
import type { LocalDate } from "~/utils/local-date";
import { HELD_REMOVAL_MS } from "~/stores/meal-plan";

/**
 * The days of the plan a page shows, a week or a trip, laid out for "the
 * week at a glance" (docs/features/meal-planner/week-layout.md): a row per
 * day with its date, which is the day's add button, and its meals, dinner
 * first, then the others with their slot's name. An open dinner is a dashed
 * "Add dinner" in the dinner's place, and a dinner "Fill my week" proposes
 * stands there instead; the week holds the proposal. Each entry has its
 * menu (move, remove, make a recipe of it, mark it as cooked, record what
 * the kids made of it). Above the days, the page's actions (the `actions`
 * slot) and the button that puts the ingredients of what is planned from
 * today on on the shopping list. It renders and wires; the order, the days
 * and the run are worked out in utils/ and composables/.
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
  /** Whether the days before yesterday fold away (the week of today). */
  foldEarlier?: boolean;
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

/** The days folded under "Earlier this week", and whether they are shown. */
const folded = computed(() =>
  props.foldEarlier ? daysToFold(props.days, props.today) : [],
);
const earlierOpen = ref(false);

const dayRows = computed(() =>
  props.days.map((day) => {
    const ofDay = shownEntries.value.filter((entry) => entry.date === day);
    const label = formatWeekday(day);
    const [weekday, dayOfMonth] = label.split(" ");
    return {
      day,
      label,
      weekday,
      dayOfMonth,
      isToday: day === props.today,
      isPast: day < props.today,
      isFolded: folded.value.includes(day),
      dinners: ofDay.filter((entry) => entry.slot === "dinner"),
      // The others after the dinner, as the day runs, each with its name.
      others: SLOTS_IN_ORDER.filter((slot) => slot !== "dinner").flatMap(
        (slot) => ofDay.filter((entry) => entry.slot === slot),
      ),
    };
  }),
);

/** A proposal is on the days; the shopping run waits until it is planned. */
const drafting = computed(() => Object.keys(props.drafts ?? {}).length > 0);

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
/** The slot the dialog's radios hold, for the day it was opened for. */
const addSlot = computed({
  get: () => addTarget.value?.slot ?? "dinner",
  set: (slot: MealSlot) => {
    if (addTarget.value) addTarget.value = { ...addTarget.value, slot };
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
      <div class="meal-days__actions">
        <slot name="actions" />
        <q-btn
          v-if="run.pending.length > 0 && !drafting"
          outline
          no-caps
          class="touch-target"
          :loading="putting"
          :label="putOnListLabel(ingredientCount(run.pending))"
          :data-testid="TEST_IDS.meals.putOnList"
          @click="putOnShoppingList"
        />
      </div>
      <p
        v-if="runFailure"
        class="text-negative"
        role="alert"
        :data-testid="TEST_IDS.meals.putOnListFailure"
      >
        {{ runFailure }}
      </p>
      <!-- role="list" because Safari stops announcing a list once its
           bullets are styled away. -->
      <ul role="list" class="meal-days">
        <li v-if="folded.length > 0">
          <q-btn
            flat
            no-caps
            align="left"
            :icon-right="mdiChevronDown"
            :label="foldedDaysLine(folded)"
            :aria-expanded="earlierOpen"
            class="touch-target full-width meal-days__earlier"
            :class="{ 'meal-days__earlier--open': earlierOpen }"
            :data-testid="TEST_IDS.meals.earlier"
            @click="earlierOpen = !earlierOpen"
          />
        </li>
        <li
          v-for="day in dayRows"
          v-show="!day.isFolded || earlierOpen"
          :key="day.day"
          class="meal-days__day"
          :class="{
            'meal-days__day--today': day.isToday,
            'meal-days__day--past': day.isPast,
          }"
          :data-testid="TEST_IDS.meals.day"
        >
          <div class="meal-days__date">
            <h3 class="meal-days__day-heading">
              <span class="meal-days__weekday">{{ day.weekday }}</span>
              {{ " " }}
              <span class="meal-days__day-of-month">{{ day.dayOfMonth }}</span>
              <template v-if="day.isToday">
                {{ " " }}
                <span class="meal-days__today">Today</span>
              </template>
            </h3>
            <!-- Laid over the whole date, so the date is the day's add
                 button; its sign is the + under the date. -->
            <button
              type="button"
              class="meal-days__add-to-day"
              :aria-label="`Add to ${day.label}`"
              :data-testid="TEST_IDS.meals.addToDay"
              @click="addTarget = { day: day.day, slot: 'dinner' }"
            >
              <q-icon :name="mdiPlus" size="16px" />
            </button>
          </div>
          <ul role="list" class="meal-days__entries">
            <meal-entry
              v-for="entry in day.dinners"
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
              v-if="drafts?.[day.day]"
              :name="drafts[day.day]!.name"
              :day-label="day.label"
              :locked="drafts[day.day]!.locked"
              :can-reroll="canReroll"
              @toggle-lock="emit('toggleDraftLock', day.day)"
              @reroll="emit('rerollDraft', day.day)"
            />
            <li v-else-if="day.dinners.length === 0">
              <q-btn
                flat
                no-caps
                align="left"
                :icon="mdiPlus"
                label="Add dinner"
                :aria-label="`Add dinner on ${day.label}`"
                class="touch-target full-width meal-days__open"
                :data-testid="TEST_IDS.meals.add"
                @click="addTarget = { day: day.day, slot: 'dinner' }"
              />
            </li>
            <meal-entry
              v-for="entry in day.others"
              :key="entry.id"
              :ref="(row) => rememberRow(entry.id, row)"
              :entry="entry"
              :name="nameOf(entry)"
              :slot-label="slotLabel(entry.slot as MealSlot)"
              :can-record-reactions="canRecord(entry)"
              :reaction-note="noteOf(entry)"
              @move="openMove"
              @reactions="openReactions"
              @remove="removeEntry"
              @make-recipe="makeRecipeOf"
              @mark-cooked="markCooked"
            />
          </ul>
        </li>
      </ul>
    </template>

    <add-meal-dialog
      v-model="addOpen"
      v-model:meal-slot="addSlot"
      choose-slot
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
/* The page's actions above the days, side by side where they fit. */
.meal-days__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.meal-days__actions:empty {
  display: none;
}

/* One bordered list of days, no card per day. */
.meal-days {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--theme-outline);
  border-radius: var(--radius-card);
}

.meal-days > li + li {
  border-top: 1px solid var(--theme-separator);
}

/* The first and the last day round off with the list, so that today's tint
   stays inside its corners. */
.meal-days > li:first-child {
  border-start-start-radius: inherit;
  border-start-end-radius: inherit;
}

.meal-days > li:last-child {
  border-end-start-radius: inherit;
  border-end-end-radius: inherit;
}

/* The date in a narrow column, the meals beside it. */
.meal-days__day {
  display: grid;
  grid-template-columns: 3.5rem 1fr;
  column-gap: 8px;
  padding: 4px 4px 4px 0;
}

/* A tint, never a colored edge: see --theme-tint. */
.meal-days__day--today {
  background: var(--theme-tint);
}

.meal-days__date {
  position: relative;
  min-height: 64px;
}

/* Quasar styles a bare h3 as a display line. */
.meal-days__day-heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0;
  padding: 6px 0 22px;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1rem;
  letter-spacing: normal;
}

.meal-days__day-of-month {
  font-size: 1.125rem;
  line-height: 1.5rem;
}

/* The text's color in bold, not the primary color, which is below 4.5:1
   on the tint. */
.meal-days__today {
  font-size: 0.75rem;
  font-weight: 700;
}

.meal-days__day--past .meal-days__weekday,
.meal-days__day--past .meal-days__day-of-month {
  font-weight: 400;
  color: var(--theme-text-muted);
}

.meal-days__add-to-day {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 0 6px;
  border: 0;
  border-radius: var(--radius-control);
  background: none;
  color: var(--theme-text-muted);
  font: inherit;
  cursor: pointer;
}

.meal-days__add-to-day:hover {
  background: var(--theme-veil-on-surface);
}

.meal-days__add-to-day:focus-visible {
  outline: 2px solid var(--theme-text);
  outline-offset: -2px;
}

.meal-days__entries {
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Not planned yet: a dashed edge, as a proposed dinner has. */
.meal-days__open {
  border: 1px dashed var(--theme-outline);
}

.meal-days__earlier :deep(.q-icon) {
  transition: transform 150ms ease;
}

.meal-days__earlier--open :deep(.q-icon) {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .meal-days__earlier :deep(.q-icon) {
    transition: none;
  }
}
</style>
