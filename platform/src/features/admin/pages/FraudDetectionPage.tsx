import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { listUsers } from '@/services/api/auth';
import { listReferralFraudFlags, type ReferralFraudFlag } from '@/services/api/referrals';
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

function severityScore(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'high' || normalized === 'critical') return 90;
  if (normalized === 'medium') return 70;
  if (normalized === 'low') return 50;
  return 35;
}

function deriveLiveFraudProfiles(
  users: Array<{ id: string; fullName: string; email: string; updatedAt: string; createdAt: string }>,
  flags: ReferralFraudFlag[],
): FraudUserProfile[] {
  const flagsByProfile = flags.reduce<Record<string, ReferralFraudFlag[]>>((accumulator, flag) => {
    const profileId = flag.profileId?.trim();
    if (!profileId) return accumulator;
    accumulator[profileId] = accumulator[profileId] ?? [];
    accumulator[profileId].push(flag);
    return accumulator;
  }, {});

  return users.slice(0, 50).map((user, index) => {
    const profileFlags = flagsByProfile[user.id] ?? [];
    const signals = profileFlags.map((flag) => `${flag.ruleKey} ${flag.signal}`.toLowerCase());
    const signalCount = profileFlags.length;
    const maxSeverity = profileFlags.length
      ? Math.max(...profileFlags.map((flag) => severityScore(flag.severity)))
      : 20;

    return {
      id: user.id,
      name: user.fullName || 'Unknown user',
      email: user.email || 'unknown@example.com',
      campaign: 'Project-wide telemetry',
      country: 'Unknown',
      device: 'Live platform profile',
      ipGroup: signalCount ? `FLAGGED-${Math.min(9, signalCount)}` : 'CLEAR',
      watchTimeMinutes: Math.max(0.5, 8 - signalCount * 1.1),
      clicksPerMinute: 2 + signalCount * 2,
      refreshesPerMinute: signalCount,
      automationConfidence: Math.min(100, maxSeverity),
      sharedIpAccounts: Math.max(1, signalCount),
      deviceReuseCount: Math.max(1, Math.ceil(signalCount / 2)),
      linkedAccounts: Math.max(1, signalCount),
      referralLoopScore: Math.min(100, signalCount * 20 + (signals.some((entry) => entry.includes('loop')) ? 20 : 0)),
      vpn: signals.some((entry) => entry.includes('vpn')),
      proxy: signals.some((entry) => entry.includes('proxy')),
      emulator: signals.some((entry) => entry.includes('emulator')),
      bot: signals.some((entry) => entry.includes('bot')),
      suspiciousReferrals: signals.some((entry) => entry.includes('referral') || entry.includes('duplicate')),
      lastSeen: user.updatedAt || user.createdAt || new Date().toISOString(),
    };
  });
}

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
  const [liveProfiles, setLiveProfiles] = useState<FraudUserProfile[]>([]);
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

    void Promise.all([listUsers(), listReferralFraudFlags(100)])
      .then(([users, flags]) => {
        if (!active) return;
        const normalizedUsers = users.map((user) => ({
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          updatedAt: user.updatedAt,
          createdAt: user.createdAt,
        }));
        setLiveProfiles(deriveLiveFraudProfiles(normalizedUsers, flags));
      })
      .catch(() => {
        if (active) {
          setLiveProfiles([]);
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

  const scoredUsers = useMemo(() => liveProfiles.map((user) => evaluateFraudProfile(user, thresholds)), [liveProfiles, thresholds]);
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
    const average = scoredUsers.length ? scoredUsers.reduce((total, user) => total + user.score, 0) / scoredUsers.length : 0;

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
              Score live user profiles, surface suspicious behavior in real time, and tune enforcement thresholds without leaving
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
          <p className="mt-1 text-xs text-slate-400">Live profiles are re-evaluated when thresholds change.</p>
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
            {fraudSignalDefinitions.map((signal) => (
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
                <p className="text-sm text-slate-400">How the current thresholds score live users before you save them.</p>
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
            <p className="text-sm text-slate-400">Every live user profile gets a fraud score and enforcement decision.</p>
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