import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MembershipPlansPage } from '@/features/admin/pages/MembershipPlansPage';
import { MembershipRulesPage } from '@/features/admin/pages/MembershipRulesPage';
import { MembershipFeePage } from '@/features/admin/pages/MembershipFeePage';
import { MembershipAnalyticsPage } from '@/features/admin/pages/MembershipAnalyticsPage';

const membershipAdminState = vi.hoisted(() => ({
  listMembershipPlans: vi.fn(),
  upsertMembershipPlan: vi.fn(),
  archiveMembershipPlan: vi.fn(),
  listMembershipRuleVersions: vi.fn(),
  upsertMembershipRuleVersion: vi.fn(),
  publishMembershipRuleVersion: vi.fn(),
  listMembershipFeeInvoices: vi.fn(),
  updateMembershipFeeInvoiceStatus: vi.fn(),
  listMembershipAnalytics: vi.fn(),
  listMembershipJobRuns: vi.fn(),
  runMembershipAutomationJobs: vi.fn(),
}));

const lifecycleState = vi.hoisted(() => ({
  listMembershipLifecycleSettings: vi.fn(),
  updateMembershipLifecycleSettings: vi.fn(),
}));

vi.mock('@/services/api/membershipAdmin', () => ({
  listMembershipPlans: membershipAdminState.listMembershipPlans,
  upsertMembershipPlan: membershipAdminState.upsertMembershipPlan,
  archiveMembershipPlan: membershipAdminState.archiveMembershipPlan,
  listMembershipRuleVersions: membershipAdminState.listMembershipRuleVersions,
  upsertMembershipRuleVersion: membershipAdminState.upsertMembershipRuleVersion,
  publishMembershipRuleVersion: membershipAdminState.publishMembershipRuleVersion,
  listMembershipFeeInvoices: membershipAdminState.listMembershipFeeInvoices,
  updateMembershipFeeInvoiceStatus: membershipAdminState.updateMembershipFeeInvoiceStatus,
  listMembershipAnalytics: membershipAdminState.listMembershipAnalytics,
  listMembershipJobRuns: membershipAdminState.listMembershipJobRuns,
  runMembershipAutomationJobs: membershipAdminState.runMembershipAutomationJobs,
}));

vi.mock('@/services/api/membershipLifecycle', () => ({
  listMembershipLifecycleSettings: lifecycleState.listMembershipLifecycleSettings,
  updateMembershipLifecycleSettings: lifecycleState.updateMembershipLifecycleSettings,
}));

