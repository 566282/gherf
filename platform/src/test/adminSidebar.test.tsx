import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdminSidebar } from '@/components/ui/AdminSidebar';

const permissionState = vi.hoisted(() => ({
  isAdmin: false,
}));

vi.mock('@/hooks/useAuth', () => ({
  usePermissions: () => permissionState,
}));

describe('AdminSidebar', () => {
  beforeEach(() => {
    permissionState.isAdmin = false;
  });

  it('hides admin shortcuts for non-admin users', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminSidebar open />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Admin navigation')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Analytics')).not.toBeInTheDocument();
  });

  it('shows admin shortcuts to super admins', () => {
    permissionState.isAdmin = true;

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminSidebar open />
      </MemoryRouter>,
    );

    const adminRoutes = [
      ['Dashboard Analytics', '/admin/dashboard-analytics'],
      ['Ad Management', '/admin/ad-management'],
      ['Video Management', '/admin/video-management'],
      ['Reward Settings', '/admin/reward-settings'],
      ['Referral Settings', '/admin/referral-settings'],
      ['Fraud Detection', '/admin/fraud-detection'],
      ['Reports', '/admin/reports'],
      ['Withdrawal Approval', '/admin/withdrawal-approval'],
      ['Wallet Management', '/admin/wallet'],
      ['Task Engine', '/admin/task-engine'],
      ['System Settings', '/admin/system-settings'],
      ['Email Templates', '/admin/email-templates'],
      ['Notification Center', '/admin/notification-center'],
      ['Support Tickets', '/admin/support-tickets'],
      ['Permissions', '/admin/permissions'],
      ['CMS', '/admin/cms'],
      ['Gamification', '/admin/gamification'],
      ['Communications', '/admin/communications'],
      ['Analytics', '/admin/analytics'],
      ['Verification', '/admin/verification'],
      ['Users', '/admin/users'],
      ['Audit Logs', '/admin/audit-logs'],
    ] as const;

    for (const [label, path] of adminRoutes) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', path);
    }
  });
});