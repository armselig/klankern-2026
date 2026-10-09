import { Notify } from 'quasar'

/**
 * Shows a persistent notice once a new app version has been downloaded,
 * instead of reloading on its own (registerType 'prompt' in nuxt.config.ts):
 * the user picks the moment, so an edit in progress isn't lost. Called once
 * from the default layout.
 */
export function usePwaUpdateNotice() {
  const { $pwa } = useNuxtApp()

  watch(
    () => $pwa?.needRefresh,
    (needRefresh) => {
      if (!needRefresh) return
      Notify.create({
        message: 'A new version of Klankern is available.',
        color: 'primary',
        timeout: 0,
        actions: [
          { label: 'Reload', color: 'white', handler: () => void $pwa?.updateServiceWorker(true) },
          { label: 'Later', color: 'white' },
        ],
      })
    },
    { immediate: true },
  )
}
