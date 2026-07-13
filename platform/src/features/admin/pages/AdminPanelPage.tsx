import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { listAdminConsoleConfig, listAdminModuleCatalog, updateAdminConsoleConfig } from '@/services/api/admin';
import { listUsers, listActivityLogs } from '@/services/api/auth';
import { listCampaigns } from '@/services/api/campaigns';
import { defaultCustomizationConfig, themePresetOptions } from '@/lib/customization';
import { getThemePresetTheme, themeFontOptions, themeModeOptions, themePaletteOptions, themeStorageEvent } from '@/lib/theme';
import { gamificationModules, listGamificationConfig } from '@/services/api/gamification';
import { getReferralEngineSummary } from '@/services/api/referrals';
import { listCampaignTasks } from '@/services/api/tasks';
import { listSupportTickets } from '@/services/api/support';
import { listNotificationQueue } from '@/services/api/communications';
import { listWalletAccounts, listWalletTransactions } from '@/services/api/wallet';
import type { AdminCustomizationConfig, AdminFeatureConfig, AdminThemeConfig } from '@/types';
import { useLocation } from 'react-router-dom';

type FeatureModule = {
  id: string;
  title: string;
  section: string;
  category: string;
  description: string;
  risk: 'Low' | 'Medium' | 'High';
  owner: string;
  modes: string[];
  policies: string[];
  scopeOptions: string[];
  noteLabel: string;
};

const featureModules: FeatureModule[] = [
  {
    id: 'users',
    title: 'User management',
    section: 'Operations',
    category: 'Identity',
    description: 'Configure verification gates, moderation rules, profile edits, and wallet actions.',
    risk: 'High',
    owner: 'Trust & Safety',
    modes: ['Open access', 'Review required', 'Approval required'],
    policies: ['2FA required', 'KYC required', 'Account age gate'],
    scopeOptions: ['Global', 'By role', 'By region'],
    noteLabel: 'Moderation note',
  },
  {
    id: 'campaigns',
    title: 'Campaign management',
    section: 'Operations',
    category: 'Growth',
    description: 'Tune campaign approvals, presets, spend limits, and workflow automation.',
    risk: 'High',
    owner: 'Growth Ops',
    modes: ['Self-serve', 'Curated', 'Approval only'],
    policies: ['Budget cap', 'Manual review', 'Auto pause'],
    scopeOptions: ['Global', 'Advertiser tier', 'Campaign type'],
    noteLabel: 'Campaign policy',
  },
  {
    id: 'finance',
    title: 'Financial dashboard',
    section: 'Finance',
    category: 'Treasury',
    description: 'Control balances, settlement views, fee rules, and payout visibility.',
    risk: 'High',
    owner: 'Finance',
    modes: ['Read only', 'Operator', 'Admin'],
    policies: ['Fee model', 'Exchange rate source', 'Daily settlement'],
    scopeOptions: ['Global', 'Currency', 'Business unit'],
    noteLabel: 'Finance note',
  },
  {
    id: 'withdrawals',
    title: 'Withdrawal approvals',
    section: 'Finance',
    category: 'Payouts',
    description: 'Manage queue thresholds, escalation rules, and approval routing.',
    risk: 'High',
    owner: 'Payments',
    modes: ['Manual', 'Hybrid', 'Automatic'],
    policies: ['Risk score gate', 'Multi-approver', 'Cooling period'],
    scopeOptions: ['Global', 'Amount band', 'Method type'],
    noteLabel: 'Approval note',
  },
  {
    id: 'reports',
    title: 'Reports',
    section: 'Insights',
    category: 'Reporting',
    description: 'Configure scheduled exports, filters, and distribution rules.',
    risk: 'Medium',
    owner: 'Analytics',
    modes: ['Manual', 'Scheduled', 'Auto-delivered'],
    policies: ['Daily summary', 'Weekly pack', 'Monthly archive'],
    scopeOptions: ['Executives', 'Finance', 'Operations'],
    noteLabel: 'Report audience',
  },
  {
    id: 'analytics',
    title: 'Analytics',
    section: 'Insights',
    category: 'Telemetry',
    description: 'Adjust event collection, attribution windows, and dashboard visibility.',
    risk: 'Medium',
    owner: 'Data',
    modes: ['Basic', 'Standard', 'Advanced'],
    policies: ['Attribution window', 'Retention window', 'Sampling rate'],
    scopeOptions: ['Whole site', 'Campaigns', 'Wallet'],
    noteLabel: 'Analytics note',
  },
  {
    id: 'fraud',
    title: 'Fraud management',
    section: 'Trust',
    category: 'Security',
    description: 'Tune risk rules, duplicate detection, and escalation thresholds.',
    risk: 'High',
    owner: 'Risk Ops',
    modes: ['Observe', 'Block', 'Quarantine'],
    policies: ['Fraud score', 'VPN check', 'Duplicate detection'],
    scopeOptions: ['Global', 'Country', 'User segment'],
    noteLabel: 'Risk note',
  },
  {
    id: 'support',
    title: 'Support tickets',
    section: 'Trust',
    category: 'Service',
    description: 'Set SLA targets, queue routing, and customer response templates.',
    risk: 'Medium',
    owner: 'Support',
    modes: ['Single queue', 'Priority queue', 'Auto-routing'],
    policies: ['SLA target', 'Escalation window', 'VIP routing'],
    scopeOptions: ['Billing', 'Product', 'Compliance'],
    noteLabel: 'Support note',
  },
  {
    id: 'cms',
    title: 'CMS',
    section: 'Content',
    category: 'Publishing',
    description: 'Edit the Go4Wealth homepage, about page, FAQ, contact, news, announcements, help center, legal pages, blog, SEO surfaces, landing pages, advertiser pages, and user guides.',
    risk: 'Medium',
    owner: 'Content',
    modes: ['Draft only', 'Editorial review', 'Instant publish'],
    policies: ['Preview required', 'Scheduled release', 'Localization gate'],
    scopeOptions: ['Homepage', 'Legal pages', 'Campaign content'],
    noteLabel: 'Publishing note',
  },
  {
    id: 'email-templates',
    title: 'Email templates',
    section: 'Content',
    category: 'Messaging',
    description: 'Customize transactional emails, sender rules, and approval flows.',
    risk: 'Medium',
    owner: 'Lifecycle',
    modes: ['System managed', 'Editable', 'Locked'],
    policies: ['Brand safe', 'Localized copy', 'Approval on edit'],
    scopeOptions: ['Authentication', 'Billing', 'Campaigns'],
    noteLabel: 'Email note',
  },
  {
    id: 'notification-templates',
    title: 'Notification templates',
    section: 'Content',
    category: 'Messaging',
    description: 'Manage push, in-app, and SMS templates with per-channel controls.',
    risk: 'Medium',
    owner: 'Lifecycle',
    modes: ['Push only', 'Omnichannel', 'Manual send'],
    policies: ['Quiet hours', 'Personalization', 'Send cap'],
    scopeOptions: ['In-app', 'Email', 'SMS'],
    noteLabel: 'Notification note',
  },
  {
    id: 'site-settings',
    title: 'Site settings',
    section: 'Platform',
    category: 'Configuration',
    description: 'Configure branding, currencies, contact data, and legal copy.',
    risk: 'Medium',
    owner: 'Platform',
    modes: ['Draft', 'Staged', 'Live'],
    policies: ['Brand lock', 'Locale fallback', 'Asset cache'],
    scopeOptions: ['Whole site', 'Locale', 'Environment'],
    noteLabel: 'Brand note',
  },
  {
    id: 'theme',
    title: 'Theme customization',
    section: 'Platform',
    category: 'Design',
    description: 'Adjust palette, typography, spacing scale, and layout density.',
    risk: 'Low',
    owner: 'Design Ops',
    modes: ['Light', 'Dark', 'Adaptive'],
    policies: ['Contrast safe', 'Compact layout', 'Accent control'],
    scopeOptions: ['Default theme', 'Campaign theme', 'Public pages'],
    noteLabel: 'Theme note',
  },
  {
    id: 'toggles',
    title: 'Feature toggles',
    section: 'Platform',
    category: 'Release',
    description: 'Gate new functionality, staged rollouts, and emergency kill switches.',
    risk: 'High',
    owner: 'Engineering',
    modes: ['Disabled', 'Beta', 'Enabled'],
    policies: ['Percentage rollout', 'Role gating', 'Environment lock'],
    scopeOptions: ['All users', 'Staff', 'Pilot cohort'],
    noteLabel: 'Launch note',
  },
  {
    id: 'maintenance',
    title: 'Maintenance mode',
    section: 'Platform',
    category: 'Availability',
    description: 'Switch the platform into controlled downtime with custom messaging and bypasses.',
    risk: 'High',
    owner: 'Operations',
    modes: ['Off', 'Read only', 'Full maintenance'],
    policies: ['Staff bypass', 'Scheduled window', 'Public notice'],
    scopeOptions: ['Whole site', 'Public pages', 'App shell'],
    noteLabel: 'Maintenance message',
  },
];

