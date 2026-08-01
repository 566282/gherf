import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { AppProviders } from '@/app/providers/AppProviders';
import { AppRouter } from '@/app/router/AppRouter';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The required root element #root was not found in index.html.');
}

ReactDOMClient.createRoot(rootElement).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>,
);
