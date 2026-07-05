import { useState } from 'react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { applyWalletAdjustment, listPendingWithdrawalRequests, listWalletAccounts, listWalletAuditLogs, listWalletSettings, listWalletTransactions } from '@/services/api/wallet';
import type { WalletAccountType } from '@/types';
import { walletAccountTypes } from '@/types';

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function statusTone(status: string): string {
  if (status === 'approved' || status === 'completed' || status === 'paid') return 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10';
  if (status === 'processing' || status === 'pending') return 'text-amber-300 border-amber-500/20 bg-amber-500/10';
  return 'text-rose-300 border-rose-500/20 bg-rose-500/10';
}

const walletAccountLabels: Record<WalletAccountType, string> = {
  main: 'Main Wallet',
  bonus: 'Bonus Wallet',
  referral: 'Referral Wallet',
  cashback: 'Cashback Wallet',
  reward: 'Reward Wallet',
};

export function WalletManagementPage(): JSX.Element {
  const [adjustmentUserId, setAdjustmentUserId] = useState('');
  const [adjustmentWalletType, setAdjustmentWalletType] = useState<WalletAccountType>('main');
  const [adjustmentAmount, setAdjustmentAmount] = useState('100');
  const [adjustmentReason, setAdjustmentReason] = useState('Manual admin adjustment');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-wallet-management'],
    queryFn: async () => {
      const [settings, withdrawals, transactions, accounts, auditLogs] = await Promise.all([
        listWalletSettings(),
        listPendingWithdrawalRequests(20),
        listWalletTransactions(undefined, 20),
        listWalletAccounts(undefined),
        listWalletAuditLogs(undefined, 20),
      ]);

      return { settings, withdrawals, transactions, accounts, auditLogs };
    },
    staleTime: 60_000,
    retry: false,
  });

  const summary = useMemo(() => {
    const withdrawals = data?.withdrawals ?? [];
    const transactions = data?.transactions ?? [];
    const accounts = data?.accounts ?? [];

    return {
      pendingWithdrawals: withdrawals.filter((item) => item.status === 'pending').length,
      processingWithdrawals: withdrawals.filter((item) => item.status === 'processing').length,
      approvedWithdrawals: withdrawals.filter((item) => item.status === 'approved' || item.status === 'completed' || item.status === 'paid').length,
      transactionCount: transactions.length,
      accountCount: accounts.length,
      totalBalance: accounts.reduce((sum, account) => sum + account.availableBalance, 0),
    };
  }, [data]);

  const handleAdjustment = async () => {
    if (!adjustmentUserId.trim()) {
      setStatusMessage('Enter a user ID before applying an adjustment.');
      return;
    }

    const amount = Number(adjustmentAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      setStatusMessage('Enter a non-zero adjustment amount.');
      return;
    }

    setIsAdjusting(true);
    setStatusMessage(null);

    try {
      await applyWalletAdjustment(adjustmentUserId.trim(), adjustmentWalletType, amount, adjustmentReason || 'Manual admin adjustment');
      setStatusMessage('Wallet adjustment applied.');
      setAdjustmentAmount('100');
      setAdjustmentReason('Manual admin adjustment');
      await refetch();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to apply wallet adjustment.');
    } finally {
      setIsAdjusting(false);
    }
  };

  if (error) {
    return (
      <Card className="border border-border bg-surface-elevated p-6">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Wallet management</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Unable to load wallet data</h1>
        <p className="mt-2 text-sm text-muted">Wallet settings and withdrawal queues could not be loaded from Supabase.</p>
        <button type="button" onClick={() => void refetch()} className="mt-4 rounded-xl border border-border bg-surface px-4 py-2 text-sm text-foreground">
          Retry
        </button>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-44" />
        <Skeleton className="h-80" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const currency = data.settings.currency;

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated p-6">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Finance operations</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Wallet management</h1>
        <p className="mt-2 text-sm text-muted">Withdrawal review and ledger activity backed by Supabase.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Pending</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{summary.pendingWithdrawals}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Processing</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{summary.processingWithdrawals}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Approved</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{summary.approvedWithdrawals}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Transactions</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{summary.transactionCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Wallet accounts</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{summary.accountCount}</p>
          </div>
        </div>
      </Card>

      <Card className="border border-border bg-surface-elevated p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Wallet balances</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Supabase wallet accounts</h2>
          </div>
          <p className="text-sm text-muted">Total balance {formatCurrency(summary.totalBalance, currency)}</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {(data.accounts ?? []).map((account) => (
            <div key={account.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">{walletAccountLabels[account.walletType]}</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(account.availableBalance, account.currency)}</p>
              <p className="mt-2 text-xs text-muted">Pending {formatCurrency(account.pendingBalance, account.currency)} · Locked {formatCurrency(account.lockedBalance, account.currency)}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border border-border bg-surface-elevated p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Admin adjustments</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Apply wallet credits or debits</h2>
          </div>
          <p className="text-sm text-muted">This writes through Supabase RPC and updates the wallet account plus transaction ledger.</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm text-muted">User ID</span>
            <input className="input-base" value={adjustmentUserId} onChange={(event) => setAdjustmentUserId(event.target.value)} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Wallet type</span>
            <select className="input-base" value={adjustmentWalletType} onChange={(event) => setAdjustmentWalletType(event.target.value as WalletAccountType)}>
              {walletAccountTypes.map((value) => <option key={value} value={value}>{walletAccountLabels[value]}</option>)}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Amount</span>
            <input className="input-base" type="number" step="0.01" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} />
          </label>
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm text-muted">Reason</span>
            <input className="input-base" value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => void handleAdjustment()} disabled={isAdjusting}>
            {isAdjusting ? 'Applying...' : 'Apply adjustment'}
          </Button>
          <Button variant="ghost" onClick={() => { setAdjustmentAmount('100'); setAdjustmentReason('Manual admin adjustment'); }}>
            Reset
          </Button>
        </div>
        {statusMessage ? <p className="mt-3 text-sm text-muted">{statusMessage}</p> : null}
      </Card>

      <Card className="overflow-hidden border border-border bg-surface-elevated">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-xl font-semibold text-foreground">Pending withdrawals</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Destination</th>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Amount</th>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Net</th>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.withdrawals.map((withdrawal) => (
                <tr key={withdrawal.id} className="border-t border-border">
                  <td className="px-6 py-4">
                    <p className="font-medium text-foreground">{withdrawal.destinationLabel}</p>
                    <p className="mt-1 text-xs text-muted">{withdrawal.method.replace(/_/g, ' ')}</p>
                  </td>
                  <td className="px-6 py-4 text-foreground/85">{formatCurrency(withdrawal.amount, currency)}</td>
                  <td className="px-6 py-4 text-foreground/85">{formatCurrency(withdrawal.netAmount, currency)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusTone(withdrawal.status)}`}>{withdrawal.status}</span>
                  </td>
                  <td className="px-6 py-4 text-foreground/85">{formatDate(withdrawal.createdAt)}</td>
                </tr>
              ))}
              {!data.withdrawals.length ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-muted">
                    No pending withdrawals were found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden border border-border bg-surface-elevated">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-xl font-semibold text-foreground">Recent wallet activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Reference</th>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Type</th>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Amount</th>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Balance after</th>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((transaction) => (
                <tr key={transaction.id} className="border-t border-border">
                  <td className="px-6 py-4 text-foreground/85">{transaction.referenceId ?? transaction.id}</td>
                  <td className="px-6 py-4 text-foreground/85">{transaction.transactionType.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-4 text-foreground/85">{formatCurrency(transaction.amount, transaction.currency)}</td>
                  <td className="px-6 py-4 text-foreground/85">{formatCurrency(transaction.balanceAfter, transaction.currency)}</td>
                  <td className="px-6 py-4 text-foreground/85">{formatDate(transaction.createdAt)}</td>
                </tr>
              ))}
              {!data.transactions.length ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-muted">
                    No wallet transactions were found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden border border-border bg-surface-elevated">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-xl font-semibold text-foreground">Wallet audit logs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Event</th>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Wallet</th>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Amount</th>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Balance after</th>
                <th className="px-6 py-3 font-medium uppercase tracking-[0.2em]">Created</th>
              </tr>
            </thead>
            <tbody>
              {(data.auditLogs ?? []).map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-6 py-4 text-foreground/85">{item.eventType.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-4 text-foreground/85">{item.walletType ? walletAccountLabels[item.walletType] : item.entryType.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-4 text-foreground/85">{formatCurrency(item.amount, item.currency)}</td>
                  <td className="px-6 py-4 text-foreground/85">{item.balanceAfter === null || item.balanceAfter === undefined ? '-' : formatCurrency(item.balanceAfter, item.currency)}</td>
                  <td className="px-6 py-4 text-foreground/85">{formatDate(item.createdAt)}</td>
                </tr>
              ))}
              {!data.auditLogs.length ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-muted">
                    No audit log entries were found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}