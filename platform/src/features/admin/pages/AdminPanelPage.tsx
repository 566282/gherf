import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { listAdminConsoleConfig, updateAdminConsoleConfig } from '@/services/api/admin';
import type { AdminFeatureConfig } from '@/types';

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
    description: 'Control page publishing, draft approvals, and content ownership.',
    risk: 'Medium',
    owner: 'Content',
    modes: ['Draft only', 'Editorial review', 'Instant publish'],
    policies: ['Preview required', 'Scheduled release', 'Localization gate'],
    scopeOptions: ['Landing pages', 'Blog', 'Help center'],
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

type FeatureState = AdminFeatureConfig;

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

export function AdminPanelPage() {
  const [savedMessage, setSavedMessage] = useState('All admin modules are editable in this console.');
  const [featureStates, setFeatureStates] = useState<Record<string, FeatureState>>(() =>
    Object.fromEntries(featureModules.map((feature) => [feature.id, defaultFeatureState(feature)])),
  );

  useEffect(() => {
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
        setSavedMessage('Loaded saved admin configuration.');
      })
      .catch(() => setSavedMessage('Using local defaults until admin settings are available.'));
  }, []);

  const summary = useMemo(() => {
    const enabledCount = Object.values(featureStates).filter((state) => state.enabled).length;
    const maintenanceState = featureStates.maintenance;
    const highRiskCount = featureModules.filter((feature) => feature.risk === 'High').length;

    return {
      enabledCount,
      disabledCount: featureModules.length - enabledCount,
      maintenanceState: maintenanceState?.mode ?? 'Off',
      highRiskCount,
    };
  }, [featureStates]);

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
    await updateAdminConsoleConfig({ features: featureStates });
    setSavedMessage('Configuration saved to platform settings.');
  };

  return (
    <div className="space-y-8 p-6">
      <Card className="relative overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,156,76,0.2),transparent_36%),linear-gradient(135deg,rgba(10,12,16,0.95),rgba(20,24,31,0.98))]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-ember/80">Phase 7 admin console</p>
            <h1 className="text-4xl font-bold text-white md:text-5xl">Professional admin panel</h1>
            <p className="max-w-3xl text-base text-mist/80">
              Configure every operational surface from one control center: users, campaigns, finance, reports, analytics,
              fraud, support, content, templates, site settings, theme, feature flags, and maintenance mode.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[28rem] xl:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Modules enabled</p>
              <p className="mt-2 text-3xl font-bold text-white">{summary.enabledCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Modules locked</p>
              <p className="mt-2 text-3xl font-bold text-white">{summary.disabledCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">High-risk controls</p>
              <p className="mt-2 text-3xl font-bold text-white">{summary.highRiskCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Maintenance mode</p>
              <p className="mt-2 text-3xl font-bold text-white">{summary.maintenanceState}</p>
            </div>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-2">
          {sectionAnchors.map((anchor) => (
            <a
              key={anchor.id}
              href={`#${anchor.id}`}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-mist/80 transition hover:border-ember/50 hover:text-white"
            >
              {anchor.label}
            </a>
          ))}
        </div>
      </Card>

      <div id="overview" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist/60">User governance</p>
          <p className="mt-3 text-2xl font-bold text-white">Verification, roles, and wallet access</p>
          <p className="mt-2 text-sm text-mist/70">Policy gates, suspension controls, and admin actions are configurable.</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist/60">Growth operations</p>
          <p className="mt-3 text-2xl font-bold text-white">Campaign review and budget controls</p>
          <p className="mt-2 text-sm text-mist/70">Approve campaign structure, spend limits, and rule presets.</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist/60">Payout safety</p>
          <p className="mt-3 text-2xl font-bold text-white">Withdrawal approvals and treasury policies</p>
          <p className="mt-2 text-sm text-mist/70">Manual, hybrid, and automatic payout paths remain switchable.</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist/60">Release control</p>
          <p className="mt-3 text-2xl font-bold text-white">Feature flags and maintenance switches</p>
          <p className="mt-2 text-sm text-mist/70">Ship safely with staged rollout and emergency off-ramps.</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist/60">Engagement systems</p>
          <p className="mt-3 text-2xl font-bold text-white">Daily login, streaks, XP, and rewards</p>
          <p className="mt-2 text-sm text-mist/70">Tune progression loops, lucky wheel odds, missions, and seasonal events.</p>
          <Link to="/admin/gamification" className="mt-4 inline-block text-sm text-ember hover:underline">
            Open gamification controls
          </Link>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-ember/70">Command layer</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Configurable feature matrix</h2>
            <p className="mt-2 max-w-3xl text-mist/75">
              Every admin capability is editable from the module cards below. Toggle access, choose a mode, assign a policy,
              and stamp a note for auditability.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={resetAll}>
              Reset defaults
            </Button>
            <Button onClick={() => void handleSave()}>Save configuration</Button>
          </div>
        </div>

        <p className="mt-4 text-sm text-mist/70">{savedMessage}</p>
      </Card>

      {featureGroups.map((group) => (
        <section key={group.id} id={group.id} className="space-y-4 scroll-mt-24">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-ember/70">{group.label}</p>
              <h3 className="mt-1 text-2xl font-semibold text-white">{group.label} controls</h3>
            </div>
            <p className="text-sm text-mist/60">{group.features.length} configurable modules</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {group.features.map((feature) => {
              const state = featureStates[feature.id];

              return (
                <Card key={feature.id} className="border border-white/5 bg-white/5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-mist/50">{feature.category}</p>
                      <h4 className="mt-2 text-2xl font-semibold text-white">{feature.title}</h4>
                      <p className="mt-2 text-sm text-mist/75">{feature.description}</p>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-mist/80">
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
                      <span className="text-sm text-mist/70">Mode</span>
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
                      <span className="text-sm text-mist/70">Scope</span>
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
                      <span className="text-sm text-mist/70">Policy</span>
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
                      <span className="text-sm text-mist/70">{feature.noteLabel}</span>
                      <textarea
                        className="input-base min-h-24"
                        value={state.note}
                        onChange={(event) => updateFeature(feature.id, { note: event.target.value })}
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-mist/60">
                    <span className="rounded-full border border-white/10 px-3 py-1">Owner: {feature.owner}</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">Risk: {feature.risk}</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">State: {state.enabled ? 'Active' : 'Disabled'}</span>
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
