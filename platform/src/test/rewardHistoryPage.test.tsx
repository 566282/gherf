import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RewardHistoryPage } from '@/features/rewards/pages/RewardHistoryPage';
import type { UserProfile } from '@/types/auth';

const authState = vi.hoisted(() => ({
  profile: null as UserProfile | null,
}));

const authApiState = vi.hoisted(() => ({
  listRewardLedger: vi.fn(),
  listWalletActivity: vi.fn(),
}));

const walletApiState = vi.hoisted(() => ({
  createWithdrawalRequest: vi.fn(),
  listWalletAccounts: vi.fn(),
  listWalletSettings: vi.fn(),
  listWalletTransactions: vi.fn(),
  listWalletTransfers: vi.fn(),
  listWithdrawalRequests: vi.fn(),
  transferWalletBalance: vi.fn(),
}));

const membershipApiState = vi.hoisted(() => ({
  evaluateWithdrawalPolicy: vi.fn(),
  resolveMembershipPlan: vi.fn(),
}));

const membershipLifecycleApiState = vi.hoisted(() => ({
  evaluateMultiplierPricing: vi.fn(),
}));

const withdrawalOpsApiState = vi.hoisted(() => ({
  listUserWithdrawalReceiptQueue: vi.fn(),
  reportWithdrawalNonReceipt: vi.fn(),
  userConfirmWithdrawalReceipt: vi.fn(),
}));

const p2pMerchantApiState = vi.hoisted(() => ({
  getMerchantProfileByUserId: vi.fn(),
}));

const p2pKycApiState = vi.hoisted(() => ({
  listMerchantKycRequirementsForCurrentUser: vi.fn(),
}));

const baseProfile: UserProfile = {
  id: 'user-1',
  email: 'user@example.com',
  fullName: 'Test User',
  role: 'registered_user',
  status: 'active',
  isActive: true,
  isEmailVerified: true,
  twoFactorEnabled: false,
  referralCode: 'TEST123',
  referredByCode: null,
  walletBalance: 120,
  rewardBalance: 35,
  rewardHistoryCount: 4,
  unreadNotificationsCount: 2,
  reputationScore: 128,
  levelLabel: 'Starter',
  levelTier: 1,
  badges: ['Rising Star'],
  lastLoginAt: '2026-07-05T09:00:00.000Z',
};

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => ({ profile: authState.profile }),
}));

vi.mock('@/services/api/auth', () => ({
  listRewardLedger: authApiState.listRewardLedger,
  listWalletActivity: authApiState.listWalletActivity,
}));

vi.mock('@/services/api/wallet', () => ({
  createWithdrawalRequest: walletApiState.createWithdrawalRequest,
  listWalletAccounts: walletApiState.listWalletAccounts,
  listWalletSettings: walletApiState.listWalletSettings,
  listWalletTransactions: walletApiState.listWalletTransactions,
  listWalletTransfers: walletApiState.listWalletTransfers,
  listWithdrawalRequests: walletApiState.listWithdrawalRequests,
  transferWalletBalance: walletApiState.transferWalletBalance,
}));

vi.mock('@/services/api/membership', () => ({
  evaluateWithdrawalPolicy: membershipApiState.evaluateWithdrawalPolicy,
  resolveMembershipPlan: membershipApiState.resolveMembershipPlan,
}));

vi.mock('@/services/api/membershipLifecycle', () => ({
  evaluateMultiplierPricing: membershipLifecycleApiState.evaluateMultiplierPricing,
}));

vi.mock('@/services/api/withdrawalOperations', () => ({
  listUserWithdrawalReceiptQueue: withdrawalOpsApiState.listUserWithdrawalReceiptQueue,
  reportWithdrawalNonReceipt: withdrawalOpsApiState.reportWithdrawalNonReceipt,
  userConfirmWithdrawalReceipt: withdrawalOpsApiState.userConfirmWithdrawalReceipt,
}));

vi.mock('@/services/api/p2pMerchant', () => ({
  getMerchantProfileByUserId: p2pMerchantApiState.getMerchantProfileByUserId,
}));

