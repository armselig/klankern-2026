import { Notify } from "quasar";

/**
 * Shows a persistent notice once a new app version has been downloaded,
 * instead of reloading on its own (registerType 'prompt' in nuxt.config.ts):
 * the user picks the moment, so an edit in progress isn't lost. Called once
 * from the default layout.
 */
export function usePwaUpdateNotice() {
  const { $pwa } = useNuxtApp();

  watch(
    () => $pwa?.needRefresh,
    (needRefresh) => {
      if (!needRefresh) return;
      Notify.create({
        message: "A new version of Klankern is available.",
        color: "primary",
        // The theme's text color on an accent, as on a filled button
        // (assets/css/theme.css); Quasar's default is white.
        textColor: "on-accent",
        timeout: 0,
        attrs: { "data-testid": TEST_IDS.pwa.updateNotice },
        actions: [
          withTestId(
            {
              label: "Reload",
              color: "on-accent",
              handler: () => void $pwa?.updateServiceWorker(true),
            },
            TEST_IDS.pwa.updateReload,
          ),
          { label: "Later", color: "on-accent" },
        ],
      });
    },
    { immediate: true },
  );
}
