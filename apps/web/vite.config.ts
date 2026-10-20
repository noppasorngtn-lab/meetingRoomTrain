/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The theme is mock's artifact and is imported where it lives, never copied (design-token · normative).
const themeDir = fileURLToPath(new URL('../../.aeon/mockup/handoff/mrr-ds', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@theme': themeDir } },
  // In development the api runs beside Vite; in production one origin serves both (/dev:deploy).
  server: {
    fs: { allow: ['.', themeDir] },
    proxy: { '/rooms': process.env.API_URL ?? 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/__tests__/**/*.test.tsx'],
    setupFiles: ['src/__tests__/setup.ts'],
    css: false,
  },
});