vi.mock('@/services/api/p2pKyc', () => ({
  listMerchantKycRequirementsForCurrentUser: p2pKycApiState.listMerchantKycRequirementsForCurrentUser,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <RewardHistoryPage />
    </MemoryRouter>,
  );
}

describe('RewardHistoryPage', () => {
  beforeEach(() => {
    authState.profile = baseProfile;

    authApiState.listRewardLedger.mockResolvedValue([]);
    authApiState.listWalletActivity.mockResolvedValue([]);

    walletApiState.createWithdrawalRequest.mockResolvedValue(undefined);
    walletApiState.listWalletAccounts.mockResolvedValue([]);
    walletApiState.listWalletSettings.mockResolvedValue({
      currency: 'USD',
      minWithdrawal: 10,
      maxWithdrawal: 1000,
      processingFeePercent: 2,
      internalTransfersEnabled: true,
      supportedMethods: ['bank_transfer', 'paypal'],
      exchangeRates: [{ currency: 'USD', label: 'US Dollar', rate: 1 }],
    });
    walletApiState.listWalletTransactions.mockResolvedValue([]);
    walletApiState.listWalletTransfers.mockResolvedValue([]);
    walletApiState.listWithdrawalRequests.mockResolvedValue([]);
    walletApiState.transferWalletBalance.mockResolvedValue(undefined);

    membershipApiState.resolveMembershipPlan.mockReturnValue({
      level: 1,
      label: 'Starter',
      price: 49,
      currency: 'USD',
    });
    membershipApiState.evaluateWithdrawalPolicy.mockReturnValue({
      allowed: true,
      reason: 'Eligible by policy',
      minThreshold: 10,
      maxWithdrawal: 1000,
    });
    membershipLifecycleApiState.evaluateMultiplierPricing.mockReturnValue({
      amount: 25,
      currency: 'USD',
      requiresGatewayPayment: false,
    });

    withdrawalOpsApiState.listUserWithdrawalReceiptQueue.mockResolvedValue([]);
    withdrawalOpsApiState.reportWithdrawalNonReceipt.mockResolvedValue(undefined);
    withdrawalOpsApiState.userConfirmWithdrawalReceipt.mockResolvedValue(undefined);

    p2pMerchantApiState.getMerchantProfileByUserId.mockResolvedValue(null);
    p2pKycApiState.listMerchantKycRequirementsForCurrentUser.mockResolvedValue([]);
  });

  it('keeps the internal transfer panel collapsed by default and resets to collapsed on remount', async () => {
    const firstRender = renderPage();

    await screen.findByText('No payout receipts awaiting your confirmation.');

    expect(screen.getByText('Feature lock enabled')).toBeInTheDocument();
    expect(screen.queryByText('From wallet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand transfer panel' }));

    expect(screen.getByText('Feature unlocked')).toBeInTheDocument();
    expect(screen.getByText('From wallet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse transfer panel' }));

    expect(screen.getByText('Feature lock enabled')).toBeInTheDocument();
    expect(screen.queryByText('From wallet')).not.toBeInTheDocument();

    firstRender.unmount();
    renderPage();

    await screen.findByText('No payout receipts awaiting your confirmation.');

    expect(screen.getByText('Feature lock enabled')).toBeInTheDocument();
    expect(screen.queryByText('From wallet')).not.toBeInTheDocument();
  });

  it('shows the transfer feature as locked when admin has not unlocked it', async () => {
    walletApiState.listWalletSettings.mockResolvedValueOnce({
      currency: 'USD',
      minWithdrawal: 10,
      maxWithdrawal: 1000,
      processingFeePercent: 2,
      internalTransfersEnabled: false,
      supportedMethods: ['bank_transfer', 'paypal'],
      exchangeRates: [{ currency: 'USD', label: 'US Dollar', rate: 1 }],
    });

    renderPage();

    await screen.findByText('No payout receipts awaiting your confirmation.');

    expect(screen.getByRole('button', { name: 'Locked by admin' })).toBeInTheDocument();
    expect(screen.getByText('Internal transfers are currently disabled. An admin must unlock this feature before funds can be moved between wallets.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Locked by admin' })).toBeDisabled();
    expect(screen.queryByText('From wallet')).not.toBeInTheDocument();
  });

  it('separates merchant wallets and keeps them locked until merchant KYC approval', async () => {
    walletApiState.listWalletAccounts.mockResolvedValueOnce([
      {
        walletType: 'main',
        currency: 'USD',
        availableBalance: 120,
      },
      {
        walletType: 'reward',
        currency: 'USD',
        availableBalance: 35,
      },
      {
        walletType: 'merchant_available',
        currency: 'USD',
        availableBalance: 450,
      },
    ]);

    p2pMerchantApiState.getMerchantProfileByUserId.mockResolvedValueOnce({
      id: 'merchant-1',
      userId: 'user-1',
      merchantCode: 'M-001',
      legalName: 'Merchant Legal',
      displayName: 'Merchant Name',
      status: 'pending_qualification',
      regionCode: 'US-EAST',
      countryCode: 'US',
      preferredCurrency: 'USD',
      riskScore: 0,
      responseSlaSeconds: 900,
      completionRate: 0,
      ratingScore: 0,
      metadata: {},
      activatedAt: null,
      suspendedAt: null,
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z',
    });

    p2pKycApiState.listMerchantKycRequirementsForCurrentUser.mockResolvedValueOnce([
      {
        id: 'req-1',
        merchantId: 'merchant-1',
        merchantUserId: 'user-1',
        requirementKey: 'government_id',
        requirementType: 'document',
        status: 'submitted',
        levelRequired: 1,
        submittedAt: '2026-08-07T00:00:00.000Z',
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        submissionPayload: {},
        metadata: {},
        updatedAt: '2026-08-07T00:00:00.000Z',
      },
    ]);

    renderPage();

    await screen.findByText('No payout receipts awaiting your confirmation.');

    expect(screen.getByRole('link', { name: 'Locked - Complete merchant KYC' })).toHaveAttribute('href', '/app/merchant/kyc');
    expect(screen.getAllByText('Merchant Available')).toHaveLength(1);
  });

  it('allows expanding merchant wallets when merchant KYC is completed and approved', async () => {
    walletApiState.listWalletAccounts.mockResolvedValueOnce([
      {
        walletType: 'main',
        currency: 'USD',
        availableBalance: 120,
      },
      {
        walletType: 'reward',
        currency: 'USD',
        availableBalance: 35,
      },
      {
        walletType: 'merchant_available',
        currency: 'USD',
        availableBalance: 450,
      },
    ]);

    p2pMerchantApiState.getMerchantProfileByUserId.mockResolvedValueOnce({
      id: 'merchant-1',
      userId: 'user-1',
      merchantCode: 'M-001',
      legalName: 'Merchant Legal',
      displayName: 'Merchant Name',
      status: 'active',
      regionCode: 'US-EAST',
      countryCode: 'US',
      preferredCurrency: 'USD',
      riskScore: 0,
      responseSlaSeconds: 900,
      completionRate: 0,
      ratingScore: 0,
      metadata: {},
      activatedAt: '2026-08-07T00:00:00.000Z',
      suspendedAt: null,
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z',
    });

    p2pKycApiState.listMerchantKycRequirementsForCurrentUser.mockResolvedValueOnce([
      {
        id: 'req-1',
        merchantId: 'merchant-1',
        merchantUserId: 'user-1',
        requirementKey: 'government_id',
        requirementType: 'document',
        status: 'approved',
        levelRequired: 1,
        submittedAt: '2026-08-07T00:00:00.000Z',
        reviewedBy: 'admin-1',
        reviewedAt: '2026-08-07T00:00:00.000Z',
        rejectionReason: null,
        submissionPayload: {},
        metadata: {},
        updatedAt: '2026-08-07T00:00:00.000Z',
      },
    ]);

    renderPage();

    await screen.findByText('No payout receipts awaiting your confirmation.');

    fireEvent.click(screen.getByRole('button', { name: 'Expand merchant wallets' }));

    expect(screen.getAllByText('Merchant Available').length).toBeGreaterThan(1);
  });
});