const sectionAnchors = [
  { label: 'Overview', id: 'overview' },
  { label: 'Operations', id: 'operations' },
  { label: 'Finance', id: 'finance' },
  { label: 'Insights', id: 'insights' },
  { label: 'Trust', id: 'trust' },
  { label: 'Content', id: 'content' },
  { label: 'Platform', id: 'platform' },
];

const enterpriseDashboardModules = [
  {
    moduleKey: 'dashboard-analytics',
    title: 'Dashboard Analytics',
    section: 'Insights',
    path: '/admin/dashboard-analytics',
    description: 'Executive reporting, trend monitoring, and export-ready operational views.',
  },
  {
    moduleKey: 'users',
    title: 'User Management',
    section: 'Operations',
    path: '/admin/users',
    description: 'Identity governance, verification gates, moderation, and role controls.',
  },
  {
    moduleKey: 'campaigns',
    title: 'Campaign Management',
    section: 'Operations',
    path: '/admin/campaigns',
    description: 'Campaign approvals, spend limits, workflow rules, and launch controls.',
  },
  {
    moduleKey: 'ad-management',
    title: 'Ad Management',
    section: 'Operations',
    path: '/admin/ad-management',
    description: 'Ad format control, targeting, optimization, and fraud-aware delivery.',
  },
  {
    moduleKey: 'ad-platform',
    title: 'Ad Platform',
    section: 'Content',
    path: '/admin/ad-platform',
    description: 'Ad format control, audience targeting, scheduling, analytics, and fraud-aware delivery.',
  },
  {
    moduleKey: 'reward-settings',
    title: 'Reward Settings',
    section: 'Finance',
    path: '/admin/reward-settings',
    description: 'Reward policies, multipliers, payout thresholds, and incentive rules.',
  },
  {
    moduleKey: 'referral-settings',
    title: 'Referral Settings',
    section: 'Operations',
    path: '/admin/referral-settings',
    description: 'Referral links, commissions, milestones, leaderboard rules, and anti-abuse.',
  },
  {
    moduleKey: 'fraud-detection',
    title: 'Fraud Detection',
    section: 'Trust',
    path: '/admin/fraud-detection',
    description: 'Risk scoring, quarantines, watchlists, and threshold tuning.',
  },
  {
    moduleKey: 'reports',
    title: 'Reports',
    section: 'Insights',
    path: '/admin/reports',
    description: 'Scheduled exports, governed distribution, and offline review packs.',
  },
  {
    moduleKey: 'withdrawal-approval',
    title: 'Withdrawal Approval',
    section: 'Finance',
    path: '/admin/withdrawal-approval',
    description: 'Approval queue, escalation rules, payout routing, and auditability.',
  },
  {
    moduleKey: 'wallet-management',
    title: 'Wallet Management',
    section: 'Finance',
    path: '/admin/wallet',
    description: 'Balances, reserves, reconciliation, and treasury health.',
  },
  {
    moduleKey: 'system-settings',
    title: 'System Settings',
    section: 'Platform',
    path: '/admin/system-settings',
    description: 'Runtime flags, maintenance windows, and environment-level controls.',
  },
  {
    moduleKey: 'email-templates',
    title: 'Email Templates',
    section: 'Content',
    path: '/admin/email-templates',
    description: 'Transactional templates, sender rules, and approval flows.',
  },
  {
    moduleKey: 'notification-center',
    title: 'Notification Center',
    section: 'Content',
    path: '/admin/notification-center',
    description: 'Omnichannel alerts, queueing, retries, and scheduled notifications.',
  },
  {
    moduleKey: 'support-tickets',
    title: 'Support Tickets',
    section: 'Trust',
    path: '/admin/support-tickets',
    description: 'Ticket queue oversight, SLA tracking, escalations, and resolution control.',
  },
  {
    moduleKey: 'audit-logs',
    title: 'Audit Logs',
    section: 'Trust',
    path: '/admin/audit-logs',
    description: 'Administrative and system event history with exportable activity trails.',
  },
  {
    moduleKey: 'permissions',
    title: 'Permissions',
    section: 'Platform',
    path: '/admin/permissions',
    description: 'Role permissions, route ownership, and access boundaries.',
  },
] as const;

