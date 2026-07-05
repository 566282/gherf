import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  getReferralEngineSummary,
  upsertReferralProgram,
  type ReferralAttribution,
  type ReferralFraudFlag,
  type ReferralLeaderboardSnapshot,
  type ReferralMilestoneConfigItem,
  type ReferralProgram,
  type ReferralProgramInput,
} from '@/services/api/referrals';

const defaultProgramDraft: ReferralProgramInput = {
  slug: 'default-referral-program',
  name: 'Referral program',
  description: 'Signup referrals, multi-level commissions, milestones, leaderboard ranking, and fraud controls.',
  campaignSlug: 'referral_campaigns',
  status: 'active',
  inviteBonusAmount: 4,
  tierOneCommissionPercent: 8,
  tierTwoCommissionPercent: 3,
  qualificationWindowDays: 14,
  payoutDelayDays: 7,
  maxTierDepth: 2,
  milestoneConfig: [
    { key: 'first_referral', label: 'First referral', threshold: 1, rewardAmount: 4 },
    { key: 'ten_referrals', label: 'Ten referrals', threshold: 10, rewardAmount: 25 },
    { key: 'fifty_referrals', label: 'Fifty referrals', threshold: 50, rewardAmount: 100 },
  ],
  leaderboardConfig: { period: 'monthly', metric: 'commission_total' },
  fraudConfig: { rules: ['self_referral', 'duplicate_referral_attempt', 'invalid_referral_code'] },
  analyticsConfig: { metrics: ['referralsByDay', 'referralCommissions', 'fraudFlags'] },
  metadata: { source: 'admin' },
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toJsonText(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function draftFromProgram(program: ReferralProgram): ReferralProgramInput {
  return {
    slug: program.slug,
    name: program.name,
    description: program.description ?? '',
    campaignSlug: program.campaignSlug ?? '',
    status: program.status,
    inviteBonusAmount: program.inviteBonusAmount,
    tierOneCommissionPercent: program.tierOneCommissionPercent,
    tierTwoCommissionPercent: program.tierTwoCommissionPercent,
    qualificationWindowDays: program.qualificationWindowDays,
    payoutDelayDays: program.payoutDelayDays,
    maxTierDepth: program.maxTierDepth,
    milestoneConfig: program.milestoneConfig,
    leaderboardConfig: program.leaderboardConfig,
    fraudConfig: program.fraudConfig,
    analyticsConfig: program.analyticsConfig,
    metadata: program.metadata,
  };
}

export function ReferralSettingsPage(): JSX.Element {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<ReferralProgram[]>([]);
  const [attributions, setAttributions] = useState<ReferralAttribution[]>([]);
  const [fraudFlags, setFraudFlags] = useState<ReferralFraudFlag[]>([]);
  const [leaderboard, setLeaderboard] = useState<ReferralLeaderboardSnapshot[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [draft, setDraft] = useState<ReferralProgramInput>(defaultProgramDraft);
  const [milestoneText, setMilestoneText] = useState(toJsonText(defaultProgramDraft.milestoneConfig));
  const [leaderboardText, setLeaderboardText] = useState(toJsonText(defaultProgramDraft.leaderboardConfig));
  const [fraudText, setFraudText] = useState(toJsonText(defaultProgramDraft.fraudConfig));
  const [analyticsText, setAnalyticsText] = useState(toJsonText(defaultProgramDraft.analyticsConfig));
  const [metadataText, setMetadataText] = useState(toJsonText(defaultProgramDraft.metadata));
  const [syncMessage, setSyncMessage] = useState('Loading referral backend...');
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const activeProgram = useMemo(() => programs.find((program) => program.slug === selectedSlug) ?? programs[0] ?? null, [programs, selectedSlug]);

  useEffect(() => {
    let active = true;

    void getReferralEngineSummary()
      .then(({ programs: nextPrograms, attributions: nextAttributions, fraudFlags: nextFraudFlags, leaderboard: nextLeaderboard }) => {
        if (!active) return;

        setPrograms(nextPrograms);
        setAttributions(nextAttributions);
        setFraudFlags(nextFraudFlags);
        setLeaderboard(nextLeaderboard);

        const firstProgram = nextPrograms[0];
        if (firstProgram && !selectedSlug) {
          setSelectedSlug(firstProgram.slug);
        }

        if (!firstProgram && !selectedSlug) {
          setSelectedSlug(defaultProgramDraft.slug);
          setDraft(defaultProgramDraft);
          setMilestoneText(toJsonText(defaultProgramDraft.milestoneConfig));
          setLeaderboardText(toJsonText(defaultProgramDraft.leaderboardConfig));
          setFraudText(toJsonText(defaultProgramDraft.fraudConfig));
          setAnalyticsText(toJsonText(defaultProgramDraft.analyticsConfig));
          setMetadataText(toJsonText(defaultProgramDraft.metadata));
        }

        setSyncMessage('Synced referral backend state.');
      })
      .catch(() => {
        if (!active) return;
        setSyncMessage('Using local defaults until the referral backend is reachable.');
      });

    return () => {
      active = false;
    };
  }, [selectedSlug]);

  useEffect(() => {
    if (!activeProgram) return;
    const nextDraft = draftFromProgram(activeProgram);
    setDraft(nextDraft);
    setMilestoneText(toJsonText(nextDraft.milestoneConfig));
    setLeaderboardText(toJsonText(nextDraft.leaderboardConfig));
    setFraudText(toJsonText(nextDraft.fraudConfig));
    setAnalyticsText(toJsonText(nextDraft.analyticsConfig));
    setMetadataText(toJsonText(nextDraft.metadata));
  }, [activeProgram]);

  const summaryCards = [
    { label: 'Programs', value: String(programs.length), note: 'Persisted referral programs.' },
    { label: 'Attributions', value: String(attributions.length), note: 'Qualified referral signups.' },
    { label: 'Fraud flags', value: String(fraudFlags.length), note: 'Open and resolved risk events.' },
    { label: 'Leaderboard rows', value: String(leaderboard.length), note: 'Current ranking snapshots.' },
  ];

  const saveProgram = async (): Promise<void> => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      const nextProgram = await upsertReferralProgram(
        {
          ...draft,
          slug: draft.slug.trim() || defaultProgramDraft.slug,
          name: draft.name.trim() || defaultProgramDraft.name,
          description: draft.description.trim(),
          campaignSlug: draft.campaignSlug.trim(),
          status: draft.status.trim() || 'active',
          inviteBonusAmount: Number(draft.inviteBonusAmount),
          tierOneCommissionPercent: Number(draft.tierOneCommissionPercent),
          tierTwoCommissionPercent: Number(draft.tierTwoCommissionPercent),
          qualificationWindowDays: Number(draft.qualificationWindowDays),
          payoutDelayDays: Number(draft.payoutDelayDays),
          maxTierDepth: Number(draft.maxTierDepth),
          milestoneConfig: safeJsonParse<ReferralMilestoneConfigItem[]>(milestoneText, []),
          leaderboardConfig: safeJsonParse<Record<string, unknown>>(leaderboardText, {}),
          fraudConfig: safeJsonParse<Record<string, unknown>>(fraudText, {}),
          analyticsConfig: safeJsonParse<Record<string, unknown>>(analyticsText, {}),
          metadata: safeJsonParse<Record<string, unknown>>(metadataText, {}),
        },
        profile?.id,
      );

      const { programs: nextPrograms, attributions: nextAttributions, fraudFlags: nextFraudFlags, leaderboard: nextLeaderboard } = await getReferralEngineSummary();

      setPrograms(nextPrograms);
      setAttributions(nextAttributions);
      setFraudFlags(nextFraudFlags);
      setLeaderboard(nextLeaderboard);
      setSelectedSlug(nextProgram.slug);
      setSaveMessage('Referral backend saved and reloaded from Supabase.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Unable to save the referral program.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-transition space-y-6 p-6">
      <Card className="border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--chart-1)/0.14),transparent_32%),linear-gradient(135deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-sm uppercase tracking-[0.35em] text-accent/70">Growth loops</p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">Referral settings</h1>
            <p className="text-base text-muted">Manage referral links, referral codes, multi-level commissions, campaign-specific referrals, milestones, leaderboards, bonuses, and fraud controls from live Supabase tables.</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-muted">
            <p>Backend status</p>
            <p className="mt-1 text-foreground">{syncMessage}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => (
          <Card key={item.label} className="border border-border bg-surface-elevated">
            <p className="text-sm text-muted">{item.label}</p>
            <p className="mt-3 text-3xl font-bold text-foreground">{item.value}</p>
            <p className="mt-2 text-sm text-muted">{item.note}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Program editor</p>
            <h2 className="mt-2 text-3xl font-semibold text-foreground">Referral program configuration</h2>
            <p className="mt-2 max-w-3xl text-muted">The selected program persists to the new referral backend table and drives commissions, milestones, and fraud configuration.</p>
          </div>

          <label className="grid gap-2 lg:min-w-[18rem]">
            <span className="text-sm text-muted">Select program</span>
            <select className="input-base" value={selectedSlug} onChange={(event) => setSelectedSlug(event.target.value)}>
              {!programs.length ? (
                <option value={defaultProgramDraft.slug}>{defaultProgramDraft.name}</option>
              ) : null}
              {programs.map((program) => (
                <option key={program.slug} value={program.slug}>
                  {program.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm text-muted">Slug</span>
            <input className="input-base" value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Name</span>
            <input className="input-base" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="grid gap-2 lg:col-span-2">
            <span className="text-sm text-muted">Description</span>
            <textarea className="input-base min-h-24" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Campaign slug</span>
            <input className="input-base" value={draft.campaignSlug} onChange={(event) => setDraft((current) => ({ ...current, campaignSlug: event.target.value }))} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Status</span>
            <select className="input-base" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="draft">draft</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Invite bonus</span>
            <input className="input-base" type="number" min="0" step="0.01" value={draft.inviteBonusAmount} onChange={(event) => setDraft((current) => ({ ...current, inviteBonusAmount: Number(event.target.value) }))} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Tier-1 commission %</span>
            <input className="input-base" type="number" min="0" step="0.01" value={draft.tierOneCommissionPercent} onChange={(event) => setDraft((current) => ({ ...current, tierOneCommissionPercent: Number(event.target.value) }))} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Tier-2 commission %</span>
            <input className="input-base" type="number" min="0" step="0.01" value={draft.tierTwoCommissionPercent} onChange={(event) => setDraft((current) => ({ ...current, tierTwoCommissionPercent: Number(event.target.value) }))} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Qualification window days</span>
            <input className="input-base" type="number" min="0" step="1" value={draft.qualificationWindowDays} onChange={(event) => setDraft((current) => ({ ...current, qualificationWindowDays: Number(event.target.value) }))} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Payout delay days</span>
            <input className="input-base" type="number" min="0" step="1" value={draft.payoutDelayDays} onChange={(event) => setDraft((current) => ({ ...current, payoutDelayDays: Number(event.target.value) }))} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Max tier depth</span>
            <input className="input-base" type="number" min="1" step="1" value={draft.maxTierDepth} onChange={(event) => setDraft((current) => ({ ...current, maxTierDepth: Number(event.target.value) }))} />
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm text-muted">Milestones JSON</span>
            <textarea className="input-base min-h-56 font-mono text-sm" value={milestoneText} onChange={(event) => setMilestoneText(event.target.value)} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Leaderboard JSON</span>
            <textarea className="input-base min-h-56 font-mono text-sm" value={leaderboardText} onChange={(event) => setLeaderboardText(event.target.value)} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Fraud JSON</span>
            <textarea className="input-base min-h-56 font-mono text-sm" value={fraudText} onChange={(event) => setFraudText(event.target.value)} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Analytics JSON</span>
            <textarea className="input-base min-h-56 font-mono text-sm" value={analyticsText} onChange={(event) => setAnalyticsText(event.target.value)} />
          </label>
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm text-muted">Metadata JSON</span>
            <textarea className="input-base min-h-44 font-mono text-sm" value={metadataText} onChange={(event) => setMetadataText(event.target.value)} />
          </label>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-muted">{saveMessage || 'Saving updates here changes the real referral backend tables, triggers commissions, and refreshes leaderboard snapshots.'}</p>
          <Button onClick={() => void saveProgram()} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save referral program'}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Attributions</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Recent referral signups</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-3 pr-4">Code</th>
                  <th className="py-3 pr-4">Referrer</th>
                  <th className="py-3 pr-4">Referred</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {attributions.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 text-foreground last:border-0">
                    <td className="py-3 pr-4 font-medium">{item.referralCode}</td>
                    <td className="py-3 pr-4">{item.referrerProfileId}</td>
                    <td className="py-3 pr-4">{item.referredProfileId}</td>
                    <td className="py-3 pr-4">{item.qualificationStatus}</td>
                    <td className="py-3 pr-4 text-muted">{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
                {!attributions.length ? (
                  <tr>
                    <td className="py-6 text-muted" colSpan={5}>
                      No referral signups have been written yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Fraud and leaderboard</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Risk flags and rankings</h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="py-3 pl-4 pr-4">Rule</th>
                    <th className="py-3 pr-4">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {fraudFlags.map((item) => (
                    <tr key={item.id} className="border-b border-border/60 text-foreground last:border-0">
                      <td className="py-3 pl-4 pr-4">
                        <p className="font-medium">{item.ruleKey}</p>
                        <p className="text-xs text-muted">{item.severity} / {item.status}</p>
                      </td>
                      <td className="py-3 pr-4 text-muted">{item.signal}</td>
                    </tr>
                  ))}
                  {!fraudFlags.length ? (
                    <tr>
                      <td className="py-6 pl-4 text-muted" colSpan={2}>
                        No fraud flags have been recorded.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="py-3 pl-4 pr-4">Profile</th>
                    <th className="py-3 pr-4">Referrals</th>
                    <th className="py-3 pr-4">Commissions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((item) => (
                    <tr key={item.id} className="border-b border-border/60 text-foreground last:border-0">
                      <td className="py-3 pl-4 pr-4">
                        <p className="font-medium">{item.profileId}</p>
                        <p className="text-xs text-muted">{item.periodKey} #{item.rank ?? '-'}</p>
                      </td>
                      <td className="py-3 pr-4">{item.referralCount}</td>
                      <td className="py-3 pr-4">{formatMoney(item.commissionTotal)}</td>
                    </tr>
                  ))}
                  {!leaderboard.length ? (
                    <tr>
                      <td className="py-6 pl-4 text-muted" colSpan={3}>
                        Leaderboard snapshots appear after referral commissions are recorded.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}