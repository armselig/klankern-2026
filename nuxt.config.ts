// https://nuxt.com/docs/api/configuration/nuxt-config
import { flavors } from "@catppuccin/palette";
import { ROUTES } from "./app/utils/routes";
import packageJson from "./package.json";

// The browser's own frame around the app takes the header's color. The same
// flavors and colors as in assets/css/theme.css.
const lightColors = flavors.latte.colors;
const darkColors = flavors.mocha.colors;

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  ssr: false,
  modules: [
    "@pinia/nuxt",
    "nuxt-quasar-ui",
    "@vite-pwa/nuxt",
    "@nuxtjs/supabase",
  ],
  components: [{ path: "~/components", pathPrefix: false }],
  // Loaded on every page: the color palette for light and dark mode, the
  // correction of a contrast problem of Quasar's hover and focus highlight
  // that no single component could fix for itself, and the motion shared by
  // the buttons and the lists.
  css: [
    "~/assets/css/theme.css",
    "~/assets/css/hover-contrast.css",
    "~/assets/css/touch-target.css",
    "~/assets/css/motion.css",
  ],
  runtimeConfig: {
    public: {
      // Shown in the menus. semantic-release writes the version into
      // package.json with each release (.releaserc.yaml at the git root), so
      // the build of a release commit carries that release's number.
      appVersion: packageJson.version,
    },
  },
  app: {
    head: {
      meta: [
        // Before the stylesheet is there, the browser paints the empty page
        // in the device's mode already.
        { name: "color-scheme", content: "light dark" },
        {
          name: "theme-color",
          media: "(prefers-color-scheme: light)",
          content: lightColors.mauve.hex,
        },
        {
          name: "theme-color",
          media: "(prefers-color-scheme: dark)",
          content: darkColors.mauve.hex,
        },
      ],
      link: [{ rel: "apple-touch-icon", href: "/pwa-192.png" }],
    },
  },
  supabase: {
    redirectOptions: {
      login: ROUTES.login,
      callback: ROUTES.confirm,
      exclude: [`${ROUTES.joinPrefix}**`, ROUTES.login, ROUTES.confirm],
      // The page a signed-out person asked for is remembered in a cookie
      // while they sign in, so a link from a messenger leads to its page and
      // not to the dashboard (see pages/login.vue).
      saveRedirectToCookie: true,
    },
  },
  quasar: {
    plugins: ["Notify", "Dialog"],
    // Follows the device's setting, and a change of it while the app is
    // open. The colors of both modes are in assets/css/theme.css.
    config: { dark: "auto" },
    // An SVG set, so only the icons a screen imports are bundled. With a font
    // set (the module's default is 'material-icons') the module ships the
    // whole icon font, whatever extras.fontIcons says.
    iconSet: "svg-mdi-v7",
    extras: {
      font: "roboto-font",
    },
  },
  pwa: {
    // 'prompt', not 'autoUpdate': a new version waits until the user clicks
    // "Reload" in the update notice, so an edit in progress isn't lost.
    registerType: "prompt",
    manifest: {
      name: "Klankern — Family Hub",
      short_name: "Klankern",
      description:
        "Shared to-dos, shopping, whiteboard and recipes for the family.",
      // A manifest holds one color each, whatever the device's mode: the
      // light one.
      theme_color: lightColors.mauve.hex,
      background_color: lightColors.base.hex,
      display: "standalone",
      icons: [
        { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
        { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
        {
          src: "pwa-512-maskable.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
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
      globPatterns: ["offline.html", "pwa-*.png", "favicon.ico"],
      // Replaces @vite-pwa/nuxt's default transform, which renames precached
      // `x.html` to `x` (pretty URLs) -- but a server that falls back to the
      // app shell for unknown paths may answer /offline with the app's own
      // page, and then the offline page would never be cached.
      manifestTransforms: [],
      runtimeCaching: [
        {
          urlPattern: ({ request }) => request.mode === "navigate",
          handler: "NetworkOnly",
          options: { precacheFallback: { fallbackURL: "offline.html" } },
        },
        {
          urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co"),
          handler: "NetworkOnly",
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
          (pattern) => !pattern.includes("/builds/"),
        );
      },
    },
    client: { installPrompt: true, periodicSyncForUpdates: 3600 },
  },
  hooks: {
    // Nitro renders the pages with a second instance of itself, the
    // prerenderer, which answers a route with a file from its own public
    // directory if there is one, instead of rendering it. That directory
    // stays `.output/public` when a preset moves the build's output (the
    // Netlify preset: to `dist`), and then no build empties it. A page that a
    // local `nuxt generate` left there would go into the next Netlify build
    // unrendered. So the prerenderer gets the build's own public directory,
    // which every build empties first, as it has without such a preset.
    "nitro:init"(nitro) {
      nitro.hooks.hook("prerender:config", (prerendererConfig) => {
        // A new object: the config is a shallow copy of the build's own.
        prerendererConfig.output = {
          ...prerendererConfig.output,
          publicDir: nitro.options.output.publicDir,
        };
      });
    },
  },
  vite: {
    build: {
      // A font stays a file of its own. Vite writes small files into the
      // stylesheet instead, and a font's smallest files are those of the
      // scripts that hardly any page needs; everyone would load them.
      assetsInlineLimit: (filePath) =>
        /\.woff2?$/.test(filePath) ? false : undefined,
    },
    server: {
      watch: { usePolling: true },
    },
  },
});
