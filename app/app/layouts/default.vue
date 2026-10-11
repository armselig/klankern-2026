<script setup lang="ts">
import { mdiDownload, mdiLogin } from "@quasar/extras/mdi-v7";

const user = useSupabaseUser();
const client = useSupabaseClient();
const router = useRouter();
const route = useRoute();
const { appVersion } = useRuntimeConfig().public;

// Before useHouseholdRealtime, so it never sees a new user with old data.
useResetStoresOnUserChange();
useHouseholdRealtime();
usePwaUpdateNotice();

/** Hidden on pages that already contain their own sign-in form: on /join a
 * detour to /login would drop the invite code, so the user would sign in
 * without joining the household. */
const showLoginButton = computed(
  () =>
    !user.value &&
    route.path !== ROUTES.login &&
    !route.path.startsWith(ROUTES.joinPrefix),
);

/** Signs the user out and returns them to the login screen. */
async function signOut() {
  await client.auth.signOut();
  await router.push(ROUTES.login);
}
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="app-header bg-primary text-white">
      <q-toolbar>
        <!-- The app's name is every page's first heading and the way back
             to the dashboard. -->
        <h1 class="wordmark">
          <nuxt-link :to="ROUTES.home" class="wordmark__link">
            Klankern
            <!-- A pen stroke, as on the whiteboard and in the avatars.
                 Stretched to the word's width; the line keeps its
                 thickness (non-scaling-stroke). -->
            <svg
              class="wordmark__stroke"
              viewBox="0 0 100 8"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M2 5.5C20 2 38 7 58 4S88 3 98 5"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                vector-effect="non-scaling-stroke"
              />
            </svg>
          </nuxt-link>
        </h1>
        <q-space />
        <!-- Only shown once the browser offers installation
             (beforeinstallprompt). Not in the account menu: the offer also
             comes on the login page, where there is no account. -->
        <q-btn
          v-if="$pwa?.showInstallPrompt && !$pwa.isPWAInstalled"
          flat
          round
          class="header-control"
          :icon="mdiDownload"
          aria-label="Install app"
          @click="$pwa.install()"
        >
          <q-tooltip>Install app</q-tooltip>
        </q-btn>
        <account-menu
          v-if="user?.email"
          :email="user.email"
          @sign-out="signOut"
        />
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

<style scoped>
/* Quasar styles a bare h1 as a 6rem display line; this one is a wordmark in
   a toolbar. */
.wordmark {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
}

/* The padding makes the link 44px high, a comfortable target for a thumb. */
.wordmark__link {
  position: relative;
  display: inline-block;
  /* The sideways padding is room for the highlight; the margin keeps the
     word where the toolbar's own padding puts it. */
  margin-left: -6px;
  padding: 10px 8px 12px;
  border-radius: 4px;
  color: inherit;
  text-decoration: none;
}

.wordmark__link:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.wordmark__stroke {
  position: absolute;
  left: 8px;
  bottom: 4px;
  width: calc(100% - 16px);
  height: 8px;
  overflow: visible;
  stroke-width: 2px;
}

/* Keyboard focus presses the pen down harder and darkens the blue behind
   the word, as far as the header's buttons darken. */
.wordmark__link:focus-visible {
  background: rgb(0 0 0 / 0.3);
}

.wordmark__link:focus-visible .wordmark__stroke {
  stroke-width: 4.5px;
}

/* Hover does the same. As Quasar does: on a touch screen a hover would
   stick after the tap. */
@media (any-hover: hover) {
  .wordmark__link:hover {
    background: rgb(0 0 0 / 0.3);
  }

  .wordmark__link:hover .wordmark__stroke {
    stroke-width: 4.5px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .wordmark__link {
    transition: background-color 0.15s ease-out;
  }

  .wordmark__stroke {
    transition: stroke-width 0.15s ease-out;
  }
}

/* Quasar's highlight is a veil of 15 to 22 percent, which on the header's
   blue is hard to see. Twice that here; black, so the contrast of the white
   text rises with it (see assets/css/hover-contrast.css). */
.app-header
  :deep(
    :is(.q-focusable:focus-visible, .q-manual-focusable--focused)
      > .q-focus-helper
  ) {
  opacity: 0.3;
}

@media (any-hover: hover) {
  .app-header :deep(.q-hoverable:hover > .q-focus-helper) {
    opacity: 0.3;
  }
}

/* Quasar's round button is 42px; 44px is the smallest comfortable target
   for a thumb. */
.header-control {
  min-width: 44px;
  min-height: 44px;
}
</style>
