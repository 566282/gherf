import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  getMerchantProfileByUserId,
  getMerchantWalletAccounts,
  listMerchantAssignedOrders,
} from '@/services/api/p2pMerchant';
import { transitionP2POrderState } from '@/services/api/p2pEscrow';
import { openP2PDispute } from '@/services/api/p2pDisputes';
import { listP2PRuntimeSettings } from '@/services/api/p2pAdmin';

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export function MerchantDashboardPage(): JSX.Element {
  const { profile } = useAuth();
  const [merchant, setMerchant] = useState<Awaited<ReturnType<typeof getMerchantProfileByUserId>>>(null);
  const [wallets, setWallets] = useState<Awaited<ReturnType<typeof getMerchantWalletAccounts>>>([]);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listMerchantAssignedOrders>>>([]);
  const [runtimeSettings, setRuntimeSettings] = useState<Record<string, unknown>>({});
  const [statusMessage, setStatusMessage] = useState('Loading merchant dashboard...');

  const refresh = async (): Promise<void> => {
    if (!profile) return;

    const nextMerchant = await getMerchantProfileByUserId(profile.id);
    setMerchant(nextMerchant);

    if (!nextMerchant) {
      setWallets([]);
      setOrders([]);
      setStatusMessage('No merchant profile found for this account.');
      return;
    }

    const [nextWallets, nextOrders, nextRuntimeSettings] = await Promise.all([
      getMerchantWalletAccounts(nextMerchant.id),
      listMerchantAssignedOrders(nextMerchant.id, 40),
      listP2PRuntimeSettings(),
    ]);

    setWallets(nextWallets);
    setOrders(nextOrders);
    setRuntimeSettings(nextRuntimeSettings);
    setStatusMessage('Merchant dashboard synced from live P2P tables.');
  };

  useEffect(() => {
    void refresh().catch(() => {
      setStatusMessage('Unable to load merchant dashboard right now.');
    });
  }, [profile?.id]);

  const summary = useMemo(() => {
    const available = wallets.find((wallet) => wallet.walletType === 'available')?.availableBalance ?? 0;
    const reserved = wallets.find((wallet) => wallet.walletType === 'reserved')?.reservedBalance ?? 0;
    const pending = wallets.find((wallet) => wallet.walletType === 'pending')?.pendingBalance ?? 0;
    const locked = wallets.find((wallet) => wallet.walletType === 'locked')?.lockedBalance ?? 0;

    return {
      available,
      reserved,
      pending,
      locked,
      assigned: orders.filter((order) => order.currentState === 'merchant_assigned').length,
      completed: orders.filter((order) => order.currentState === 'completed').length,
      disputed: orders.filter((order) => order.currentState === 'disputed' || order.currentState === 'under_review').length,
    };
  }, [orders, wallets]);

  const minOperatingBalance = Number(runtimeSettings.p2p_min_operating_balance ?? 0);
  const lowLiquidity = summary.available < minOperatingBalance;

  const handleOrderAction = async (orderId: string, action: 'confirm' | 'review' | 'dispute') => {
    if (!profile || !merchant) return;

    try {
      if (action === 'dispute') {
        await openP2PDispute({
          orderId,
          openedBy: profile.id,
          disputeReason: 'merchant_reported_issue',
          metadata: {
            source: 'merchant_dashboard',
          },
        });

        await transitionP2POrderState({
          orderId,
          nextState: 'disputed',
          actorId: profile.id,
          actorRole: 'merchant',
          idempotencyKey: `merchant-dispute-${orderId}`,
          metadata: { source: 'merchant_dashboard' },
        });

        setStatusMessage('Order moved to disputed state and dispute case created.');
      } else {
        await transitionP2POrderState({
          orderId,
          nextState: action === 'confirm' ? 'confirmed' : 'under_review',
          actorId: profile.id,
          actorRole: 'merchant',
          idempotencyKey: `merchant-${action}-${orderId}`,
          metadata: { source: 'merchant_dashboard' },
        });

        setStatusMessage(action === 'confirm' ? 'Order confirmed.' : 'Order routed to review.');
      }

      await refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to apply order action.');
    }
  };

  if (!profile) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <h1 className="text-3xl font-semibold text-foreground">Merchant dashboard</h1>
          <p className="mt-2 text-muted">Sign in to view your P2P merchant dashboard.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">P2P merchant</p>
        <h1 className="mt-2 text-4xl font-semibold text-foreground">Merchant dashboard</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Track merchant liquidity, assigned orders, SLA-sensitive states, and settlement flow in one place.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => void refresh()}>Reload</Button>
          <p className="rounded-xl border border-border bg-surface px-4 py-2 text-sm text-muted">{statusMessage}</p>
        </div>
        {lowLiquidity ? (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Available liquidity is below the minimum operating threshold ({formatCurrency(minOperatingBalance, merchant?.preferredCurrency ?? 'USD')}).
            Matching eligibility may be reduced until funds are topped up.
          </p>
        ) : null}
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Available liquidity</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatCurrency(summary.available, merchant?.preferredCurrency ?? 'USD')}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Reserved</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatCurrency(summary.reserved, merchant?.preferredCurrency ?? 'USD')}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Pending</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatCurrency(summary.pending, merchant?.preferredCurrency ?? 'USD')}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Locked</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatCurrency(summary.locked, merchant?.preferredCurrency ?? 'USD')}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Assigned orders</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{summary.assigned}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Completed orders</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{summary.completed}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Dispute/review orders</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{summary.disputed}</p>
        </Card>
      </div>

      <Card className="border border-border bg-surface-elevated">
        <h2 className="text-2xl font-semibold text-foreground">Merchant profile</h2>
        {!merchant ? (
          <p className="mt-3 text-muted">This account is not yet activated as a merchant profile.</p>
        ) : (
          <div className="mt-3 grid gap-2 text-sm text-muted md:grid-cols-2">
            <p><span className="text-foreground">Code:</span> {merchant.merchantCode}</p>
            <p><span className="text-foreground">Status:</span> {merchant.status}</p>
            <p><span className="text-foreground">Country:</span> {merchant.countryCode ?? 'n/a'}</p>
            <p><span className="text-foreground">Risk score:</span> {merchant.riskScore}</p>
            <p><span className="text-foreground">Rating score:</span> {merchant.ratingScore}</p>
            <p><span className="text-foreground">Completion rate:</span> {merchant.completionRate}%</p>
          </div>
        )}
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <h2 className="text-2xl font-semibold text-foreground">Assigned orders</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-border/60 text-foreground last:border-0">
                  <td className="px-4 py-3">{order.orderCode}</td>
                  <td className="px-4 py-3">{formatCurrency(order.totalAmount, order.currency)}</td>
                  <td className="px-4 py-3">{order.currentState}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(order.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => void handleOrderAction(order.id, 'confirm')}>Confirm</Button>
                      <Button onClick={() => void handleOrderAction(order.id, 'review')}>Review</Button>
                      <Button onClick={() => void handleOrderAction(order.id, 'dispute')}>Dispute</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!orders.length ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={5}>No merchant orders yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
