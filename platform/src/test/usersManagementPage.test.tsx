import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersManagementPage } from '@/features/admin/pages/UsersManagementPage';

const authApiState = vi.hoisted(() => ({
  listUsers: vi.fn(),
  createAdminUser: vi.fn(),
  verifyUser: vi.fn(),
  suspendUser: vi.fn(),
  unsuspendUser: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  updateProfile: vi.fn(),
  updateMemberPlan: vi.fn(),
  adjustWalletBalance: vi.fn(),
  resetUserPassword: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  formatCurrency: (value: number) => `$${value.toFixed(2)}`,
}));

vi.mock('@/services/api/membership', () => ({
  getMembershipPlanOptions: () => [
    { value: 0, label: 'Tier 0 · Free member' },
    { value: 1, label: 'Tier 1 · Starter' },
    { value: 2, label: 'Tier 2 · Balanced' },
  ],
}));

vi.mock('@/services/api/auth', () => ({
  listUsers: authApiState.listUsers,
  createAdminUser: authApiState.createAdminUser,
  verifyUser: authApiState.verifyUser,
  suspendUser: authApiState.suspendUser,
  unsuspendUser: authApiState.unsuspendUser,
  banUser: authApiState.banUser,
  unbanUser: authApiState.unbanUser,
  updateProfile: authApiState.updateProfile,
  updateMemberPlan: authApiState.updateMemberPlan,
  adjustWalletBalance: authApiState.adjustWalletBalance,
  resetUserPassword: authApiState.resetUserPassword,
}));

describe('UsersManagementPage', () => {
  beforeEach(() => {
    authApiState.listUsers.mockReset();
    authApiState.createAdminUser.mockReset();
    authApiState.verifyUser.mockReset();
    authApiState.suspendUser.mockReset();
    authApiState.unsuspendUser.mockReset();
    authApiState.banUser.mockReset();
    authApiState.unbanUser.mockReset();
    authApiState.updateProfile.mockReset();
    authApiState.updateMemberPlan.mockReset();
    authApiState.adjustWalletBalance.mockReset();
    authApiState.resetUserPassword.mockReset();

    authApiState.listUsers.mockResolvedValue([
      {
        id: 'user-active',
        email: 'active@example.com',
        fullName: 'Active User',
        avatarUrl: null,
        role: 'registered_user',
        status: 'active',
        isActive: true,
        isEmailVerified: true,
        twoFactorEnabled: false,
        referralCode: 'ACTIVE-1',
        referredByCode: null,
        walletBalance: 100,
        rewardBalance: 10,
        rewardHistoryCount: 1,
        unreadNotificationsCount: 0,
        reputationScore: 0,
        levelLabel: 'Starter',
        levelTier: 1,
        badges: [],
        lastLoginAt: null,
      },
      {
        id: 'user-suspended',
        email: 'suspended@example.com',
        fullName: 'Suspended User',
        avatarUrl: null,
        role: 'registered_user',
        status: 'suspended',
        isActive: false,
        isEmailVerified: true,
        twoFactorEnabled: false,
        referralCode: 'SUSPEND-1',
        referredByCode: null,
        walletBalance: 50,
        rewardBalance: 5,
        rewardHistoryCount: 1,
        unreadNotificationsCount: 0,
        reputationScore: 0,
        levelLabel: 'Starter',
        levelTier: 1,
        badges: [],
        lastLoginAt: null,
      },
      {
        id: 'user-banned',
        email: 'banned@example.com',
        fullName: 'Banned User',
        avatarUrl: null,
        role: 'registered_user',
        status: 'banned',
        isActive: false,
        isEmailVerified: true,
        twoFactorEnabled: false,
        referralCode: 'BANNED-1',
        referredByCode: null,
        walletBalance: 20,
        rewardBalance: 2,
        rewardHistoryCount: 1,
        unreadNotificationsCount: 0,
        reputationScore: 0,
        levelLabel: 'Starter',
        levelTier: 1,
        badges: [],
        lastLoginAt: null,
      },
    ]);

    authApiState.createAdminUser.mockResolvedValue({
      id: 'user-new',
      email: 'new.user@example.com',
      fullName: 'New User',
      avatarUrl: null,
      role: 'registered_user',
      status: 'active',
      isActive: true,
      isEmailVerified: true,
      twoFactorEnabled: false,
      referralCode: 'NEW-1',
      referredByCode: null,
      walletBalance: 0,
      rewardBalance: 0,
      rewardHistoryCount: 0,
      unreadNotificationsCount: 0,
      reputationScore: 0,
      levelLabel: 'Balanced',
      levelTier: 2,
      badges: [],
      lastLoginAt: null,
    });
  });

  it('calls unsuspend and unban actions for suspended and banned users', async () => {
    const user = userEvent.setup();
    render(<UsersManagementPage />);

    const suspendedEmail = await screen.findByText('suspended@example.com');
    const suspendedRow = suspendedEmail.closest('tr');
    expect(suspendedRow).not.toBeNull();

    const bannedEmail = await screen.findByText('banned@example.com');
    const bannedRow = bannedEmail.closest('tr');
    expect(bannedRow).not.toBeNull();

    await user.click(within(suspendedRow as HTMLElement).getByRole('button', { name: 'Unsuspend' }));
    await user.click(within(bannedRow as HTMLElement).getByRole('button', { name: 'Unban' }));

    await waitFor(() => expect(authApiState.unsuspendUser).toHaveBeenCalledWith('user-suspended'));
    await waitFor(() => expect(authApiState.unbanUser).toHaveBeenCalledWith('user-banned'));
  });

  it('submits the create user form through the admin create-user API', async () => {
    const user = userEvent.setup();
    render(<UsersManagementPage />);

    await screen.findByText('Create managed user');

    await user.type(screen.getByLabelText('Full name'), 'New User');
    await user.type(screen.getByLabelText('Email address'), 'new.user@example.com');
    await user.type(screen.getByLabelText('Password'), 'secure-pass-123');
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    await waitFor(() =>
      expect(authApiState.createAdminUser).toHaveBeenCalledWith({
        email: 'new.user@example.com',
        password: 'secure-pass-123',
        fullName: 'New User',
        role: 'registered_user',
        levelTier: 1,
      }),
    );

    expect(await screen.findByText('Created New User with Balanced membership.')).toBeInTheDocument();
  }, 15000);

  it('submits advertiser role when admin creates an advertiser account', async () => {
    const user = userEvent.setup();
    render(<UsersManagementPage />);

    const createHeading = await screen.findByText('Create managed user');
    const createSection = createHeading.closest('section') as HTMLElement;

    await user.type(within(createSection).getByLabelText('Full name'), 'Advertiser User');
    await user.type(within(createSection).getByLabelText('Email address'), 'advertiser.user@example.com');
    await user.type(within(createSection).getByLabelText('Password'), 'secure-pass-123');
    await user.selectOptions(within(createSection).getByRole('combobox', { name: 'Role' }), 'advertiser');
    await user.selectOptions(within(createSection).getAllByRole('combobox')[1], '2');
    await user.click(within(createSection).getByRole('button', { name: 'Create user' }));

    await waitFor(() =>
      expect(authApiState.createAdminUser).toHaveBeenCalledWith({
        email: 'advertiser.user@example.com',
        password: 'secure-pass-123',
        fullName: 'Advertiser User',
        role: 'advertiser',
        levelTier: 2,
      }),
    );
  }, 15000);
});
