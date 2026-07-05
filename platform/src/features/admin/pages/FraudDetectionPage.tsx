import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  defaultFraudThresholds,
  extractFraudThresholdsFromAuditEntry,
  evaluateFraudProfile,
  explainFraudAssessment,
  fraudSignalDefinitions,
  listFraudDetectionConfig,
  listFraudPolicyAuditTrail,
  updateFraudDetectionConfig,
  type FraudAssessment,
  type FraudDecision,
  type FraudThresholds,
  type FraudPolicyAuditEntry,
  type FraudUserProfile,
} from '@/services/api/fraud';
type ScoredUser = FraudAssessment;

const userProfiles: FraudUserProfile[] = [
  {
    id: 'usr-901',
    name: 'Maya Ortiz',
    email: 'maya@investpro.com',
    campaign: 'Video watch rewards',
    country: 'US',
    device: 'iPhone 15 · Safari',
    ipGroup: 'IP-14A',
    watchTimeMinutes: 9.6,
    clicksPerMinute: 4,
    refreshesPerMinute: 1,
    automationConfidence: 12,
    sharedIpAccounts: 1,
    deviceReuseCount: 1,
    linkedAccounts: 1,
    referralLoopScore: 18,
    vpn: false,
    proxy: false,
    emulator: false,
    bot: false,
    suspiciousReferrals: false,
    lastSeen: '2026-07-05T09:12:00.000Z',
  },
  {
    id: 'usr-772',
    name: 'Noah Blake',
    email: 'noah@growthloop.example',
    campaign: 'Referral sprint',
    country: 'NL',
    device: 'Android emulator · Chrome',
    ipGroup: 'IP-82C',
    watchTimeMinutes: 1.1,
    clicksPerMinute: 14,
    refreshesPerMinute: 6,
    automationConfidence: 91,
    sharedIpAccounts: 4,
    deviceReuseCount: 3,
    linkedAccounts: 5,
    referralLoopScore: 88,
    vpn: true,
    proxy: true,
    emulator: true,
    bot: true,
    suspiciousReferrals: true,
    lastSeen: '2026-07-05T08:57:00.000Z',
  },
  {
    id: 'usr-644',
    name: 'Ava Chen',
    email: 'ava@investpro.com',
    campaign: 'Launch teaser',
    country: 'US',
    device: 'Windows desktop · Edge',
    ipGroup: 'IP-14A',
    watchTimeMinutes: 3.8,
    clicksPerMinute: 8,
    refreshesPerMinute: 4,
    automationConfidence: 62,
    sharedIpAccounts: 2,
    deviceReuseCount: 2,
    linkedAccounts: 2,
    referralLoopScore: 54,
    vpn: false,
    proxy: true,
    emulator: false,
    bot: false,
    suspiciousReferrals: false,
    lastSeen: '2026-07-05T09:04:00.000Z',
  },
  {
    id: 'usr-118',
    name: 'Ethan Park',
    email: 'ethan@creatorgrid.example',
    campaign: 'Rewarded views',
    country: 'PH',
    device: 'Android phone · Chrome',
    ipGroup: 'IP-21F',
    watchTimeMinutes: 0.7,
    clicksPerMinute: 18,
    refreshesPerMinute: 7,
    automationConfidence: 84,
    sharedIpAccounts: 3,
    deviceReuseCount: 2,
    linkedAccounts: 3,
    referralLoopScore: 71,
    vpn: false,
    proxy: false,
    emulator: false,
    bot: true,
    suspiciousReferrals: true,
    lastSeen: '2026-07-05T08:49:00.000Z',
  },
  {
    id: 'usr-409',
    name: 'Liam Turner',
    email: 'liam@partnerlinks.example',
    campaign: 'Partner referrals',
    country: 'CA',
    device: 'MacBook Pro · Safari',
    ipGroup: 'IP-33D',
    watchTimeMinutes: 6.4,
    clicksPerMinute: 5,
    refreshesPerMinute: 1,
    automationConfidence: 35,
    sharedIpAccounts: 1,
    deviceReuseCount: 1,
    linkedAccounts: 4,
    referralLoopScore: 79,
    vpn: false,
    proxy: false,
    emulator: false,
    bot: false,
    suspiciousReferrals: true,
    lastSeen: '2026-07-05T09:01:00.000Z',
  },
];

function formatTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatScore(score: number): string {
  return `${Math.max(0, Math.min(100, Math.round(score)))} / 100`;
}

function decisionTone(decision: FraudDecision): string {
  switch (decision) {
    case 'Block':
      return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
    case 'Quarantine':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
    case 'Review':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-300';
    default:
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  }
}

