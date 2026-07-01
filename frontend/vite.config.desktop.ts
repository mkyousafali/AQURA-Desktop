import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	
	// Desktop-specific configuration
	build: {
		target: 'electron-renderer',
		outDir: 'build',
		// Optimize for desktop
		minify: 'esbuild',
		sourcemap: false,
		rollupOptions: {
			output: {
				manualChunks: undefined
			}
		}
	},
	
	server: {
		port: 5173,
		strictPort: false,
		host: 'localhost'
	},
	
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib'),
			$desktop: path.resolve('./src/lib/components/desktop')
		}
	},
	
	optimizeDeps: {
		exclude: ['electron']
	}
});
