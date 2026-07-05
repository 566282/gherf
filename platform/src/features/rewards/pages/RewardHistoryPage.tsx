import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import { formatCurrency } from '@/lib/auth';
import { listRewardLedger, listWalletActivity } from '@/services/api/auth';
import {
  createWithdrawalRequest,
  listWalletAccounts,
  listWalletSettings,
  listWalletTransactions,
  listWalletTransfers,
  listWithdrawalRequests,
  transferWalletBalance,
} from '@/services/api/wallet';
import { getAllowedTransferTargets, walletOperationalRules, walletTransferSources } from '@/services/api/walletPolicies';
import type { WalletAccount, WalletTransaction, WalletTransfer, WalletWithdrawalMethod, WithdrawalRequest, WithdrawalRequestInput, WalletSettings, WalletAccountType } from '@/types';
import { walletAccountTypes } from '@/types';

const withdrawalMethodLabels: Record<WalletWithdrawalMethod, string> = {
  bank_transfer: 'Bank transfer',
  crypto: 'Crypto',
  paypal: 'PayPal',
  gift_cards: 'Gift cards',
  manual_payout: 'Manual payout',
};

const defaultWithdrawalMethod: WalletWithdrawalMethod = 'bank_transfer';

const walletAccountLabels: Record<WalletAccountType, string> = {
  main: 'Main Wallet',
  bonus: 'Bonus Wallet',
  referral: 'Referral Wallet',
  cashback: 'Cashback Wallet',
  reward: 'Reward Wallet',
};

function getDefaultWithdrawalDate(): string {
  const nextDay = new Date();
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay.toISOString().slice(0, 10);
}

