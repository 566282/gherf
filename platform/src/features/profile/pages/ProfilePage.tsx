import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/auth';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  enrollTotpFactor,
  listActiveSessions,
  listMfaFactors,
  listNotifications,
  listRewardLedger,
  listWalletActivity,
  revokeSession,
  unenrollMfaFactor,
  updateProfile,
  updateMemberPlan,
  verifyTotpEnrollment,
} from '@/services/api/auth';
import type { DeviceSession, MfaFactor, NotificationItem, RewardLedgerItem, WalletActivity } from '@/types/auth';

export function ProfilePage(): JSX.Element {
  const { profile, refreshProfile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [rewards, setRewards] = useState<RewardLedgerItem[]>([]);
  const [walletActivity, setWalletActivity] = useState<WalletActivity[]>([]);
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>([]);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [totpQrCode, setTotpQrCode] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(profile?.fullName ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;

    setDisplayName(profile.fullName ?? '');

    void listNotifications(profile.id).then(setNotifications).catch(() => setNotifications([]));
    void listRewardLedger(profile.id).then(setRewards).catch(() => setRewards([]));
    void listWalletActivity(profile.id).then(setWalletActivity).catch(() => setWalletActivity([]));
    void listMfaFactors().then(setMfaFactors).catch(() => setMfaFactors([]));
    void listActiveSessions().then(setDeviceSessions).catch(() => setDeviceSessions([]));
  }, [profile]);

  const refreshSecurityData = async () => {
    const [factors, sessions] = await Promise.all([listMfaFactors(), listActiveSessions()]);
    setMfaFactors(factors);
    setDeviceSessions(sessions);
  };

  if (!profile) {
    return (
      <Card className="border border-white/10 bg-white/5">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Profile</h1>
        <p className="mt-2 text-mist/80">Sign in to view your account profile.</p>
      </Card>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(profile.id, {
        fullName: displayName,
        twoFactorEnabled: profile.twoFactorEnabled,
      });
      await refreshProfile();
    } finally {
      setSaving(false);
    }
  };

  const handleUpgradePlan = async (targetTier: number) => {
    setPlanMessage(null);

    try {
      await updateMemberPlan(profile.id, targetTier);
      await refreshProfile();
      setPlanMessage(targetTier >= 3 ? 'Premium plan activated. Withdrawal holds are cleared.' : 'Member plan upgraded. Withdrawal holds are cleared.');
    } catch (error) {
      setPlanMessage(error instanceof Error ? error.message : 'Unable to upgrade plan right now.');
    }
  };

  const handleStartTotpEnrollment = async () => {
    setSecurityMessage(null);
    try {
      const enrolled = await enrollTotpFactor('InvestPro Authenticator');
      setTotpFactorId(enrolled.factorId);
      setTotpQrCode(enrolled.qrCode);
      setSecurityMessage('Scan the QR code in your authenticator app, then enter the 6-digit code.');
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : 'Unable to start 2FA setup.');
    }
  };

  const handleVerifyTotp = async () => {
    if (!totpFactorId || !totpCode.trim()) {
      setSecurityMessage('Enter the verification code from your authenticator app.');
      return;
    }

    setSecurityMessage(null);
    try {
      await verifyTotpEnrollment(totpFactorId, totpCode.trim());
      setTotpCode('');
      setTotpFactorId(null);
      setTotpQrCode(null);
      await refreshSecurityData();
      await refreshProfile();
      setSecurityMessage('Two-factor authentication enabled.');
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : 'Unable to verify the authenticator code.');
    }
  };

  const handleDisableMfa = async (factorId: string) => {
    setSecurityMessage(null);
    try {
      await unenrollMfaFactor(factorId);
      await refreshSecurityData();
      await refreshProfile();
      setSecurityMessage('Two-factor authentication updated.');
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : 'Unable to disable factor.');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setSecurityMessage(null);
    try {
      await revokeSession(sessionId, 'user_revoked');
      await refreshSecurityData();
      setSecurityMessage('Session revoked.');
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : 'Unable to revoke session.');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-white/10 bg-white/5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Account</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{profile.fullName ?? 'Unnamed user'}</h1>
            <p className="mt-2 text-mist/80">{profile.email}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/app/wallet" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
                Open wallet
              </Link>
              <Link to="/app/notifications" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
                View notifications
              </Link>
              <Link to="/app/tasks" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
                Resume tasks
              </Link>
              <Link to="/app/gamification" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
                View leaderboard
              </Link>
            </div>
          </div>
          <div className="grid gap-2 text-sm text-mist/80">
            <span>Referral code: {profile.referralCode}</span>
            <span>Wallet balance: {formatCurrency(profile.walletBalance)}</span>
            <span>Reputation: {profile.reputationScore}</span>
            <span>Member plan: {profile.levelLabel} · Tier {profile.levelTier}</span>
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm text-mist/80">Display name</span>
            <input className="input-base" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <div className="grid gap-2">
            <span className="text-sm text-mist/80">Security</span>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-mist/80">
              <p>Email verified: {profile.isEmailVerified ? 'Yes' : 'No'}</p>
              <p>Two-factor enabled: {profile.twoFactorEnabled ? 'Yes' : 'No'}</p>
              <p>Level: {profile.levelLabel}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="rounded-xl bg-ember px-4 py-2 font-medium text-ink shadow-[0_10px_30px_rgba(201,130,78,0.2)] disabled:opacity-60" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving...' : 'Save profile'}
          </button>
          <button className="rounded-xl border border-white/10 px-4 py-2 text-mist hover:bg-white/5" onClick={() => void handleUpgradePlan(2)}>
            Upgrade to Balanced
          </button>
          <button className="rounded-xl border border-white/10 px-4 py-2 text-mist hover:bg-white/5" onClick={() => void handleUpgradePlan(3)}>
            Upgrade to Premium
          </button>
          <button className="rounded-xl border border-white/10 px-4 py-2 text-mist hover:bg-white/5" onClick={() => void refreshProfile()}>
            Refresh
          </button>
        </div>
        {planMessage ? <p className="mt-3 text-sm text-mint">{planMessage}</p> : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="text-xl font-semibold">Badges</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.badges.length ? profile.badges.map((badge) => <span key={badge} className="rounded-full bg-mint/15 px-3 py-1 text-sm text-mint">{badge}</span>) : <p className="text-sm text-mist/60">No badges yet.</p>}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Notifications</h2>
            <Link to="/app/notifications" className="text-sm text-ember/90 hover:text-ember">Open inbox →</Link>
          </div>
          <ul className="mt-4 space-y-3 text-sm text-mist/80">
            {notifications.length ? notifications.map((item) => <li key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="font-medium text-white">{item.title}</p><p>{item.message}</p></li>) : <li>No notifications yet.</li>}
          </ul>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold">Reward history</h2>
          <ul className="mt-4 space-y-3 text-sm text-mist/80">
            {rewards.length ? rewards.map((item) => <li key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="font-medium text-white">{item.action}</p><p>{formatCurrency(item.amount, item.currency)}</p></li>) : <li>No reward activity yet.</li>}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/app/wallet" className="text-sm text-ember/90 hover:text-ember">Review wallet activity →</Link>
            <Link to="/help-center" className="text-sm text-ember/90 hover:text-ember">Open support center →</Link>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold">Wallet activity</h2>
        <ul className="mt-4 space-y-3 text-sm text-mist/80">
          {walletActivity.length ? walletActivity.map((item) => <li key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"><span>{item.note ?? 'Wallet update'}</span><span>{formatCurrency(item.amount)} · {formatCurrency(item.balanceAfter)}</span></li>) : <li>No wallet transactions yet.</li>}
        </ul>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/app/wallet" className="text-sm text-ember/90 hover:text-ember">Open wallet →</Link>
          <Link to="/app/tasks" className="text-sm text-ember/90 hover:text-ember">Resume tasks →</Link>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">Security center</h2>
        <p className="mt-2 text-sm text-mist/70">Manage two-factor authentication and active device sessions.</p>
        {securityMessage ? <p className="mt-3 text-sm text-mint">{securityMessage}</p> : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-lg font-semibold text-white">Two-factor authentication</h3>
            <ul className="mt-3 space-y-2 text-sm text-mist/80">
              {mfaFactors.length === 0 ? <li>No factors enrolled.</li> : mfaFactors.map((factor) => (
                <li key={factor.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                  <span>{factor.friendlyName ?? factor.factorType} · {factor.status}</span>
                  <button className="rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10" onClick={() => void handleDisableMfa(factor.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            {!totpFactorId ? (
              <button className="mt-4 rounded-xl bg-ember px-4 py-2 font-medium text-ink shadow-[0_10px_30px_rgba(201,130,78,0.2)]" onClick={() => void handleStartTotpEnrollment()}>
                Add authenticator app
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="overflow-hidden rounded-lg border border-white/10 bg-white p-3">
                  {totpQrCode ? <div dangerouslySetInnerHTML={{ __html: totpQrCode }} /> : null}
                </div>
                <input className="input-base" placeholder="Enter 6-digit code" value={totpCode} onChange={(event) => setTotpCode(event.target.value)} />
                <button className="rounded-xl border border-white/10 px-4 py-2 text-mist hover:bg-white/5" onClick={() => void handleVerifyTotp()}>
                  Verify and enable 2FA
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-lg font-semibold text-white">Active sessions</h3>
            <ul className="mt-3 space-y-2 text-sm text-mist/80">
              {deviceSessions.length === 0 ? <li>No active sessions recorded.</li> : deviceSessions.map((session) => (
                <li key={session.id} className="rounded-lg border border-white/10 bg-black/10 p-3">
                  <p className="text-white">{session.isCurrentSession ? 'Current device' : 'Device session'}{session.isTrusted ? ' · trusted' : ''}</p>
                  <p className="text-xs text-mist/70">Last seen: {new Date(session.lastSeenAt).toLocaleString()}</p>
                  <p className="text-xs text-mist/70">Expires: {new Date(session.expiresAt).toLocaleString()}</p>
                  {!session.isCurrentSession && !session.isRevoked ? (
                    <button className="mt-2 rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10" onClick={() => void handleRevokeSession(session.sessionId)}>
                      Revoke
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
