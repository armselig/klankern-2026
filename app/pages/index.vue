<script setup lang="ts">
import { Dialog, Notify } from "quasar";
import type { HouseholdChild } from "~/types/kids";

const householdStore = useHouseholdStore();
const todoStore = useTodoStore();
const shoppingStore = useShoppingStore();
const whiteboardStore = useWhiteboardStore();
const recipeStore = useRecipeStore();
const vacationStore = useVacationStore();
const mealPlanStore = useMealPlanStore();
const kidsStore = useKidsStore();

const inviteOpen = ref(false);

onMounted(() => householdStore.fetchMine());

// Everything the dashboard shows is fetched here, not by the roster or the
// tiles, which only render: the page knows the household. Watching its id
// fetches once per visit, and also when a household is created on this
// page, which mounts nothing anew. On a later visit the stores are loaded
// already, and load() only repairs them in the background.
watch(
  () => householdStore.household?.id,
  (householdId) => {
    void householdStore.fetchMembers();
    if (!householdId) return;
    void todoStore.load(householdId);
    void shoppingStore.load(householdId);
    void whiteboardStore.load(householdId);
    void recipeStore.load(householdId);
    void vacationStore.load(householdId);
    void kidsStore.load(householdId);
    // Not `today` below: it is declared after this watcher, which runs at
    // once when the household is known already.
    void mealPlanStore.load(
      householdId,
      dashboardRange(localDateOf(new Date())),
    );
  },
  { immediate: true },
);

const todoPreview = computed(() => previewOfList(todoStore.open));
const shoppingPreview = computed(() => previewOfList(shoppingStore.toBuy));
const recipePreview = computed(() => previewOfList(recipeStore.visible));

/** The day the dashboard was opened on; it decides which vacations are
 * current and where the first of them stands. */
const today = localDateOf(new Date());
const user = useSupabaseUser();
const vacationPreview = computed(() =>
  vacationTilePreview(
    vacationStore.vacationsById,
    vacationStore.tasksById,
    today,
    (vacationId) =>
      myShareOf(
        vacationStore.tasksOf(vacationId),
        personOfUser(vacationStore.peopleOf(vacationId), user.value?.sub),
        vacationStore.peopleById,
      ),
  ),
);

// A store's error can also be that of a single write on its own page. A
// tile only says that it has nothing to show: the store was never loaded.
const todosFailed = computed(() => !todoStore.listId && !!todoStore.error);
const shoppingFailed = computed(
  () => !shoppingStore.listId && !!shoppingStore.error,
);
const whiteboardFailed = computed(
  () => !whiteboardStore.boardId && !!whiteboardStore.error,
);
const recipesFailed = computed(
  () => !recipeStore.householdId && !!recipeStore.error,
);
const now = useMinuteClock();
/** The day the Tonight tile is about: today, or tomorrow from 17:00 on. */
const tonight = computed(() =>
  tonightDay(localDateOf(now.value), now.value.getHours()),
);
const tonightIsToday = computed(() => tonight.value === localDateOf(now.value));
/** How many suggestions "Another one" passed; on this device only, and
 * started again whenever the day or the plan's dinners change. Watched as a
 * key of what the dinners say, not as the list: a resync builds a new list
 * with the same dinners, and would undo the member's "Another one". */
const tonightSkip = ref(0);
const dinnersKey = computed(() =>
  mealPlanStore.visible
    .filter((entry) => entry.slot === "dinner")
    .map(
      (entry) =>
        `${entry.id}|${entry.date}|${entry.recipe_id}|${entry.skipped_at}`,
    )
    .join(),
);
watch([tonight, dinnersKey], () => (tonightSkip.value = 0));
/** The recipes a child refused often enough to be proposed last, with who
 * refused them; counted up to the tile's day. */
