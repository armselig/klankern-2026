<script setup lang="ts">
import { copyToClipboard, Notify } from 'quasar'

const householdStore = useHouseholdStore()

const open = ref(false)
const code = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const inviteUrl = computed(() => (code.value ? `${location.origin}/join/${code.value}` : ''))

async function show() {
  open.value = true
  loading.value = true
  error.value = null
  try {
    code.value = await householdStore.invite()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'unknown_error'
  } finally {
    loading.value = false
  }
}

async function copy() {
  await copyToClipboard(inviteUrl.value)
  Notify.create({ message: 'Invite link copied', color: 'positive' })
}
</script>

<template>
  <q-btn color="primary" label="Invite a family member" unelevated @click="show" />

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
            <q-btn flat dense label="Copy" @click="copy" />
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
