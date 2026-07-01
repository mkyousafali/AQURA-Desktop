import adapterVercel from "@sveltejs/adapter-vercel";
import adapterNode from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const useNode = process.env.BUILD_ADAPTER === 'node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  onwarn: (warning, handler) => {
    if (warning.code === 'a11y-label-has-associated-control') return;
    handler(warning);
  },
  preprocess: vitePreprocess(),
  kit: {
    adapter: useNode ? adapterNode({ out: 'build' }) : adapterVercel({ external: ['sharp'] }),
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
    },
    serviceWorker: {
      register: false, // We'll use vite-plugin-pwa instead
    },
  },
};

export default config;
