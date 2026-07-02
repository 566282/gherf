import { Outlet } from 'react-router-dom';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-ink via-slate to-ink">
      <Outlet />
    </div>
  );
}
