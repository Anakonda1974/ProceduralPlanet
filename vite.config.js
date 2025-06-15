import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { fileURLToPath, URL } from 'node:url';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./ProceduralPlanet', import.meta.url)),
  plugins: [vue(), vuetify()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./ProceduralPlanet/src', import.meta.url))
    }
  },
  build: {
    outDir: '../dist'
  }
});