function scoreTone(score: number, thresholds: FraudThresholds): string {
  if (score >= thresholds.block) {
    return 'text-rose-300';
  }

  if (score >= thresholds.quarantine) {
    return 'text-amber-300';
  }

  if (score >= thresholds.review) {
    return 'text-sky-300';
  }

  return 'text-emerald-300';
}

export function FraudDetectionPage(): JSX.Element {
  const { profile } = useAuth();
  const [thresholds, setThresholds] = useState<FraudThresholds>(defaultFraudThresholds);
  const [syncMessage, setSyncMessage] = useState('Loading fraud engine policy...');
  const [saveMessage, setSaveMessage] = useState('');
  const [rollbackMessage, setRollbackMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [policyAuditTrail, setPolicyAuditTrail] = useState<FraudPolicyAuditEntry[]>([]);

  useEffect(() => {
    let active = true;

    void listFraudDetectionConfig()
      .then((config) => {
        if (!active) return;

        setThresholds(config.thresholds);
        setSyncMessage(config.savedAt ? `Synced policy from Supabase. Last saved ${formatTime(config.savedAt)}.` : 'Loaded default fraud policy from Supabase settings.');
      })
      .catch(() => {
        if (!active) return;
        setSyncMessage('Using local defaults until the fraud policy can be loaded from Supabase.');
      });

    void listFraudPolicyAuditTrail()
      .then((entries) => {
        if (active) {
          setPolicyAuditTrail(entries);
        }
      })
      .catch(() => {
        if (active) {
          setPolicyAuditTrail([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const saveThresholds = async (): Promise<void> => {
    setIsSaving(true);
    setSaveMessage('');
    setRollbackMessage('');

    try {
      await updateFraudDetectionConfig(thresholds, profile?.id);
      const config = await listFraudDetectionConfig();
      setThresholds(config.thresholds);
      setSyncMessage(config.savedAt ? `Synced policy from Supabase. Last saved ${formatTime(config.savedAt)}.` : 'Saved fraud policy to Supabase.');
      setSaveMessage('Fraud policy saved to Supabase.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Unable to save the fraud policy.');
    } finally {
      setIsSaving(false);
    }
  };

  const reloadPolicyState = async (): Promise<void> => {
    const [config, auditTrail] = await Promise.all([listFraudDetectionConfig(), listFraudPolicyAuditTrail()]);
    setThresholds(config.thresholds);
    setPolicyAuditTrail(auditTrail);
    setSyncMessage(config.savedAt ? `Synced policy from Supabase. Last saved ${formatTime(config.savedAt)}.` : 'Loaded default fraud policy from Supabase settings.');
  };

  const rollbackToAuditEntry = async (entry: FraudPolicyAuditEntry): Promise<void> => {
    const previousThresholds = extractFraudThresholdsFromAuditEntry(entry);

    if (!previousThresholds) {
      setRollbackMessage('This audit record does not include a restorable policy snapshot.');
      return;
    }

    setIsRollingBack(true);
    setSaveMessage('');
    setRollbackMessage('');

    try {
      await updateFraudDetectionConfig(previousThresholds, profile?.id);
      await reloadPolicyState();
      setRollbackMessage('Fraud policy restored from the selected audit entry.');
    } catch (error) {
      setRollbackMessage(error instanceof Error ? error.message : 'Unable to restore the fraud policy snapshot.');
    } finally {
      setIsRollingBack(false);
    }
  };

  const scoredUsers = useMemo(() => userProfiles.map((user) => evaluateFraudProfile(user, thresholds)), [thresholds]);
  const previewUsers = useMemo(() => scoredUsers.slice(0, 3), [scoredUsers]);
  const previewExplanations = useMemo(
    () => previewUsers.map((user) => ({ user, explanation: explainFraudAssessment(user, thresholds) })),
    [previewUsers, thresholds],
  );
  const recentPolicyEvents = useMemo(() => policyAuditTrail.slice(0, 4), [policyAuditTrail]);
  const stats = useMemo(() => {
    const monitored = scoredUsers.filter((user) => user.decision === 'Monitor').length;
    const underReview = scoredUsers.filter((user) => user.decision === 'Review').length;
    const quarantined = scoredUsers.filter((user) => user.decision === 'Quarantine').length;
    const blocked = scoredUsers.filter((user) => user.decision === 'Block').length;
    const average = scoredUsers.reduce((total, user) => total + user.score, 0) / scoredUsers.length;

    return { monitored, underReview, quarantined, blocked, average };
  }, [scoredUsers]);

  return (
    <div className="space-y-6 p-6">
      <Card className="overflow-hidden border border-white/5 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.18),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.16),_transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(3,7,18,0.96))]">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.35em] text-amber-300/80">Trust and safety</p>
          <div className="max-w-4xl space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Fraud prevention engine</h1>
            <p className="text-base text-slate-300">
              Score every user, surface suspicious behavior in real time, and tune enforcement thresholds without leaving
              the admin console. This covers VPN, proxy, emulator, bot, duplicate IP, device fingerprint, rapid
              clicking, fake watch time, auto refresh, automation, multiple accounts, and suspicious referral loops.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
            <p>Backend status</p>
            <p className="mt-1 text-white">{syncMessage}</p>
            {saveMessage ? <p className="mt-1 text-emerald-300">{saveMessage}</p> : null}
            {rollbackMessage ? <p className="mt-1 text-amber-300">{rollbackMessage}</p> : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-slate-400">Users scored</p>
          <p className="mt-2 text-3xl font-bold text-white">{scoredUsers.length}</p>
          <p className="mt-1 text-xs text-slate-400">Every profile is re-evaluated when thresholds change.</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-slate-400">Average score</p>
          <p className={`mt-2 text-3xl font-bold ${scoreTone(stats.average, thresholds)}`}>{formatScore(stats.average)}</p>
          <p className="mt-1 text-xs text-slate-400">Lower is safer, higher is more suspicious.</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-slate-400">Quarantined</p>
          <p className="mt-2 text-3xl font-bold text-amber-300">{stats.quarantined}</p>
          <p className="mt-1 text-xs text-slate-400">Scores between quarantine and block thresholds.</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-slate-400">Blocked</p>
          <p className="mt-2 text-3xl font-bold text-rose-300">{stats.blocked}</p>
          <p className="mt-1 text-xs text-slate-400">Scores above the block threshold are auto-blocked.</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-4 border border-white/5 bg-white/5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white">Threshold controls</h2>
              <p className="text-sm text-slate-400">Adjust the policy without redeploying the engine.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="ghost" onClick={() => setThresholds(defaultFraudThresholds)}>
                Reset defaults
              </Button>
              <Button type="button" onClick={() => void saveThresholds()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save policy'}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Review threshold</span>
              <input
                className="input-base"
                type="number"
                min={0}
                max={100}
                value={thresholds.review}
                onChange={(event) => setThresholds((current) => ({ ...current, review: Number(event.target.value) }))}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Quarantine threshold</span>
              <input
                className="input-base"
                type="number"
                min={0}
                max={100}
                value={thresholds.quarantine}
                onChange={(event) => setThresholds((current) => ({ ...current, quarantine: Number(event.target.value) }))}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Block threshold</span>
              <input
                className="input-base"
                type="number"
                min={0}
                max={100}
                value={thresholds.block}
                onChange={(event) => setThresholds((current) => ({ ...current, block: Number(event.target.value) }))}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Minimum watch time</span>
              <input
                className="input-base"
                type="number"
                min={0}
                step={0.5}
                value={thresholds.watchTimeMinutes}
                onChange={(event) =>
                  setThresholds((current) => ({ ...current, watchTimeMinutes: Number(event.target.value) }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Rapid clicks per minute</span>
              <input
                className="input-base"
                type="number"
                min={0}
                value={thresholds.rapidClicksPerMinute}
                onChange={(event) =>
                  setThresholds((current) => ({ ...current, rapidClicksPerMinute: Number(event.target.value) }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Auto refreshes per minute</span>
              <input
                className="input-base"
                type="number"
                min={0}
                value={thresholds.autoRefreshesPerMinute}
                onChange={(event) =>
                  setThresholds((current) => ({ ...current, autoRefreshesPerMinute: Number(event.target.value) }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Shared IP limit</span>
              <input
                className="input-base"
                type="number"
                min={1}
                value={thresholds.sharedIpLimit}
                onChange={(event) => setThresholds((current) => ({ ...current, sharedIpLimit: Number(event.target.value) }))}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Device reuse limit</span>
              <input
                className="input-base"
                type="number"
                min={1}
                value={thresholds.deviceReuseLimit}
                onChange={(event) =>
                  setThresholds((current) => ({ ...current, deviceReuseLimit: Number(event.target.value) }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Linked account limit</span>
              <input
                className="input-base"
                type="number"
                min={1}
                value={thresholds.linkedAccountLimit}
                onChange={(event) =>
                  setThresholds((current) => ({ ...current, linkedAccountLimit: Number(event.target.value) }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Automation confidence</span>
              <input
                className="input-base"
                type="number"
                min={0}
                max={100}
                value={thresholds.automationConfidence}
                onChange={(event) =>
                  setThresholds((current) => ({ ...current, automationConfidence: Number(event.target.value) }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Referral loop score</span>
              <input
                className="input-base"
                type="number"
                min={0}
                max={100}
                value={thresholds.referralLoopScore}
                onChange={(event) =>
                  setThresholds((current) => ({ ...current, referralLoopScore: Number(event.target.value) }))
                }
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Review band</p>
              <p className="mt-2 text-lg font-semibold text-white">{thresholds.review}+ risk score</p>
              <p className="mt-1 text-sm text-slate-400">Send to a manual reviewer.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Quarantine band</p>
              <p className="mt-2 text-lg font-semibold text-white">{thresholds.quarantine}+ risk score</p>
              <p className="mt-1 text-sm text-slate-400">Pause rewards and investigate.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Block band</p>
              <p className="mt-2 text-lg font-semibold text-white">{thresholds.block}+ risk score</p>
              <p className="mt-1 text-sm text-slate-400">Reject or freeze the account.</p>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 border border-white/5 bg-white/5">
          <div>
            <h2 className="text-2xl font-bold text-white">Detection coverage</h2>
            <p className="text-sm text-slate-400">The engine continuously scores these signals for every profile.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {signalDefinitions.map((signal) => (
              <div key={signal.key} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{signal.label}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{signal.category}</p>
                  </div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                    Active
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-400">{signal.description}</p>
                <p className="mt-3 text-xs text-slate-500">Base penalty: {signal.weight} points</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Policy preview</h3>
                <p className="text-sm text-slate-400">How the current thresholds score representative users before you save them.</p>
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Live with current policy</p>
            </div>

            <div className="mt-4 space-y-3">
              {previewExplanations.map(({ user, explanation }) => (
                <div key={user.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{user.name}</p>
                      <p className="text-xs text-slate-400">

                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Policy audit trail</h3>
                      <p className="text-sm text-slate-400">Saved threshold changes and the reason the admin provided when they were written.</p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">admin_action_audit</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {recentPolicyEvents.length ? (
                      recentPolicyEvents.map((entry) => (
                        <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{entry.action.split('_').join(' ')}</p>
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{entry.resourceId}</p>
                            </div>
                            <p className="text-xs text-slate-400">{entry.createdAt ? formatTime(entry.createdAt) : 'Unknown time'}</p>
                          </div>
                          <p className="mt-2 text-sm text-slate-300">{entry.reason}</p>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-slate-500">Admin: {entry.adminId ?? 'system'}</p>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => void rollbackToAuditEntry(entry)}
                              disabled={isSaving || isRollingBack}
                            >
                              {isRollingBack ? 'Restoring...' : 'Rollback'}
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                        No fraud policy audit events are available yet.
                      </p>
                    )}
                  </div>
                </div>
                        {user.campaign} · {user.country} · {user.device}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-semibold ${scoreTone(user.score, thresholds)}`}>{formatScore(user.score)}</p>
                      <p className={`text-xs uppercase tracking-[0.2em] ${decisionTone(user.decision)}`}>{user.decision}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{explanation.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {explanation.reasons.length ? (
                      explanation.reasons.slice(0, 4).map((reason) => (
                        <span key={reason} className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                          {reason}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                        No active signals
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card className="space-y-4 border border-white/5 bg-white/5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">User risk ledger</h2>
            <p className="text-sm text-slate-400">Every user gets a live fraud score and a clear enforcement decision.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
              <p className="text-slate-400">Monitor</p>
              <p className="font-semibold text-emerald-300">{stats.monitored}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
              <p className="text-slate-400">Review</p>
              <p className="font-semibold text-sky-300">{stats.underReview}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
              <p className="text-slate-400">Quarantine</p>
              <p className="font-semibold text-amber-300">{stats.quarantined}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
              <p className="text-slate-400">Block</p>
              <p className="font-semibold text-rose-300">{stats.blocked}</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Context</th>
                <th className="px-4 py-3">Signals</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {scoredUsers.map((user) => (
                <tr key={user.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{user.name}</p>
                    <p className="text-xs text-slate-400">{user.email}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-300">
                    <p>{user.campaign}</p>
                    <p className="text-xs text-slate-400">
                      {user.country} · {user.device} · {user.ipGroup}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {user.activeSignals.length ? (
                        user.activeSignals.map((signal) => (
                          <span
                            key={signal}
                            className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200"
                          >
                            {signal}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                          Clear
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`px-4 py-4 text-lg font-semibold ${scoreTone(user.score, thresholds)}`}>{formatScore(user.score)}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${decisionTone(user.decision)}`}>
                      {user.decision}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-400">{formatTime(user.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}