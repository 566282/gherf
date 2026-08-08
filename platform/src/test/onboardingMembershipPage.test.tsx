import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingMembershipPage } from '@/features/profile/pages/OnboardingMembershipPage';

const authState = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const membershipAdminState = vi.hoisted(() => ({
  listMembershipPlans: vi.fn(),
}));

const authApiState = vi.hoisted(() => ({
  updateMemberPlan: vi.fn(),
}));

const taskProfileState = vi.hoisted(() => ({
  getTaskComplianceProfile: vi.fn(),
  upsertTaskComplianceProfile: vi.fn(),
}));

const membershipUpgradeState = vi.hoisted(() => ({
  listMembershipUpgradeRequestsForUser: vi.fn(),
}));

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: authState.useAuth,
}));

vi.mock('@/services/api/membershipAdmin', () => ({
  listMembershipPlans: membershipAdminState.listMembershipPlans,
}));

vi.mock('@/services/api/auth', () => ({
  updateMemberPlan: authApiState.updateMemberPlan,
}));

vi.mock('@/services/api/taskProfile', () => ({
  getTaskComplianceProfile: taskProfileState.getTaskComplianceProfile,
  upsertTaskComplianceProfile: taskProfileState.upsertTaskComplianceProfile,
}));

vi.mock('@/services/api/membershipUpgradeRequests', () => ({
  listMembershipUpgradeRequestsForUser: membershipUpgradeState.listMembershipUpgradeRequestsForUser,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('OnboardingMembershipPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    authState.useAuth.mockReturnValue({
      profile: {
        id: 'user-1',
        fullName: 'Ada Example',
      },
    });

    membershipAdminState.listMembershipPlans.mockResolvedValue([
      {
        id: 'free-0',
        level: 0,
        slug: 'free',
        label: 'Free',
        price: 0,
        currency: 'NGN',
        durationDays: 30,
        category: 'free',
        benefits: [],
        isActive: true,
        archivedAt: null,
        updatedAt: '2026-08-07T00:00:00.000Z',
      },
      {
        id: 'starter-1',
        level: 1,
        slug: 'starter',
        label: 'Starter',
        price: 5000,
        currency: 'NGN',
        durationDays: 30,
        category: 'starter',
        benefits: [],
        isActive: true,
        archivedAt: null,
        updatedAt: '2026-08-07T00:00:00.000Z',
      },
    ]);

    membershipUpgradeState.listMembershipUpgradeRequestsForUser.mockResolvedValue([
      {
        id: 'req-1',
        request_id: 'mem-upg-user-1-1',
        user_id: 'user-1',
        current_tier: 0,
        target_tier: 1,
        payment_intent_id: 'pi_1',
        payment_reference: 'pi_1',
        status: 'pending',
        amount: 5000,
        currency: 'NGN',
        settled_at: null,
        failed_at: null,
        cancelled_at: null,
        created_at: '2026-08-07T00:00:00.000Z',
        metadata: {},
      },
    ]);

    taskProfileState.getTaskComplianceProfile.mockResolvedValue({
      preferredTaskTypes: ['watch_videos'],
      socialProfiles: {},
      onboardingProgress: {},
    });

    taskProfileState.upsertTaskComplianceProfile.mockResolvedValue({});
    authApiState.updateMemberPlan.mockResolvedValue({});
  });

  it('renders paid plans and excludes free tier option from selection list', async () => {
    render(
      <MemoryRouter>
        <OnboardingMembershipPage />
      </MemoryRouter>,
    );

    await screen.findByText('Choose your membership plan');

    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.queryByText('Tier 0')).not.toBeInTheDocument();
  });

  it('shows membership settlement status summary from recent upgrade requests', async () => {
    render(
      <MemoryRouter>
        <OnboardingMembershipPage />
      </MemoryRouter>,
    );

    await screen.findByText('Membership settlement status');
    expect(screen.getByText(/Pending settlement/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open payment details' })).toBeInTheDocument();
  });

  it('starts membership upgrade and redirects to payment details after selecting plan', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OnboardingMembershipPage />
      </MemoryRouter>,
    );

    await screen.findByText('Starter');
    await user.click(screen.getByRole('button', { name: 'Select plan' }));

    await waitFor(() => expect(authApiState.updateMemberPlan).toHaveBeenCalledWith('user-1', 1, 5000, 'NGN'));
    await waitFor(() => expect(taskProfileState.upsertTaskComplianceProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/app/orders?source=membership-onboarding'));
  });
});