type FeatureState = AdminFeatureConfig;

type ThemeState = AdminThemeConfig;
type CustomizationState = AdminCustomizationConfig;
type LivePlatformStats = {
  users: number;
  campaigns: number;
  supportTickets: number;
  auditLogs: number;
  walletAccounts: number;
  walletTransactions: number;
  notificationQueued: number;
  notificationFailed: number;
};

type LiveOperationalStats = {
  engagementActiveModules: number;
  engagementTotalModules: number;
  engagementSeason: string;
  taskCount: number;
  referralPrograms: number;
  referralAttributions: number;
  referralFraudFlags: number;
};

type MetricStatus = {
  label: 'Healthy' | 'Attention needed' | 'Review required';
  tone: 'success' | 'warning' | 'error';
};

const defaultFeatureState = (feature: FeatureModule): FeatureState => ({
  enabled: feature.id !== 'maintenance',
  mode: feature.modes[0],
  policy: feature.policies[0],
  scope: feature.scopeOptions[0],
  note: `${feature.title} configuration is ready.`,
});

const featureGroups = sectionAnchors.map((section) => ({
  ...section,
  features: featureModules.filter((feature) => feature.section === section.label),
}));

const defaultThemeState: ThemeState = {
  mode: 'auto',
  palette: 'deep-blue',
  fontFamily: 'Inter',
};

const defaultLivePlatformStats: LivePlatformStats = {
  users: 0,
  campaigns: 0,
  supportTickets: 0,
  auditLogs: 0,
  walletAccounts: 0,
  walletTransactions: 0,
  notificationQueued: 0,
  notificationFailed: 0,
};

const defaultLiveOperationalStats: LiveOperationalStats = {
  engagementActiveModules: 0,
  engagementTotalModules: gamificationModules.length,
  engagementSeason: 'Loading season...',
  taskCount: 0,
  referralPrograms: 0,
  referralAttributions: 0,
  referralFraudFlags: 0,
};

function getMetricStatus(value: number, thresholds: { healthy: number; warning: number }): MetricStatus {
  if (value >= thresholds.healthy) {
    return { label: 'Healthy', tone: 'success' };
  }

  if (value >= thresholds.warning) {
    return { label: 'Attention needed', tone: 'warning' };
  }

  return { label: 'Review required', tone: 'error' };
}

function statusBadgeClass(tone: MetricStatus['tone']): string {
  if (tone === 'success') return 'border-success/20 bg-success/10 text-success';
  if (tone === 'warning') return 'border-warning/20 bg-warning/10 text-warning';
  return 'border-error/20 bg-error/10 text-error';
}

function getModuleStatus(records: number, activity: number): MetricStatus {
  if (records > 0 && activity > 0) {
    return { label: 'Healthy', tone: 'success' };
  }

  if (records > 0 || activity > 0) {
    return { label: 'Attention needed', tone: 'warning' };
  }

  return { label: 'Review required', tone: 'error' };
}

