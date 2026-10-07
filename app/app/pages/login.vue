<script setup lang="ts">
/**
 * Email OTP login (not magic links): a magic link opens the system browser
 * instead of this installed PWA and would leave it looking logged out, so
 * the user instead types the 6-digit code back into the app itself.
 */
const client = useSupabaseClient()
const router = useRouter()

const step = ref<'email' | 'code'>('email')
const email = ref('')
const code = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

async function requestCode() {
  loading.value = true
  error.value = null
  const { error: sendError } = await client.auth.signInWithOtp({
    email: email.value,
    options: { shouldCreateUser: true },
  })
  loading.value = false
  if (sendError) {
    error.value = sendError.message
    return
  }
  step.value = 'code'
}

async function verifyCode() {
  loading.value = true
  error.value = null
  const { error: verifyError } = await client.auth.verifyOtp({
    email: email.value,
    token: code.value,
    type: 'email',
  })
  loading.value = false
  if (verifyError) {
    error.value = verifyError.message
    return
  }
  await router.push('/')
}
</script>

<template>
  <q-page class="flex flex-center">
    <q-card style="width: 100%; max-width: 360px">
      <q-card-section>
        <div class="text-h6">Sign in to Klankern</div>
      </q-card-section>

      <q-card-section v-if="step === 'email'">
        <q-form @submit.prevent="requestCode">
          <q-input
            v-model="email"
            type="email"
            label="Email address"
            autocomplete="email"
            autofocus
            required
          />
          <div class="q-mt-md">
            <q-btn type="submit" color="primary" label="Send code" :loading="loading" unelevated />
          </div>
        </q-form>
      </q-card-section>

      <q-card-section v-else>
        <p>We sent a 6-digit code to {{ email }}.</p>
        <q-form @submit.prevent="verifyCode">
          <q-input
            v-model="code"
            label="6-digit code"
            inputmode="numeric"
            autocomplete="one-time-code"
            autofocus
            required
          />
          <div class="q-mt-md row q-gutter-sm">
            <q-btn type="submit" color="primary" label="Verify" :loading="loading" unelevated />
            <q-btn flat label="Use a different email" @click="step = 'email'" />
          </div>
        </q-form>
      </q-card-section>

      <q-card-section v-if="error" class="text-negative">
        {{ error }}
      </q-card-section>
    </q-card>
  </q-page>
</template>
