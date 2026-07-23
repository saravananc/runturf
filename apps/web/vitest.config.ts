import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Dedicated Vitest config so the app's Vite build (PWA plugin, etc.) stays
// separate from the test runner. jsdom gives components a DOM to render into.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
