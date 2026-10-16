<script setup lang="ts">
import { mdiDotsVertical } from "@quasar/extras/mdi-v7";
import type { MealPlanEntry } from "~/types/meal-plan";

/**
 * One entry of a day's list: the slot's name in front where it is no
 * dinner, its name, a link where it is a recipe, and one menu with what can
 * be done to it. Under it, only when a
 * child did not eat it, a line that says who. It only renders and reports;
 * the day list does the writes.
 */
const props = defineProps<{
  entry: MealPlanEntry;
  /** The entry's name; null when its recipe was removed. */
  name: string | null;
  /** The slot's name ("Lunch"); null for a dinner, which has none. */
  slotLabel?: string | null;
  /** Whether the menu offers to record what the kids made of it. */
  canRecordReactions?: boolean;
  /** Which child refused it or picked at it; null when every child ate it. */
  reactionNote?: string | null;
}>();
const emit = defineEmits<{
  move: [entry: MealPlanEntry];
  remove: [entry: MealPlanEntry];
  makeRecipe: [entry: MealPlanEntry];
  markCooked: [entry: MealPlanEntry];
  reactions: [entry: MealPlanEntry];
}>();

/** What the menu's button and the menu are named; the visible sign is the
 * same in every row, so the name adds the entry. */
const menuName = computed(() => `More: ${props.name ?? "Recipe was removed"}`);

/**
 * Whether the menu is open. Opened by the button's own press, not by
 * Quasar's listener, which also opens it when Enter is released on the
 * button: a dialog that was closed with Enter gives the focus back to it.
 */
const menuOpen = ref(false);

/** Closes the menu, then reports what was chosen. Closed here, not left to
 * Quasar's auto-close: a dialog opened by the choice takes the focus first,
 * and the menu then stays open underneath it, holding the focus when the
 * dialog gives it back. */
function choose(
  action: "move" | "remove" | "makeRecipe" | "markCooked" | "reactions",
) {
  menuOpen.value = false;
  // One call per event name, so each is checked against defineEmits.
  if (action === "move") emit("move", props.entry);
  else if (action === "remove") emit("remove", props.entry);
  else if (action === "makeRecipe") emit("makeRecipe", props.entry);
  else if (action === "reactions") emit("reactions", props.entry);
  else emit("markCooked", props.entry);
}

const moreButton = useTemplateRef<{ $el: HTMLElement }>("moreButton");

defineExpose({
  /** Puts the focus back on the menu's button, after a dialog opened from
   * the menu has closed: the menu that held the focus is gone. */
  focusMore: () => moreButton.value?.$el.focus(),
});
</script>

<template>
  <li class="meal-entry" :data-testid="TEST_IDS.meals.entry">
    <span
      v-if="slotLabel"
      class="meal-entry__slot text-muted"
      :data-testid="TEST_IDS.meals.entrySlot"
      >{{ slotLabel }}</span
    >
    <nuxt-link
      v-if="entry.recipe_id && name"
      :to="ROUTES.recipe(entry.recipe_id)"
      class="meal-entry__name"
      :data-testid="TEST_IDS.meals.entryRecipeLink"
      >{{ name }}</nuxt-link
    >
    <span
      v-else-if="name"
      class="meal-entry__name"
      :data-testid="TEST_IDS.meals.entryName"
      >{{ name }}</span
    >
    <span
      v-else
      class="meal-entry__name text-muted"
      :data-testid="TEST_IDS.meals.entryName"
      >Recipe was removed</span
    >
    <span v-if="entry.skipped_at" class="text-muted">Skipped</span>
    <q-btn
      ref="moreButton"
      flat
      round
      :icon="mdiDotsVertical"
      :aria-label="menuName"
      :aria-expanded="menuOpen"
      class="touch-target"
      :data-testid="TEST_IDS.meals.entryMore"
      @click="menuOpen = !menuOpen"
    >
      <!-- A group of real buttons, as the account menu is: list items have
           no role that says they can be pressed. -->
      <q-menu
        v-model="menuOpen"
        no-parent-event
        auto-close
        anchor="bottom right"
        self="top right"
        role="group"
        :aria-label="menuName"
        :data-testid="TEST_IDS.meals.entryMenu.group"
      >
        <div class="column meal-entry__menu">
          <q-btn
            v-if="!entry.recipe_id"
            flat
            no-caps
            align="left"
            label="Make a recipe from this"
            class="touch-target"
            :data-testid="TEST_IDS.meals.entryMenu.makeRecipe"
            @click="choose('makeRecipe')"
          />
          <q-btn
            flat
            no-caps
            align="left"
            label="Move"
            class="touch-target"
            :data-testid="TEST_IDS.meals.entryMenu.move"
            @click="choose('move')"
          />
          <q-btn
            v-if="entry.skipped_at"
            flat
            no-caps
            align="left"
            label="Mark as cooked"
            class="touch-target"
            :data-testid="TEST_IDS.meals.entryMenu.markCooked"
            @click="choose('markCooked')"
          />
          <q-btn
            v-if="canRecordReactions"
            flat
            no-caps
            align="left"
            label="How did the kids eat?"
            class="touch-target"
            :data-testid="TEST_IDS.meals.entryMenu.reactions"
            @click="choose('reactions')"
          />
          <q-btn
            flat
            no-caps
            align="left"
            label="Remove"
            class="touch-target"
            :data-testid="TEST_IDS.meals.entryMenu.remove"
            @click="choose('remove')"
          />
        </div>
      </q-menu>
    </q-btn>
    <!-- A second line only for an exception: most dinners have none. -->
    <p
      v-if="reactionNote"
      class="meal-entry__note text-muted"
      :data-testid="TEST_IDS.meals.entryReactionNote"
    >
      {{ reactionNote }}
    </p>
  </li>
</template>

<style scoped>
.meal-entry {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 8px;
}

/* Under the name, the full width of the row. */
.meal-entry__note {
  flex: 1 0 100%;
  margin: -8px 0 4px;
  font-size: 0.8125rem;
  line-height: 1.25rem;
  overflow-wrap: anywhere;
}

.meal-entry__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}

/* The text's color, not the browser's link blue; the underline says it is
   a link (see docs/rules/conventions.md). */
a.meal-entry__name {
  color: inherit;
  text-decoration-color: var(--theme-outline);
  text-underline-offset: 3px;
}

.meal-entry__slot {
  flex: none;
  font-size: 0.8125rem;
}

.meal-entry__menu {
  min-width: 12rem;
}
</style>
