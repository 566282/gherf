import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  listFiatPaymentIntents,
  listActiveMerchantPaymentAccounts,
  listMerchantOrdersForUser,
  type MerchantPaymentAccountOption,
  previewFiatProvider,
  quoteFiatFee,
  startFiatPurchase,
} from '@/services/api/p2pMerchant';
import { listMembershipFeeInvoicesForUser, type MembershipFeeInvoiceRecord } from '@/services/api/membershipAdmin';
import { evaluateMultiplierPricing } from '@/services/api/membershipLifecycle';
import { listWalletSettings } from '@/services/api/wallet';
import { notifySuperAdmins } from '@/services/api/communications';
import { submitP2PPaymentProof, transitionP2POrderState } from '@/services/api/p2pEscrow';
import { openP2PDispute } from '@/services/api/p2pDisputes';

type QuotePreview = {
  provider: string;
  fee: number;
  total: number;
  currency: string;
};

type CatalogItem = {
  key: string;
  label: string;
  description: string;
  moduleKey: 'premium_features' | 'promotional_purchase' | 'membership_multiplier';
  intentType: string;
  amount: number;
  currency: string;
};

const basePremiumFeatureCatalog: CatalogItem[] = [
  {
    key: 'priority-support',
    label: 'Priority support unlock',
    description: 'Fast-track support queue and account assistance for 30 days.',
    moduleKey: 'premium_features',
    intentType: 'priority_support_unlock',
    amount: 49,
    currency: 'USD',
  },
  {
    key: 'analytics-pack',
    label: 'Advanced analytics pack',
    description: 'Unlock expanded history cards and extended insight windows.',
    moduleKey: 'premium_features',
    intentType: 'advanced_analytics_pack',
    amount: 79,
    currency: 'USD',
  },
];

const promotionalPurchaseCatalog: CatalogItem[] = [
  {
    key: 'growth-boost',
    label: 'Growth boost bundle',
    description: 'Promotional bundle for short-run activation and retention pushes.',
    moduleKey: 'promotional_purchase',
    intentType: 'growth_boost_bundle',
    amount: 35,
    currency: 'USD',
  },
  {
    key: 'seasonal-promo',
    label: 'Seasonal promo slot',
    description: 'Reserved promotional inventory for time-boxed campaign placement.',
    moduleKey: 'promotional_purchase',
    intentType: 'seasonal_promo_slot',
    amount: 95,
    currency: 'USD',
  },
];

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

async function loadQuote(userId: string, moduleKey: string, intentType: string, amount: number, currency: string): Promise<QuotePreview> {
  const [provider, quote] = await Promise.all([
    previewFiatProvider(moduleKey, currency),
    quoteFiatFee({
      userId,
      moduleKey,
      intentType,
      amount,
      currency,
    }),
  ]);

  return {
    provider: provider.providerKey,
    fee: quote.feeAmount,
    total: quote.totalAmount,
    currency,
  };
}

