import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  plugins: [
    sveltekit(),
    // Only enable PWA in production
    ...(mode === "production"
      ? [
          VitePWA({
            registerType: "prompt",
            // Use our custom service worker with proper injection
            strategies: "injectManifest",
            srcDir: "static",
            filename: "sw.js",
            // Enable automatic registration for proper SW lifecycle
            injectRegister: "auto",
            selfDestroying: false,
            injectManifest: {
              // Increase the file size limit to 30MB to accommodate WASM files from background-removal
              maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
              // Exclude large WASM files from precaching (they'll be loaded on-demand)
              globIgnores: ['**/*.wasm'],
            },
            workbox: {
              globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
              // Don't precache large WASM files - they're loaded on-demand
              globIgnores: ['**/*.wasm'],
              navigateFallback: "/",
              navigateFallbackDenylist: [
                /^\/api\//,
                /^\/__pwa__.*/,
                /^\/offline\.html$/,
                /^\/gift-wheel/,
                /^\/[^/]*$/,
              ],
              // Remove conflicting skipWaiting since we handle it in our SW
              skipWaiting: false,
              clientsClaim: false,
              cleanupOutdatedCaches: true,
              disableDevLogs: false,
              // Force service worker update on any change
              mode: "production",
              // Add service worker lifecycle control
              additionalManifestEntries: [
                {
                  url: "/sw-cleanup.js",
                  revision: Date.now().toString(), // Force update
                },
              ],
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                  handler: "StaleWhileRevalidate",
                  options: {
                    cacheName: "google-fonts-stylesheets",
                  },
                },
                {
                  urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                  handler: "CacheFirst",
                  options: {
                    cacheName: "google-fonts-webfonts",
                    expiration: {
                      maxEntries: 30,
                      maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                    },
                  },
                },
                {
                  urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
                  handler: "NetworkFirst",
                  options: {
                    cacheName: "supabase-api-cache",
                    networkTimeoutSeconds: 3,
                    expiration: {
                      maxEntries: 100,
                      maxAgeSeconds: 60 * 10, // 10 minutes
                    },
                  },
                },
                {
                  urlPattern: /\/api\/.*/,
                  handler: "NetworkFirst",
                  options: {
                    cacheName: "api-cache",
                    networkTimeoutSeconds: 5,
                    expiration: {
                      maxEntries: 50,
                      maxAgeSeconds: 60 * 5, // 5 minutes
                    },
                  },
                },
              ],
            },
            includeAssets: [
              "favicon.ico",
              "apple-touch-icon.png",
              "safari-pinned-tab.svg",
            ],
            manifestFilename: "manifest.webmanifest",
            manifest: {
              name: "Aqura Management System",
              short_name: "Aqura",
              description:
                "PWA-first windowed management platform with bilingual support",
              theme_color: "#f08300",
              background_color: "#ffffff",
              display: "standalone",
              orientation: "any",
              scope: "/",
              start_url: "/",
              id: "/",
              categories: ["business", "productivity", "utilities"],
              lang: "en",
              dir: "ltr",
              display_override: [
                "window-controls-overlay",
                "standalone",
                "minimal-ui",
              ] as any,
              prefer_related_applications: false,
              icons: [
                {
                  src: "icons/icon-72x72.png",
                  sizes: "72x72",
                  type: "image/png",
                },
                {
                  src: "icons/icon-96x96.png",
                  sizes: "96x96",
                  type: "image/png",
                },
                {
                  src: "icons/icon-128x128.png",
                  sizes: "128x128",
                  type: "image/png",
                },
                {
                  src: "icons/icon-144x144.png",
                  sizes: "144x144",
                  type: "image/png",
                },
                {
                  src: "icons/icon-152x152.png",
                  sizes: "152x152",
                  type: "image/png",
                },
                {
                  src: "icons/icon-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: "icons/icon-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                  purpose: "maskable",
                },
                {
                  src: "icons/icon-384x384.png",
                  sizes: "384x384",
                  type: "image/png",
                },
                {
                  src: "icons/icon-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: "icons/icon-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "maskable",
                },
              ],
              shortcuts: [
                {
                  name: "HR Management",
                  short_name: "HR",
                  description: "Manage employees and human resources",
                  url: "/?module=hr",
                  icons: [{ src: "icons/shortcut-admin.png", sizes: "96x96" }],
                },
                {
                  name: "Branch Management",
                  short_name: "Branches",
                  description: "Manage company branches and locations",
                  url: "/?module=branches",
                  icons: [{ src: "icons/shortcut-user.png", sizes: "96x96" }],
                },
                {
                  name: "Vendor Management",
                  short_name: "Vendors",
                  description: "Manage vendors and suppliers",
                  url: "/?module=vendors",
                  icons: [{ src: "icons/shortcut-admin.png", sizes: "96x96" }],
                },
                {
                  name: "Offline Mode",
                  short_name: "Offline",
                  description: "Access cached data offline",
                  url: "/offline.html",
                  icons: [{ src: "icons/shortcut-user.png", sizes: "96x96" }],
                },
              ],
            },
            devOptions: {
              enabled: false,
              type: "module",
            },
          }),
        ]
      : []),
  ],
  optimizeDeps: {
    exclude: ['@imgly/background-removal'],
    include: ['onnxruntime-web']
  },
  server: {
    port: 5173,
    host: true,
    fs: {
      allow: [".."],
    },
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      external: ['mssql', 'sharp'],
      output: {
        manualChunks: {
          vendor: ["svelte"],
        },
      },
    },
  },
  ssr: {
    external: ['sharp'],
  },
  define: {
    "import.meta.env.VITE_PWA_ENABLED": JSON.stringify(
      mode === "production" ? "true" : "false",
    ),
  },
}));
