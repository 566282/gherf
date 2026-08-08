import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubmissionReviewPage } from '@/features/admin/pages/SubmissionReviewPage';

const verificationApiState = vi.hoisted(() => ({
  listTaskVerificationEvents: vi.fn(),
}));

const taskApiState = vi.hoisted(() => ({
  listCampaignTasks: vi.fn(),
}));

const policyApiState = vi.hoisted(() => ({
  getActiveCompliancePolicy: vi.fn(),
}));

vi.mock('@/services/api/taskVerification', () => ({
  listTaskVerificationEvents: verificationApiState.listTaskVerificationEvents,
}));

vi.mock('@/services/api/tasks', () => ({
  listCampaignTasks: taskApiState.listCampaignTasks,
}));

vi.mock('@/services/api/compliancePolicy', () => ({
  getActiveCompliancePolicy: policyApiState.getActiveCompliancePolicy,
}));

describe('SubmissionReviewPage', () => {
  beforeEach(() => {
    verificationApiState.listTaskVerificationEvents.mockResolvedValue([
      {
        id: 'evt-1',
        task_id: 'task-1',
        campaign_id: 'campaign-1',
        user_id: 'user-1',
        verification_method: 'video_proof',
        verification_state: 'review_required',
        confidence_score: 62,
        risk_score: 58,
        created_at: '2026-08-07T10:00:00.000Z',
        raw_result: {
          context: {
            suspiciousDevice: true,
            duplicateSignals: 1,
          },
        },
      },
      {
        id: 'evt-2',
        task_id: 'task-2',
        campaign_id: 'campaign-2',
        user_id: 'user-2',
        verification_method: 'api_signal',
        verification_state: 'approved',
        confidence_score: 90,
        risk_score: 12,
        created_at: '2026-08-07T11:00:00.000Z',
      },
    ]);

    taskApiState.listCampaignTasks.mockResolvedValue([
      {
        id: 'task-1',
        campaignId: 'campaign-1',
        campaignTitle: 'Growth sprint',
        campaignStatus: 'active',
        campaignType: 'engagement',
        campaignInstructions: '',
        campaignBudgetCurrency: 'USD',
        title: 'Watch onboarding video',
        description: '',
        taskType: 'watch_video',
        rewardAmount: 25,
        requirements: [],
        cooldownSeconds: 0,
        maximumAttempts: null,
        verificationMethod: 'video_proof',
        fraudChecks: [],
        expiresAt: null,
        taskConfig: {},
        currentCompletions: 0,
        status: 'active',
        createdAt: '2026-08-06T10:00:00.000Z',
        updatedAt: '2026-08-06T10:00:00.000Z',
      },
    ]);

    policyApiState.getActiveCompliancePolicy.mockResolvedValue({
      id: 'policy-version-1',
      policyId: 'policy-1',
      policyKey: 'task_compliance_default',
      version: 'v1',
      schemaVersion: 'task_compliance_policy_v1',
      status: 'published',
      isBaseline: true,
      publishedAt: '2026-08-07T10:00:00.000Z',
      effectiveFrom: '2026-08-07T10:00:00.000Z',
      effectiveTo: null,
      updatedBy: 'admin-1',
      createdAt: '2026-08-07T10:00:00.000Z',
      updatedAt: '2026-08-07T10:00:00.000Z',
      policy: {
        schemaVersion: 'task_compliance_policy_v1',
        metadata: { label: 'default' },
        states: {
          submission: ['submitted'],
          verification: ['review_required', 'approved', 'rejected'],
          withdrawal: ['pending'],
          appeal: ['none'],
          payout: ['none'],
        },
        transitions: [],
        verificationStrategy: {
          methods: ['video_proof', 'api_signal'],
          fallbackOrder: ['video_proof'],
          randomAuditRatePercent: 0,
          manualReview: {
            minRiskScore: 55,
            queue: 'default',
            slaHours: 24,
          },
          platformMethodAllowList: {},
        },
        withdrawalGate: {
          holdStates: [],
          releaseWhenStates: [],
          gracePeriodHours: 0,
        },
        risk: {
          scoreWeights: {},
          multipliers: {},
          thresholds: {
            review: 45,
            quarantine: 65,
            block: 85,
          },
        },
        enforcement: {
          actions: {},
          notifications: {
            user: [],
            admin: [],
          },
        },
      },
    });
  });

  it('renders live verification data and policy controls', async () => {
    render(<SubmissionReviewPage />);

    expect(await screen.findByText('Verification dashboard')).toBeInTheDocument();
    expect(screen.getByText('Synced live verification events and compliance policy controls.')).toBeInTheDocument();
    expect(screen.getAllByText('Watch onboarding video').length).toBeGreaterThan(0);
    expect(screen.getAllByText('video proof').length).toBeGreaterThan(0);
    expect(screen.queryByText('Task verification system')).not.toBeInTheDocument();
  });
});
