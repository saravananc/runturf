import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'RunTurf',
        short_name: 'RunTurf',
        description: 'Run to capture territory',
        theme_color: '#0a0f1e',
        background_color: '#0a0f1e',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // never cache API or tiles aggressively in MVP
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Split the big, rarely-changing dependencies into their own chunks.
        // maplibre alone is most of the bundle; keeping it separate means an app
        // change no longer invalidates it in users' caches.
        manualChunks: {
          maplibre: ['maplibre-gl'],
          sentry: ['@sentry/react'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
