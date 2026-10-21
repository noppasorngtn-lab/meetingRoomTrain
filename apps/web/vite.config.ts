/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The theme is mock's artifact and is imported where it lives, never copied (design-token · normative).
const themeDir = fileURLToPath(new URL('../../.aeon/mockup/handoff/mrr-ds', import.meta.url));

// Every first path segment a page sends to the api — one missing here is answered with index.html
// instead of json (src/__tests__/api-proxy.test.tsx scans the call sites against this list).
export const API_PREFIXES = ['/adjustment-requests', '/auth', '/bookings', '/facilities', '/me', '/reports', '/rooms', '/users'];

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@theme': themeDir } },
  // In development the api runs beside Vite; in production one origin serves both (/dev:deploy) —
  // vite preview inherits server.proxy.
  server: {
    fs: { allow: ['.', themeDir] },
    proxy: Object.fromEntries(API_PREFIXES.map((p) => [p, process.env.API_URL ?? 'http://localhost:3000'])),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/__tests__/**/*.test.tsx'],
    setupFiles: ['src/__tests__/setup.ts'],
    css: false,
  },
});