export function UserOrdersPage(): JSX.Element {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listMerchantOrdersForUser>>>([]);
  const [intents, setIntents] = useState<Awaited<ReturnType<typeof listFiatPaymentIntents>>>([]);
  const [invoices, setInvoices] = useState<MembershipFeeInvoiceRecord[]>([]);
  const [walletSettings, setWalletSettings] = useState<Awaited<ReturnType<typeof listWalletSettings>> | null>(null);
  const [fundingAmount, setFundingAmount] = useState('100');
  const [fundingCurrency, setFundingCurrency] = useState('USD');
  const [fundingQuote, setFundingQuote] = useState<QuotePreview | null>(null);
  const [invoiceQuotes, setInvoiceQuotes] = useState<Record<string, QuotePreview>>({});
  const [catalogQuotes, setCatalogQuotes] = useState<Record<string, QuotePreview>>({});
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({});
  const [paymentAccountsByOrderId, setPaymentAccountsByOrderId] = useState<Record<string, MerchantPaymentAccountOption[]>>({});
  const [isLoadingAccountsByOrderId, setIsLoadingAccountsByOrderId] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState('Loading payment intents and P2P orders...');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const internalTransferUnlockPrice = walletSettings?.internalTransferUnlockPrice ?? 65;
  const internalTransferUnlockCurrency = walletSettings?.currency ?? 'USD';
  const internalTransfersUnlocked = walletSettings?.internalTransfersEnabled ?? false;
  const multiplierPremiumStatus = walletSettings?.multiplierPremiumEnabled ?? false;
  const multiplierPricing = useMemo(() => evaluateMultiplierPricing(profile?.levelTier ?? 1), [profile?.levelTier]);

  const premiumFeatureCatalog = useMemo<CatalogItem[]>(() => {
    return [
      ...basePremiumFeatureCatalog,
      {
        key: 'internal-transfer-unlock',
        label: 'Internal transfer unlock',
        description: 'Unlock wallet internal transfers (bonus/referral/cashback/reward to main wallet).',
        moduleKey: 'premium_features',
        intentType: 'internal_transfer_unlock',
        amount: internalTransferUnlockPrice,
        currency: internalTransferUnlockCurrency,
      },
      {
        key: 'multiplier-premium-unlock',
        label: 'Multiplier premium activation',
        description: 'Purchase multiplier premium using the membership multiplier activation flow shown in wallet dashboard.',
        moduleKey: 'membership_multiplier',
        intentType: 'membership_multiplier_activation',
        amount: multiplierPricing.amount,
        currency: multiplierPricing.currency,
      },
    ];
  }, [internalTransferUnlockCurrency, internalTransferUnlockPrice, multiplierPricing.amount, multiplierPricing.currency]);

  const loadApprovedAccountsForOrder = async (orderId: string, currency: string): Promise<MerchantPaymentAccountOption[]> => {
    setIsLoadingAccountsByOrderId((current) => ({ ...current, [orderId]: true }));

    try {
      const accounts = await listActiveMerchantPaymentAccounts({
        currency,
        limit: 200,
      });

      setPaymentAccountsByOrderId((current) => ({
        ...current,
        [orderId]: accounts,
      }));

      return accounts;
    } finally {
      setIsLoadingAccountsByOrderId((current) => ({ ...current, [orderId]: false }));
    }
  };

  const refresh = async (): Promise<void> => {
    if (!profile) return;

    const [nextOrders, nextIntents, nextInvoices, nextWalletSettings] = await Promise.all([
      listMerchantOrdersForUser(profile.id, 40),
      listFiatPaymentIntents(profile.id, 40),
      listMembershipFeeInvoicesForUser(profile.id, 12),
      listWalletSettings(),
    ]);

    setOrders(nextOrders);
    setIntents(nextIntents);
    setInvoices(nextInvoices);
    setWalletSettings(nextWalletSettings);
    setStatusMessage('Orders, payment intents, and invoice routes synced.');
  };

  useEffect(() => {
    void refresh().catch(() => {
      setStatusMessage('Unable to load orders and payments right now.');
    });
  }, [premiumFeatureCatalog, profile?.id]);

  useEffect(() => {
    let active = true;
    if (!profile) return;

    const parsedAmount = Number(fundingAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFundingQuote(null);
      return;
    }

    void loadQuote(profile.id, 'wallet_funding', 'wallet_balance_top_up', parsedAmount, fundingCurrency)
      .then((quote) => {
        if (active) setFundingQuote(quote);
      })
      .catch(() => {
        if (active) setFundingQuote(null);
      });

    return () => {
      active = false;
    };
  }, [fundingAmount, fundingCurrency, profile?.id]);

  useEffect(() => {
    let active = true;
    if (!profile) return;

    const loadCatalogQuotes = async () => {
      const quoteEntries = await Promise.all(
        [...premiumFeatureCatalog, ...promotionalPurchaseCatalog].map(async (item) => {
          const quote = await loadQuote(profile.id, item.moduleKey, item.intentType, item.amount, item.currency);
          return [item.key, quote] as const;
        }),
      );

      if (active) setCatalogQuotes(Object.fromEntries(quoteEntries));
    };

    void loadCatalogQuotes().catch(() => {
      if (active) setCatalogQuotes({});
    });

    return () => {
      active = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    let active = true;
    if (!profile || !invoices.length) {
      setInvoiceQuotes({});
      return;
    }

    const loadInvoiceQuotes = async () => {
      const quoteEntries = await Promise.all(
        invoices
          .filter((invoice) => invoice.status === 'unpaid')
          .map(async (invoice) => {
            const quote = await loadQuote(
              profile.id,
              'membership_fee_settlement',
              'membership_fee_invoice_settlement',
              invoice.amount,
              invoice.currency,
            );

            return [invoice.id, quote] as const;
          }),
      );

      if (active) setInvoiceQuotes(Object.fromEntries(quoteEntries));
    };

    void loadInvoiceQuotes().catch(() => {
      if (active) setInvoiceQuotes({});
    });

    return () => {
      active = false;
    };
  }, [invoices, profile?.id]);

  useEffect(() => {
    const ordersWithoutLoadedAccounts = orders.filter((order) => !paymentAccountsByOrderId[order.id] && !isLoadingAccountsByOrderId[order.id]);
    if (!ordersWithoutLoadedAccounts.length) return;

    void Promise.all(
      ordersWithoutLoadedAccounts.map((order) => loadApprovedAccountsForOrder(order.id, order.currency).catch(() => [])),
    );
  }, [orders, paymentAccountsByOrderId, isLoadingAccountsByOrderId]);

  const pendingInvoices = useMemo(() => invoices.filter((invoice) => invoice.status === 'unpaid'), [invoices]);

  const handleStartPurchase = async (input: {
    moduleKey: string;
    intentType: string;
    amount: number;
    currency: string;
    sourceReference: string;
    metadata?: Record<string, unknown>;
  }) => {
    if (!profile) return;

    setIsSubmitting(true);
    setStatusMessage('');
    try {
      const result = await startFiatPurchase({
        userId: profile.id,
        moduleKey: input.moduleKey,
        intentType: input.intentType,
        amount: input.amount,
        currency: input.currency,
        sourceReference: input.sourceReference,
        idempotencyKey: `${input.sourceReference}-intent`,
        metadata: {
          ...input.metadata,
          source: 'user_orders_page',
        },
      });

      let accountsLoaded = 0;
      if (result.order) {
        try {
          const accounts = await loadApprovedAccountsForOrder(result.order.id, result.order.currency);
          accountsLoaded = accounts.length;
        } catch {
          accountsLoaded = 0;
        }
      }

      await refresh();
      setStatusMessage(
        result.order
          ? `Payment intent ${result.intent.id.slice(0, 8)} created and routed to P2P order ${result.order.orderCode}. ${accountsLoaded} approved merchant payment account${accountsLoaded === 1 ? '' : 's'} loaded below. You can pay immediately and then click I have paid.`
          : `Payment intent ${result.intent.id.slice(0, 8)} created with provider ${result.intent.providerKey}.`,
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to start fiat purchase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPayment = async (orderId: string) => {
    if (!profile) return;

    setIsSubmitting(true);
    setStatusMessage('');
    try {
      const paymentReference = paymentReferences[orderId]?.trim();
      await submitP2PPaymentProof({
        orderId,
        submittedBy: profile.id,
        proofType: paymentReference ? 'transaction_id' : 'manual_note',
        amount: orders.find((order) => order.id === orderId)?.totalAmount ?? 0,
        currency: orders.find((order) => order.id === orderId)?.currency ?? 'USD',
        paymentReference,
        metadata: {
          source: 'user_orders_page',
        },
      });
      await transitionP2POrderState({
        orderId,
        nextState: 'payment_submitted',
        actorId: profile.id,
        actorRole: 'user',
        idempotencyKey: `user-paid-${orderId}`,
        metadata: {
          source: 'user_orders_page',
          paymentReference,
        },
      });

      const selectedOrder = orders.find((order) => order.id === orderId);
      try {
        await notifySuperAdmins({
          title: 'P2P payment proof submitted by user',
          message: `User ${profile.fullName ?? profile.email ?? profile.id} submitted payment proof for order ${selectedOrder?.orderCode ?? orderId}. Please confirm with the assigned P2P merchant.`,
          type: 'info',
          channel: 'in_app',
          category: 'transactional',
          metadata: {
            source: 'user_orders_page',
            orderId,
            orderCode: selectedOrder?.orderCode ?? null,
            userId: profile.id,
            userEmail: profile.email,
            paymentReference: paymentReference ?? null,
            amount: selectedOrder?.totalAmount ?? null,
            currency: selectedOrder?.currency ?? null,
          },
        });
      } catch {
        // Payment submission should not fail if admin notification fails.
      }

      await refresh();
      setStatusMessage('Payment proof submitted and order moved to payment_submitted. Admin notification has been triggered for merchant confirmation.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to submit payment proof.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestReview = async (orderId: string) => {
    if (!profile) return;

    setIsSubmitting(true);
    setStatusMessage('');
    try {
      await openP2PDispute({
        orderId,
        openedBy: profile.id,
        disputeReason: 'customer_requested_review',
        metadata: {
          source: 'user_orders_page',
        },
      });
      await transitionP2POrderState({
        orderId,
        nextState: 'under_review',
        actorId: profile.id,
        actorRole: 'user',
        idempotencyKey: `user-review-${orderId}`,
        metadata: {
          source: 'user_orders_page',
        },
      });
      await refresh();
      setStatusMessage('Order sent to review and dispute trail opened.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to request review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!profile) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <h1 className="text-3xl font-semibold text-foreground">Orders and payments</h1>
          <p className="mt-2 text-muted">Sign in to manage fiat purchases and P2P orders.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Orders and payments</p>
        <h1 className="mt-2 text-4xl font-semibold text-foreground">Fiat purchase routing and P2P actions</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Start wallet funding, settle membership fee invoices, unlock premium features, launch promotional purchases, and manage your customer-side P2P order actions in one place.
        </p>
        <p className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">{statusMessage}</p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-accent/70">Wallet funding</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Top up wallet with fiat</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm text-muted">Amount</span>
              <input className="input-base" type="number" min="1" step="0.01" value={fundingAmount} onChange={(event) => setFundingAmount(event.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-muted">Currency</span>
              <select className="input-base" value={fundingCurrency} onChange={(event) => setFundingCurrency(event.target.value)}>
                {['USD', 'NGN', 'EUR', 'GBP'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </label>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            <p>Provider: <span className="text-foreground">{fundingQuote?.provider ?? 'Loading...'}</span></p>
            <p>Fee: <span className="text-foreground">{fundingQuote ? formatCurrency(fundingQuote.fee, fundingQuote.currency) : 'Loading...'}</span></p>
            <p>Total: <span className="text-foreground">{fundingQuote ? formatCurrency(fundingQuote.total, fundingQuote.currency) : 'Loading...'}</span></p>
          </div>
          <Button
            onClick={() => void handleStartPurchase({
              moduleKey: 'wallet_funding',
              intentType: 'wallet_balance_top_up',
              amount: Number(fundingAmount || 0),
              currency: fundingCurrency,
              sourceReference: `wallet-funding-${profile.id.slice(0, 8)}-${Date.now()}`,
              metadata: {
                fundingCurrency,
              },
            })}
            disabled={isSubmitting || !Number.isFinite(Number(fundingAmount)) || Number(fundingAmount) <= 0}
          >
            {isSubmitting ? 'Submitting...' : 'Create wallet funding intent'}
          </Button>
        </Card>

        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-accent/70">Membership fee settlement</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Outstanding invoices</h2>
          </div>
          <div className="space-y-3">
            {pendingInvoices.map((invoice) => (
              <div key={invoice.id} className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{invoice.feeCycleKey}</p>
                    <p>Due {invoice.dueAt ? formatDate(invoice.dueAt) : 'as soon as possible'}</p>
                    <p>
                      Provider: {invoiceQuotes[invoice.id]?.provider ?? 'Loading...'} · Fee: {invoiceQuotes[invoice.id] ? formatCurrency(invoiceQuotes[invoice.id].fee, invoice.currency) : 'Loading...'} · Total: {invoiceQuotes[invoice.id] ? formatCurrency(invoiceQuotes[invoice.id].total, invoice.currency) : 'Loading...'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">{formatCurrency(invoice.amount, invoice.currency)}</p>
                    <Button
                      className="mt-3"
                      onClick={() => void handleStartPurchase({
                        moduleKey: 'membership_fee_settlement',
                        intentType: 'membership_fee_invoice_settlement',
                        amount: invoice.amount,
                        currency: invoice.currency,
                        sourceReference: invoice.id,
                        metadata: {
                          invoiceId: invoice.id,
                          feeCycleKey: invoice.feeCycleKey,
                        },
                      })}
                      disabled={isSubmitting}
                    >
                      Pay invoice
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {!pendingInvoices.length ? <p className="text-sm text-muted">No unpaid membership fee invoices found.</p> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-accent/70">Premium features</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Feature unlock purchases</h2>
          </div>
          <div className="space-y-3">
            {premiumFeatureCatalog.map((item) => (
              <div key={item.key} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="mt-1 text-sm text-muted">{item.description}</p>
                    <p className="mt-2 text-sm text-muted">
                      Provider: {catalogQuotes[item.key]?.provider ?? 'Loading...'} · Fee: {catalogQuotes[item.key] ? formatCurrency(catalogQuotes[item.key].fee, item.currency) : 'Loading...'} · Total: {catalogQuotes[item.key] ? formatCurrency(catalogQuotes[item.key].total, item.currency) : 'Loading...'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">{formatCurrency(item.amount, item.currency)}</p>
                    {item.key === 'internal-transfer-unlock' ? (
                      <p className="mt-1 text-xs text-muted">{internalTransfersUnlocked ? 'Status: unlocked by admin' : 'Status: locked by admin'}</p>
                    ) : null}
                    {item.key === 'multiplier-premium-unlock' ? (
                      <p className="mt-1 text-xs text-muted">{multiplierPremiumStatus ? 'Status: unlocked by admin' : 'Status: locked by admin'}</p>
                    ) : null}
                    <Button
                      className="mt-3"
                      onClick={() => void handleStartPurchase({
                        moduleKey: item.moduleKey,
                        intentType: item.intentType,
                        amount: item.amount,
                        currency: item.currency,
                        sourceReference: `${item.key}-${profile.id.slice(0, 8)}-${Date.now()}`,
                        metadata: {
                          productKey: item.key,
                          productLabel: item.label,
                          unlockFeature: item.key === 'internal-transfer-unlock' ? 'internal_transfers' : undefined,
                          multiplierFeature: item.key === 'multiplier-premium-unlock' ? 'membership_multiplier' : undefined,
                          planLevel: item.key === 'multiplier-premium-unlock' ? profile.levelTier : undefined,
                        },
                      })}
                      disabled={
                        isSubmitting ||
                        (item.key === 'internal-transfer-unlock' && internalTransfersUnlocked) ||
                        (item.key === 'multiplier-premium-unlock' && multiplierPremiumStatus)
                      }
                    >
                      {item.key === 'internal-transfer-unlock' && internalTransfersUnlocked
                        ? 'Already unlocked by admin'
                        : item.key === 'multiplier-premium-unlock' && multiplierPremiumStatus
                          ? 'Already unlocked by admin'
                          : 'Buy feature'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-accent/70">Promotional purchases</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Promo inventory and boosts</h2>
          </div>
          <div className="space-y-3">
            {promotionalPurchaseCatalog.map((item) => (
              <div key={item.key} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="mt-1 text-sm text-muted">{item.description}</p>
                    <p className="mt-2 text-sm text-muted">
                      Provider: {catalogQuotes[item.key]?.provider ?? 'Loading...'} · Fee: {catalogQuotes[item.key] ? formatCurrency(catalogQuotes[item.key].fee, item.currency) : 'Loading...'} · Total: {catalogQuotes[item.key] ? formatCurrency(catalogQuotes[item.key].total, item.currency) : 'Loading...'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">{formatCurrency(item.amount, item.currency)}</p>
                    <Button
                      className="mt-3"
                      onClick={() => void handleStartPurchase({
                        moduleKey: item.moduleKey,
                        intentType: item.intentType,
                        amount: item.amount,
                        currency: item.currency,
                        sourceReference: `${item.key}-${profile.id.slice(0, 8)}-${Date.now()}`,
                        metadata: {
                          promotionKey: item.key,
                          promotionLabel: item.label,
                        },
                      })}
                      disabled={isSubmitting}
                    >
                      Buy promo
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border border-border bg-surface-elevated">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-accent/70">Customer P2P actions</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Your P2P orders</h2>
            </div>
            <Button variant="ghost" onClick={() => void refresh()} disabled={isSubmitting}>Reload orders</Button>
          </div>
          <div className="mt-4 space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{order.orderCode}</p>
                    <p className="mt-1 text-sm text-muted">{order.moduleKey.replace(/_/g, ' ')} · {order.currentState}</p>
                    <p className="mt-1 text-sm text-muted">Updated {formatDate(order.updatedAt)}</p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(order.totalAmount, order.currency)}</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <label className="grid gap-2">
                    <span className="text-sm text-muted">Transaction or transfer reference</span>
                    <input
                      className="input-base"
                      value={paymentReferences[order.id] ?? ''}
                      onChange={(event) => setPaymentReferences((current) => ({ ...current, [order.id]: event.target.value }))}
                      placeholder="Optional payment reference"
                    />
                  </label>
                  <Button onClick={() => void handleSubmitPayment(order.id)} disabled={isSubmitting}>
                    I have paid
                  </Button>
                  <Button variant="ghost" onClick={() => void handleRequestReview(order.id)} disabled={isSubmitting}>
                    Request review
                  </Button>
                </div>
                <div className="mt-4 rounded-xl border border-border/70 bg-surface-elevated p-4 text-sm text-muted">
                  <p className="font-medium text-foreground">Approved P2P merchant payment accounts</p>
                  <p className="mt-1">Pay to any active admin-approved account below, then click I have paid.</p>
                  {isLoadingAccountsByOrderId[order.id] ? (
                    <p className="mt-2">Loading approved merchant accounts...</p>
                  ) : null}
                  {!isLoadingAccountsByOrderId[order.id] && paymentAccountsByOrderId[order.id]?.length ? (
                    <div className="mt-3 space-y-2">
                      {paymentAccountsByOrderId[order.id].map((account) => (
                        <div key={`${order.id}:${account.id}`} className="rounded-lg border border-border bg-surface px-3 py-2">
                          <p className="font-medium text-foreground">{account.merchantName} ({account.merchantCode})</p>
                          <p>{account.label}</p>
                          <p>{account.bankName ?? account.provider ?? 'Settlement account'} · {account.currency}</p>
                          <p>Account name: <span className="text-foreground">{account.accountName}</span></p>
                          <p>Account number: <span className="text-foreground">{account.accountNumber}</span></p>
                          {account.paymentInstructions ? <p className="mt-1">Instructions: {account.paymentInstructions}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {!isLoadingAccountsByOrderId[order.id] && !paymentAccountsByOrderId[order.id]?.length ? (
                    <p className="mt-2">No active admin-approved merchant accounts are currently available for {order.currency}. Please request support review.</p>
                  ) : null}
                </div>
              </div>
            ))}
            {!orders.length ? <p className="text-sm text-muted">No P2P orders created yet.</p> : null}
          </div>
        </Card>

        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm uppercase tracking-[0.2em] text-accent/70">Intent log</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Recent fiat intents</h2>
          <div className="mt-4 space-y-3 text-sm text-muted">
            {intents.map((intent) => (
              <div key={intent.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{intent.moduleKey.replace(/_/g, ' ')}</p>
                    <p>{intent.intentType.replace(/_/g, ' ')}</p>
                    <p>{intent.providerKey} · {intent.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{formatCurrency(intent.totalAmount, intent.currency)}</p>
                    <p>{formatDate(intent.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
            {!intents.length ? <p>No fiat payment intents recorded yet.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}