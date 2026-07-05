import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  referralOpsReviewPresets,
  listReferralOpsReviewState,
  updateReferralOpsReviewState,
  type ReferralOpsReviewState,
} from '@/services/api/admin';
import {
  buildReferralBackfillValidationChecks,
  getReferralOpsSummary,
  getReferralCommissionReleaseWindow,
  getReferralCommissionApprovalPolicy,
  updateReferralCommissionStatus,
  updateReferralFraudFlagStatus,
  type ReferralAttribution,
  type ReferralCommissionLedgerItem,
  type ReferralFraudFlag,
  type ReferralLeaderboardSnapshot,
  type ReferralProgram,
} from '@/services/api/referrals';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function statusClass(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized.includes('paid') || normalized.includes('available') || normalized.includes('resolved')) {
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  }

  if (normalized.includes('held') || normalized.includes('pending') || normalized.includes('investigating') || normalized.includes('open')) {
    return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  }

  if (normalized.includes('blocked')) {
    return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  }

  return 'border-white/10 bg-white/5 text-mist/80';
}

function toCsv(rows: Array<Record<string, string | number | null | undefined>>): string {
  if (!rows.length) return 'No data\n';

  const headers = Object.keys(rows[0]);
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => {
      const value = row[header] ?? '';
      const raw = String(value);
      return raw.includes(',') || raw.includes('"') || raw.includes('\n') ? `"${raw.replace(/"/g, '""')}"` : raw;
    }).join(',')),
  ].join('\n');
}

type OpsSummary = {
  programs: ReferralProgram[];
  attributions: ReferralAttribution[];
  commissions: ReferralCommissionLedgerItem[];
  fraudFlags: ReferralFraudFlag[];
  leaderboard: ReferralLeaderboardSnapshot[];
};

