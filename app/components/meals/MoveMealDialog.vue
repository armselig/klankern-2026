<script setup lang="ts">
import type { MealSlot } from "~/types/meal-plan";
import { isLocalDate, type LocalDate } from "~/utils/local-date";

/**
 * Asks where an entry goes: a slot, then a day. The days most entries move
 * to are buttons, one press each; any other day is typed or picked in the
 * field below them. It only reports the choice; saving is the page's.
 */
const props = defineProps<{
  /** The entry's name, as a member reads it. */
  name: string;
  /** Where the entry is now. Not named `slot`, which Vue reads as the
   * slot attribute of old. */
  fromDate: LocalDate;
  fromSlot: MealSlot;
  today: LocalDate;
}>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{
  choose: [target: { date: LocalDate; slot: MealSlot }];
  /** The dialog has finished closing. */
  hide: [];
}>();

const slot = ref<MealSlot>(props.fromSlot);
const otherDay = ref<LocalDate>("");
const slotOptions = SLOTS_IN_ORDER.map((value) => ({
  value,
  label: slotLabel(value),
}));
const targets = computed(() => moveTargets(props.today));

watch(open, (isOpen) => {
  if (!isOpen) return;
  slot.value = props.fromSlot;
  otherDay.value = "";
});

/** Whether a day is where the entry is already, in the slot chosen. */
function isCurrent(day: LocalDate): boolean {
  return day === props.fromDate && slot.value === props.fromSlot;
}

function choose(day: LocalDate) {
  if (isCurrent(day)) return;
  emit("choose", { date: day, slot: slot.value });
  open.value = false;
}

function chooseOtherDay() {
  if (isLocalDate(otherDay.value)) choose(otherDay.value);
}
</script>

<template>
  <q-dialog v-model="open" @hide="emit('hide')">
    <q-card class="move-meal-dialog">
      <form class="move-meal-dialog__form" @submit.prevent="chooseOtherDay">
        <h2
          class="text-h6 q-my-none"
          :data-testid="TEST_IDS.meals.moveDialog.title"
        >
          Move {{ name }}
        </h2>
        <!-- A group with its question as the name, so a screen reader says
             what the choices are for. -->
        <fieldset class="move-meal-dialog__fieldset">
          <legend class="text-muted">Meal</legend>
          <q-option-group
            v-model="slot"
            :options="slotOptions"
            inline
            type="radio"
            :data-testid="TEST_IDS.meals.moveDialog.slot"
          />
        </fieldset>
        <fieldset class="move-meal-dialog__fieldset">
          <legend class="text-muted">Day</legend>
          <ul role="list" class="move-meal-dialog__days">
            <li v-for="target in targets" :key="target.day">
              <q-btn
                outline
                no-caps
                class="touch-target full-width"
                :label="target.label"
                :disable="isCurrent(target.day)"
                :data-testid="TEST_IDS.meals.moveDialog.day"
                @click="choose(target.day)"
              />
            </li>
          </ul>
        </fieldset>
        <vacation-date-field
          v-model="otherDay"
          label="Another day"
          :test-id="TEST_IDS.meals.moveDialog.date"
        />
        <div class="move-meal-dialog__actions">
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
            label="Move to that day"
            :disable="!isLocalDate(otherDay) || isCurrent(otherDay)"
            :data-testid="TEST_IDS.meals.moveDialog.submit"
          />
        </div>
      </form>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.move-meal-dialog {
  width: min(24rem, 100vw - 32px);
}

.move-meal-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.move-meal-dialog__fieldset {
  margin: 0;
  padding: 0;
  border: 0;
}

/* Two columns of day buttons fit a phone's width. */
.move-meal-dialog__days {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.move-meal-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
