import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProviders } from '@/app/providers/AppProviders';
import { AppRouter } from '@/app/router/AppRouter';
import '@/styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  document.body.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:2rem;background:#07111d;color:#e7edf6;font-family:system-ui,sans-serif;">
      <section style="max-width:36rem;text-align:center;line-height:1.6;">
        <h1 style="margin:0 0 0.75rem;font-size:1.75rem;">Application failed to start</h1>
        <p style="margin:0;opacity:0.85;">The required root element #root was not found in index.html.</p>
      </section>
    </main>
  `;

  throw new Error('Root element #root was not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>,
);
