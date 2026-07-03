import { Outlet } from 'react-router-dom';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-ink via-slate to-ink">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <main id="main-content" role="main">
        <Outlet />
      </main>
    </div>
  );
}