export function AdminPanelPage() {
  const location = useLocation();
  const [savedMessage, setSavedMessage] = useState('All admin modules are editable in this console.');
  const [themeState, setThemeState] = useState<ThemeState>(defaultThemeState);
  const [customizationState, setCustomizationState] = useState<CustomizationState>(defaultCustomizationConfig);
  const [moduleCatalog, setModuleCatalog] = useState<Record<string, { records: number; activity: number }>>({});
  const [livePlatformStats, setLivePlatformStats] = useState<LivePlatformStats>(defaultLivePlatformStats);
  const [liveOperationalStats, setLiveOperationalStats] = useState<LiveOperationalStats>(defaultLiveOperationalStats);
  const [featureStates, setFeatureStates] = useState<Record<string, FeatureState>>(() =>
    Object.fromEntries(featureModules.map((feature) => [feature.id, defaultFeatureState(feature)])),
  );

  useEffect(() => {
    void listAdminModuleCatalog()
      .then((catalog) => {
        setModuleCatalog(
          Object.fromEntries(
            Object.entries(catalog).map(([moduleKey, entry]) => [moduleKey, { records: entry.records.length, activity: entry.activity.length }]),
          ),
        );
      })
      .catch(() => setModuleCatalog({}));

    void listAdminConsoleConfig()
      .then((config) => {
        setFeatureStates((current) =>
          Object.fromEntries(
            featureModules.map((feature) => [
              feature.id,
              config.features[feature.id] ?? current[feature.id] ?? defaultFeatureState(feature),
            ]),
          ),
        );
        setThemeState(config.theme ?? defaultThemeState);
        setCustomizationState(config.customization ?? defaultCustomizationConfig);
        setSavedMessage('Loaded saved admin configuration.');
      })
      .catch(() => setSavedMessage('Using local defaults until admin settings are available.'));

    void Promise.all([
      listUsers(),
      listCampaigns(),
      listSupportTickets(undefined, 50),
      listActivityLogs(50),
      listWalletAccounts(undefined),
      listWalletTransactions(undefined, 50),
      listNotificationQueue(50),
    ])
      .then(([users, campaigns, supportTickets, auditLogs, walletAccounts, walletTransactions, notificationQueue]) => {
        setLivePlatformStats({
          users: users.length,
          campaigns: campaigns.length,
          supportTickets: supportTickets.length,
          auditLogs: auditLogs.length,
          walletAccounts: walletAccounts.length,
          walletTransactions: walletTransactions.length,
          notificationQueued: notificationQueue.filter((row) => row.status === 'queued').length,
          notificationFailed: notificationQueue.filter((row) => row.status === 'failed').length,
        });
      })
      .catch(() => setLivePlatformStats(defaultLivePlatformStats));

    void Promise.all([listGamificationConfig(), listCampaignTasks(), getReferralEngineSummary()])
      .then(([gamificationConfig, campaignTasks, referralSummary]) => {
        const engagementActiveModules = Object.values(gamificationConfig.modules).filter((module) => module.enabled).length;

        setLiveOperationalStats({
          engagementActiveModules,
          engagementTotalModules: gamificationModules.length,
          engagementSeason: gamificationConfig.seasonName,
          taskCount: campaignTasks.length,
          referralPrograms: referralSummary.programs.length,
          referralAttributions: referralSummary.attributions.length,
          referralFraudFlags: referralSummary.fraudFlags.length,
        });
      })
      .catch(() => setLiveOperationalStats(defaultLiveOperationalStats));
  }, []);

  const summary = useMemo(() => {
    const enabledCount = Object.values(featureStates).filter((state) => state.enabled).length;
    const maintenanceState = featureStates.maintenance;
    const highRiskCount = featureModules.filter((feature) => feature.risk === 'High').length;
    const liveRecords = Object.values(moduleCatalog).reduce((total, entry) => total + entry.records, 0);
    const liveActivity = Object.values(moduleCatalog).reduce((total, entry) => total + entry.activity, 0);

    return {
      enabledCount,
      disabledCount: featureModules.length - enabledCount,
      maintenanceState: maintenanceState?.mode ?? 'Off',
      highRiskCount,
      liveRecords,
      liveActivity,
    };
  }, [featureStates, moduleCatalog]);

  const updateFeature = (id: string, patch: Partial<FeatureState>) => {
    setFeatureStates((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  };

  const resetAll = () => {
    const nextState = Object.fromEntries(featureModules.map((feature) => [feature.id, defaultFeatureState(feature)]));
    setFeatureStates(nextState);
    setSavedMessage('Configuration reset to defaults.');
  };

  const handleSave = async () => {
    const nextConfig = { features: featureStates, theme: themeState, customization: customizationState };
    await updateAdminConsoleConfig(nextConfig);
    window.dispatchEvent(new CustomEvent(themeStorageEvent, { detail: { theme: themeState } }));
    setSavedMessage('Configuration saved to platform settings.');
  };

  const updateCustomization = (patch: Partial<CustomizationState>) => {
    setCustomizationState((current) => ({
      ...current,
      ...patch,
    }));
  };

  useEffect(() => {
    if (!location.hash) return;

    const targetElement = document.getElementById(location.hash.slice(1));
    targetElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  return (
    <div className="space-y-8 p-6">
      <Card className="relative overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,156,76,0.2),transparent_36%),linear-gradient(135deg,rgba(10,12,16,0.95),rgba(20,24,31,0.98))]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-accent/80">Phase 7 admin console</p>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">Professional admin panel</h1>
            <p className="max-w-3xl text-base text-muted">
              Configure every operational surface from one control center: users, campaigns, finance, reports, analytics,
              fraud, support, content, templates, site settings, theme, feature flags, and maintenance mode.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[28rem] xl:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface-elevated p-4">
              <p className="text-sm text-muted">Modules enabled</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{summary.enabledCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-elevated p-4">
              <p className="text-sm text-muted">Modules locked</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{summary.disabledCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-elevated p-4">
              <p className="text-sm text-muted">High-risk controls</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{summary.highRiskCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-elevated p-4">
              <p className="text-sm text-muted">Maintenance mode</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{summary.maintenanceState}</p>
            </div>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-2">
          {sectionAnchors.map((anchor) => (
            <a
              key={anchor.id}
              href={`#${anchor.id}`}
              className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-foreground"
            >
              {anchor.label}
            </a>
          ))}
        </div>
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Live platform metrics</p>
            <h2 className="mt-2 text-3xl font-semibold text-foreground">Current operational snapshots</h2>
            <p className="mt-2 max-w-3xl text-muted">
              These counts are pulled from Supabase-backed admin datasets so the index reflects current platform activity.
            </p>
          </div>
          <p className="text-sm text-muted">Updated on page load</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Users</p>
              <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${statusBadgeClass(getMetricStatus(livePlatformStats.users, { healthy: 1, warning: 1 }).tone)}`}>
                {getMetricStatus(livePlatformStats.users, { healthy: 1, warning: 1 }).label}
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{livePlatformStats.users}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Campaigns</p>
              <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${statusBadgeClass(getMetricStatus(livePlatformStats.campaigns, { healthy: 1, warning: 1 }).tone)}`}>
                {getMetricStatus(livePlatformStats.campaigns, { healthy: 1, warning: 1 }).label}
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{livePlatformStats.campaigns}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Support tickets</p>
              <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${statusBadgeClass(getMetricStatus(livePlatformStats.supportTickets, { healthy: 1, warning: 6 }).tone)}`}>
                {getMetricStatus(livePlatformStats.supportTickets, { healthy: 1, warning: 6 }).label}
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{livePlatformStats.supportTickets}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Audit logs</p>
              <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${statusBadgeClass(getMetricStatus(livePlatformStats.auditLogs, { healthy: 1, warning: 10 }).tone)}`}>
                {getMetricStatus(livePlatformStats.auditLogs, { healthy: 1, warning: 10 }).label}
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{livePlatformStats.auditLogs}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Wallet accounts</p>
              <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${statusBadgeClass(getMetricStatus(livePlatformStats.walletAccounts, { healthy: 1, warning: 1 }).tone)}`}>
                {getMetricStatus(livePlatformStats.walletAccounts, { healthy: 1, warning: 1 }).label}
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{livePlatformStats.walletAccounts}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Wallet activity</p>
              <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${statusBadgeClass(getMetricStatus(livePlatformStats.walletTransactions, { healthy: 1, warning: 1 }).tone)}`}>
                {getMetricStatus(livePlatformStats.walletTransactions, { healthy: 1, warning: 1 }).label}
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{livePlatformStats.walletTransactions}</p>
          </div>
        </div>
      </Card>

      <Card className="border border-border bg-surface-elevated p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Ops metric</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Notification queue health</h2>
            <p className="mt-2 text-sm text-muted">A lightweight signal for backlog and recent failures, updated from the live queue.</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted">
            <span className="rounded-full border border-border bg-surface px-3 py-1.5">Queued: {livePlatformStats.notificationQueued}</span>
            <span className="rounded-full border border-border bg-surface px-3 py-1.5">Failed: {livePlatformStats.notificationFailed}</span>
            <Link to="/admin/notification-center" className="rounded-full border border-border bg-surface px-3 py-1.5 text-foreground transition hover:border-accent/40 hover:text-accent">
              Open notification center
            </Link>
          </div>
        </div>
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Enterprise module index</p>
            <h2 className="mt-2 text-3xl font-semibold text-foreground">Independent admin modules</h2>
            <p className="mt-2 max-w-3xl text-muted">
              Every requested module opens a dedicated workspace with its own search, filters, bulk actions, CSV export,
              pagination, sorting, and activity logs.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted">
            <p>{enterpriseDashboardModules.length} independent modules</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-accent/70">
              {summary.liveRecords} live records · {summary.liveActivity} activity entries
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {enterpriseDashboardModules.map((module) => {
            const moduleSnapshot = module.moduleKey ? moduleCatalog[module.moduleKey] : null;
            const moduleStatus = moduleSnapshot ? getModuleStatus(moduleSnapshot.records, moduleSnapshot.activity) : getMetricStatus(0, { healthy: 1, warning: 1 });

            return (
              <Link
                key={module.title}
                to={module.path}
                className="group rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-elevated"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">{module.section}</p>
                    <h3 className="mt-2 text-xl font-semibold text-foreground group-hover:text-accent">{module.title}</h3>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs ${statusBadgeClass(moduleStatus.tone)}`}>
                    {moduleStatus.label}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted">{module.description}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-accent/70">
                  {module.moduleKey && moduleCatalog[module.moduleKey]
                    ? `${moduleCatalog[module.moduleKey].records} records · ${moduleCatalog[module.moduleKey].activity} activity entries`
                    : 'Open workflow editor'}
                </p>
              </Link>
            );
          })}
        </div>
      </Card>

      <div id="overview" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Live users</p>
          <p className="mt-3 text-2xl font-bold text-foreground">{livePlatformStats.users}</p>
          <p className="mt-2 text-sm text-muted">Accounts loaded from the profiles table.</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Live campaigns</p>
          <p className="mt-3 text-2xl font-bold text-foreground">{livePlatformStats.campaigns}</p>
          <p className="mt-2 text-sm text-muted">Active records pulled from the campaigns table.</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Support queue</p>
          <p className="mt-3 text-2xl font-bold text-foreground">{livePlatformStats.supportTickets}</p>
          <p className="mt-2 text-sm text-muted">Tickets currently tracked in Supabase.</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Audit volume</p>
          <p className="mt-3 text-2xl font-bold text-foreground">{livePlatformStats.auditLogs}</p>
          <p className="mt-2 text-sm text-muted">Recent admin activity log entries available for review.</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Engagement systems</p>
          <p className="mt-3 text-2xl font-bold text-foreground">
            {liveOperationalStats.engagementActiveModules}/{liveOperationalStats.engagementTotalModules} live modules
          </p>
          <span className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${statusBadgeClass(getMetricStatus(liveOperationalStats.engagementActiveModules, { healthy: liveOperationalStats.engagementTotalModules, warning: Math.max(1, liveOperationalStats.engagementTotalModules - 1) }).tone)}`}>
            {getMetricStatus(liveOperationalStats.engagementActiveModules, { healthy: liveOperationalStats.engagementTotalModules, warning: Math.max(1, liveOperationalStats.engagementTotalModules - 1) }).label}
          </span>
          <p className="mt-2 text-sm text-muted">{liveOperationalStats.engagementSeason} is the active season.</p>
          <Link to="/admin/gamification" className="mt-4 inline-block text-sm text-accent hover:underline">
            Open gamification controls
          </Link>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Task engine</p>
          <p className="mt-3 text-2xl font-bold text-foreground">{liveOperationalStats.taskCount} configured tasks</p>
          <span className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${statusBadgeClass(getMetricStatus(liveOperationalStats.taskCount, { healthy: 1, warning: 1 }).tone)}`}>
            {getMetricStatus(liveOperationalStats.taskCount, { healthy: 1, warning: 1 }).label}
          </span>
          <p className="mt-2 text-sm text-muted">Campaign task records pulled from Supabase.</p>
          <Link to="/admin/task-engine" className="mt-4 inline-block text-sm text-accent hover:underline">
            Open task engine
          </Link>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Referral engine</p>
          <p className="mt-3 text-2xl font-bold text-foreground">{liveOperationalStats.referralPrograms} programs</p>
          <span className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${statusBadgeClass(getMetricStatus(liveOperationalStats.referralPrograms, { healthy: 1, warning: 1 }).tone)}`}>
            {getMetricStatus(liveOperationalStats.referralPrograms, { healthy: 1, warning: 1 }).label}
          </span>
          <p className="mt-2 text-sm text-muted">
            {liveOperationalStats.referralAttributions} attributions and {liveOperationalStats.referralFraudFlags} fraud flags.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link to="/admin/referral-settings" className="text-accent hover:underline">
              Open referral settings
            </Link>
            <Link to="/admin/referral-ops" className="text-accent hover:underline">
              Open referral ops
            </Link>
            <Link to="/admin/fraud-detection" className="text-accent hover:underline">
              Open fraud detection
            </Link>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Command layer</p>
            <h2 className="mt-2 text-3xl font-semibold text-foreground">Configurable feature matrix</h2>
            <p className="mt-2 max-w-3xl text-muted">
              Every admin capability is editable from the module cards below. Toggle access, choose a mode, assign a policy,
              and stamp a note for auditability.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/admin/cms" className="rounded-xl border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/50 hover:text-accent">
              Open CMS editor
            </Link>
            <Button variant="ghost" onClick={resetAll}>
              Reset defaults
            </Button>
            <Button onClick={() => void handleSave()}>Save configuration</Button>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted">{savedMessage}</p>
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Theme studio</p>
            <h2 className="mt-2 text-3xl font-semibold text-foreground">Color system and typography</h2>
            <p className="mt-2 max-w-3xl text-muted">
              Configure light, dark, or auto mode, then choose a palette and type family. The selected theme updates semantic tokens, charts, and shared components across the app.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="semantic-chip">Accessible charts</span>
            <span className="semantic-chip">Semantic tokens</span>
            <span className="semantic-chip">Reusable primitives</span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm text-muted">Theme mode</span>
            <select className="input-base" value={themeState.mode} onChange={(event) => setThemeState((current) => ({ ...current, mode: event.target.value as ThemeState['mode'] }))}>
              {themeModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-muted">Primary palette</span>
            <select className="input-base" value={themeState.palette} onChange={(event) => setThemeState((current) => ({ ...current, palette: event.target.value as ThemeState['palette'] }))}>
              {themePaletteOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-muted">Font family</span>
            <select className="input-base" value={themeState.fontFamily} onChange={(event) => setThemeState((current) => ({ ...current, fontFamily: event.target.value as ThemeState['fontFamily'] }))}>
              {themeFontOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Surface preview</p>
            <div className="mt-3 rounded-xl border border-border bg-surface p-4">
              <p className="text-sm text-muted">Body copy</p>
              <p className="mt-2 text-lg font-semibold text-foreground">Card, form, and shell surfaces are token driven.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Accent preview</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="h-10 w-10 rounded-full bg-accent" />
              <span className="h-10 w-10 rounded-full bg-success" />
              <span className="h-10 w-10 rounded-full bg-warning" />
              <span className="h-10 w-10 rounded-full bg-info" />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Chart palette</p>
            <div className="mt-3 grid grid-cols-6 gap-2">
              <span className="h-8 rounded-full bg-chart-1" />
              <span className="h-8 rounded-full bg-chart-2" />
              <span className="h-8 rounded-full bg-chart-3" />
              <span className="h-8 rounded-full bg-chart-4" />
              <span className="h-8 rounded-full bg-chart-5" />
              <span className="h-8 rounded-full bg-chart-6" />
            </div>
          </div>
        </div>
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Customization engine</p>
            <h2 className="mt-2 text-3xl font-semibold text-foreground">Reusable tokens, branding, and trust controls</h2>
            <p className="mt-2 max-w-3xl text-muted">
              Use presets for the fast path, then refine branding, layout density, trust elements, and template families without touching code.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="semantic-chip">Design tokens</span>
            <span className="semantic-chip">Trust elements</span>
            <span className="semantic-chip">Template presets</span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm text-muted">Layout mode</span>
            <select
              className="input-base"
              value={customizationState.layout.mode}
              onChange={(event) => updateCustomization({ layout: { ...customizationState.layout, mode: event.target.value as CustomizationState['layout']['mode'] } })}
            >
              <option value="stacked">Stacked</option>
              <option value="sidebar">Sidebar</option>
              <option value="split">Split</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-muted">Theme preset</span>
            <select
              className="input-base"
              value={customizationState.themePreset}
              onChange={(event) => {
                const preset = event.target.value as CustomizationState['themePreset'];
                const presetTheme = getThemePresetTheme(preset);
                setCustomizationState((current) => ({ ...current, themePreset: preset }));
                setThemeState(preset === 'custom' ? themeState : presetTheme);
              }}
            >
              {themePresetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">Fast path for common brand directions.</p>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-muted">Logo mark</span>
            <input
              className="input-base"
              value={customizationState.branding.logoMark}
              onChange={(event) => updateCustomization({ branding: { ...customizationState.branding, logoMark: event.target.value } })}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-muted">Logo text</span>
            <input
              className="input-base"
              value={customizationState.branding.logoText}
              onChange={(event) => updateCustomization({ branding: { ...customizationState.branding, logoText: event.target.value } })}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-muted">Logo & icon style</span>
            <select
              className="input-base"
              value={customizationState.branding.iconStyle}
              onChange={(event) => updateCustomization({ branding: { ...customizationState.branding, iconStyle: event.target.value as CustomizationState['branding']['iconStyle'] } })}
            >
              <option value="line">Line</option>
              <option value="solid">Solid</option>
              <option value="duotone">Duotone</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-muted">Sidebar</span>
            <select
              className="input-base"
              value={customizationState.layout.sidebar}
              onChange={(event) => updateCustomization({ layout: { ...customizationState.layout, sidebar: event.target.value as CustomizationState['layout']['sidebar'] } })}
            >
              <option value="expanded">Expanded</option>
              <option value="compact">Compact</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-muted">Dashboard widgets</span>
            <select
              className="input-base"
              value={customizationState.layout.dashboardWidgets}
              onChange={(event) => updateCustomization({ layout: { ...customizationState.layout, dashboardWidgets: event.target.value as CustomizationState['layout']['dashboardWidgets'] } })}
            >
              <option value="stacked">Stacked</option>
              <option value="bento">Bento</option>
              <option value="dense">Dense</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-muted">Navigation</span>
            <select
              className="input-base"
              value={customizationState.layout.navigation}
              onChange={(event) => updateCustomization({ layout: { ...customizationState.layout, navigation: event.target.value as CustomizationState['layout']['navigation'] } })}
            >
              <option value="top">Top</option>
              <option value="side">Side</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-muted">Homepage and landing sections</span>
            <select
              className="input-base"
              value={customizationState.layout.landingPageSections}
              onChange={(event) => updateCustomization({ layout: { ...customizationState.layout, landingPageSections: event.target.value as CustomizationState['layout']['landingPageSections'] } })}
            >
              <option value="full">Full sections</option>
              <option value="focused">Focused sections</option>
              <option value="minimal">Minimal sections</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-muted">Button style</span>
            <select
              className="input-base"
              value={customizationState.layout.buttonStyle}
              onChange={(event) => updateCustomization({ layout: { ...customizationState.layout, buttonStyle: event.target.value as CustomizationState['layout']['buttonStyle'] } })}
            >
              <option value="rounded">Rounded</option>
              <option value="pill">Pill</option>
              <option value="sharp">Sharp</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-muted">Card style</span>
            <select
              className="input-base"
              value={customizationState.layout.cardStyle}
              onChange={(event) => updateCustomization({ layout: { ...customizationState.layout, cardStyle: event.target.value as CustomizationState['layout']['cardStyle'] } })}
            >
              <option value="flat">Flat</option>
              <option value="elevated">Elevated</option>
              <option value="glass">Glass</option>
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Trust elements</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {([
                ['sslSecurityIndicators', 'SSL/security indicators'],
                ['verifiedAdvertiserBadges', 'Verified advertiser badges'],
                ['verifiedUserBadges', 'Verified user badges'],
                ['realTimeStatistics', 'Real-time statistics'],
                ['transparentPayoutHistory', 'Transparent payout history'],
                ['auditLogs', 'Audit logs'],
                ['fraudProtectionMessaging', 'Fraud protection messaging'],
                ['userTestimonials', 'User testimonials'],
                ['professionalCertifications', 'Professional certifications'],
                ['systemStatusIndicators', 'System status indicators'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={customizationState.trust[key]}
                    onChange={(event) =>
                      updateCustomization({
                        trust: {
                          ...customizationState.trust,
                          [key]: event.target.checked,
                        },
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Token families</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm text-muted">Spacing</span>
                <select
                  className="input-base"
                  value={customizationState.tokens.spacing}
                  onChange={(event) => updateCustomization({ tokens: { ...customizationState.tokens, spacing: event.target.value as CustomizationState['tokens']['spacing'] } })}
                >
                  <option value="compact">Compact</option>
                  <option value="balanced">Balanced</option>
                  <option value="cozy">Cozy</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-muted">Radius</span>
                <select
                  className="input-base"
                  value={customizationState.tokens.radius}
                  onChange={(event) => updateCustomization({ tokens: { ...customizationState.tokens, radius: event.target.value as CustomizationState['tokens']['radius'] } })}
                >
                  <option value="sharp">Sharp</option>
                  <option value="balanced">Balanced</option>
                  <option value="soft">Soft</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-muted">Elevation</span>
                <select
                  className="input-base"
                  value={customizationState.tokens.elevation}
                  onChange={(event) => updateCustomization({ tokens: { ...customizationState.tokens, elevation: event.target.value as CustomizationState['tokens']['elevation'] } })}
                >
                  <option value="flat">Flat</option>
                  <option value="layered">Layered</option>
                  <option value="floating">Floating</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-muted">Transitions</span>
                <select
                  className="input-base"
                  value={customizationState.tokens.transitions}
                  onChange={(event) => updateCustomization({ tokens: { ...customizationState.tokens, transitions: event.target.value as CustomizationState['tokens']['transitions'] } })}
                >
                  <option value="snappy">Snappy</option>
                  <option value="standard">Standard</option>
                  <option value="slow">Slow</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-muted">Animations</span>
                <select
                  className="input-base"
                  value={customizationState.tokens.animations}
                  onChange={(event) => updateCustomization({ tokens: { ...customizationState.tokens, animations: event.target.value as CustomizationState['tokens']['animations'] } })}
                >
                  <option value="calm">Calm</option>
                  <option value="polished">Polished</option>
                  <option value="expressive">Expressive</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-muted">Opacity</span>
                <select
                  className="input-base"
                  value={customizationState.tokens.opacity}
                  onChange={(event) => updateCustomization({ tokens: { ...customizationState.tokens, opacity: event.target.value as CustomizationState['tokens']['opacity'] } })}
                >
                  <option value="subtle">Subtle</option>
                  <option value="balanced">Balanced</option>
                  <option value="bold">Bold</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-muted">Grid system</span>
                <select
                  className="input-base"
                  value={customizationState.tokens.gridSystem}
                  onChange={(event) => updateCustomization({ tokens: { ...customizationState.tokens, gridSystem: event.target.value as CustomizationState['tokens']['gridSystem'] } })}
                >
                  <option value="12-column">12-column</option>
                  <option value="14-column">14-column</option>
                  <option value="16-column">16-column</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-muted">Breakpoints</span>
                <select
                  className="input-base"
                  value={customizationState.tokens.breakpoints}
                  onChange={(event) => updateCustomization({ tokens: { ...customizationState.tokens, breakpoints: event.target.value as CustomizationState['tokens']['breakpoints'] } })}
                >
                  <option value="standard">Standard</option>
                  <option value="touch-optimized">Touch optimized</option>
                  <option value="foldable-aware">Foldable aware</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-muted">Typography</span>
                <select
                  className="input-base"
                  value={customizationState.tokens.typography}
                  onChange={(event) => updateCustomization({ tokens: { ...customizationState.tokens, typography: event.target.value as CustomizationState['tokens']['typography'] } })}
                >
                  {themeFontOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-muted">Icons</span>
                <select
                  className="input-base"
                  value={customizationState.tokens.icons}
                  onChange={(event) => updateCustomization({ tokens: { ...customizationState.tokens, icons: event.target.value as CustomizationState['tokens']['icons'] } })}
                >
                  <option value="line">Line</option>
                  <option value="solid">Solid</option>
                  <option value="duotone">Duotone</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4 lg:col-span-2">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Template presets and custom CSS</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2">
                <span className="text-sm text-muted">Campaign templates</span>
                <select
                  className="input-base"
                  value={customizationState.templates.campaignTemplate}
                  onChange={(event) => updateCustomization({ templates: { ...customizationState.templates, campaignTemplate: event.target.value as CustomizationState['templates']['campaignTemplate'] } })}
                >
                  <option value="starter">Starter</option>
                  <option value="balanced">Balanced</option>
                  <option value="premium">Premium</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-muted">Email templates</span>
                <select
                  className="input-base"
                  value={customizationState.templates.emailTemplate}
                  onChange={(event) => updateCustomization({ templates: { ...customizationState.templates, emailTemplate: event.target.value as CustomizationState['templates']['emailTemplate'] } })}
                >
                  <option value="starter">Starter</option>
                  <option value="balanced">Balanced</option>
                  <option value="premium">Premium</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-muted">Notification templates</span>
                <select
                  className="input-base"
                  value={customizationState.templates.notificationTemplate}
                  onChange={(event) => updateCustomization({ templates: { ...customizationState.templates, notificationTemplate: event.target.value as CustomizationState['templates']['notificationTemplate'] } })}
                >
                  <option value="starter">Starter</option>
                  <option value="balanced">Balanced</option>
                  <option value="premium">Premium</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-muted">Reward rules</span>
                <select
                  className="input-base"
                  value={customizationState.templates.rewardRules}
                  onChange={(event) => updateCustomization({ templates: { ...customizationState.templates, rewardRules: event.target.value as CustomizationState['templates']['rewardRules'] } })}
                >
                  <option value="starter">Starter</option>
                  <option value="balanced">Balanced</option>
                  <option value="premium">Premium</option>
                </select>
              </label>

              <label className="grid gap-2 md:col-span-2 xl:col-span-4">
                <span className="text-sm text-muted">Custom CSS</span>
                <textarea
                  className="input-base min-h-28"
                  value={customizationState.customCss}
                  onChange={(event) => updateCustomization({ customCss: event.target.value })}
                  placeholder="Optional CSS overrides for advanced brand work."
                />
              </label>
            </div>
          </div>
        </div>
      </Card>

      {featureGroups.map((group) => (
        <section key={group.id} id={group.id} className="space-y-4 scroll-mt-24">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-accent/70">{group.label}</p>
              <h3 className="mt-1 text-2xl font-semibold text-foreground">{group.label} controls</h3>
            </div>
            <p className="text-sm text-muted">{group.features.length} configurable modules</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {group.features.map((feature) => {
              const state = featureStates[feature.id];

              return (
                <Card key={feature.id} className="border border-border bg-surface-elevated">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-muted">{feature.category}</p>
                      <h4 className="mt-2 text-2xl font-semibold text-foreground">{feature.title}</h4>
                      <p className="mt-2 text-sm text-muted">{feature.description}</p>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={state.enabled}
                        onChange={(event) => updateFeature(feature.id, { enabled: event.target.checked })}
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm text-muted">Mode</span>
                      <select
                        className="input-base"
                        value={state.mode}
                        onChange={(event) => updateFeature(feature.id, { mode: event.target.value })}
                      >
                        {feature.modes.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm text-muted">Scope</span>
                      <select
                        className="input-base"
                        value={state.scope}
                        onChange={(event) => updateFeature(feature.id, { scope: event.target.value })}
                      >
                        {feature.scopeOptions.map((scope) => (
                          <option key={scope} value={scope}>
                            {scope}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2 md:col-span-2">
                      <span className="text-sm text-muted">Policy</span>
                      <select
                        className="input-base"
                        value={state.policy}
                        onChange={(event) => updateFeature(feature.id, { policy: event.target.value })}
                      >
                        {feature.policies.map((policy) => (
                          <option key={policy} value={policy}>
                            {policy}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2 md:col-span-2">
                      <span className="text-sm text-muted">{feature.noteLabel}</span>
                      <textarea
                        className="input-base min-h-24"
                        value={state.note}
                        onChange={(event) => updateFeature(feature.id, { note: event.target.value })}
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted">
                    <span className="rounded-full border border-border px-3 py-1">Owner: {feature.owner}</span>
                    <span className="rounded-full border border-border px-3 py-1">Risk: {feature.risk}</span>
                    <span className="rounded-full border border-border px-3 py-1">State: {state.enabled ? 'Active' : 'Disabled'}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
