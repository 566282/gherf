import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';
import { TelemetryDebugPanel } from '@/components/ui/TelemetryDebugPanel';
import { useAuth } from '@/app/providers/AuthProvider';
import { emitDashboardTelemetry } from '@/lib/telemetry';
import {
  getMerchantProfileByUserId,
  listMerchantAnalytics,
  getMerchantWalletAccounts,
  listMerchantAssignedOrders,
} from '@/services/api/p2pMerchant';
import {
  listMerchantWithdrawalAssignments,
  merchantMarkWithdrawalPayoutSent,
  merchantRespondWithdrawalAssignment,
  type MerchantWithdrawalAssignment,
} from '@/services/api/withdrawalOperations';
import { transitionP2POrderState } from '@/services/api/p2pEscrow';
import { openP2PDispute } from '@/services/api/p2pDisputes';
import { listP2PRuntimeSettings } from '@/services/api/p2pAdmin';

const ASSIGNMENT_BATCH_SIZE = 12;
const ORDER_BATCH_SIZE = 10;
const ANALYTICS_BATCH_SIZE = 10;

type MerchantSection = 'assignments' | 'orders' | 'analytics';

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildCsv(rows: Array<Record<string, string | number>>): string {
  if (!rows.length) return 'No data\n';

  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number) => {
    const raw = String(value ?? '');
    return raw.includes(',') || raw.includes('"') || raw.includes('\n') ? `"${raw.replace(/"/g, '""')}"` : raw;
  };

  return [headers.join(','), ...rows.map((row) => headers.map((header) => escapeCell(row[header] ?? '')).join(','))].join('\n');
}

