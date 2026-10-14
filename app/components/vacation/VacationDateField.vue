<script setup lang="ts">
import { mdiCalendar } from "@quasar/extras/mdi-v7";
import type { LocalDate } from "~/utils/local-date";

/**
 * A calendar day in a field, picked from Quasar's calendar or typed as
 * YYYY-MM-DD. Quasar's calendar in place of the browser's own date field,
 * which looks and behaves differently on every browser. The field stays
 * typeable, so a day can be given without the calendar too.
 */
const day = defineModel<LocalDate>({ required: true });
const props = defineProps<{
  label: string;
  testId: string;
  /** The first day the calendar offers; earlier ones are greyed out. */
  min?: LocalDate;
}>();

const popup = useTemplateRef<{ hide: () => void }>("popup");

/** The month the calendar opens on while the field is empty: the one of
 * `min`, so the end of a trip is picked beside its start. */
const openingMonth = computed(() =>
  props.min ? props.min.slice(0, 7).replace("-", "/") : undefined,
);

/** Whether the calendar offers a day. Quasar hands it as YYYY/MM/DD,
 * whatever the model's form. */
function isOffered(date: string): boolean {
  return !props.min || date.replaceAll("/", "-") >= props.min;
}

/** Takes a picked day and closes the calendar: one tap picks a day. */
function pickDay(picked: LocalDate | null) {
  if (!picked) return;
  day.value = picked;
  popup.value?.hide();
}
</script>

<template>
  <q-input
    v-model="day"
    :label="label"
    :data-testid="testId"
    mask="####-##-##"
    placeholder="YYYY-MM-DD"
    inputmode="numeric"
    stack-label
    required
  >
    <template #append>
      <q-btn
        flat
        round
        :icon="mdiCalendar"
        :aria-label="`${label}: pick a day`"
        class="touch-target"
      >
        <!-- A dialog with a name: Quasar's menu, which the proxy is on a
             wide screen, declares no role of its own. -->
        <q-popup-proxy
          ref="popup"
          role="dialog"
          :aria-label="`${label}: pick a day`"
          cover
        >
          <q-date
            :model-value="day"
            mask="YYYY-MM-DD"
            :options="isOffered"
            :default-year-month="openingMonth"
            first-day-of-week="1"
            text-color="on-accent"
            minimal
            @update:model-value="pickDay"
          />
        </q-popup-proxy>
      </q-btn>
    </template>
  </q-input>
</template>
