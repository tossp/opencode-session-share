import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: '../assets/static/frontend',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        share: 'src/apps/share/main.ts',
        admin: 'src/apps/admin/main.ts'
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: '[name][extname]'
      }
    }
  }
});
