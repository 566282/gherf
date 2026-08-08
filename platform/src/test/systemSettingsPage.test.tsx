import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemSettingsPage } from '@/features/admin/pages/SystemSettingsPage';

const adminApiState = vi.hoisted(() => ({
  listAdminConsoleConfig: vi.fn(),
}));

const communicationApiState = vi.hoisted(() => ({
  listCommunicationConfig: vi.fn(),
}));

const cmsApiState = vi.hoisted(() => ({
  listCmsConfig: vi.fn(),
}));

const fraudApiState = vi.hoisted(() => ({
  listFraudDetectionConfig: vi.fn(),
}));

const withdrawalApiState = vi.hoisted(() => ({
  listWithdrawalRuntimeSettings: vi.fn(),
}));

const classroomApiState = vi.hoisted(() => ({
  getClassroomRolloutSettings: vi.fn(),
  updateClassroomRolloutSettings: vi.fn(),
}));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'admin-1' } }),
}));

vi.mock('@/services/api/admin', () => ({
  listAdminConsoleConfig: adminApiState.listAdminConsoleConfig,
}));

vi.mock('@/services/api/communications', () => ({
  listCommunicationConfig: communicationApiState.listCommunicationConfig,
}));

vi.mock('@/services/api/cms', () => ({
  listCmsConfig: cmsApiState.listCmsConfig,
}));

vi.mock('@/services/api/fraud', () => ({
  listFraudDetectionConfig: fraudApiState.listFraudDetectionConfig,
}));

vi.mock('@/services/api/withdrawalOperations', () => ({
  listWithdrawalRuntimeSettings: withdrawalApiState.listWithdrawalRuntimeSettings,
}));

vi.mock('@/services/api/classroomContracts', () => ({
  getClassroomRolloutSettings: classroomApiState.getClassroomRolloutSettings,
  updateClassroomRolloutSettings: classroomApiState.updateClassroomRolloutSettings,
}));

describe('SystemSettingsPage', () => {
  beforeEach(() => {
    adminApiState.listAdminConsoleConfig.mockResolvedValue({
      features: {},
      theme: { mode: 'auto', palette: 'deep-blue', fontFamily: 'Inter' },
      customization: { sidebarCollapsedByDefault: false, compactCards: false },
    });

    communicationApiState.listCommunicationConfig.mockResolvedValue({
      timezone: 'UTC',
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
      emailEnabled: true,
      pushEnabled: true,
      smsEnabled: false,
      promotionalEnabled: true,
      liveAnnouncementsEnabled: true,
      templates: {},
    });

    cmsApiState.listCmsConfig.mockResolvedValue({
      siteName: 'Gherf',
      pages: {
        home: {},
        about: {},
        benefits: {},
        faq: {},
        privacy: {},
        terms: {},
        contact: {},
        blog: {},
        help: {},
        advertiser: {},
        referral: {},
        notifications: {},
        login: {},
        signup: {},
        dashboard: {},
        campaigns: {},
        rewards: {},
        support: {},
        security: {},
        analytics: {},
        classroom: {},
      },
      reusableBlocks: {},
      customPages: [{ id: 'page-1', slug: 'launch-kit', sortOrder: 1, eyebrow: 'Launch', title: 'Launch Kit', summary: 'Launch docs', body: 'Body', ctaLabel: 'Open', ctaHref: '/launch-kit', highlights: [], items: [], blocks: [], createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }],
    });

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
      savedAt: '2026-08-07T10:00:00.000Z',
      updatedBy: 'admin-1',
      version: 1,
    });

    withdrawalApiState.listWithdrawalRuntimeSettings.mockResolvedValue({
      assignmentSlaHours: 12,
      reminderCadenceHours: [6, 3, 1],
      maxReassignments: 2,
      enableAutoAssignment: true,
      enableDuplicatePrevention: true,
      disputeAutoEscalationHours: 24,
      reminderNotificationsEnabled: true,
    });

    classroomApiState.getClassroomRolloutSettings.mockResolvedValue({
      enabled: false,
      cohort: 'internal',
      allowLearnerRoutes: false,
      allowAdminRoutes: false,
      allowRewardPayouts: false,
      allowWalletTransfers: false,
      allowTutor: false,
      eventSchemaVersion: 'classroom_learning_event_v1',
      apiSchemaVersion: 'classroom_learning_api_v1',
    });

    classroomApiState.updateClassroomRolloutSettings.mockResolvedValue({
      enabled: true,
      cohort: 'internal',
      allowLearnerRoutes: false,
      allowAdminRoutes: true,
      allowRewardPayouts: false,
      allowWalletTransfers: false,
      allowTutor: false,
      eventSchemaVersion: 'classroom_learning_event_v1',
      apiSchemaVersion: 'classroom_learning_api_v1',
    });
  });

  it('renders live system settings and classroom rollout controls', async () => {
    render(<SystemSettingsPage />);

    expect(await screen.findByText('System settings control plane')).toBeInTheDocument();
    expect(screen.getByText('Classroom rollout')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable classroom' })).toBeInTheDocument();
    expect(screen.queryByText('Settings managed')).not.toBeInTheDocument();
  });
});
