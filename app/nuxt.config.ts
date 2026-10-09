// https://nuxt.com/docs/api/configuration/nuxt-config
import { ROUTES } from './app/utils/routes'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  modules: ['@pinia/nuxt', 'nuxt-quasar-ui', '@vite-pwa/nuxt', '@nuxtjs/supabase'],
  components: [{ path: '~/components', pathPrefix: false }],
  app: {
    head: {
      meta: [{ name: 'theme-color', content: '#1976D2' }],
      link: [{ rel: 'apple-touch-icon', href: '/pwa-192.png' }],
    },
  },
  supabase: {
    redirectOptions: {
      login: ROUTES.login,
      callback: ROUTES.confirm,
      exclude: [`${ROUTES.joinPrefix}**`, ROUTES.login, ROUTES.confirm],
    },
  },
  quasar: {
    plugins: ['Notify', 'Dialog'],
    extras: {
      font: 'roboto-font',
      fontIcons: [],
    },
  },
  pwa: {
    // 'prompt', not 'autoUpdate': a new version waits until the user clicks
    // "Reload" in the update notice, so an edit in progress isn't lost.
    registerType: 'prompt',
    manifest: {
      name: 'Klankern — Family Hub',
      short_name: 'Klankern',
      description: 'Shared to-dos, shopping, whiteboard and recipes for the family.',
      theme_color: '#1976D2',
      background_color: '#ffffff',
      display: 'standalone',
      icons: [
        { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // Page loads go to the network and fall back to offline.html only when
      // that fails. navigateFallback would answer *every* page load with the
      // fallback page, online or not, so it's disabled.
      navigateFallback: null,
      // Set explicitly: @vite-pwa/nuxt appends its own patterns to an empty
      // list, which would otherwise drop Workbox's defaults and precache
      // nothing the offline page needs.
      globPatterns: ['offline.html', 'pwa-*.png', 'favicon.ico'],
      // Replaces @vite-pwa/nuxt's default transform, which renames precached
      // `x.html` to `x` (pretty URLs) -- but this server answers /offline with
      // the app's own page, so the offline page would never be cached.
      manifestTransforms: [],
      // Nuxt's build-info files (added to globPatterns by the module) aren't
      // needed offline, and would be precached without a revision.
      globIgnores: ['_nuxt/builds/**'],
      runtimeCaching: [
        {
          urlPattern: ({ request }) => request.mode === 'navigate',
          handler: 'NetworkOnly',
          options: { precacheFallback: { fallbackURL: 'offline.html' } },
        },
        {
          urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
          handler: 'NetworkOnly',
        },
      ],
    },
    client: { installPrompt: true, periodicSyncForUpdates: 3600 },
  },
  vite: {
    server: {
      watch: { usePolling: true },
    },
  },
})
