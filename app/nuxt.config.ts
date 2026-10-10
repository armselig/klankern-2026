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
    // An SVG set, so only the icons a screen imports are bundled. With a font
    // set (the module's default is 'material-icons') the module ships the
    // whole icon font, whatever extras.fontIcons says.
    iconSet: 'svg-mdi-v7',
    extras: {
      font: 'roboto-font',
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
      // `x.html` to `x` (pretty URLs) -- but a server that falls back to the
      // app shell for unknown paths may answer /offline with the app's own
      // page, and then the offline page would never be cached.
      manifestTransforms: [],
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
    integration: {
      // @vite-pwa/nuxt appends a pattern for Nuxt's build-info files, which
      // aren't needed offline and would be precached without a revision. The
      // pattern is removed here, right before the service worker is built:
      // ignoring its files via globIgnores leaves a pattern that matches
      // nothing, which Workbox warns about on every build.
      beforeBuildServiceWorker(options) {
        options.workbox.globPatterns = options.workbox.globPatterns?.filter(
          (pattern) => !pattern.includes('/builds/'),
        )
      },
    },
    client: { installPrompt: true, periodicSyncForUpdates: 3600 },
  },
  vite: {
    server: {
      watch: { usePolling: true },
    },
  },
})
