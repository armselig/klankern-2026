<script setup lang="ts">
import { mdiDownload, mdiLogin, mdiLogout } from '@quasar/extras/mdi-v7'

const user = useSupabaseUser()
const client = useSupabaseClient()
const router = useRouter()
const route = useRoute()
const { appVersion } = useRuntimeConfig().public

// Before useHouseholdRealtime, so it never sees a new user with old data.
useResetStoresOnUserChange()
useHouseholdRealtime()
usePwaUpdateNotice()

/** Hidden on pages that already contain their own sign-in form: on /join a
 * detour to /login would drop the invite code, so the user would sign in
 * without joining the household. */
const showLoginButton = computed(
  () => !user.value && route.path !== ROUTES.login && !route.path.startsWith(ROUTES.joinPrefix),
)

/** Signs the user out and returns them to the login screen. */
async function signOut() {
  await client.auth.signOut()
  await router.push(ROUTES.login)
}
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <!-- Never narrower than its own text: on a phone the email gives way
             instead (see below), or the title would be squeezed to one letter. -->
        <q-toolbar-title style="min-width: max-content">
          <nuxt-link :to="ROUTES.home">Klankern</nuxt-link>
        </q-toolbar-title>
        <!-- Only shown once the browser offers installation (beforeinstallprompt). -->
        <q-btn
          v-if="$pwa?.showInstallPrompt && !$pwa.isPWAInstalled"
          flat
          :icon="mdiDownload"
          label="Install app"
          @click="$pwa.install()"
        />
        <template v-if="user">
          <!-- No label: the address is written right beside it. -->
          <UserAvatar v-if="user.email" :email="user.email" :size="32" class="q-mr-sm" />
          <!-- The one part of the header that may shrink: cut with an ellipsis
               when a phone is too narrow for the whole address. -->
          <span class="ellipsis" style="min-width: 0">{{ user.email }}</span>
          <q-btn flat no-wrap :icon="mdiLogout" label="Sign out" @click="signOut" />
        </template>
        <q-btn
          v-else-if="showLoginButton"
          flat
          :icon="mdiLogin"
          label="Log in"
          :to="ROUTES.login"
        />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <slot />
    </q-page-container>

    <q-footer>&copy; armselig &middot; Version {{ appVersion }}</q-footer>
  </q-layout>
</template>
