<script setup lang="ts">
import type { HouseholdChild, MealReactionChoice } from "~/types/kids";

/**
 * Asks what each child made of a meal: ate it, picked at it, or refused it.
 * One group of radios per child, all "Ate it" unless something else was
 * recorded, so recording an exception is one choice and Save. It only
 * reports the choices; saving is the page's.
 */
const props = defineProps<{
  /** The meal, as a member reads it. */
  name: string;
  children: readonly HouseholdChild[];
  /** What is recorded now, by child id. */
  initial: Readonly<Record<string, MealReactionChoice>>;
}>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{
  save: [choices: Record<string, MealReactionChoice>];
  /** The dialog has gone; the focus can go back where it came from. */
  hide: [];
}>();

const choices = ref<Record<string, MealReactionChoice>>({});

/** Every opening starts from what is recorded, not from what was chosen
 * and cancelled the last time. */
watch(
  open,
  (isOpen) => {
    if (isOpen) choices.value = { ...props.initial };
  },
  { immediate: true },
);

const options = REACTION_CHOICES.map(({ value, label }) => ({ value, label }));

function save() {
  emit("save", { ...choices.value });
  open.value = false;
}
</script>

<template>
  <q-dialog v-model="open" @hide="emit('hide')">
    <q-card class="reaction-dialog">
      <form class="reaction-dialog__form" @submit.prevent="save">
        <h2
          class="text-h6 q-my-none"
          :data-testid="TEST_IDS.meals.reactionDialog.title"
        >
          How did the kids eat {{ name }}?
        </h2>
        <fieldset
          v-for="child in children"
          :key="child.id"
          class="reaction-dialog__child"
          :data-testid="TEST_IDS.meals.reactionDialog.child"
        >
          <legend
            class="reaction-dialog__legend"
            :data-testid="TEST_IDS.meals.reactionDialog.childName"
          >
            {{ child.name }}
          </legend>
          <q-option-group
            v-model="choices[child.id]"
            :options="options"
            type="radio"
            inline
          />
        </fieldset>
        <div class="reaction-dialog__actions">
          <q-btn
            flat
            no-caps
            class="touch-target"
            label="Cancel"
            @click="open = false"
          />
          <q-btn
            type="submit"
            unelevated
            no-caps
            color="primary"
            class="touch-target"
            label="Save"
            :data-testid="TEST_IDS.meals.reactionDialog.save"
          />
        </div>
      </form>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.reaction-dialog {
  width: min(24rem, 100vw - 32px);
}

.reaction-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

/* A fieldset for its meaning: the child's name labels the group. */
.reaction-dialog__child {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.reaction-dialog__legend {
  padding: 0;
  font-weight: 500;
}

.reaction-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
