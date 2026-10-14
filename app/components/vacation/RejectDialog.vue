<script setup lang="ts">
/**
 * Asks for the reason of a rejection. The app's dialog with a plain form
 * inside, as the invite dialog is built; its errors are shown inside it,
 * since a notice behind an open dialog is easy to miss.
 */
const props = defineProps<{
  /** The task that is rejected. */
  taskTitle: string;
  /** The rejection is on its way to the server. */
  saving: boolean;
  /** Why it could not be saved. */
  error: string | null;
}>();
const emit = defineEmits<{ reject: [reason: string] }>();
/** Whether the dialog is shown; the page opens and closes it. */
const open = defineModel<boolean>({ required: true });

const reason = ref("");
/** A reason of spaces only gets past the field's `required`. */
const reasonMissing = ref(false);
const reasonInput = useTemplateRef<{ focus: () => void }>("reasonInput");

// Every opening starts empty: the reason belongs to one task.
watch(open, (isOpen) => {
  if (!isOpen) return;
  reason.value = "";
  reasonMissing.value = false;
});

function submit() {
  const text = reason.value.trim();
  reasonMissing.value = text === "";
  if (reasonMissing.value) {
    reasonInput.value?.focus();
    return;
  }
  emit("reject", text);
}
</script>

<template>
  <q-dialog v-model="open" :persistent="props.saving">
    <q-card style="width: 100%; max-width: 420px">
      <q-form @submit.prevent="submit">
        <q-card-section>
          <h2 class="text-h6 q-my-none reject-dialog__title">
            Reject “{{ taskTitle }}”
          </h2>
          <p class="q-mt-sm q-mb-none">
            The task goes back to nobody. Everyone sees your reason.
          </p>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            ref="reasonInput"
            v-model="reason"
            label="Why not?"
            :data-testid="TEST_IDS.vacation.reject.reason"
            :maxlength="REJECTION_REASON_LIMIT"
            :error="reasonMissing"
            error-message="Say why, so the others know."
            hide-bottom-space
            required
            autofocus
          />
          <!-- Not the field's own hint: Quasar sets that in a grey that is
               below 4.5:1 on the theme's surface in light mode. -->
          <p class="reject-dialog__limit text-muted">
            {{ REJECTION_REASON_LIMIT }} characters at most.
          </p>
          <p
            v-if="error"
            role="alert"
            class="text-negative q-mt-sm q-mb-none"
            :data-testid="TEST_IDS.errorMessage"
          >
            {{ error }}
          </p>
        </q-card-section>

        <q-card-actions align="right">
          <!-- No color for the flat button; see SharedWhiteboard.vue. -->
          <q-btn
            v-close-popup
            flat
            label="Cancel"
            class="touch-target"
            :disable="saving"
          />
          <q-btn
            type="submit"
            color="primary"
            label="Reject task"
            :data-testid="TEST_IDS.vacation.reject.submit"
            unelevated
            class="touch-target"
            :loading="saving"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.reject-dialog__limit {
  margin: 4px 0 0;
  font-size: 0.75rem;
}

.reject-dialog__title {
  overflow-wrap: anywhere;
}
</style>
