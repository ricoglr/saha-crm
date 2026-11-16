import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';

export default defineConfig({
  // Fixed port: browser data is stored per address, so the app must always open at the same one.
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:3000' } },
  preview: { port: 5173, strictPort: true },
  // Two separate apps: the sales app (index.html) and the platform console (platform.html, served at /platform)
  build: { rollupOptions: { input: { main: resolve(__dirname, 'index.html'), platform: resolve(__dirname, 'platform.html') } } },
  plugins: [
    react(),
    {
      name: 'platform-route',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/platform' || req.url?.startsWith('/platform?') || req.url?.startsWith('/platform/')) req.url = '/platform.html';
          next();
        });
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { navigateFallbackDenylist: [/^\/api\//, /^\/platform/], globIgnores: ['**/node_modules/**', 'sw.js', 'workbox-*.js', 'platform.html'] },
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Saha CRM',
        short_name: 'Saha CRM',
        description: 'Saha pazarlama ve müşteri takip uygulaması',
        lang: 'tr',
        theme_color: '#1f3a5f',
        background_color: '#f4f6f9',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ]
});
