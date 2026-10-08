// https://nuxt.com/docs/api/configuration/nuxt-config
import { ROUTES } from './app/utils/routes'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  modules: ['@pinia/nuxt', 'nuxt-quasar-ui', '@vite-pwa/nuxt', '@nuxtjs/supabase'],
  components: [{ path: '~/components', pathPrefix: false }],
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
    registerType: 'autoUpdate',
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
      navigateFallback: '/offline.html',
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      runtimeCaching: [
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
