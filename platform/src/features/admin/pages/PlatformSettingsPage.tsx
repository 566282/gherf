import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/app/providers/AuthProvider';
import { formatCurrency } from '@/lib/auth';
import { listPendingWithdrawalRequests, listWalletSettings, resolveWithdrawalRequest, updateWalletSettings } from '@/services/api/wallet';
import type { WalletApprovalWorkflow, WalletSettings, WalletWithdrawalMethod, WithdrawalRequest } from '@/types';

export function PlatformSettingsPage() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<WalletSettings | null>(null);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [currency, setCurrency] = useState('USD');
  const [minWithdrawal, setMinWithdrawal] = useState('25');
  const [maxWithdrawal, setMaxWithdrawal] = useState('5000');
  const [processingFeePercent, setProcessingFeePercent] = useState('1.5');
  const [approvalWorkflow, setApprovalWorkflow] = useState<WalletApprovalWorkflow>('manual');
  const [supportedMethods, setSupportedMethods] = useState<WalletWithdrawalMethod[]>(['bank_transfer', 'crypto', 'paypal']);
  const [exchangeRateDraft, setExchangeRateDraft] = useState('USD:1,EUR:0.92,GBP:0.79,NGN:1500,USDT:1');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastSavedDraft = useRef('');

  const loadSettings = useCallback(async () => {
    const [walletSettings, withdrawals] = await Promise.all([listWalletSettings(), listPendingWithdrawalRequests(20)]);
    setSettings(walletSettings);
    setPendingWithdrawals(withdrawals);
    setCurrency(walletSettings.currency);
    setMinWithdrawal(String(walletSettings.minWithdrawal));
    setMaxWithdrawal(String(walletSettings.maxWithdrawal));
    setProcessingFeePercent(String(walletSettings.processingFeePercent));
    setApprovalWorkflow(walletSettings.approvalWorkflow);
    setSupportedMethods(walletSettings.supportedMethods);
    setExchangeRateDraft(walletSettings.exchangeRates.map((rate) => `${rate.currency}:${rate.rate}`).join(','));
    lastSavedDraft.current = JSON.stringify({
      currency: walletSettings.currency,
      minWithdrawal: walletSettings.minWithdrawal,
      maxWithdrawal: walletSettings.maxWithdrawal,
      processingFeePercent: walletSettings.processingFeePercent,
      approvalWorkflow: walletSettings.approvalWorkflow,
      supportedMethods: walletSettings.supportedMethods,
      exchangeRateDraft: walletSettings.exchangeRates.map((rate) => `${rate.currency}:${rate.rate}`).join(','),
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadSettings().catch(() => {
      setPendingWithdrawals([]);
      setIsLoading(false);
    });
  }, [loadSettings]);

  const exchangeRates = useMemo(() => {
    return exchangeRateDraft
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [code, rate] = entry.split(':');
        return {
          currency: code?.trim().toUpperCase() ?? 'USD',
          rate: Number(rate ?? '1'),
          label: code?.trim().toUpperCase() ?? 'USD',
        };
      })
      .filter((item) => item.currency && Number.isFinite(item.rate));
  }, [exchangeRateDraft]);

  const validationErrors = useMemo(() => {
    const messages: string[] = [];
    const parsedMin = Number(minWithdrawal);
    const parsedMax = Number(maxWithdrawal);
    const parsedFee = Number(processingFeePercent);

    if (!/^\w{3}$/.test(currency.trim())) {
      messages.push('Currency should be a 3-letter code.');
    }

    if (!Number.isFinite(parsedMin) || parsedMin < 0) {
      messages.push('Minimum withdrawal must be a valid non-negative number.');
    }

    if (!Number.isFinite(parsedMax) || parsedMax < 0) {
      messages.push('Maximum withdrawal must be a valid non-negative number.');
    }

    if (Number.isFinite(parsedMin) && Number.isFinite(parsedMax) && parsedMax < parsedMin) {
      messages.push('Maximum withdrawal must be greater than or equal to minimum withdrawal.');
    }

    if (!Number.isFinite(parsedFee) || parsedFee < 0 || parsedFee > 100) {
      messages.push('Processing fee must be between 0 and 100.');
    }

    if (!exchangeRates.length) {
      messages.push('Add at least one valid exchange rate entry.');
    }

    return messages;
  }, [currency, exchangeRates.length, maxWithdrawal, minWithdrawal, processingFeePercent]);

  const persistSettings = useCallback(async () => {
    const snapshot = JSON.stringify({ currency, minWithdrawal, maxWithdrawal, processingFeePercent, approvalWorkflow, supportedMethods, exchangeRateDraft });

    if (validationErrors.length) {
      setStatusMessage(validationErrors[0]);
      return;
    }

    setIsSaving(true);
    setStatusMessage('Saving wallet settings...');

    try {
      await updateWalletSettings({
        currency,
        minWithdrawal: Number(minWithdrawal),
        maxWithdrawal: Number(maxWithdrawal),
        processingFeePercent: Number(processingFeePercent),
        approvalWorkflow,
        supportedMethods,
        exchangeRates,
      });
      lastSavedDraft.current = snapshot;
      setStatusMessage('Wallet settings saved.');
    } finally {
      setIsSaving(false);
    }
  }, [approvalWorkflow, currency, exchangeRateDraft, exchangeRates, maxWithdrawal, minWithdrawal, processingFeePercent, supportedMethods, validationErrors]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const snapshot = JSON.stringify({ currency, minWithdrawal, maxWithdrawal, processingFeePercent, approvalWorkflow, supportedMethods, exchangeRateDraft });
    if (snapshot === lastSavedDraft.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void persistSettings();
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [approvalWorkflow, currency, exchangeRateDraft, isLoading, maxWithdrawal, minWithdrawal, persistSettings, processingFeePercent, supportedMethods]);

  const handleSave = async () => {
    await persistSettings();
  };

  const handleDecision = async (requestId: string, decision: 'approved' | 'rejected') => {
    setStatusMessage(null);

    try {
      await resolveWithdrawalRequest(
        requestId,
        decision,
        profile?.id ?? 'system_admin',
        decision === 'approved' ? 'Approved in wallet queue' : 'Rejected in wallet queue',
      );
      setStatusMessage(`Withdrawal ${decision}.`);
      await loadSettings();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to process withdrawal.');
    }
  };

  return (
    <div className="page-transition space-y-6 p-6">
      {isLoading ? (
        <>
          <Card className="space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-3/5" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </Card>
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Skeleton className="h-[34rem]" />
            <Skeleton className="h-[34rem]" />
          </div>
        </>
      ) : null}
      <Card className="interactive-card">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Wallet admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Withdrawal controls and approval workflow</h1>
        <p className="mt-2 max-w-3xl text-mist/80">
          Manage payout limits, fees, currencies, exchange rates, and the queue of withdrawal requests that need review.
        </p>
        {validationErrors.length ? <p className="mt-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{validationErrors.join(' ')}</p> : null}
        {statusMessage ? <p className="mt-4 text-sm text-mist/80">{statusMessage}</p> : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="interactive-card">
          <h2 className="text-2xl font-semibold text-white">Wallet configuration</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm text-mist/70">Currency</span>
              <input className="input-base" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
              <p className="form-hint">Use a 3-letter code such as USD or NGN.</p>
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-mist/70">Approval workflow</span>
              <select className="input-base" value={approvalWorkflow} onChange={(event) => setApprovalWorkflow(event.target.value as WalletApprovalWorkflow)}>
                <option value="manual">Manual</option>
                <option value="automatic">Automatic</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-mist/70">Minimum withdrawal</span>
              <input className="input-base" type="number" step="0.01" value={minWithdrawal} onChange={(event) => setMinWithdrawal(event.target.value)} />
              <p className="form-hint">Must be a non-negative amount.</p>
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-mist/70">Maximum withdrawal</span>
              <input className="input-base" type="number" step="0.01" value={maxWithdrawal} onChange={(event) => setMaxWithdrawal(event.target.value)} />
              <p className="form-hint">Should not be lower than the minimum withdrawal.</p>
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-mist/70">Processing fee (%)</span>
              <input className="input-base" type="number" step="0.01" value={processingFeePercent} onChange={(event) => setProcessingFeePercent(event.target.value)} />
              <p className="form-hint">Keep the fee between 0 and 100.</p>
            </label>
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm text-mist/70">Supported payout methods</span>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {(['bank_transfer', 'crypto', 'paypal', 'gift_cards', 'manual_payout'] as WalletWithdrawalMethod[]).map((value) => (
                  <label key={value} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-mist/80">
                    <input
                      type="checkbox"
                      checked={supportedMethods.includes(value)}
                      onChange={(event) => {
                        setSupportedMethods((current) =>
                          event.target.checked ? [...current, value] : current.filter((item) => item !== value),
                        );
                      }}
                    />
                    <span>{value.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </label>
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm text-mist/70">Exchange rates</span>
              <textarea
                className="input-base min-h-28"
                value={exchangeRateDraft}
                onChange={(event) => setExchangeRateDraft(event.target.value)}
                placeholder="USD:1,EUR:0.92,GBP:0.79"
              />
              <p className="form-hint">Use comma-separated pairs in the form CODE:rate.</p>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => void handleSave()} disabled={isSaving || isLoading}>
              {isSaving ? 'Saving...' : 'Save wallet settings'}
            </Button>
            <Button variant="ghost" onClick={() => void loadSettings()}>
              Reload
            </Button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Currency</p>
              <p className="mt-1 text-lg font-semibold text-white">{settings?.currency ?? currency}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Fee</p>
              <p className="mt-1 text-lg font-semibold text-white">{settings?.processingFeePercent ?? processingFeePercent}%</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Min withdrawal</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(settings?.minWithdrawal ?? Number(minWithdrawal), settings?.currency ?? currency)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Max withdrawal</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(settings?.maxWithdrawal ?? Number(maxWithdrawal), settings?.currency ?? currency)}</p>
            </div>
          </div>
        </Card>

        <Card className="interactive-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-white">Approval queue</h2>
              <p className="mt-1 text-sm text-mist/70">Withdrawal requests awaiting review by the admin team.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-mist/80">
              Pending: {pendingWithdrawals.length}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {pendingWithdrawals.length ? pendingWithdrawals.map((request) => (
              <div key={request.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-mist/80">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{request.method.replace(/_/g, ' ')}</p>
                    <p>{request.destinationLabel}</p>
                    <p>{formatCurrency(request.amount, request.currency)} | Net {formatCurrency(request.netAmount, request.currency)}</p>
                    <p>Currency: {request.destinationCurrency}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-mist/70">
                    {request.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => void handleDecision(request.id, 'approved')}>Approve</Button>
                  <Button variant="ghost" onClick={() => void handleDecision(request.id, 'rejected')}>
                    Reject
                  </Button>
                </div>
              </div>
            )) : <p className="text-sm text-mist/60">No pending withdrawals right now.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
