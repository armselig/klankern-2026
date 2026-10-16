<script setup lang="ts">
import { mdiDownload, mdiLogin } from "@quasar/extras/mdi-v7";

const user = useSupabaseUser();
const client = useSupabaseClient();
const router = useRouter();
const route = useRoute();

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

/** Signs the user out and returns them to the login screen. The page a
 * signed-out person asked for is forgotten with it: left in its cookie, it
 * would lead whoever signs in next on this device to that page. */
async function signOut() {
  await client.auth.signOut();
  await router.push(ROUTES.login);
  useSupabaseCookieRedirect().pluck();
}
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="app-header bg-primary text-on-accent">
      <q-toolbar>
        <!-- The app's name is every page's first heading and the way back
             to the dashboard. -->
        <h1 class="wordmark">
          <nuxt-link
            :to="ROUTES.home"
            class="wordmark__link"
            :data-testid="TEST_IDS.layout.homeLink"
          >
            Klankern
            <!-- A pen stroke, as on the whiteboard and in the avatars,
                 stretched to the word's width. -->
            <pen-stroke class="wordmark__stroke" />
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
          :data-testid="TEST_IDS.layout.installButton"
          @click="$pwa.install()"
        >
          <q-tooltip>Install app</q-tooltip>
        </q-btn>
        <account-menu
          v-if="user?.email"
          :email="user.email"
          @sign-out="signOut"
        />
        <template v-else>
          <version-menu />
          <q-btn
            v-if="showLoginButton"
            flat
            :icon="mdiLogin"
            label="Log in"
            :data-testid="TEST_IDS.layout.loginLink"
            :to="ROUTES.login"
          />
        </template>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <slot />
    </q-page-container>
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
  border-radius: var(--radius-control);
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
  stroke-width: 2px;
}

/* Keyboard focus presses the pen down harder and veils the header's color
   behind the word, as the header's buttons are veiled (see
   assets/css/hover-contrast.css). */
.wordmark__link:focus-visible {
  background: var(--theme-veil);
}

.wordmark__link:focus-visible .wordmark__stroke {
  stroke-width: 4.5px;
}

/* Hover does the same. As Quasar does: on a touch screen a hover would
   stick after the tap. */
@media (any-hover: hover) {
  .wordmark__link:hover {
    background: var(--theme-veil);
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

/* Quasar's round button is 42px; 44px is the smallest comfortable target
   for a thumb. */
.header-control {
  min-width: 44px;
  min-height: 44px;
}
</style>
