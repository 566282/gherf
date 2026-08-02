import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FraudDetectionPage } from '@/features/admin/pages/FraudDetectionPage';

const fraudApiState = vi.hoisted(() => ({
  listFraudDetectionConfig: vi.fn(),
  listFraudPolicyAuditTrail: vi.fn(),
  updateFraudDetectionConfig: vi.fn(),
}));

vi.mock('@/services/api/fraud', () => ({
  defaultFraudThresholds: {
    review: 45,
    quarantine: 65,
    block: 85,
    watchTimeMinutes: 2,
    rapidClicksPerMinute: 8,
    autoRefreshesPerMinute: 3,
    sharedIpLimit: 1,
    deviceReuseLimit: 1,
    linkedAccountLimit: 1,
    automationConfidence: 70,
    referralLoopScore: 65,
  },
  extractFraudThresholdsFromAuditEntry: vi.fn(),
  evaluateFraudProfile: vi.fn((user: Record<string, unknown>) => ({
    ...user,
    score: 12,
    decision: 'Monitor',
    activeSignals: [],
  })),
  explainFraudAssessment: vi.fn((assessment: { decision: string; score: number; activeSignals: string[] }) => ({
    decision: assessment.decision,
    score: assessment.score,
    summary: 'Safe profile',
    reasons: ['No active fraud signals were detected.'],
    signals: assessment.activeSignals,
  })),
  fraudSignalDefinitions: [
    { key: 'vpn', label: 'VPN', category: 'Network', description: 'Flags traffic that routes through anonymized or privacy-grade tunnels.', weight: 18 },
    { key: 'proxy', label: 'Proxy', category: 'Network', description: 'Detects proxy hops, residential relays, and masked IP paths.', weight: 16 },
  ],
  listFraudDetectionConfig: fraudApiState.listFraudDetectionConfig,
  listFraudPolicyAuditTrail: fraudApiState.listFraudPolicyAuditTrail,
  updateFraudDetectionConfig: fraudApiState.updateFraudDetectionConfig,
}));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => ({
    profile: { id: 'admin-1' },
  }),
}));

describe('FraudDetectionPage', () => {
  beforeEach(() => {
    fraudApiState.listFraudDetectionConfig.mockResolvedValue({
      thresholds: {
        review: 45,
        quarantine: 65,
        block: 85,
        watchTimeMinutes: 2,
        rapidClicksPerMinute: 8,
        autoRefreshesPerMinute: 3,
        sharedIpLimit: 1,
        deviceReuseLimit: 1,
        linkedAccountLimit: 1,
        automationConfidence: 70,
        referralLoopScore: 65,
      },
      savedAt: '2026-08-02T12:00:00.000Z',
      updatedBy: 'admin-1',
      version: 1,
    });
    fraudApiState.listFraudPolicyAuditTrail.mockResolvedValue([]);
    fraudApiState.updateFraudDetectionConfig.mockResolvedValue(undefined);
  });

  it('renders the fraud detection admin page without crashing', async () => {
    render(<FraudDetectionPage />);

    expect(screen.getByText('Fraud prevention engine')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Detection coverage')).toBeInTheDocument());
    expect(screen.getByText('VPN')).toBeInTheDocument();
    expect(screen.getByText('Proxy')).toBeInTheDocument();
  });
});