export function MerchantDashboardPage(): JSX.Element {
  const { profile } = useAuth();
  const [merchant, setMerchant] = useState<Awaited<ReturnType<typeof getMerchantProfileByUserId>>>(null);
  const [wallets, setWallets] = useState<Awaited<ReturnType<typeof getMerchantWalletAccounts>>>([]);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listMerchantAssignedOrders>>>([]);
  const [withdrawalAssignments, setWithdrawalAssignments] = useState<MerchantWithdrawalAssignment[]>([]);
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof listMerchantAnalytics>>>([]);
  const [runtimeSettings, setRuntimeSettings] = useState<Record<string, unknown>>({});
  const [assignmentNotes, setAssignmentNotes] = useState<Record<string, string>>({});
  const [assignmentPaymentRefs, setAssignmentPaymentRefs] = useState<Record<string, string>>({});
  const [isApplyingWithdrawalAction, setIsApplyingWithdrawalAction] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Loading merchant dashboard...');
  const [assignmentsExpanded, setAssignmentsExpanded] = useState(true);
  const [ordersExpanded, setOrdersExpanded] = useState(true);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false);
  const [visibleAssignmentCount, setVisibleAssignmentCount] = useState(ASSIGNMENT_BATCH_SIZE);
  const [visibleOrderCount, setVisibleOrderCount] = useState(ORDER_BATCH_SIZE);
  const [visibleAnalyticsCount, setVisibleAnalyticsCount] = useState(ANALYTICS_BATCH_SIZE);

  const setSectionExpanded = (section: MerchantSection, expanded: boolean) => {
    if (section === 'assignments') setAssignmentsExpanded(expanded);
    if (section === 'orders') setOrdersExpanded(expanded);
    if (section === 'analytics') setAnalyticsExpanded(expanded);

    emitDashboardTelemetry({
      area: 'merchant',
      action: expanded ? 'expand_section' : 'collapse_section',
      metadata: { section },
    });
  };

  const refresh = async (): Promise<void> => {
    if (!profile) return;

    const nextMerchant = await getMerchantProfileByUserId(profile.id);
    setMerchant(nextMerchant);

    if (!nextMerchant) {
      setWallets([]);
      setOrders([]);
      setWithdrawalAssignments([]);
      setAnalytics([]);
      setStatusMessage('No merchant profile found for this account.');
      return;
    }

    const [nextWallets, nextOrders, nextWithdrawalAssignments, nextAnalytics, nextRuntimeSettings] = await Promise.all([
      getMerchantWalletAccounts(nextMerchant.id),
      listMerchantAssignedOrders(nextMerchant.id, 40),
      listMerchantWithdrawalAssignments(80),
      listMerchantAnalytics(nextMerchant.id, 30),
      listP2PRuntimeSettings(),
    ]);

    setWallets(nextWallets);
    setOrders(nextOrders);
    setWithdrawalAssignments(nextWithdrawalAssignments);
    setAnalytics(nextAnalytics);
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
      payoutAssignments: withdrawalAssignments.filter((assignment) => assignment.assignmentStatus === 'assigned' || assignment.assignmentStatus === 'accepted').length,
      receiptPending: withdrawalAssignments.filter((assignment) => assignment.workflowStateKey === 'user_receipt_pending').length,
    };
  }, [orders, wallets, withdrawalAssignments]);

  const minOperatingBalance = Number(runtimeSettings.p2p_min_operating_balance ?? 0);
  const lowLiquidity = summary.available < minOperatingBalance;

  const urgentAssignments = useMemo(
    () =>
      withdrawalAssignments.filter(
        (assignment) =>
          assignment.assignmentStatus === 'assigned' ||
          assignment.assignmentStatus === 'reassigned' ||
          assignment.assignmentStatus === 'accepted' ||
          assignment.workflowStateKey === 'merchant_acknowledged',
      ),
    [withdrawalAssignments],
  );
  const assignmentSource = urgentAssignments.length ? urgentAssignments : withdrawalAssignments;
  const visibleAssignments = assignmentSource.slice(0, visibleAssignmentCount);
  const visibleOrders = orders.slice(0, visibleOrderCount);
  const visibleAnalytics = analytics.slice(0, visibleAnalyticsCount);

  const analyticsExportRows = useMemo(
    () => analytics.map((item) => ({
      report_date: item.reportDate,
      assigned_orders: item.assignedOrders,
      completed_orders: item.completedOrders,
      disputed_orders: item.disputedOrders,
      average_response_seconds: item.averageResponseSeconds,
      completion_rate_percent: item.completionRate,
      earnings_total: item.earningsTotal,
    })),
    [analytics],
  );

  const exportAnalytics = (format: 'csv' | 'excel') => {
    if (!merchant) return;

    if (format === 'csv') {
      const csv = buildCsv(analyticsExportRows);
      triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `merchant-analytics-${merchant.merchantCode}.csv`);
      return;
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(analyticsExportRows.length ? analyticsExportRows : [{ empty: 'No analytics snapshots available' }]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Merchant Analytics');
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    triggerDownload(
      new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `merchant-analytics-${merchant.merchantCode}.xlsx`,
    );
  };

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

  const handleWithdrawalAssignmentAction = async (
    assignment: MerchantWithdrawalAssignment,
    action: 'accept' | 'decline' | 'payout_sent',
  ) => {
    setIsApplyingWithdrawalAction(true);

    try {
      if (action === 'payout_sent') {
        const paymentReference = assignmentPaymentRefs[assignment.assignmentId]?.trim();
        await merchantMarkWithdrawalPayoutSent({
          assignmentId: assignment.assignmentId,
          paymentReference: paymentReference || undefined,
          note: assignmentNotes[assignment.assignmentId]?.trim() || undefined,
          idempotencyKey: `merchant-payout:${assignment.assignmentId}:${Date.now()}`,
        });
        setStatusMessage('Payout marked as sent. User receipt confirmation is now pending.');
      } else {
        const result = await merchantRespondWithdrawalAssignment({
          assignmentId: assignment.assignmentId,
          action,
          note: assignmentNotes[assignment.assignmentId]?.trim() || undefined,
          idempotencyKey: `merchant-${action}:${assignment.assignmentId}:${Date.now()}`,
        });

        if (action === 'accept') {
          setStatusMessage('Assignment accepted. You can now mark payout as sent when complete.');
        } else {
          setStatusMessage(
            result.reassignedAssignmentId
              ? 'Assignment declined. Withdrawal was auto-reassigned to the next eligible merchant.'
              : 'Assignment declined. No eligible fallback merchant available at this time.',
          );
        }
      }

      await refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to apply withdrawal assignment action.');
    } finally {
      setIsApplyingWithdrawalAction(false);
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
      <TelemetryDebugPanel />
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">P2P merchant</p>
        <h1 className="mt-2 text-4xl font-semibold text-foreground">Merchant dashboard</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Track merchant liquidity, assigned orders, SLA-sensitive states, and settlement flow in one place.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => void refresh()}>Reload</Button>
          <Link to="/app/merchant/kyc" className="rounded-full border border-border px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
            Open KYC requirements
          </Link>
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
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Active payout assignments</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{summary.payoutAssignments}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Awaiting user receipt confirm</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{summary.receiptPending}</p>
        </Card>
      </div>

      <Card className="border border-border bg-surface-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Workspace map</p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">Jump and collapse sections</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <a href="#merchant-assignments" className="rounded-full border border-border bg-surface px-3 py-1.5 text-muted hover:text-foreground">Assignments</a>
            <a href="#merchant-orders" className="rounded-full border border-border bg-surface px-3 py-1.5 text-muted hover:text-foreground">Orders</a>
            <a href="#merchant-analytics" className="rounded-full border border-border bg-surface px-3 py-1.5 text-muted hover:text-foreground">Analytics</a>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <button
            type="button"
            aria-expanded={assignmentsExpanded}
            aria-controls="merchant-assignments"
            onClick={() => setSectionExpanded('assignments', !assignmentsExpanded)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm text-muted transition hover:text-foreground"
          >
            {assignmentsExpanded ? 'Hide' : 'Show'} payout assignments
          </button>
          <button
            type="button"
            aria-expanded={ordersExpanded}
            aria-controls="merchant-orders"
            onClick={() => setSectionExpanded('orders', !ordersExpanded)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm text-muted transition hover:text-foreground"
          >
            {ordersExpanded ? 'Hide' : 'Show'} assigned orders
          </button>
          <button
            type="button"
            aria-expanded={analyticsExpanded}
            aria-controls="merchant-analytics"
            onClick={() => setSectionExpanded('analytics', !analyticsExpanded)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm text-muted transition hover:text-foreground"
          >
            {analyticsExpanded ? 'Hide' : 'Show'} analytics snapshots
          </button>
        </div>
      </Card>

      <section id="merchant-assignments" className={`transition-opacity duration-300 motion-reduce:transition-none ${assignmentsExpanded ? 'opacity-100' : 'hidden opacity-0'}`}>
      <Card className="border border-border bg-surface-elevated">
        <h2 className="text-2xl font-semibold text-foreground">Withdrawal payout assignments</h2>
        <p className="mt-2 text-sm text-muted">Accept or decline assignments, then mark payout sent so users can confirm receipt. Urgent queues are shown first when present.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3">Action controls</th>
              </tr>
            </thead>
            <tbody>
              {visibleAssignments.map((assignment) => {
                const allowAccept = assignment.assignmentStatus === 'assigned' || assignment.assignmentStatus === 'reassigned';
                const allowDecline = allowAccept || assignment.assignmentStatus === 'accepted';
                const allowPayoutSent = assignment.assignmentStatus === 'accepted' && assignment.workflowStateKey === 'merchant_acknowledged';

                return (
                  <tr key={assignment.assignmentId} className="border-b border-border/60 text-foreground last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{assignment.userDisplayName}</p>
                      <p className="text-xs text-muted">{assignment.userEmail ?? assignment.userId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{formatCurrency(assignment.netAmount || assignment.amount, assignment.currency)}</p>
                      <p className="text-xs text-muted">Gross {formatCurrency(assignment.amount, assignment.currency)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{assignment.destinationLabel}</p>
                      <p className="text-xs text-muted break-all">{assignment.destinationValue ?? '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{assignment.workflowStateKey}</p>
                      <p className="text-xs text-muted">{assignment.assignmentStatus}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{assignment.dueAt ? formatDate(assignment.dueAt) : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="grid gap-2">
                        <input
                          className="input-base"
                          value={assignmentPaymentRefs[assignment.assignmentId] ?? ''}
                          onChange={(event) => setAssignmentPaymentRefs((current) => ({ ...current, [assignment.assignmentId]: event.target.value }))}
                          placeholder="Payment reference"
                        />
                        <textarea
                          className="input-base min-h-20"
                          value={assignmentNotes[assignment.assignmentId] ?? ''}
                          onChange={(event) => setAssignmentNotes((current) => ({ ...current, [assignment.assignmentId]: event.target.value }))}
                          placeholder="Assignment note"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button disabled={!allowAccept || isApplyingWithdrawalAction} onClick={() => void handleWithdrawalAssignmentAction(assignment, 'accept')}>
                            Accept
                          </Button>
                          <Button disabled={!allowDecline || isApplyingWithdrawalAction} onClick={() => void handleWithdrawalAssignmentAction(assignment, 'decline')}>
                            Decline
                          </Button>
                          <Button disabled={!allowPayoutSent || isApplyingWithdrawalAction} onClick={() => void handleWithdrawalAssignmentAction(assignment, 'payout_sent')}>
                            Mark payout sent
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!visibleAssignments.length ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={6}>No withdrawal payout assignments available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {assignmentSource.length > visibleAssignments.length ? (
            <Button
              variant="ghost"
              onClick={() => {
                setVisibleAssignmentCount((count) => count + ASSIGNMENT_BATCH_SIZE);
                emitDashboardTelemetry({ area: 'merchant', action: 'show_more_assignments', metadata: { batchSize: ASSIGNMENT_BATCH_SIZE } });
              }}
            >
              Show more assignments
            </Button>
          ) : null}
          {visibleAssignmentCount > ASSIGNMENT_BATCH_SIZE && assignmentSource.length > ASSIGNMENT_BATCH_SIZE ? (
            <Button
              variant="ghost"
              onClick={() => {
                setVisibleAssignmentCount(ASSIGNMENT_BATCH_SIZE);
                emitDashboardTelemetry({ area: 'merchant', action: 'show_fewer_assignments' });
              }}
            >
              Show fewer assignments
            </Button>
          ) : null}
        </div>
      </Card>
      </section>

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

      <section id="merchant-orders" className={`transition-opacity duration-300 motion-reduce:transition-none ${ordersExpanded ? 'opacity-100' : 'hidden opacity-0'}`}>
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
              {visibleOrders.map((order) => (
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
              {!visibleOrders.length ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={5}>No merchant orders yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {orders.length > visibleOrders.length ? (
            <Button
              variant="ghost"
              onClick={() => {
                setVisibleOrderCount((count) => count + ORDER_BATCH_SIZE);
                emitDashboardTelemetry({ area: 'merchant', action: 'show_more_orders', metadata: { batchSize: ORDER_BATCH_SIZE } });
              }}
            >
              Show more orders
            </Button>
          ) : null}
          {visibleOrderCount > ORDER_BATCH_SIZE && orders.length > ORDER_BATCH_SIZE ? (
            <Button
              variant="ghost"
              onClick={() => {
                setVisibleOrderCount(ORDER_BATCH_SIZE);
                emitDashboardTelemetry({ area: 'merchant', action: 'show_fewer_orders' });
              }}
            >
              Show fewer orders
            </Button>
          ) : null}
        </div>
      </Card>
      </section>

      <section id="merchant-analytics" className={`transition-opacity duration-300 motion-reduce:transition-none ${analyticsExpanded ? 'opacity-100' : 'hidden opacity-0'}`}>
      <Card className="border border-border bg-surface-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Analytics snapshots</h2>
            <p className="mt-2 text-sm text-muted">Daily merchant KPI rollups ready for CSV or Excel export.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => exportAnalytics('csv')} disabled={!merchant}>Export CSV</Button>
            <Button variant="ghost" onClick={() => exportAnalytics('excel')} disabled={!merchant}>Export Excel</Button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Disputed</th>
                <th className="px-4 py-3">Response</th>
                <th className="px-4 py-3">Completion</th>
                <th className="px-4 py-3">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {visibleAnalytics.map((item) => (
                <tr key={item.id} className="border-b border-border/60 text-foreground last:border-0">
                  <td className="px-4 py-3">{item.reportDate}</td>
                  <td className="px-4 py-3">{item.assignedOrders}</td>
                  <td className="px-4 py-3">{item.completedOrders}</td>
                  <td className="px-4 py-3">{item.disputedOrders}</td>
                  <td className="px-4 py-3">{Number(item.averageResponseSeconds).toFixed(2)}s</td>
                  <td className="px-4 py-3">{Number(item.completionRate).toFixed(2)}%</td>
                  <td className="px-4 py-3">{formatCurrency(item.earningsTotal, merchant?.preferredCurrency ?? 'USD')}</td>
                </tr>
              ))}
              {!visibleAnalytics.length ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={7}>No merchant analytics snapshots available yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {analytics.length > visibleAnalytics.length ? (
            <Button
              variant="ghost"
              onClick={() => {
                setVisibleAnalyticsCount((count) => count + ANALYTICS_BATCH_SIZE);
                emitDashboardTelemetry({ area: 'merchant', action: 'show_more_analytics_rows', metadata: { batchSize: ANALYTICS_BATCH_SIZE } });
              }}
            >
              Show more analytics
            </Button>
          ) : null}
          {visibleAnalyticsCount > ANALYTICS_BATCH_SIZE && analytics.length > ANALYTICS_BATCH_SIZE ? (
            <Button
              variant="ghost"
              onClick={() => {
                setVisibleAnalyticsCount(ANALYTICS_BATCH_SIZE);
                emitDashboardTelemetry({ area: 'merchant', action: 'show_fewer_analytics_rows' });
              }}
            >
              Show fewer analytics
            </Button>
          ) : null}
        </div>
      </Card>
      </section>
    </div>
  );
}
