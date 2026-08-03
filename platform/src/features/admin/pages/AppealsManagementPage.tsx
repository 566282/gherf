import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import { createAppealPaymentIntent, decideComplianceAppeal, listComplianceAppeals, markAppealPaymentSettled, type AppealRecord } from '@/services/api/appeals';

export function AppealsManagementPage(): JSX.Element {
  const { profile } = useAuth();
  const [appeals, setAppeals] = useState<AppealRecord[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const reload = async () => {
    const nextAppeals = await listComplianceAppeals(120);
    setAppeals(nextAppeals);
  };

  useEffect(() => {
    void reload().catch(() => setStatusMessage('Unable to load appeals.'));
  }, []);

  const handleDecision = async (appealId: string, decision: 'approved' | 'rejected' | 'request_more_info') => {
    if (!profile) return;

    setIsSaving(true);
    setStatusMessage('');

    try {
      await decideComplianceAppeal({
        appealId,
        reviewerId: profile.id,
        decision,
        reason: decision === 'approved' ? 'Evidence validated and appeal approved.' : decision === 'rejected' ? 'Evidence insufficient for reversal.' : 'Additional supporting documents required.',
      });
      await reload();
      setStatusMessage(`Appeal ${appealId} updated to ${decision}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to update appeal decision.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettleFee = async (appeal: AppealRecord) => {
    if (!profile) return;

    setIsSaving(true);
    setStatusMessage('');

    try {
      const paymentIntent = await createAppealPaymentIntent(appeal.id, appeal.userId);
      await markAppealPaymentSettled({
        appealId: appeal.id,
        paymentIntentId: paymentIntent.paymentIntentId,
        providerReference: `manual-${Date.now()}`,
      });
      await reload();
      setStatusMessage(`Appeal fee settled for ${appeal.id}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to settle appeal fee.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Phase 6</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Appeals management</h1>
        <p className="mt-2 text-sm text-muted">Review appeal lifecycle, fee settlement, and final adjudication decisions.</p>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 pr-4">Appeal</th>
                <th className="py-2 pr-4">State</th>
                <th className="py-2 pr-4">Payment</th>
                <th className="py-2 pr-4">Fee</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appeals.map((appeal) => (
                <tr key={appeal.id} className="border-b border-border/60">
                  <td className="py-2 pr-4">{appeal.id.slice(0, 8)}...</td>
                  <td className="py-2 pr-4">{appeal.state}</td>
                  <td className="py-2 pr-4">{appeal.paymentStatus}</td>
                  <td className="py-2 pr-4">{appeal.feeCurrency} {appeal.feeAmount.toFixed(2)}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-2">
                      {appeal.paymentRequired && appeal.paymentStatus !== 'paid' ? (
                        <Button variant="ghost" onClick={() => void handleSettleFee(appeal)} disabled={isSaving}>Settle fee</Button>
                      ) : null}
                      <Button variant="ghost" onClick={() => void handleDecision(appeal.id, 'approved')} disabled={isSaving}>Approve</Button>
                      <Button variant="ghost" onClick={() => void handleDecision(appeal.id, 'rejected')} disabled={isSaving}>Reject</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!appeals.length ? (
                <tr>
                  <td className="py-4 text-muted" colSpan={5}>No appeals found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {statusMessage ? <p className="mt-4 text-sm text-muted">{statusMessage}</p> : null}
      </Card>
    </div>
  );
}
