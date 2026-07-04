import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/auth';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  listNotifications,
  listRewardLedger,
  listWalletActivity,
  updateProfile,
} from '@/services/api/auth';
import type { NotificationItem, RewardLedgerItem, WalletActivity } from '@/types/auth';

export function ProfilePage(): JSX.Element {
  const { profile, refreshProfile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [rewards, setRewards] = useState<RewardLedgerItem[]>([]);
  const [walletActivity, setWalletActivity] = useState<WalletActivity[]>([]);
  const [displayName, setDisplayName] = useState(profile?.fullName ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;

    setDisplayName(profile.fullName ?? '');

    void listNotifications(profile.id).then(setNotifications).catch(() => setNotifications([]));
    void listRewardLedger(profile.id).then(setRewards).catch(() => setRewards([]));
    void listWalletActivity(profile.id).then(setWalletActivity).catch(() => setWalletActivity([]));
  }, [profile]);

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

  return (
    <div className="space-y-6">
      <Card className="border border-white/10 bg-white/5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Account</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{profile.fullName ?? 'Unnamed user'}</h1>
            <p className="mt-2 text-mist/80">{profile.email}</p>
          </div>
          <div className="grid gap-2 text-sm text-mist/80">
            <span>Referral code: {profile.referralCode}</span>
            <span>Wallet balance: {formatCurrency(profile.walletBalance)}</span>
            <span>Reputation: {profile.reputationScore}</span>
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
          <button className="rounded-xl border border-white/10 px-4 py-2 text-mist hover:bg-white/5" onClick={() => void refreshProfile()}>
            Refresh
          </button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="text-xl font-semibold">Badges</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.badges.length ? profile.badges.map((badge) => <span key={badge} className="rounded-full bg-mint/15 px-3 py-1 text-sm text-mint">{badge}</span>) : <p className="text-sm text-mist/60">No badges yet.</p>}
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold">Notifications</h2>
          <ul className="mt-4 space-y-3 text-sm text-mist/80">
            {notifications.length ? notifications.map((item) => <li key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="font-medium text-white">{item.title}</p><p>{item.message}</p></li>) : <li>No notifications yet.</li>}
          </ul>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold">Reward history</h2>
          <ul className="mt-4 space-y-3 text-sm text-mist/80">
            {rewards.length ? rewards.map((item) => <li key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="font-medium text-white">{item.action}</p><p>{formatCurrency(item.amount, item.currency)}</p></li>) : <li>No reward activity yet.</li>}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold">Wallet activity</h2>
        <ul className="mt-4 space-y-3 text-sm text-mist/80">
          {walletActivity.length ? walletActivity.map((item) => <li key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"><span>{item.note ?? 'Wallet update'}</span><span>{formatCurrency(item.amount)} · {formatCurrency(item.balanceAfter)}</span></li>) : <li>No wallet transactions yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
