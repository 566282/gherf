import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminPage } from '@/features/admin/pages/AdminPage';
import { VideoManagementPage } from '@/features/admin/pages/VideoManagementPage';
import { defaultCustomizationConfig } from '@/lib/customization';

const authState = vi.hoisted(() => ({
  profile: { id: 'admin-1' } as { id: string } | null,
}));

const adminApiState = vi.hoisted(() => ({
  listAdminConsoleConfig: vi.fn(),
  listAdminModuleCatalog: vi.fn(),
}));

const dataApiState = vi.hoisted(() => ({
  listUsers: vi.fn(),
  listCampaigns: vi.fn(),
  listSupportTickets: vi.fn(),
  listActivityLogs: vi.fn(),
  listWalletAccounts: vi.fn(),
  listWalletTransactions: vi.fn(),
  listGamificationConfig: vi.fn(),
  getReferralEngineSummary: vi.fn(),
  listCampaignTasks: vi.fn(),
}));

function getMetricCard(label: string): HTMLElement {
  const labelElement = screen.getByText(label);
  const container = labelElement.closest('div') ?? labelElement.parentElement;

  if (!container) {
    throw new Error(`Unable to find metric card for ${label}`);
  }

  return container;
}

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => ({ profile: authState.profile }),
}));

vi.mock('@/services/api/admin', () => ({
  listAdminConsoleConfig: adminApiState.listAdminConsoleConfig,
  listAdminModuleCatalog: adminApiState.listAdminModuleCatalog,
  updateAdminConsoleConfig: vi.fn(),
  updateAdminModuleCatalog: vi.fn(),
}));

vi.mock('@/services/api/auth', () => ({
  listUsers: dataApiState.listUsers,
  listActivityLogs: dataApiState.listActivityLogs,
}));

vi.mock('@/services/api/campaigns', () => ({
  listCampaigns: dataApiState.listCampaigns,
}));

vi.mock('@/services/api/support', () => ({
  listSupportTickets: dataApiState.listSupportTickets,
}));

vi.mock('@/services/api/wallet', () => ({
  listWalletAccounts: dataApiState.listWalletAccounts,
  listWalletTransactions: dataApiState.listWalletTransactions,
}));

vi.mock('@/services/api/gamification', () => ({
  gamificationModules: [],
  listGamificationConfig: dataApiState.listGamificationConfig,
}));

vi.mock('@/services/api/referrals', () => ({
  getReferralEngineSummary: dataApiState.getReferralEngineSummary,
}));

vi.mock('@/services/api/tasks', () => ({
  listCampaignTasks: dataApiState.listCampaignTasks,
}));

describe('Admin enterprise routes', () => {
  beforeEach(() => {
    authState.profile = { id: 'admin-1' };

    adminApiState.listAdminConsoleConfig.mockResolvedValue({
      features: {},
      theme: {
        mode: 'auto',
        palette: 'deep-blue',
        fontFamily: 'Inter',
      },
      customization: defaultCustomizationConfig,
    });

    adminApiState.listAdminModuleCatalog.mockResolvedValue({
      'dashboard-analytics': {
        records: [
          {
            id: 'dashboard-analytics-1',
            name: 'Acquisition overview',
            category: 'Growth',
            status: 'Published',
            owner: 'Growth Ops',
            value: 'CTR 4.8%',
            updatedAt: '2026-07-04T10:00:00.000Z',
            risk: 'Medium',
            notes: 'Traffic trends and channel mix.',
          },
          {
            id: 'dashboard-analytics-2',
            name: 'Revenue snapshot',
            category: 'Finance',
            status: 'Published',
            owner: 'Finance',
            value: 'USD 84.2k',
            updatedAt: '2026-07-03T10:00:00.000Z',
            risk: 'High',
            notes: 'Revenue, fees, and margin rollups.',
          },
        ],
        activity: [
          {
            title: 'CSV export completed',
            description: 'Filtered dashboard rows were exported.',
            meta: 'Export trail',
          },
        ],
      },
      'video-management': {
        records: [
          {
            id: 'video-management-1',
            name: 'Product explainer',
            category: 'Explainers',
            status: 'Published',
            owner: 'Content',
            value: '4:32',
            updatedAt: '2026-07-04T12:00:00.000Z',
            risk: 'Low',
            notes: 'Primary explainer used on the landing page.',
          },
        ],
        activity: [
          {
            title: 'Video management reviewed',
            description: 'A recent change set for video management was validated by an admin operator.',
            meta: 'Activity log',
          },
        ],
      },
    });

    dataApiState.listUsers.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }]);
    dataApiState.listCampaigns.mockResolvedValue([{ id: 'campaign-1' }, { id: 'campaign-2' }]);
    dataApiState.listSupportTickets.mockResolvedValue([{ id: 'ticket-1' }, { id: 'ticket-2' }, { id: 'ticket-3' }, { id: 'ticket-4' }]);
    dataApiState.listActivityLogs.mockResolvedValue([{ id: 'log-1' }]);
    dataApiState.listWalletAccounts.mockResolvedValue([{ id: 'wallet-1' }, { id: 'wallet-2' }]);
    dataApiState.listWalletTransactions.mockResolvedValue([{ id: 'tx-1' }, { id: 'tx-2' }, { id: 'tx-3' }, { id: 'tx-4' }, { id: 'tx-5' }]);
    dataApiState.listGamificationConfig.mockResolvedValue({
      seasonName: 'Season of Momentum',
      seasonTheme: 'Daily wins and long-term progression',
      seasonEndsOn: '2026-07-26',
      xpPerLevel: 250,
      dailyResetHour: 0,
      maxDailyWheelSpins: 3,
      dailyLoginBonus: 20,
      streakBonusPerDay: 8,
      spinBonusXp: 40,
      mysteryRewardPool: ['25 XP'],
      modules: {},
    });
    dataApiState.listCampaignTasks.mockResolvedValue([{ id: 'task-1' }, { id: 'task-2' }, { id: 'task-3' }]);
    dataApiState.getReferralEngineSummary.mockResolvedValue({
      programs: [{ id: 'program-1' }, { id: 'program-2' }],
      attributions: [{ id: 'attrib-1' }, { id: 'attrib-2' }, { id: 'attrib-3' }],
      fraudFlags: [{ id: 'flag-1' }],
      leaderboard: [],
    });
  });

  it('renders the admin landing route with live module snapshots', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Enterprise module index')).toBeInTheDocument();
    expect(await screen.findByText('Live platform metrics')).toBeInTheDocument();
    expect(within(getMetricCard('Users')).getByText('3')).toBeInTheDocument();
    expect(within(getMetricCard('Campaigns')).getByText('2')).toBeInTheDocument();
    expect(within(getMetricCard('Support tickets')).getByText('4')).toBeInTheDocument();
    expect(await screen.findByText('3 live records · 2 activity entries')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dashboard Analytics/i })).toBeInTheDocument();
    expect(screen.getByText('2 records')).toBeInTheDocument();
    expect(screen.getByText('1 activity entries')).toBeInTheDocument();
  });

  it('renders the video management route as a dedicated module workspace', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/video-management']}>
        <Routes>
          <Route path="/admin/video-management" element={<VideoManagementPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Video management' })).toBeInTheDocument();
    expect(screen.getByText('Video management reviewed')).toBeInTheDocument();
    expect(screen.getByText('1 records')).toBeInTheDocument();
  });
});