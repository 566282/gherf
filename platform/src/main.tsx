import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProviders } from '@/app/providers/AppProviders';
import { AppRouter } from '@/app/router/AppRouter';
import { preloadCriticalRoutes } from '@/app/router';
import { env } from '@/lib/env';
import { reportWebVitals } from '@/lib/webVitals';
import '@/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>,
);

reportWebVitals(env.webVitalsEndpoint);
preloadCriticalRoutes();
