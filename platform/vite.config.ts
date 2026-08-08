import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeRequestHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value]),
  );
}

function parseQueryParams(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries());
}

const adminDevServerPlugin = {
  name: 'admin-dev-server-routes',
  configureServer(server: { middlewares: { use: (handler: (req: { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; on: (event: string, callback: (chunk: Buffer) => void) => void }, res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url ? new URL(req.url, 'http://localhost') : null;

      if (!url) {
        next();
        return;
      }

      const headers = normalizeRequestHeaders(req.headers);

      if (req.method === 'POST' && url.pathname === '/api/admin/create-user') {
        let rawBody = '';
        req.on('data', (chunk) => {
          rawBody += chunk.toString('utf8');
        });

        req.on('end', async () => {
          try {
            const { handler } = await import('./src/server/adminCreateUser');
            const response = await handler({
              httpMethod: req.method,
              headers,
              body: rawBody,
            });

            res.statusCode = response.statusCode;
            Object.entries(response.headers ?? {}).forEach(([key, value]) => {
              res.setHeader(key, value);
            });
            res.end(response.body ?? '');
          } catch (error) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Admin create-user middleware failed.' }));
          }
        });

        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/admin/list-users') {
        try {
          const { handler } = await import('./src/server/adminListUsers');
          const response = await handler({
            httpMethod: req.method,
            headers,
            queryStringParameters: parseQueryParams(url),
          });

          res.statusCode = response.statusCode;
          Object.entries(response.headers ?? {}).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
          res.end(response.body ?? '');
        } catch (error) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Admin list-users middleware failed.' }));
        }

        return;
      }

      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), adminDevServerPlugin],
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
