<script setup lang="ts">
/**
 * Email OTP login (not magic links): a magic link opens the system browser
 * instead of this installed PWA and would leave it looking logged out, so
 * the user instead types the emailed code back into the app itself.
 */
useHead({ title: "Sign in" });

const client = useSupabaseClient();
const router = useRouter();

const step = ref<"email" | "code">("email");
const email = ref("");
const code = ref("");
const loading = ref(false);
const error = ref<string | null>(null);

async function requestCode() {
  loading.value = true;
  error.value = null;
  const { error: sendError } = await client.auth.signInWithOtp({
    email: email.value,
    options: { shouldCreateUser: true },
  });
  loading.value = false;
  if (sendError) {
    error.value = sendError.message;
    return;
  }
  step.value = "code";
}

async function verifyCode() {
  loading.value = true;
  error.value = null;
  const { error: verifyError } = await client.auth.verifyOtp({
    email: email.value,
    token: code.value,
    type: "email",
  });
  loading.value = false;
  if (verifyError) {
    error.value = verifyError.message;
    return;
  }
  // The page that was asked for before signing in, if any. Read only now,
  // after a code that worked, and only a path inside the app is followed:
  // the cookie is not the app's word (see isInAppPath).
  const asked = useSupabaseCookieRedirect().pluck();
  await router.push(isInAppPath(asked) ? asked : ROUTES.home);
}
</script>

<template>
  <q-page class="flex flex-center">
    <q-card style="width: 100%; max-width: 360px">
      <q-card-section>
        <h2 class="text-h6 q-my-none" :data-testid="TEST_IDS.login.heading">
          Sign in to Klankern
        </h2>
      </q-card-section>

      <q-card-section v-if="step === 'email'">
        <q-form @submit.prevent="requestCode">
          <q-input
            v-model="email"
            type="email"
            label="Email address"
            :data-testid="TEST_IDS.signIn.email"
            autocomplete="email"
            autofocus
            required
          />
          <div class="q-mt-md">
            <q-btn
              type="submit"
              color="primary"
              label="Send code"
              :data-testid="TEST_IDS.signIn.sendCode"
              :loading="loading"
              unelevated
            />
          </div>
        </q-form>
      </q-card-section>

      <q-card-section v-else>
        <p :data-testid="TEST_IDS.signIn.sentNotice">
          We sent a login code to {{ email }}.
        </p>
        <q-form @submit.prevent="verifyCode">
          <q-input
            v-model="code"
            label="Code from the email"
            :data-testid="TEST_IDS.signIn.code"
            inputmode="numeric"
            autocomplete="one-time-code"
            autofocus
            required
          />
          <div class="q-mt-md row q-gutter-sm">
            <q-btn
              type="submit"
              color="primary"
              label="Verify"
              :data-testid="TEST_IDS.signIn.submit"
              :loading="loading"
              unelevated
            />
            <q-btn
              flat
              label="Use a different email"
              :data-testid="TEST_IDS.signIn.changeEmail"
              @click="step = 'email'"
            />
          </div>
        </q-form>
      </q-card-section>

      <q-card-section
        v-if="error"
        class="text-negative"
        :data-testid="TEST_IDS.errorMessage"
      >
        {{ error }}
      </q-card-section>
    </q-card>
  </q-page>
</template>
