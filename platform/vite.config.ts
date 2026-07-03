import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import compression from 'vite-plugin-compression';

const assetCdnBaseUrl = (process.env.VITE_ASSET_CDN_BASE_URL ?? '').trim();

export default defineConfig({
  base: assetCdnBaseUrl ? `${assetCdnBaseUrl.replace(/\/+$/, '')}/` : '/',
  plugins: [
    react(),
    compression({ algorithm: 'gzip', ext: '.gz' }),
    compression({ algorithm: 'brotliCompress', ext: '.br' }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query', 'zustand'],
          analyticsExport: ['xlsx', 'jspdf', 'jspdf-autotable'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
