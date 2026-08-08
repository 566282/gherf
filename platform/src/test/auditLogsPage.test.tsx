import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogsPage } from '@/features/admin/pages/AuditLogsPage';

const authApiState = vi.hoisted(() => ({
  listActivityLogs: vi.fn(),
}));

vi.mock('@/services/api/auth', () => ({
  listActivityLogs: authApiState.listActivityLogs,
}));

describe('AuditLogsPage', () => {
  beforeEach(() => {
    authApiState.listActivityLogs.mockResolvedValue([
      {
        id: 'log-1',
        adminId: 'admin-11',
        action: 'update_fraud_detection_config',
        resourceType: 'fraud_detection_policy',
        resourceId: 'fraud_detection_policy',
        reason: 'Adjusted review threshold',
        createdAt: '2026-08-07T09:20:00.000Z',
      },
    ]);
  });

  it('renders live audit log entries', async () => {
    render(<AuditLogsPage />);

    expect(await screen.findByText('Audit logs')).toBeInTheDocument();
    expect(screen.getByText('Admin activity ledger')).toBeInTheDocument();
    expect(screen.getByText('admin-11')).toBeInTheDocument();
    expect(screen.getByText('Synced live admin activity logs from project scope.')).toBeInTheDocument();
  });
});
