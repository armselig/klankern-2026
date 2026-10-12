<script setup lang="ts">
import { mdiContentCopy } from "@quasar/extras/mdi-v7";
import { copyToClipboard, Notify } from "quasar";

const householdStore = useHouseholdStore();

/** Whether the dialog is shown. Its openers are elsewhere (the account menu
 * in the header, the roster on the dashboard), so the state is the
 * parent's. */
const open = defineModel<boolean>({ required: true });
const code = ref<string | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const inviteUrl = computed(() =>
  code.value ? `${location.origin}${ROUTES.join(code.value)}` : "",
);

/** Every opening asks for a new code: one from an earlier opening may have
 * been used or have expired since. */
async function requestInviteCode() {
  loading.value = true;
  error.value = null;
  try {
    code.value = await householdStore.invite();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

watch(open, (isOpen) => {
  if (isOpen) void requestInviteCode();
});

async function copy() {
  await copyToClipboard(inviteUrl.value);
  Notify.create({
    message: "Invite link copied",
    // Not "positive": no text color of the theme is readable on its green
    // in light mode. The primary color with the theme's text for an accent
    // is, in both modes (assets/css/theme.css).
    color: "primary",
    textColor: "on-accent",
  });
}
</script>

<template>
  <q-dialog v-model="open">
    <q-card style="width: 100%; max-width: 420px">
      <q-card-section>
        <div class="text-h6">Invite a family member</div>
      </q-card-section>

      <q-card-section v-if="loading">
        <q-spinner color="primary" />
      </q-card-section>

      <q-card-section v-else-if="error" class="text-negative">
        {{ error }}
      </q-card-section>

      <q-card-section v-else>
        <p>Share this link or code -- it works for 7 days.</p>
        <q-input :model-value="inviteUrl" readonly label="Invite link">
          <template #append>
            <q-btn
              flat
              dense
              :icon="mdiContentCopy"
              label="Copy"
              @click="copy"
            />
          </template>
        </q-input>
        <p class="text-h5 text-center q-mt-md">{{ code }}</p>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" @click="open = false" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
