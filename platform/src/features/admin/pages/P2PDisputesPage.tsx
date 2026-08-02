import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  addP2PDisputeAction,
  listP2PDisputes,
  resolveP2PDispute,
  type P2PDispute,
} from '@/services/api/p2pDisputes';

function formatDate(value: string | null): string {
  if (!value) return 'n/a';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export function P2PDisputesPage(): JSX.Element {
  const [disputes, setDisputes] = useState<P2PDispute[]>([]);
  const [statusMessage, setStatusMessage] = useState('Loading dispute queue...');
  const [isBusy, setIsBusy] = useState(false);

  const refresh = async (): Promise<void> => {
    const queue = await listP2PDisputes(150);
    setDisputes(queue);
    setStatusMessage('Dispute queue synced from Supabase.');
  };

  useEffect(() => {
    void refresh().catch(() => setStatusMessage('Unable to load dispute queue.'));
  }, []);

  const applyOutcome = async (dispute: P2PDispute, outcome: 'release' | 'refund' | 'penalize' | 'suspend'): Promise<void> => {
    setIsBusy(true);
    setStatusMessage('');

    try {
      await resolveP2PDispute({
        disputeId: dispute.id,
        status: 'resolved',
        resolutionOutcome: outcome,
        resolutionNote: `Resolved via admin queue with outcome=${outcome}`,
      });

      await addP2PDisputeAction({
        disputeId: dispute.id,
        actionType: outcome,
        note: `Admin decision recorded: ${outcome}`,
      });

      await refresh();
      setStatusMessage(`Dispute ${dispute.id.slice(0, 8)} resolved with ${outcome}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to resolve dispute.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">P2P disputes</p>
        <h1 className="mt-2 text-4xl font-semibold text-foreground">Dispute resolution queue</h1>
        <p className="mt-2 max-w-3xl text-muted">Review open disputes and apply auditable outcomes: release, refund, penalize, or suspend.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => void refresh()}>Reload queue</Button>
          <p className="rounded-xl border border-border bg-surface px-4 py-2 text-sm text-muted">{statusMessage}</p>
        </div>
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3">Dispute</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Opened</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((dispute) => (
                <tr key={dispute.id} className="border-b border-border/60 text-foreground last:border-0">
                  <td className="px-4 py-3">{dispute.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{dispute.orderId.slice(0, 8)}</td>
                  <td className="px-4 py-3">{dispute.status}</td>
                  <td className="px-4 py-3">{dispute.disputeReason}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(dispute.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={isBusy} onClick={() => void applyOutcome(dispute, 'release')}>Release</Button>
                      <Button disabled={isBusy} onClick={() => void applyOutcome(dispute, 'refund')}>Refund</Button>
                      <Button disabled={isBusy} onClick={() => void applyOutcome(dispute, 'penalize')}>Penalize</Button>
                      <Button disabled={isBusy} onClick={() => void applyOutcome(dispute, 'suspend')}>Suspend</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!disputes.length ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={6}>No disputes found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
