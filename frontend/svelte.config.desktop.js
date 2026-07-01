import adapterStatic from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  onwarn: (warning, handler) => {
    if (warning.code === 'a11y-label-has-associated-control') return;
    handler(warning);
  },
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapterStatic({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html', // SPA fallback
      precompress: false,
      strict: false
    }),
    paths: {
      base: '',
      relative: true
    },
    alias: {
      $lib: "./src/lib",
      $components: "./src/lib/components",
      $stores: "./src/lib/stores",
      $utils: "./src/lib/utils",
      $types: "./src/lib/types",
      $i18n: "./src/lib/i18n",
    },
    prerender: {
      handleHttpError: "warn",
      entries: []  // Don't prerender - we'll use SPA mode
    },
    serviceWorker: {
      register: false,
    },
  },
};

export default config;