export function ReferralOpsPage(): JSX.Element {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<OpsSummary>({ programs: [], attributions: [], commissions: [], fraudFlags: [], leaderboard: [] });
  const [syncMessage, setSyncMessage] = useState('Loading referral operations...');
  const [actionMessage, setActionMessage] = useState('');
  const [isSavingId, setIsSavingId] = useState<string | null>(null);
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<'all' | 'pending' | 'held' | 'available' | 'paid'>('all');
  const [fraudStatusFilter, setFraudStatusFilter] = useState<'all' | 'open' | 'investigating' | 'resolved' | 'blocked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('custom');

  useEffect(() => {
    let active = true;

    void Promise.all([getReferralOpsSummary(), listReferralOpsReviewState()])
      .then(([nextSummary, reviewState]) => {
        if (!active) return;
        setSummary(nextSummary);
        setCommissionStatusFilter(reviewState.commissionStatusFilter);
        setFraudStatusFilter(reviewState.fraudStatusFilter);
        setSearchQuery(reviewState.searchQuery);
        setSelectedPreset(reviewState.selectedPreset);
        setSyncMessage('Referral ops synced from Supabase.');
      })
      .catch(() => {
        if (!active) return;
        setSyncMessage('Unable to load referral ops right now.');
      });

    return () => {
      active = false;
    };
  }, []);

  const pendingCommissions = useMemo(() => summary.commissions.filter((item) => item.status === 'pending'), [summary.commissions]);
  const heldCommissions = useMemo(() => summary.commissions.filter((item) => item.status === 'held'), [summary.commissions]);
  const openFraudFlags = useMemo(() => summary.fraudFlags.filter((item) => item.status === 'open' || item.status === 'investigating'), [summary.fraudFlags]);

  const searchableCommissions = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return summary.commissions.filter((item) => {
      const matchesStatus = commissionStatusFilter === 'all' || item.status === commissionStatusFilter;
      const searchable = [item.beneficiaryProfileId, item.commissionKind, item.status, item.note ?? '', item.currency].join(' ').toLowerCase();
      const matchesSearch = search.length === 0 || searchable.includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [commissionStatusFilter, searchQuery, summary.commissions]);

  const searchableFraudFlags = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return summary.fraudFlags.filter((item) => {
      const matchesStatus = fraudStatusFilter === 'all' || item.status === fraudStatusFilter;
      const searchable = [item.ruleKey, item.signal, item.severity, item.status].join(' ').toLowerCase();
      const matchesSearch = search.length === 0 || searchable.includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [fraudStatusFilter, searchQuery, summary.fraudFlags]);

  const backfillChecks = useMemo(
    () => buildReferralBackfillValidationChecks({
      programs: summary.programs,
      attributions: summary.attributions,
      fraudFlags: summary.fraudFlags,
      leaderboard: summary.leaderboard,
    }),
    [summary.attributions, summary.fraudFlags, summary.leaderboard, summary.programs],
  );

  const exportCommissions = (): void => {
    const rows = searchableCommissions.map((item) => ({
      beneficiary_profile_id: item.beneficiaryProfileId,
      tier_depth: item.tierDepth,
      commission_kind: item.commissionKind,
      amount: item.amount,
      currency: item.currency,
      status: item.status,
      created_at: item.createdAt,
    }));
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'referral-commissions.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportFraudFlags = (): void => {
    const rows = searchableFraudFlags.map((item) => ({
      rule_key: item.ruleKey,
      severity: item.severity,
      status: item.status,
      signal: item.signal,
      created_at: item.createdAt,
    }));
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'referral-fraud-flags.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveFilters = async (): Promise<void> => {
    const filters: ReferralOpsReviewState = {
      commissionStatusFilter,
      fraudStatusFilter,
      searchQuery,
      selectedPreset,
    };

    try {
      await updateReferralOpsReviewState(filters, profile?.id);
      setActionMessage('Saved shared referral filter set to Supabase.');
    } catch {
      setActionMessage('Unable to save the shared referral filter set.');
    }
  };

  const restoreFilters = async (): Promise<void> => {
    try {
      const filters = await listReferralOpsReviewState();
      setCommissionStatusFilter(filters.commissionStatusFilter);
      setFraudStatusFilter(filters.fraudStatusFilter);
      setSearchQuery(filters.searchQuery);
      setSelectedPreset(filters.selectedPreset);
      setActionMessage('Restored the shared referral filter set from Supabase.');
    } catch {
      setActionMessage('Unable to restore the shared referral filter set.');
    }
  };

  const applyPreset = async (presetKey: string): Promise<void> => {
    const preset = referralOpsReviewPresets.find((entry) => entry.key === presetKey);
    if (!preset) {
      setActionMessage('Unknown referral review preset.');
      return;
    }

    setCommissionStatusFilter(preset.state.commissionStatusFilter);
    setFraudStatusFilter(preset.state.fraudStatusFilter);
    setSearchQuery(preset.state.searchQuery);
    setSelectedPreset(preset.key);

    try {
      await updateReferralOpsReviewState({ ...preset.state, selectedPreset: preset.key }, profile?.id);
      setActionMessage(`Applied the ${preset.label.toLowerCase()} preset.`);
    } catch {
      setActionMessage('Unable to save the selected referral review preset.');
    }
  };

  const refresh = async (): Promise<void> => {
    const nextSummary = await getReferralOpsSummary();
    setSummary(nextSummary);
  };

  const updateCommission = async (commissionId: string, status: 'available' | 'held' | 'paid' | 'pending'): Promise<void> => {
    setIsSavingId(commissionId);
    setActionMessage('');

    try {
      await updateReferralCommissionStatus(commissionId, status, status === 'held' ? 'Held for review' : status === 'paid' ? 'Marked paid from ops console' : undefined);
      await refresh();
      setActionMessage(`Commission ${commissionId} updated to ${status}.`);
    } catch {
      setActionMessage('Unable to update the selected commission.');
    } finally {
      setIsSavingId(null);
    }
  };

  const getCommissionReleaseWindow = (commission: ReferralCommissionLedgerItem) => {
    const program = summary.programs.find((entry) => entry.id === commission.programId);
    if (!program) {
      return { unlockAt: commission.createdAt, eligible: true };
    }

    return getReferralCommissionReleaseWindow(commission.createdAt, program.payoutDelayDays);
  };

  const getCommissionPolicy = (commission: ReferralCommissionLedgerItem) => {
    const program = summary.programs.find((entry) => entry.id === commission.programId);
    if (!program) {
      return {
        releaseWindow: { unlockAt: commission.createdAt, eligible: true },
        requiresHold: false,
        requiresEscalation: false,
        canRelease: true,
        reason: 'Program metadata unavailable.',
      };
    }

    return getReferralCommissionApprovalPolicy({
      commissionCreatedAt: commission.createdAt,
      payoutDelayDays: program.payoutDelayDays,
      amount: commission.amount,
      status: commission.status,
      holdThreshold: program.inviteBonusAmount * 50,
      escalationThreshold: program.inviteBonusAmount * 250,
    });
  };

  const updateFraudFlag = async (flagId: string, status: 'open' | 'investigating' | 'resolved' | 'blocked'): Promise<void> => {
    setIsSavingId(flagId);
    setActionMessage('');

    try {
      await updateReferralFraudFlagStatus(flagId, status);
      await refresh();
      setActionMessage(`Fraud flag ${flagId} updated to ${status}.`);
    } catch {
      setActionMessage('Unable to update the selected fraud flag.');
    } finally {
      setIsSavingId(null);
    }
  };

  return (
    <div className="page-transition space-y-6 p-6">
      <Card className="border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--chart-1)/0.14),transparent_32%),linear-gradient(135deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-sm uppercase tracking-[0.35em] text-accent/70">Referral operations</p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">Commission and risk review</h1>
            <p className="text-base text-muted">Review pending commissions, hold payouts, resolve fraud flags, and inspect leaderboard snapshots from the new referral backend.</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-muted">
            <p>Backend status</p>
            <p className="mt-1 text-foreground">{syncMessage}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Programs</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{summary.programs.length}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Pending commissions</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{pendingCommissions.length}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Held commissions</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{heldCommissions.length}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Open fraud flags</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{openFraudFlags.length}</p>
        </Card>
      </div>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Commission workflow</p>
          <h2 className="mt-2 text-3xl font-semibold text-foreground">Review and approve payouts</h2>
          <p className="mt-2 max-w-3xl text-muted">Use hold, release, and paid actions to move referral commissions through an explicit review workflow.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {referralOpsReviewPresets.map((preset) => (
            <Button
              key={preset.key}
              variant={selectedPreset === preset.key ? 'default' : 'ghost'}
              className="h-auto justify-start px-4 py-3 text-left"
              onClick={() => void applyPreset(preset.key)}
            >
              <span className="block">
                <span className="block text-sm font-semibold">{preset.label}</span>
                <span className="block text-xs opacity-80">{preset.description}</span>
              </span>
            </Button>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Search</span>
            <input className="input-base" placeholder="beneficiary, status, kind" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSelectedPreset('custom'); }} />
          </label>
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Commission status</span>
            <select className="input-base" value={commissionStatusFilter} onChange={(event) => { setCommissionStatusFilter(event.target.value as typeof commissionStatusFilter); setSelectedPreset('custom'); }}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="held">Held</option>
              <option value="available">Available</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <Button variant="ghost" onClick={saveFilters}>Save filters</Button>
          <Button variant="ghost" onClick={restoreFilters}>Restore filters</Button>
          <Button variant="ghost" onClick={exportCommissions}>Export commissions</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-3 pr-4">Beneficiary</th>
                <th className="py-3 pr-4">Tier</th>
                <th className="py-3 pr-4">Amount</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Created</th>
                <th className="py-3 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {searchableCommissions.map((commission) => {
                const releaseWindow = getCommissionReleaseWindow(commission);
                const policy = getCommissionPolicy(commission);

                return (
                <tr key={commission.id} className="border-b border-border/60 text-foreground last:border-0">
                  <td className="py-3 pr-4 font-medium">{commission.beneficiaryProfileId}</td>
                  <td className="py-3 pr-4">Tier {commission.tierDepth}</td>
                  <td className="py-3 pr-4">{formatMoney(commission.amount)}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${statusClass(commission.status)}`}>
                      {commission.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-muted">{formatDate(commission.createdAt)}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" className="px-3 py-1 text-xs" disabled={isSavingId === commission.id} onClick={() => void updateCommission(commission.id, 'held')}>
                        Hold
                      </Button>
                      <Button variant="ghost" className="px-3 py-1 text-xs" disabled={isSavingId === commission.id || !policy.canRelease} onClick={() => void updateCommission(commission.id, 'available')}>
                        Release
                      </Button>
                      <Button className="px-3 py-1 text-xs" disabled={isSavingId === commission.id} onClick={() => void updateCommission(commission.id, 'paid')}>
                        Mark paid
                      </Button>
                    </div>
                    {!releaseWindow.eligible ? <p className="mt-2 text-xs text-muted">Release unlocks after {formatDate(releaseWindow.unlockAt)}.</p> : null}
                    <p className="mt-1 text-xs text-muted">{policy.reason}</p>
                    {policy.requiresHold ? <p className="mt-1 text-xs text-amber-300">Hold review required before release.</p> : null}
                    {policy.requiresEscalation ? <p className="mt-1 text-xs text-rose-300">Escalation required before payout.</p> : null}
                  </td>
                </tr>
                );
              })}
              {!searchableCommissions.length ? (
                <tr>
                  <td className="py-6 text-muted" colSpan={6}>
                    No referral commissions match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Backfill validation</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Migration sanity checks</h2>
          <p className="mt-2 max-w-3xl text-muted">Verify that the seeded referral program, backfilled attributions, fraud flags, and leaderboard snapshots are present in Supabase.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {backfillChecks.map((check) => (
            <div key={check.key} className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-medium text-foreground">{check.label}</p>
              <p className={`mt-2 text-sm ${check.passed ? 'text-emerald-300' : 'text-amber-300'}`}>{check.passed ? 'Pass' : 'Review required'}</p>
              <p className="mt-2 text-xs text-muted">{check.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Fraud workflow</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Open review flags</h2>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Fraud status</span>
              <select className="input-base" value={fraudStatusFilter} onChange={(event) => { setFraudStatusFilter(event.target.value as typeof fraudStatusFilter); setSelectedPreset('custom'); }}>
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
            <Button variant="ghost" onClick={exportFraudFlags}>Export fraud flags</Button>
          </div>

          <div className="space-y-3">
            {searchableFraudFlags.map((flag) => (
              <div key={flag.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{flag.ruleKey}</p>
                    <p className="text-sm text-muted">{flag.signal}</p>
                    <p className="mt-1 text-xs text-muted">{flag.severity} / {flag.status}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" className="px-3 py-1 text-xs" disabled={isSavingId === flag.id} onClick={() => void updateFraudFlag(flag.id, 'investigating')}>
                      Investigate
                    </Button>
                    <Button variant="ghost" className="px-3 py-1 text-xs" disabled={isSavingId === flag.id} onClick={() => void updateFraudFlag(flag.id, 'resolved')}>
                      Resolve
                    </Button>
                    <Button className="px-3 py-1 text-xs" disabled={isSavingId === flag.id} onClick={() => void updateFraudFlag(flag.id, 'blocked')}>
                      Block
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {!searchableFraudFlags.length ? <p className="text-sm text-muted">No fraud flags match the current filters.</p> : null}
          </div>
        </Card>

        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Leaderboard</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Recent ranking snapshots</h2>
          </div>

          <div className="space-y-3">
            {summary.leaderboard.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{entry.profileId}</p>
                  <span className="text-sm text-muted">#{entry.rank ?? '-'}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{entry.periodKey} • {entry.referralCount} referrals • {formatMoney(entry.commissionTotal)}</p>
              </div>
            ))}
            {!summary.leaderboard.length ? <p className="text-sm text-muted">No leaderboard snapshots yet.</p> : null}
          </div>
        </Card>
      </div>

      <p className="text-sm text-muted">{actionMessage || 'Changes update the referral backend tables and the analytics page will reflect them on the next refresh.'}</p>
    </div>
  );
}