export function RewardHistoryPage() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<WalletSettings | null>(null);
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const [rewards, setRewards] = useState<Awaited<ReturnType<typeof listRewardLedger>>>([]);
  const [walletActivity, setWalletActivity] = useState<Awaited<ReturnType<typeof listWalletActivity>>>([]);
  const [amount, setAmount] = useState('50');
  const [method, setMethod] = useState<WalletWithdrawalMethod>(defaultWithdrawalMethod);
  const [transferAmount, setTransferAmount] = useState('25');
  const [transferFrom, setTransferFrom] = useState<WalletAccountType>('reward');
  const [transferTo, setTransferTo] = useState<WalletAccountType>('main');
  const [transferNote, setTransferNote] = useState('Internal wallet transfer');
  const [transferFilterWalletType, setTransferFilterWalletType] = useState<'all' | WalletAccountType>('all');
  const [transferFilterStatus, setTransferFilterStatus] = useState<'all' | WalletTransfer['status']>('all');
  const [transferFilterCurrency, setTransferFilterCurrency] = useState<'all' | string>('all');
  const [destinationLabel, setDestinationLabel] = useState('Primary payout account');
  const [destinationValue, setDestinationValue] = useState('');
  const [destinationCurrency, setDestinationCurrency] = useState('USD');
  const [scheduledFor, setScheduledFor] = useState(getDefaultWithdrawalDate());
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    void listWalletSettings().then(setSettings).catch(() => setSettings(null));
    void listWalletAccounts(profile.id).then(setAccounts).catch(() => setAccounts([]));
    void listWalletTransactions(profile.id, 20).then(setTransactions).catch(() => setTransactions([]));
    void listWithdrawalRequests(profile.id, 12).then(setWithdrawals).catch(() => setWithdrawals([]));
    void listWalletTransfers(profile.id, 20).then(setTransfers).catch(() => setTransfers([]));
    void listRewardLedger(profile.id).then(setRewards).catch(() => setRewards([]));
    void listWalletActivity(profile.id).then(setWalletActivity).catch(() => setWalletActivity([]));
  }, [profile]);

  const walletAccounts = useMemo(() => {
    const currency = settings?.currency ?? 'USD';
    const lookup = new Map<string, WalletAccount>();

    for (const account of accounts) {
      if (account.currency.toUpperCase() === currency.toUpperCase()) {
        lookup.set(account.walletType, account);
      }
    }

    return walletAccountTypes.map((walletType) => ({
      walletType,
      balance:
        lookup.get(walletType)?.availableBalance ??
        (walletType === 'main' ? profile?.walletBalance ?? 0 : walletType === 'reward' ? profile?.rewardBalance ?? 0 : 0),
    }));
  }, [accounts, profile?.rewardBalance, profile?.walletBalance, settings?.currency]);

  const summary = useMemo(() => {
    const totals = transactions.reduce(
      (accumulator, transaction) => {
        const amountValue = Math.abs(transaction.amount);

        if (transaction.transactionType === 'bonus_reward') accumulator.bonusRewards += amountValue;
        if (transaction.transactionType === 'referral_commission') accumulator.referralCommissions += amountValue;
        if (transaction.transactionType === 'cashback') accumulator.cashback += amountValue;
        if (transaction.transactionType === 'promotional_reward') accumulator.promotionalRewards += amountValue;
        if (transaction.transactionType === 'achievement_reward') accumulator.achievementRewards += amountValue;
        if (transaction.transactionType === 'processing_fee') accumulator.processingFees += amountValue;
        if (transaction.transactionType === 'withdrawal_request' && transaction.status === 'reserved') {
          accumulator.reservedWithdrawals += amountValue;
        }

        return accumulator;
      },
      {
        bonusRewards: 0,
        referralCommissions: 0,
        cashback: 0,
        promotionalRewards: 0,
        achievementRewards: 0,
        processingFees: 0,
        reservedWithdrawals: 0,
      },
    );

    return {
      currency: settings?.currency ?? 'USD',
      mainWallet: walletAccounts.find((item) => item.walletType === 'main')?.balance ?? 0,
      bonusWallet: walletAccounts.find((item) => item.walletType === 'bonus')?.balance ?? 0,
      referralWallet: walletAccounts.find((item) => item.walletType === 'referral')?.balance ?? 0,
      cashbackWallet: walletAccounts.find((item) => item.walletType === 'cashback')?.balance ?? 0,
      rewardWallet: walletAccounts.find((item) => item.walletType === 'reward')?.balance ?? 0,
      withdrawableBalance: walletAccounts.find((item) => item.walletType === 'main')?.balance ?? profile?.walletBalance ?? 0,
      pendingEarnings: walletAccounts.find((item) => item.walletType === 'reward')?.balance ?? profile?.rewardBalance ?? 0,
      earnings:
        walletAccounts.reduce((sum, item) => sum + item.balance, 0) ||
        (profile?.walletBalance ?? 0) + (profile?.rewardBalance ?? 0),
      totalBalance: walletAccounts.reduce((sum, item) => sum + item.balance, 0),
      ...totals,
    };
  }, [profile?.rewardBalance, profile?.walletBalance, settings?.currency, transactions, walletAccounts]);

  const amountNumber = Number(amount);
  const feePreview = useMemo(() => {
    if (!settings || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      return { fee: 0, net: 0 };
    }

    const fee = Number(((amountNumber * settings.processingFeePercent) / 100).toFixed(2));
    return { fee, net: Number((amountNumber - fee).toFixed(2)) };
  }, [amountNumber, settings]);

  const supportedMethods = settings?.supportedMethods ?? [
    'bank_transfer',
    'crypto',
    'paypal',
    'gift_cards',
    'manual_payout',
  ];
  const allowedTransferTargets = getAllowedTransferTargets(transferFrom);
  const transferCurrencyOptions = useMemo(() => {
    const currencies = new Set<string>([settings?.currency ?? 'USD']);
    for (const item of transfers) currencies.add(item.currency);
    return ['all', ...Array.from(currencies).filter(Boolean)];
  }, [settings?.currency, transfers]);

  const filteredTransfers = useMemo(() => {
    return transfers.filter((transfer) => {
      const walletTypeMatches =
        transferFilterWalletType === 'all' ||
        transfer.fromWalletAccountId === transferFilterWalletType ||
        transfer.toWalletAccountId === transferFilterWalletType;
      const statusMatches = transferFilterStatus === 'all' || transfer.status === transferFilterStatus;
      const currencyMatches = transferFilterCurrency === 'all' || transfer.currency === transferFilterCurrency;
      return walletTypeMatches && statusMatches && currencyMatches;
    });
  }, [transferFilterCurrency, transferFilterStatus, transferFilterWalletType, transfers]);

  const handleWithdraw = async () => {
    if (!profile) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const payload: WithdrawalRequestInput = {
        amount: amountNumber,
        method,
        destinationLabel,
        destinationValue,
        destinationCurrency,
        scheduledFor,
        note: note || undefined,
      };

      await createWithdrawalRequest(profile.id, payload);
      setStatusMessage('Withdrawal request submitted.');
      setAmount('50');
      setDestinationValue('');
      setScheduledFor(getDefaultWithdrawalDate());
      setNote('');

      const [nextSettings, nextAccounts, nextTransactions, nextWithdrawals, nextTransfers, nextRewards, nextWalletActivity] = await Promise.all([
        listWalletSettings(),
        listWalletAccounts(profile.id),
        listWalletTransactions(profile.id, 20),
        listWithdrawalRequests(profile.id, 12),
        listWalletTransfers(profile.id, 20),
        listRewardLedger(profile.id),
        listWalletActivity(profile.id),
      ]);

      setSettings(nextSettings);
      setAccounts(nextAccounts);
      setTransactions(nextTransactions);
      setWithdrawals(nextWithdrawals);
      setTransfers(nextTransfers);
      setRewards(nextRewards);
      setWalletActivity(nextWalletActivity);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to submit withdrawal request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransfer = async () => {
    if (!profile) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const parsedAmount = Number(transferAmount);
      await transferWalletBalance(profile.id, transferFrom, transferTo, parsedAmount, transferNote || undefined, settings?.currency ?? 'USD');
      setStatusMessage('Internal wallet transfer completed.');
      setTransferAmount('25');
      setTransferNote('Internal wallet transfer');

      const [nextAccounts, nextTransactions, nextTransfers, nextWalletActivity] = await Promise.all([
        listWalletAccounts(profile.id),
        listWalletTransactions(profile.id, 20),
        listWalletTransfers(profile.id, 20),
        listWalletActivity(profile.id),
      ]);

      setAccounts(nextAccounts);
      setTransactions(nextTransactions);
      setTransfers(nextTransfers);
      setWalletActivity(nextWalletActivity);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to complete wallet transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!profile) {
    return (
      <div className="p-6">
        <Card>
          <h1 className="text-3xl font-bold text-white">Wallet</h1>
          <p className="mt-2 text-mist/80">Sign in to view your balances and request a withdrawal.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="bg-[linear-gradient(135deg,rgba(12,16,22,0.98),rgba(19,24,32,0.96))]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-mint">Wallet</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Rewards, balances, and withdrawals</h1>
            <p className="mt-2 max-w-2xl text-mist/80">
              Track earnings, see what is pending, and move available funds into a withdrawal request with the correct payout method.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="#withdrawal-request" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
                Request withdrawal
              </a>
              <a href="#internal-transfer" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
                Move funds
              </a>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm text-mist/70">Wallet type</span>
                    <select className="input-base" value={transferFilterWalletType} onChange={(event) => setTransferFilterWalletType(event.target.value as 'all' | WalletAccountType)}>
                      <option value="all">All wallets</option>
                      {walletAccountTypes.map((value) => <option key={value} value={value}>{walletAccountLabels[value]}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-mist/70">Status</span>
                    <select className="input-base" value={transferFilterStatus} onChange={(event) => setTransferFilterStatus(event.target.value as 'all' | WalletTransfer['status'])}>
                      <option value="all">All statuses</option>
                      <option value="completed">Completed</option>
                      <option value="pending">Pending</option>
                      <option value="failed">Failed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-mist/70">Currency</span>
                    <select className="input-base" value={transferFilterCurrency} onChange={(event) => setTransferFilterCurrency(event.target.value)}>
                      {transferCurrencyOptions.map((value) => (
                        <option key={value} value={value}>
                          {value === 'all' ? 'All currencies' : value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              <a href="#wallet-summary" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
                  {filteredTransfers.length ? filteredTransfers.map((transfer) => (
              </a>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-mist/80 shadow-soft">
            <p className="text-white">Base currency: {settings?.currency ?? 'USD'}</p>
            <p>Approval workflow: {settings?.approvalWorkflow ?? 'manual'}</p>
            <p>Supported methods: {supportedMethods.length}</p>
          </div>
        </div>
      </Card>

      <Card id="wallet-summary">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Wallet accounts</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Multi-wallet balances</h2>
          </div>
          <p className="text-sm text-mist/70">Balances are backed by Supabase wallet accounts and synced with the profile wallet fields.</p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {walletAccounts.map((account) => (
            <div key={account.walletType} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
              <p className="text-sm uppercase tracking-[0.18em] text-mist/60">{walletAccountLabels[account.walletType]}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(account.balance, summary.currency)}</p>
              <p className="mt-2 text-xs text-mist/60">{account.walletType === 'main' ? 'Withdrawable funds' : account.walletType === 'reward' ? 'Claimed reward earnings' : 'Internal wallet bucket'}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
            <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Available to withdraw</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(summary.withdrawableBalance, summary.currency)}</p>
            <p className="mt-1 text-sm text-mist/70">Ready for a withdrawal request.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
            <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Pending rewards</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(summary.pendingEarnings, summary.currency)}</p>
            <p className="mt-1 text-sm text-mist/70">Rewards waiting to be claimed or settled.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
            <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Reserved withdrawals</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(summary.reservedWithdrawals, summary.currency)}</p>
            <p className="mt-1 text-sm text-mist/70">Held while requests are processed.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
            <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Recent totals</p>
            <p className="mt-2 text-2xl font-semibold text-white">{transactions.length + withdrawals.length + transfers.length}</p>
            <p className="mt-1 text-sm text-mist/70">Combined activity across wallet history.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {walletAccountTypes.map((walletType) => {
            const rule = walletOperationalRules[walletType];

            return (
              <div key={walletType} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
                <p className="text-sm uppercase tracking-[0.18em] text-mist/60">{rule.label}</p>
                <p className="mt-2 text-sm text-white/90">{rule.description}</p>
                <p className="mt-2 text-xs text-mist/60">{rule.withdrawable ? 'Withdrawable directly' : `Transfer to ${getAllowedTransferTargets(walletType).map((value) => walletOperationalRules[value].label).join(', ') || 'none'}`}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-soft">
            <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Internal transfer</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Move funds between wallets</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm text-mist/70">From wallet</span>
                <select className="input-base" value={transferFrom} onChange={(event) => setTransferFrom(event.target.value as WalletAccountType)}>
                  {walletTransferSources.map((value) => <option key={value} value={value}>{walletAccountLabels[value]}</option>)}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-mist/70">To wallet</span>
                <select className="input-base" value={transferTo} onChange={(event) => setTransferTo(event.target.value as WalletAccountType)}>
                  {allowedTransferTargets.map((value) => <option key={value} value={value}>{walletAccountLabels[value]}</option>)}
                </select>
              </label>
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm text-mist/70">Amount</span>
                <input className="input-base" type="number" min="0.01" step="0.01" value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} />
              </label>
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm text-mist/70">Note</span>
                <input className="input-base" value={transferNote} onChange={(event) => setTransferNote(event.target.value)} />
              </label>
              <p className="md:col-span-2 text-xs text-mist/60">
                {allowedTransferTargets.length ? `Valid destinations: ${allowedTransferTargets.map((value) => walletOperationalRules[value].label).join(', ')}` : 'This wallet cannot transfer funds.'}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => void handleTransfer()} disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : 'Move funds'}
              </Button>
              <Button variant="ghost" onClick={() => { setTransferAmount('25'); setTransferFrom('main'); setTransferTo('reward'); setTransferNote('Internal wallet transfer'); }}>
                Reset transfer
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-soft">
            <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Audit snapshot</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Latest wallet events</h3>
            <div className="mt-4 space-y-3 text-sm text-mist/80">
              {walletActivity.length ? walletActivity.map((item) => (
                <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <p className="font-medium text-white">{item.entryType ?? item.transactionType ?? 'wallet event'}</p>
                  <p className="mt-1">{item.walletType ? `${item.walletType} wallet` : 'Wallet ledger'} {item.note ? `· ${item.note}` : ''}</p>
                  <p className="mt-1 text-xs text-mist/60">{formatCurrency(item.amount, item.currency ?? summary.currency)}{item.balanceAfter !== undefined ? ` · balance ${formatCurrency(item.balanceAfter, item.currency ?? summary.currency)}` : ''}</p>
                </div>
              )) : <p className="text-sm text-mist/60">No wallet events yet.</p>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Withdrawable balance</p>
          <p className="mt-3 text-3xl font-bold text-white">{formatCurrency(summary.withdrawableBalance, summary.currency)}</p>
          <p className="mt-2 text-sm text-mist/70">Funds currently available for payout.</p>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Pending earnings</p>
          <p className="mt-3 text-3xl font-bold text-white">{formatCurrency(summary.pendingEarnings, summary.currency)}</p>
          <p className="mt-2 text-sm text-mist/70">Rewards waiting to be claimed into your wallet.</p>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Reserved withdrawals</p>
          <p className="mt-3 text-3xl font-bold text-white">{formatCurrency(summary.reservedWithdrawals, summary.currency)}</p>
          <p className="mt-2 text-sm text-mist/70">Pending requests held for review or processing.</p>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Rewards ledger</p>
          <p className="mt-3 text-3xl font-bold text-white">{rewards.length}</p>
          <p className="mt-2 text-sm text-mist/70">Historical reward events and status changes.</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-white">Earnings breakdown</h2>
              <p className="mt-1 text-sm text-mist/70">Category totals derived from the wallet ledger.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-mist/80 shadow-soft">
              Total earned: {formatCurrency(summary.earnings, summary.currency)}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
              <p className="text-sm text-mist/60">Bonus rewards</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(summary.bonusRewards, summary.currency)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
              <p className="text-sm text-mist/60">Referral commissions</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(summary.referralCommissions, summary.currency)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
              <p className="text-sm text-mist/60">Cashback</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(summary.cashback, summary.currency)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
              <p className="text-sm text-mist/60">Promotional rewards</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(summary.promotionalRewards, summary.currency)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft md:col-span-2">
              <p className="text-sm text-mist/60">Achievement rewards</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(summary.achievementRewards, summary.currency)}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-lg font-semibold text-white">Recent wallet transactions</h3>
            <div className="space-y-3">
              {transactions.length ? transactions.map((transaction) => (
                <div key={transaction.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-white">{transaction.transactionType.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-mist/70">{transaction.note ?? transaction.status}</p>
                  </div>
                  <div className="text-right text-sm text-mist/80">
                    <p className="font-medium text-white">{formatCurrency(transaction.amount, transaction.currency)}</p>
                    <p>Balance after {formatCurrency(transaction.balanceAfter, transaction.currency)}</p>
                  </div>
                </div>
              )) : <p className="text-sm text-mist/60">No wallet transactions yet.</p>}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card id="withdrawal-request">
            <h2 className="text-2xl font-semibold text-white">Withdrawal request</h2>
            <p className="mt-1 text-sm text-mist/70">
              Minimum {formatCurrency(settings?.minWithdrawal ?? 0, settings?.currency ?? 'USD')} | Maximum {formatCurrency(settings?.maxWithdrawal ?? 0, settings?.currency ?? 'USD')}
            </p>

            <div className="mt-4 space-y-4">
              <label className="grid gap-2">
                <span className="text-sm text-mist/70">Amount</span>
                <input className="input-base" type="number" min={settings?.minWithdrawal ?? 0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-mist/70">Withdrawal method</span>
                <select className="input-base" value={method} onChange={(event) => setMethod(event.target.value as WalletWithdrawalMethod)}>
                  {supportedMethods.map((value) => <option key={value} value={value}>{withdrawalMethodLabels[value]}</option>)}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-mist/70">Destination label</span>
                <input className="input-base" value={destinationLabel} onChange={(event) => setDestinationLabel(event.target.value)} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-mist/70">Destination account or address</span>
                <input className="input-base" value={destinationValue} onChange={(event) => setDestinationValue(event.target.value)} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-mist/70">Destination currency</span>
                <select className="input-base" value={destinationCurrency} onChange={(event) => setDestinationCurrency(event.target.value)}>
                  {(settings?.exchangeRates ?? []).map((rate) => (
                    <option key={rate.currency} value={rate.currency}>{rate.currency}{rate.label ? ` - ${rate.label}` : ''}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-mist/70">Withdrawal date</span>
                <input className="input-base" type="date" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
                <p className="form-hint">This date is included in both the admin and user withdrawal notifications.</p>
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-mist/70">Note</span>
                <textarea className="input-base min-h-24" value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-mist/80 shadow-soft">
              <p>Processing fee: {settings?.processingFeePercent ?? 0}%</p>
              <p>Estimated fee: {formatCurrency(feePreview.fee, settings?.currency ?? 'USD')}</p>
              <p>Estimated net payout: {formatCurrency(feePreview.net, settings?.currency ?? 'USD')}</p>
            </div>

            {statusMessage ? <p className="mt-3 text-sm text-ember">{statusMessage}</p> : null}

            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => void handleWithdraw()} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Request withdrawal'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setAmount('50');
                  setMethod(defaultWithdrawalMethod);
                  setDestinationCurrency(settings?.currency ?? 'USD');
                }}
              >
                Reset form
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-semibold text-white">Withdrawal history</h2>
            <div className="mt-4 space-y-3">
              {withdrawals.length ? withdrawals.map((request) => (
                <div key={request.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-mist/80 shadow-soft">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{withdrawalMethodLabels[request.method]}</p>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-mist/70">
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-2">{request.destinationLabel}</p>
                  <p>{formatCurrency(request.amount, request.currency)} | Fee {formatCurrency(request.processingFee, request.currency)}</p>
                  <p>Net {formatCurrency(request.netAmount, request.currency)}</p>
                </div>
              )) : <p className="text-sm text-mist/60">No withdrawal requests yet.</p>}
            </div>
          </Card>

          <Card id="internal-transfer">
            <h2 className="text-2xl font-semibold text-white">Transfer history</h2>
            <div className="mt-4 space-y-3">
              {transfers.length ? transfers.map((transfer) => (
                <div key={transfer.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-mist/80 shadow-soft">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{transfer.transferCategory.replace(/_/g, ' ')}</p>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-mist/70">{transfer.status}</span>
                  </div>
                  <p className="mt-2">{formatCurrency(transfer.amount, transfer.currency)}</p>
                  <p className="text-xs text-mist/60">{transfer.note ?? 'Wallet transfer'} · {transfer.fromWalletAccountId} → {transfer.toWalletAccountId}</p>
                </div>
              )) : <p className="text-sm text-mist/60">No wallet transfers matched the current filters.</p>}
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-semibold text-white">Reward history</h2>
            <div className="mt-4 space-y-3 text-sm text-mist/80">
              {rewards.length ? rewards.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
                  <p className="font-medium text-white">{item.action}</p>
                  <p>{formatCurrency(item.amount, item.currency)}</p>
                  <p>{item.reason ?? 'Reward entry recorded in the ledger.'}</p>
                </div>
              )) : <p>No reward activity yet.</p>}
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-semibold text-white">Wallet audit log</h2>
            <div className="mt-4 space-y-3 text-sm text-mist/80">
              {walletActivity.length ? walletActivity.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
                  <p className="font-medium text-white">{item.entryType ?? item.transactionType ?? 'Wallet update'}</p>
                  <p className="mt-1 text-mist/70">{item.note ?? 'Wallet update'}{item.walletType ? ` · ${item.walletType}` : ''}</p>
                  <p>{formatCurrency(item.amount, item.currency ?? summary.currency)} · {formatCurrency(item.balanceAfter, item.currency ?? summary.currency)}</p>
                </div>
              )) : <p>No wallet transactions yet.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