const refusals = computed(() =>
  refusalsByRecipe(
    kidsStore.children,
    kidsStore.reactionsById,
    mealPlanStore.visible,
    tonight.value,
  ),
);
const tonightStateNow = computed(() =>
  tonightState(recipeStore.visible, mealPlanStore.visible, tonight.value, {
    isToday: tonightIsToday.value,
    skip: tonightSkip.value,
    demoted: new Set(refusals.value.keys()),
    suggester: repertoireSuggester,
  }),
);
const tonightRefusal = computed(() => {
  const state = tonightStateNow.value;
  if (state.kind !== "suggested" && state.kind !== "only-one") return null;
  return refusalLine(refusals.value.get(state.candidate.recipe.id) ?? []);
});
const tonightLinesNow = computed(() =>
  tonightLines(
    tonightStateNow.value,
    new Map(recipeStore.visible.map((recipe) => [recipe.id, recipe.title])),
  ),
);
/** The open dinners of the tile's week, from the tile's day on; the tile
 * offers to fill them when one besides the tile's own day is open. */
const tonightWeek = computed(() => mondayOf(tonight.value));
const unplannedLine = computed(() => {
  const open = openDinnerDays(
    mealPlanStore.visible,
    weekDays(tonightWeek.value),
    tonight.value,
  );
  if (recipeStore.visible.length === 0) return null;
  if (!open.some((day) => day !== tonight.value)) return null;
  return unplannedDinnersLine(
    open.length,
    tonightWeek.value !== mondayOf(localDateOf(now.value)),
  );
});
const tonightFailed = computed(
  () =>
    (!mealPlanStore.householdId && !!mealPlanStore.error) ||
    recipesFailed.value,
);
const tonightLoading = computed(
  () => mealPlanStore.loading || recipeStore.loading,
);
/** The Tonight tile has its color over its whole surface only while it
 * shows what to eat. */
const tonightLeads = computed(
  () => !tonightLoading.value && !tonightFailed.value,
);
const addTextOpen = ref(false);

/** The dinners of the tile's day that are not removed. */
function dinnersOfTonight() {
  return mealPlanStore.visible.filter(
    (entry) => entry.slot === "dinner" && entry.date === tonight.value,
  );
}

/** Plans the tile's day; a refused save is taken back, and said. */
async function planTonight(choice: {
  recipeId: string | null;
  title: string | null;
}) {
  const saved = await mealPlanStore.add({
    date: tonight.value,
    slot: "dinner",
    ...choice,
  });
  if (saved) return;
  Notify.create({
    message: "Could not save. Check your connection and try again.",
    color: "negative",
    textColor: "on-accent",
    attrs: { "data-testid": TEST_IDS.errorMessage },
  });
}

function planSuggestion() {
  const state = tonightStateNow.value;
  if (state.kind === "suggested" || state.kind === "only-one")
    void planTonight({ recipeId: state.candidate.recipe.id, title: null });
}

function skipTonight(skipped: boolean) {
  for (const entry of dinnersOfTonight())
    if (!!entry.skipped_at !== skipped)
      void mealPlanStore.setSkipped(entry.id, skipped);
}

/** The child the name dialog renames, or null when it adds one. It stays
 * set after the dialog closed, until the dialog has gone, so the focus can
 * go back to the child. */
const namingChild = ref<HouseholdChild | null>(null);
const childNameOpen = ref(false);
const childrenRoster = useTemplateRef<{ focusChild: (id: string) => void }>(
  "childrenRoster",
);

function openChildName(child: HouseholdChild | null) {
  namingChild.value = child;
  childNameOpen.value = true;
}

function childNameDialogGone() {
  const child = namingChild.value;
  if (child) childrenRoster.value?.focusChild(child.id);
}

/** Shows that a write about a child failed. Names no child: a notice is
 * read out and seen over a shoulder. */
function notifyChildFailure() {
  Notify.create({
    message: "Could not save. Check your connection and try again.",
    color: "negative",
    textColor: "on-accent",
    attrs: { "data-testid": TEST_IDS.errorMessage },
  });
}

