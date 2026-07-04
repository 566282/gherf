import { Outlet } from 'react-router-dom';
import { AdminNavigation } from '@/components/ui/AdminNavigation';
import { AdminSidebar } from '@/components/ui/AdminSidebar';
import { useState } from 'react';

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div data-admin-shell="true" className="flex h-screen bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <AdminSidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminNavigation onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main id="main-content" data-admin-main="true" className="flex-1 overflow-auto" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
