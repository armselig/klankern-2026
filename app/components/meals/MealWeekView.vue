<script setup lang="ts">
import {
  mdiChevronLeft,
  mdiChevronRight,
  mdiDeleteOutline,
  mdiPlus,
} from "@quasar/extras/mdi-v7";
import { Dialog, Notify } from "quasar";
import type { MealPlanEntry } from "~/types/meal-plan";
import { HELD_REMOVAL_MS } from "~/stores/meal-plan";

/**
 * A week of the household's dinners, Monday to Sunday: what is planned on
 * each day, a way to add a dinner to it and a way to take one out. The week
 * is in the address (`?week=`), so a week can be linked to and the browser's
 * back button goes to the week before. It only renders and wires; the order
 * and the week's days are worked out in utils/.
 */
const props = defineProps<{ householdId: string }>();
const mealPlanStore = useMealPlanStore();
const recipeStore = useRecipeStore();
const route = useRoute();

const now = useMinuteClock();
const today = computed(() => localDateOf(now.value));
const monday = computed(() => weekFromParam(route.query.week, today.value));
const range = computed(() => ({
  from: monday.value,
  to: addDays(monday.value, 6),
}));
const isThisWeek = computed(() => monday.value === mondayOf(today.value));

watch(range, (wanted) => void mealPlanStore.load(props.householdId, wanted), {
  immediate: true,
});
onMounted(() => void recipeStore.load(props.householdId));
// Leaving the page sends what is held for "Undo": nobody can press it now.
onBeforeUnmount(() => void mealPlanStore.flushHeldRemovals());

/** Loading never shows as an empty week: the days are drawn once fetched,
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

const days = computed(() =>
  weekDays(monday.value).map((day) => ({
    day,
    label: formatWeekday(day),
    isToday: day === today.value,
    dinners: mealPlanStore.visible.filter(
      (entry) => entry.slot === "dinner" && entry.date === day,
    ),
  })),
);
const hasDinners = computed(() =>
  days.value.some((day) => day.dinners.length > 0),
);

/** What an entry is called, and whether its recipe was removed. */
function nameOf(entry: MealPlanEntry): string | null {
  if (entry.title) return entry.title;
  return (entry.recipe_id && recipeStore.find(entry.recipe_id)?.title) || null;
}

const addDay = ref<string | null>(null);
const addOpen = computed({
  get: () => addDay.value !== null,
  set: (open) => {
    if (!open) addDay.value = null;
  },
});

/** Shows that a write failed: the entry is back as it was. */
function notifyFailure() {
  Notify.create({
    message: "Could not save. Check your connection and try again.",
    color: "negative",
    textColor: "on-accent",
    attrs: { "data-testid": TEST_IDS.errorMessage },
  });
}

async function addDinner(choice: {
  recipeId: string | null;
  title: string | null;
}) {
  const day = addDay.value;
  if (!day) return;
  const saved = await mealPlanStore.add({
    date: day,
    slot: "dinner",
    ...choice,
  });
  if (!saved) notifyFailure();
}

/**
 * Takes an entry out of the plan. One whose ingredients are on the shopping
 * list is asked about first, as a trip's meal is; any other is hidden at
 * once with "Undo", and its removal is sent once the notice has gone.
 */
function removeEntry(entry: MealPlanEntry) {
  if (entry.on_shopping_list_at) {
    Dialog.create({
      title: "Remove this dinner?",
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
    message: name ? `${name} removed` : "Dinner removed",
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
</script>

<template>
  <section aria-labelledby="meals-heading">
    <h2
      id="meals-heading"
      class="text-h6 q-my-none"
      :data-testid="TEST_IDS.meals.heading"
    >
      Dinners, week of {{ formatDay(monday, true) }}
    </h2>
    <nav aria-label="Weeks" class="meal-week__nav">
      <q-btn
        flat
        no-caps
        :icon="mdiChevronLeft"
        label="Previous"
        aria-label="Previous week"
        :to="{ query: { week: addDays(monday, -7) } }"
        class="touch-target"
        :data-testid="TEST_IDS.meals.previousWeek"
      />
      <q-btn
        v-if="!isThisWeek"
        flat
        no-caps
        label="Today"
        aria-label="This week"
        :to="{ query: {} }"
        class="touch-target"
        :data-testid="TEST_IDS.meals.thisWeek"
      />
      <q-btn
        flat
        no-caps
        :icon-right="mdiChevronRight"
        label="Next"
        aria-label="Next week"
        :to="{ query: { week: addDays(monday, 7) } }"
        class="touch-target"
        :data-testid="TEST_IDS.meals.nextWeek"
      />
    </nav>

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
        v-if="!hasDinners"
        class="text-muted"
        :data-testid="TEST_IDS.meals.empty"
      >
        Planned dinners appear here.
      </p>
      <!-- role="list" because Safari stops announcing a list once its
           bullets are styled away. -->
      <ul role="list" class="meal-week__days">
        <li
          v-for="day in days"
          :key="day.day"
          class="meal-week__day"
          :data-testid="TEST_IDS.meals.day"
        >
          <h3 class="meal-week__day-heading">
            {{ day.label
            }}<span v-if="day.isToday" class="text-primary"> · Today</span>
          </h3>
          <ul role="list" class="meal-week__entries">
            <li
              v-for="entry in day.dinners"
              :key="entry.id"
              class="meal-week__entry"
              :data-testid="TEST_IDS.meals.entry"
            >
              <nuxt-link
                v-if="entry.recipe_id && nameOf(entry)"
                :to="ROUTES.recipe(entry.recipe_id)"
                class="meal-week__name"
                >{{ nameOf(entry) }}</nuxt-link
              >
              <span v-else-if="nameOf(entry)" class="meal-week__name">{{
                nameOf(entry)
              }}</span>
              <span v-else class="meal-week__name text-muted"
                >Recipe was removed</span
              >
              <span v-if="entry.skipped_at" class="text-muted">Skipped</span>
              <q-btn
                flat
                round
                :icon="mdiDeleteOutline"
                :aria-label="`Remove ${nameOf(entry) ?? 'this dinner'}`"
                class="touch-target"
                :data-testid="TEST_IDS.meals.entryRemove"
                @click="removeEntry(entry)"
              />
            </li>
          </ul>
          <q-btn
            flat
            no-caps
            align="left"
            :icon="mdiPlus"
            label="Add dinner"
            :aria-label="`Add dinner on ${day.label}`"
            class="touch-target full-width"
            :data-testid="TEST_IDS.meals.add"
            @click="addDay = day.day"
          />
        </li>
      </ul>
    </template>

    <add-meal-dialog
      v-model="addOpen"
      :day-label="addDay ? formatWeekday(addDay) : ''"
      :recipes="recipeStore.visible"
      @choose="addDinner"
    />
  </section>
</template>

<style scoped>
.meal-week__nav {
  display: flex;
  justify-content: space-between;
  margin: 8px 0;
}

/* One bordered list of seven days, no card per day. */
.meal-week__days {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--theme-outline);
  border-radius: 4px;
}

.meal-week__day {
  padding: 8px 12px;
}

.meal-week__day + .meal-week__day {
  border-top: 1px solid var(--theme-outline);
}

/* Quasar styles a bare h3 as a 3rem display line. */
.meal-week__day-heading {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.5rem;
  letter-spacing: normal;
}

.meal-week__entries {
  margin: 0;
  padding: 0;
  list-style: none;
}

.meal-week__entry {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meal-week__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
