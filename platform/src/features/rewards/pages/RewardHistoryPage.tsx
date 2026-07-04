import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import { formatCurrency } from '@/lib/auth';
import { listRewardLedger, listWalletActivity } from '@/services/api/auth';
import { createWithdrawalRequest, listWalletSettings, listWalletTransactions, listWithdrawalRequests } from '@/services/api/wallet';
import type { WalletTransaction, WalletWithdrawalMethod, WithdrawalRequest, WithdrawalRequestInput, WalletSettings } from '@/types';

const withdrawalMethodLabels: Record<WalletWithdrawalMethod, string> = {
  bank_transfer: 'Bank transfer',
  crypto: 'Crypto',
  paypal: 'PayPal',
  gift_cards: 'Gift cards',
  manual_payout: 'Manual payout',
};

const defaultWithdrawalMethod: WalletWithdrawalMethod = 'bank_transfer';

export function RewardHistoryPage() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<WalletSettings | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [rewards, setRewards] = useState<Awaited<ReturnType<typeof listRewardLedger>>>([]);
  const [walletActivity, setWalletActivity] = useState<Awaited<ReturnType<typeof listWalletActivity>>>([]);
  const [amount, setAmount] = useState('50');
  const [method, setMethod] = useState<WalletWithdrawalMethod>(defaultWithdrawalMethod);
  const [destinationLabel, setDestinationLabel] = useState('Primary payout account');
  const [destinationValue, setDestinationValue] = useState('');
  const [destinationCurrency, setDestinationCurrency] = useState('USD');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    void listWalletSettings().then(setSettings).catch(() => setSettings(null));
    void listWalletTransactions(profile.id, 20).then(setTransactions).catch(() => setTransactions([]));
    void listWithdrawalRequests(profile.id, 12).then(setWithdrawals).catch(() => setWithdrawals([]));
    void listRewardLedger(profile.id).then(setRewards).catch(() => setRewards([]));
    void listWalletActivity(profile.id).then(setWalletActivity).catch(() => setWalletActivity([]));
  }, [profile]);

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
      withdrawableBalance: profile?.walletBalance ?? 0,
      pendingEarnings: profile?.rewardBalance ?? 0,
      earnings: (profile?.walletBalance ?? 0) + (profile?.rewardBalance ?? 0),
      ...totals,
    };
  }, [profile?.rewardBalance, profile?.walletBalance, settings?.currency, transactions]);

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
        note: note || undefined,
      };

      await createWithdrawalRequest(profile.id, payload);
      setStatusMessage('Withdrawal request submitted.');
      setAmount('50');
      setDestinationValue('');
      setNote('');

      const [nextSettings, nextTransactions, nextWithdrawals, nextRewards, nextWalletActivity] = await Promise.all([
        listWalletSettings(),
        listWalletTransactions(profile.id, 20),
        listWithdrawalRequests(profile.id, 12),
        listRewardLedger(profile.id),
        listWalletActivity(profile.id),
      ]);

      setSettings(nextSettings);
      setTransactions(nextTransactions);
      setWithdrawals(nextWithdrawals);
      setRewards(nextRewards);
      setWalletActivity(nextWalletActivity);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to submit withdrawal request.');
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
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-mist/80 shadow-soft">
            <p className="text-white">Base currency: {settings?.currency ?? 'USD'}</p>
            <p>Approval workflow: {settings?.approvalWorkflow ?? 'manual'}</p>
            <p>Supported methods: {supportedMethods.length}</p>
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
          <Card>
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
            <h2 className="text-2xl font-semibold text-white">Wallet activity</h2>
            <div className="mt-4 space-y-3 text-sm text-mist/80">
              {walletActivity.length ? walletActivity.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
                  <p>{item.note ?? 'Wallet update'}</p>
                  <p>{formatCurrency(item.amount)} · {formatCurrency(item.balanceAfter)}</p>
                </div>
              )) : <p>No wallet transactions yet.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
