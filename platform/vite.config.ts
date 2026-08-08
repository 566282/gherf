import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('react-router') || id.includes('@remix-run')) {
              return 'vendor-router';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('@tanstack')) {
              return 'vendor-query';
            }
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('jspdf')) return 'vendor-jspdf';
            if (id.includes('html2canvas')) return 'vendor-html2canvas';
            if (id.includes('dompurify')) return 'vendor-dompurify';
            return 'vendor-misc';
          }

          if (id.includes('/src/features/admin/pages/')) {
            const fileName = id.split('/').pop()?.replace(/\.[jt]sx?$/, '');
            return fileName ? `feature-admin-${fileName}` : 'feature-admin-pages';
          }
          if (id.includes('/src/features/admin/')) return 'feature-admin-shared';
          if (id.includes('/src/features/classroom/')) return 'feature-classroom';
          if (id.includes('/src/features/dashboard/')) return 'feature-dashboard';
          if (id.includes('/src/features/rewards/')) return 'feature-rewards';
          if (id.includes('/src/features/campaigns/')) return 'feature-campaigns';
          if (id.includes('/src/features/content/')) return 'feature-content';
          if (id.includes('/src/services/')) return 'feature-services';

          return undefined;
        },
      },
    },
  },
  server: {
    fs: {
      allow: [__dirname],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
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