async function saveChildName(name: string) {
  const child = namingChild.value;
  const saved = child
    ? await kidsStore.renameChild(child.id, name)
    : await kidsStore.addChild(name);
  if (!saved) notifyChildFailure();
}

/** Removing a child leaves out what was recorded about them, so it asks
 * first. */
function confirmRemoveChild(child: HouseholdChild) {
  Dialog.create({
    title: `Remove ${child.name}?`,
    message:
      "What was recorded about their meals no longer counts, here or in the suggestions.",
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
    if (!(await kidsStore.removeChild(child.id))) notifyChildFailure();
  });
}

const vacationsFailed = computed(
  () => !vacationStore.householdId && !!vacationStore.error,
);
</script>

<template>
  <q-page padding :class="{ 'flex flex-center': !householdStore.household }">
    <!-- The spinner and the form stand in the middle of the screen; the
         dashboard starts at the top. The spinner only shows while there is
         no household to show: fetchMine() runs on every visit, and the
         dashboard of a household that is known already stays on screen
         meanwhile. -->
    <q-spinner
      v-if="householdStore.loading && !householdStore.household"
      color="primary"
      size="2em"
    />

    <create-household-form v-else-if="!householdStore.household" />

    <div v-else class="dashboard">
      <h2 class="text-h6 q-my-none" :data-testid="TEST_IDS.household.name">
        {{ householdStore.household.name }}
      </h2>
      <member-roster @invite="inviteOpen = true" />
      <!-- Only once the children are loaded: an add needs the store to
           know the household. A failed load leaves the row out. -->
      <kid-roster
        v-if="kidsStore.householdId === householdStore.household.id"
        ref="childrenRoster"
        :children="kidsStore.children"
        @add="openChildName(null)"
        @rename="openChildName"
        @remove="confirmRemoveChild"
      />

      <!-- A list of links, as a navigation is; a plain ul, because a q-list
           would hold no q-items. role="list" because Safari stops
           announcing a list once its bullets are styled away. -->
      <!-- The whiteboard is last and stays last when a tile is added: the
           other four are what a household looks up, and they come first. -->
      <nav aria-label="Lists, recipes, vacations and whiteboard">
        <ul role="list" class="dashboard__tiles">
          <!-- Tonight leads, once it offers a decision: a tile that is
               loading or failed has none, and the shared red line would
               be too close to 4.5:1 on its tint. -->
          <li
            class="dashboard__tile--wide"
            :class="{ 'dashboard__tile--lead': tonightLeads }"
            :data-testid="TEST_IDS.dashboard.tile.tonight"
          >
            <dashboard-tile
              :title="tonightIsToday ? 'Tonight' : 'Tomorrow'"
              :to="ROUTES.meals"
              feature="meals"
              :loading="tonightLoading"
              :failed="tonightFailed"
            >
              <tonight-tile
                :kind="tonightStateNow.kind"
                :lines="tonightLinesNow"
                :is-today="tonightIsToday"
                :refusal="tonightRefusal"
                :unplanned="unplannedLine"
                :fill-week-to="{
                  path: ROUTES.meals,
                  query: { week: tonightWeek, fill: '1' },
                }"
                @plan-this="planSuggestion"
                @another="tonightSkip++"
                @skip="skipTonight(true)"
                @undo-skip="skipTonight(false)"
                @add-text="addTextOpen = true"
              />
            </dashboard-tile>
          </li>
          <li :data-testid="TEST_IDS.dashboard.tile.todos">
            <dashboard-tile
              title="To-dos"
              :to="ROUTES.todos"
              feature="todos"
              :loading="todoStore.loading"
              :failed="todosFailed"
            >
              <tile-list-preview
                :preview="todoPreview"
                count-label="open"
                empty-text="Nothing to do."
              />
            </dashboard-tile>
          </li>
          <li :data-testid="TEST_IDS.dashboard.tile.shopping">
            <dashboard-tile
              title="Shopping"
              :to="ROUTES.shopping"
              feature="shopping"
              :loading="shoppingStore.loading"
              :failed="shoppingFailed"
            >
              <tile-list-preview
                :preview="shoppingPreview"
                count-label="to buy"
                empty-text="Nothing to buy."
              />
            </dashboard-tile>
          </li>
          <li :data-testid="TEST_IDS.dashboard.tile.recipes">
            <dashboard-tile
              title="Recipes"
              :to="ROUTES.recipes"
              feature="recipes"
              :loading="recipeStore.loading"
              :failed="recipesFailed"
            >
              <tile-list-preview
                :preview="recipePreview"
                count-label="saved"
                empty-text="None saved yet."
              />
            </dashboard-tile>
          </li>
          <li :data-testid="TEST_IDS.dashboard.tile.vacations">
            <dashboard-tile
              title="Vacations"
              :to="ROUTES.vacations"
              feature="vacations"
              :loading="vacationStore.loading"
              :failed="vacationsFailed"
            >
              <vacation-tile
                v-if="vacationPreview"
                :lines="vacationPreview"
                :all-to="ROUTES.vacations"
              />
              <p
                v-else
                class="text-muted q-my-none"
                :data-testid="TEST_IDS.dashboard.tileEmpty"
              >
                No vacation planned.
              </p>
            </dashboard-tile>
          </li>
          <li :data-testid="TEST_IDS.dashboard.tile.whiteboard">
            <dashboard-tile
              title="Whiteboard"
              :to="ROUTES.whiteboard"
              feature="whiteboard"
              :loading="whiteboardStore.loading"
              :failed="whiteboardFailed"
            >
              <whiteboard-preview
                v-if="whiteboardStore.visible.length > 0"
                :strokes="whiteboardStore.visible"
              />
              <p
                v-else
                class="text-muted q-my-none"
                :data-testid="TEST_IDS.dashboard.tileEmpty"
              >
                Nothing drawn yet.
              </p>
            </dashboard-tile>
          </li>
        </ul>
      </nav>

      <!-- Beside the roster, whose button opens it: the roster only renders. -->
      <invite-dialog v-model="inviteOpen" />
      <child-name-dialog
        v-model="childNameOpen"
        :title="namingChild ? `Rename ${namingChild.name}` : 'Add a child'"
        :initial-name="namingChild?.name ?? ''"
        @save="saveChildName"
        @hide="childNameDialogGone"
      />
      <add-meal-dialog
        v-model="addTextOpen"
        :day-label="formatWeekday(tonight)"
        slot-label="Dinner"
        :recipes="recipeStore.visible"
        @choose="planTonight"
      />
    </div>
  </q-page>
</template>

<style scoped>
/* One column of a phone's width, also on a wider screen. */
.dashboard {
  max-width: 480px;
  margin: 0 auto;
}

/* Two tiles side by side, on the reference phone as well. */
.dashboard__tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}

/* The Tonight tile spans the row: it holds a line of buttons. */
.dashboard__tile--wide {
  grid-column: 1 / -1;
}

/* The one tile that asks for a decision today: peach over the surface
   (6% light, 8% dark; utils/theme-tokens.spec.ts calculates the pairs on
   it) and an edge in the strong shade. The edge is 2px, so that it still
   leads in forced colors, where the tint is dropped and every edge takes
   the system's color. */
.dashboard__tile--lead > :deep(.dashboard-tile) {
  background-image: linear-gradient(var(--feature-tint), var(--feature-tint));
  --card-edge: var(--feature-outline);
  --card-edge-width: 2px;
  /* The wider edge takes its pixel from the padding: the content stays
     where it is on the other tiles. */
  padding: 13px;
}

/* A tile fills its cell, so the two of a row are equally high. */
.dashboard__tiles > li {
  display: flex;
  min-width: 0;
}
</style>
