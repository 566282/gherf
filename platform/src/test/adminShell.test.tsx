import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '@/app/layouts/AdminLayout';

const permissionState = vi.hoisted(() => ({
  isAdmin: true,
}));

vi.mock('@/hooks/useAuth', () => ({
  usePermissions: () => permissionState,
}));

vi.mock('@/hooks/useLogout', () => ({
  useLogout: () => ({
    handleLogout: vi.fn(),
    isLoggingOut: false,
  }),
}));

describe('Admin shell smoke check', () => {
  beforeEach(() => {
    permissionState.isAdmin = true;
  });

  it('renders the admin shell and routed content together', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={<AdminLayout />}
          >
            <Route index element={<div>Admin shell smoke content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    expect(screen.getByText('Admin shell smoke content')).toBeInTheDocument();
    expect(screen.getByLabelText('Admin navigation')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});