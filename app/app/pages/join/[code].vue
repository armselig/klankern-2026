<script setup lang="ts">
// Reachable while logged out (excluded from the global auth redirect in
// nuxt.config.ts) so a new family member can land here straight from the
// invite link, log in with OTP right on this page, and be redeemed into
// the household in one flow -- rather than bouncing through a separate
// login page and losing the invite code.
const route = useRoute()
const code = route.params.code as string

const client = useSupabaseClient()
const user = useSupabaseUser()
const householdStore = useHouseholdStore()
const router = useRouter()

const step = ref<'email' | 'code' | 'joining' | 'error'>('email')
const email = ref('')
const otp = ref('')
const error = ref<string | null>(null)

onMounted(() => {
  if (user.value) join()
})

async function requestCode() {
  error.value = null
  const { error: sendError } = await client.auth.signInWithOtp({
    email: email.value,
    options: { shouldCreateUser: true },
  })
  if (sendError) {
    error.value = sendError.message
    return
  }
  step.value = 'code'
}

async function verifyCode() {
  error.value = null
  const { error: verifyError } = await client.auth.verifyOtp({
    email: email.value,
    token: otp.value,
    type: 'email',
  })
  if (verifyError) {
    error.value = verifyError.message
    return
  }
  await join()
}

async function join() {
  step.value = 'joining'
  try {
    await householdStore.redeem(code)
    await router.push('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'unknown_error'
    step.value = 'error'
  }
}
</script>

<template>
  <q-page class="flex flex-center">
    <q-card style="width: 100%; max-width: 360px">
      <q-card-section>
        <div class="text-h6">Join your household</div>
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
            <q-btn type="submit" color="primary" label="Send code" unelevated />
          </div>
        </q-form>
      </q-card-section>

      <q-card-section v-else-if="step === 'code'">
        <p>We sent a 6-digit code to {{ email }}.</p>
        <q-form @submit.prevent="verifyCode">
          <q-input
            v-model="otp"
            label="6-digit code"
            inputmode="numeric"
            autocomplete="one-time-code"
            autofocus
            required
          />
          <div class="q-mt-md">
            <q-btn type="submit" color="primary" label="Join household" unelevated />
          </div>
        </q-form>
      </q-card-section>

      <q-card-section v-else-if="step === 'joining'">
        <q-spinner color="primary" size="2em" />
      </q-card-section>

      <q-card-section v-if="error" class="text-negative">
        {{ error }}
      </q-card-section>
    </q-card>
  </q-page>
</template>
