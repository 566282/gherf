import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/auth';
import type { AppRole, UserProfile } from '@/types/auth';
import {
  adjustWalletBalance,
  banUser,
  listUsers,
  resetUserPassword,
  suspendUser,
  updateProfile,
  verifyUser,
} from '@/services/api/auth';

const roleOptions: Array<{ label: string; value: AppRole | 'all' }> = [
  { label: 'All roles', value: 'all' },
  { label: 'Super admin', value: 'super_admin' },
  { label: 'Campaign manager', value: 'campaign_manager' },
  { label: 'Moderator', value: 'moderator' },
  { label: 'Advertiser', value: 'advertiser' },
  { label: 'Registered user', value: 'registered_user' },
];

const statusOptions: Array<{ label: string; value: UserProfile['status'] | 'all' }> = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Banned', value: 'banned' },
  { label: 'Pending verification', value: 'pending_verification' },
];

export function UsersManagementPage(): JSX.Element {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<AppRole | 'all'>('all');
  const [status, setStatus] = useState<UserProfile['status'] | 'all'>('all');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [reason, setReason] = useState('');
  const [adjustment, setAdjustment] = useState('25');

  const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) ?? null, [selectedUserId, users]);

  const loadUsers = async () => {
    const data = await listUsers({
      query: query || undefined,
      role: role === 'all' ? undefined : role,
      status: status === 'all' ? undefined : status,
    });
    setUsers(data);
    if (!selectedUserId && data[0]) {
      setSelectedUserId(data[0].id);
    }
  };

  useEffect(() => {
    void loadUsers().catch(() => setUsers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, role, status]);

  useEffect(() => {
    setDisplayName(selectedUser?.fullName ?? '');
  }, [selectedUser]);

  const handleAction = async (action: () => Promise<void>) => {
    try {
      await action();
      await loadUsers();
    } catch {
      // Keep the control surface stable; the surrounding state will refresh on the next action.
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Users management</h1>
        <p className="mt-2 text-mist/80">Suspend, ban, verify, edit, and rebalance user accounts from one place.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input className="input-base" placeholder="Search name, email, referral code" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="input-base" value={role} onChange={(event) => setRole(event.target.value as AppRole | 'all')}>
            {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="input-base" value={status} onChange={(event) => setStatus(event.target.value as UserProfile['status'] | 'all')}>
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-mist/70">
                <tr>
                  <th className="py-3 pr-4">User</th>
                  <th className="py-3 pr-4">Role</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Wallet</th>
                  <th className="py-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-white/5 text-mist/90">
                    <td className="py-4 pr-4">
                      <button className="text-left text-white transition hover:text-ember" onClick={() => setSelectedUserId(user.id)}>
                        <div className="font-medium">{user.fullName ?? 'Unnamed user'}</div>
                        <div className="text-xs text-mist/60">{user.email}</div>
                      </button>
                    </td>
                    <td className="py-4 pr-4">{user.role}</td>
                    <td className="py-4 pr-4">{user.status}</td>
                    <td className="py-4 pr-4">{formatCurrency(user.walletBalance)}</td>
                    <td className="py-4 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="rounded-lg border border-white/10 px-3 py-1 hover:bg-white/5" onClick={() => setSelectedUserId(user.id)}>View</button>
                        <button type="button" className="rounded-lg border border-white/10 px-3 py-1 hover:bg-white/5" onClick={() => void handleAction(() => verifyUser(user.id))}>Verify</button>
                        <button type="button" className="rounded-lg border border-white/10 px-3 py-1 hover:bg-white/5" onClick={() => void handleAction(() => suspendUser(user.id, reason || 'Temporary moderation action'))}>Suspend</button>
                        <button type="button" className="rounded-lg border border-white/10 px-3 py-1 text-mist/80 hover:bg-white/5" onClick={() => void handleAction(() => banUser(user.id, reason || 'Policy violation'))}>Ban</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-semibold text-white">Selected user</h2>
          {selectedUser ? (
            <div className="mt-4 space-y-4 text-sm text-mist/80">
              <div className="space-y-1">
                <p className="text-lg font-medium text-white">{selectedUser.fullName ?? 'Unnamed user'}</p>
                <p>{selectedUser.email}</p>
                <p>{selectedUser.referralCode}</p>
              </div>
              <label className="grid gap-2">
                <span>Display name</span>
                <input className="input-base" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </label>
              <label className="grid gap-2">
                <span>Admin reason</span>
                <textarea className="input-base min-h-24" value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
              <label className="grid gap-2">
                <span>Wallet adjustment</span>
                <input className="input-base" type="number" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} />
              </label>
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
                <p>Wallet: {formatCurrency(selectedUser.walletBalance)}</p>
                <p>Rewards: {formatCurrency(selectedUser.rewardBalance)}</p>
                <p>Reputation: {selectedUser.reputationScore}</p>
                <p>Level: {selectedUser.levelLabel}</p>
                <p>Verification: {selectedUser.isEmailVerified ? 'Verified' : 'Pending'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-xl bg-ember px-4 py-2 font-medium text-ink shadow-[0_10px_30px_rgba(201,130,78,0.2)]" onClick={() => void handleAction(() => updateProfile(selectedUser.id, { fullName: displayName, twoFactorEnabled: selectedUser.twoFactorEnabled }))}>
                  Save profile
                </button>
                <button type="button" className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/5" onClick={() => void handleAction(() => adjustWalletBalance(selectedUser.id, Number(adjustment), reason || 'Manual balance adjustment'))}>
                  Adjust balance
                </button>
                <button type="button" className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/5" onClick={() => selectedUser.email ? void handleAction(() => resetUserPassword(selectedUser.email)) : undefined}>
                  Reset password
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-mist/70">Select a user to manage their account.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