describe('membership admin pages', () => {
  beforeEach(() => {
    membershipAdminState.listMembershipPlans.mockReset();
    membershipAdminState.upsertMembershipPlan.mockReset();
    membershipAdminState.archiveMembershipPlan.mockReset();
    membershipAdminState.listMembershipRuleVersions.mockReset();
    membershipAdminState.upsertMembershipRuleVersion.mockReset();
    membershipAdminState.publishMembershipRuleVersion.mockReset();
    membershipAdminState.listMembershipFeeInvoices.mockReset();
    membershipAdminState.updateMembershipFeeInvoiceStatus.mockReset();
    membershipAdminState.listMembershipAnalytics.mockReset();
    membershipAdminState.listMembershipJobRuns.mockReset();
    membershipAdminState.runMembershipAutomationJobs.mockReset();
    lifecycleState.listMembershipLifecycleSettings.mockReset();
    lifecycleState.updateMembershipLifecycleSettings.mockReset();

    membershipAdminState.listMembershipPlans.mockResolvedValue([
      {
        id: 'plan-1',
        level: 1,
        slug: 'starter',
        label: 'Starter',
        price: 5000,
        currency: 'NGN',
        durationDays: 30,
        category: 'starter',
        benefits: ['Priority support', 'Withdrawal eligibility'],
        isActive: true,
        archivedAt: null,
        updatedAt: '2026-08-02T12:00:00.000Z',
      },
    ]);

    membershipAdminState.listMembershipRuleVersions.mockResolvedValue([
      {
        id: 'rule-1',
        ruleKey: 'reward_policy',
        version: 'v1',
        payload: { dailyPercent: 10 },
        status: 'published',
        effectiveFrom: '2026-08-02T12:00:00.000Z',
        effectiveTo: null,
        updatedAt: '2026-08-02T12:00:00.000Z',
      },
    ]);

    membershipAdminState.listMembershipFeeInvoices.mockResolvedValue([
      {
        id: 'invoice-1',
        userId: 'user-1',
        feeCycleKey: 'auto-20260802',
        amount: 1000,
        currency: 'NGN',
        status: 'unpaid',
        dueAt: '2026-08-09T00:00:00.000Z',
        settledAt: null,
        createdAt: '2026-08-02T12:00:00.000Z',
      },
    ]);

    membershipAdminState.listMembershipAnalytics.mockResolvedValue([
      {
        id: 'analytics-1',
        reportDate: '2026-08-02',
        totalMembers: 120,
        paidMembers: 80,
        pendingUpgrades: 4,
        activeMultipliers: 7,
        feeDelinquentMembers: 3,
        topPlanLevel: 10,
        topPlanLabel: 'Gold Plus',
      },
    ]);

    membershipAdminState.listMembershipJobRuns.mockResolvedValue([
      {
        id: 'job-1',
        jobKey: 'membership_daily_analytics',
        status: 'completed',
        runDate: '2026-08-02',
        startedAt: '2026-08-02T01:30:00.000Z',
        finishedAt: '2026-08-02T01:31:00.000Z',
        details: { total_members: 120 },
      },
    ]);

    lifecycleState.listMembershipLifecycleSettings.mockResolvedValue({
      autoUpgrade: { everyNWithdrawals: 4, insufficientBalanceAction: 'pending_upgrade' },
      downgrade: { graceDays: 7, warningDays: 3, recoveryDays: 14 },
      carryForward: { deductionPercent: 20, resetMultiplierOnUpgrade: true },
      multiplier: { priceFormula: 'equal_to_membership_price', fixedPercent: 100, paymentMethods: ['gateway_only'] },
      feeCompliance: { enforceFromWithdrawalCount: 2, blockOnOutstandingFee: true },
      rollout: { mode: 'progressive', percent: 20 },
    });
  });

  it('saves and archives membership plans from the admin CRUD page', async () => {
    const user = userEvent.setup();
    render(<MembershipPlansPage />);

    await screen.findByText('Membership plans');

    await user.clear(screen.getByLabelText('Label'));
    await user.type(screen.getByLabelText('Label'), 'Starter Prime');
    await user.clear(screen.getByLabelText('Price (NGN)'));
    await user.type(screen.getByLabelText('Price (NGN)'), '6500');
    await user.click(screen.getByRole('button', { name: 'Save plan' }));

    await waitFor(() => expect(membershipAdminState.upsertMembershipPlan).toHaveBeenCalledWith(expect.objectContaining({
      level: 1,
      label: 'Starter Prime',
      price: 6500,
      category: 'starter',
      isActive: true,
    })));

    await user.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() => expect(membershipAdminState.archiveMembershipPlan).toHaveBeenCalledWith(1));
  });

  it('saves and publishes membership rule versions from the admin rule page', async () => {
    const user = userEvent.setup();
    render(<MembershipRulesPage />);

    await screen.findByText('Membership rules');
    await user.clear(screen.getByLabelText('Version'));
    await user.type(screen.getByLabelText('Version'), 'v2');
    await user.click(screen.getByRole('button', { name: 'Save rule version' }));

    await waitFor(() => expect(membershipAdminState.upsertMembershipRuleVersion).toHaveBeenCalledWith(expect.objectContaining({
      ruleKey: 'reward_policy',
      version: 'v2',
      status: 'draft',
      payload: { dailyPercent: 10, cycleDays: 31, targetWallet: 'main_wallet' },
    })));

    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(membershipAdminState.publishMembershipRuleVersion).toHaveBeenCalledWith('reward_policy', 'v1'));
  });

  it('updates fee policy and invoice settlement from the admin fee page', async () => {
    const user = userEvent.setup();
    render(<MembershipFeePage />);

    await screen.findByText('Membership fee policy');
    fireEvent.change(screen.getByLabelText('Enforce from withdrawal count'), { target: { value: '3' } });
    await user.click(screen.getByRole('button', { name: 'Save fee policy' }));

    await waitFor(() => expect(lifecycleState.updateMembershipLifecycleSettings).toHaveBeenCalledWith({
      enforceFromWithdrawalCount: 3,
      blockWithoutFeeSettlement: true,
    }));

    await user.click(screen.getByRole('button', { name: 'Mark paid' }));

    await waitFor(() => expect(membershipAdminState.updateMembershipFeeInvoiceStatus).toHaveBeenCalledWith('invoice-1', 'paid'));
  });

  it('runs membership automation jobs from the analytics admin page', async () => {
    const user = userEvent.setup();
    render(<MembershipAnalyticsPage />);

    await screen.findByText('Membership analytics');
    await user.click(screen.getByRole('button', { name: 'Run membership jobs now' }));

    await waitFor(() => expect(membershipAdminState.runMembershipAutomationJobs).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(membershipAdminState.listMembershipAnalytics).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(membershipAdminState.listMembershipJobRuns).toHaveBeenCalledTimes(2));
  });
});
