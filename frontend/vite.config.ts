import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: '../assets/static',
    emptyOutDir: true,
    manifest: 'manifest.json',
    rollupOptions: {
      input: {
        share: 'src/apps/share/main.ts',
        admin: 'src/apps/admin/main.ts'
      },
      output: {
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]'
      }
    }
  }
});
