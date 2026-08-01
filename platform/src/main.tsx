import '@/styles.css';

const rootElement = document.getElementById('root');

function renderStartupError(message: string): void {
  document.body.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:2rem;background:#07111d;color:#e7edf6;font-family:system-ui,sans-serif;">
      <section style="max-width:36rem;text-align:center;line-height:1.6;padding:2rem;border:1px solid rgba(255,255,255,.12);border-radius:1rem;background:#0b1422;">
        <p style="margin:0 0 .5rem;color:#d39a72;font-size:.8rem;letter-spacing:.18em;text-transform:uppercase;">Configuration error</p>
        <h1 style="margin:0 0 .75rem;font-size:1.75rem;">Application failed to start</h1>
        <p style="margin:0;opacity:.85;">${message}</p>
      </section>
    </main>
  `;
}

if (!rootElement) {
  renderStartupError('The required root element #root was not found in index.html.');
  throw new Error('Root element #root was not found');
}

void import('./bootstrap').catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : 'Check the production environment configuration and reload.';
  renderStartupError(detail);
  console.error('Application startup failed', error);
});
