import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsPage } from '@/features/admin/pages/ReportsPage';

const analyticsApiState = vi.hoisted(() => ({
  listAnalyticsReport: vi.fn(),
}));

const fraudApiState = vi.hoisted(() => ({
  listFraudDetectionConfig: vi.fn(),
}));

const withdrawalState = vi.hoisted(() => ({
  listWithdrawalRuntimeSettings: vi.fn(),
}));

const classroomState = vi.hoisted(() => ({
  getClassroomRolloutSettings: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  listActivityLogs: vi.fn(),
}));

vi.mock('@/services/api/analytics', () => ({
  listAnalyticsReport: analyticsApiState.listAnalyticsReport,
}));

vi.mock('@/services/api/fraud', () => ({
  listFraudDetectionConfig: fraudApiState.listFraudDetectionConfig,
}));

vi.mock('@/services/api/withdrawalOperations', () => ({
  listWithdrawalRuntimeSettings: withdrawalState.listWithdrawalRuntimeSettings,
}));

vi.mock('@/services/api/classroomContracts', () => ({
  getClassroomRolloutSettings: classroomState.getClassroomRolloutSettings,
}));

vi.mock('@/services/api/auth', () => ({
  listActivityLogs: authState.listActivityLogs,
}));

describe('ReportsPage', () => {
  beforeEach(() => {
    analyticsApiState.listAnalyticsReport.mockResolvedValue({
      generatedAt: '2026-08-07T10:00:00.000Z',
      rangeDays: 30,
      kpis: {
        totalUsers: 15,
        activeUsers: 11,
        totalRevenue: 15000,
        activeCampaigns: 5,
        rewardsIssued: 44,
        withdrawalsVolume: 3500,
      },
      userGrowth: [],
      activeUsers: [],
      revenue: [],
      taskCompletion: [],
      retention: [],
      campaignPerformance: [],
      rewardDistribution: [],
      withdrawalStatistics: { totalRequests: 0, totalVolume: 0, approvedRate: 0, byStatus: [], byMethod: [] },
      referralPerformance: {
        referredUsers: 0,
        qualifiedReferrals: 0,
        referralCommissions: 0,
        referralsByDay: [],
        activePrograms: 0,
        fraudFlags: 0,
        programsByActivity: [],
        leaderboard: [],
        fraudSignals: [],
      },
      geographicStatistics: [],
      deviceStatistics: [],
      browserStatistics: [],
      conversionFunnels: [],
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

    withdrawalState.listWithdrawalRuntimeSettings.mockResolvedValue({
      assignmentSlaHours: 12,
      reminderCadenceHours: [6, 3, 1],
      maxReassignments: 2,
      enableAutoAssignment: true,
      enableDuplicatePrevention: true,
      disputeAutoEscalationHours: 24,
      reminderNotificationsEnabled: true,
    });

    classroomState.getClassroomRolloutSettings.mockResolvedValue({
      enabled: true,
      cohort: 'internal',
      allowLearnerRoutes: true,
      allowAdminRoutes: true,
      allowRewardPayouts: true,
      allowWalletTransfers: true,
      allowTutor: false,
      eventSchemaVersion: 'classroom_learning_event_v1',
      apiSchemaVersion: 'classroom_learning_api_v1',
    });

    authState.listActivityLogs.mockResolvedValue([
      {
        id: 'log-1',
        adminId: 'admin-1',
        action: 'update_fraud_detection_config',
        resourceType: 'fraud_detection_policy',
        resourceId: 'fraud_detection_policy',
        reason: 'Tuned threshold for launch',
        createdAt: '2026-08-07T09:00:00.000Z',
      },
    ]);
  });

  it('renders live project-wide report settings and telemetry', async () => {
    render(<ReportsPage />);

    expect(await screen.findByText('Reports control plane')).toBeInTheDocument();
    expect(screen.getByText('Live settings state')).toBeInTheDocument();
    expect(screen.getByText('Revenue (30d)')).toBeInTheDocument();
    expect(screen.queryByText('Scheduled packs')).not.toBeInTheDocument();
  });
});
