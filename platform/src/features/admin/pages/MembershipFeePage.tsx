import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { listMembershipFeeInvoices, updateMembershipFeeInvoiceStatus, type MembershipFeeInvoiceRecord } from '@/services/api/membershipAdmin';
import { listMembershipLifecycleSettings, updateMembershipLifecycleSettings } from '@/services/api/membershipLifecycle';

export function MembershipFeePage(): JSX.Element {
  const [invoices, setInvoices] = useState<MembershipFeeInvoiceRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [enforceFrom, setEnforceFrom] = useState(2);
  const [blockOnOutstanding, setBlockOnOutstanding] = useState(true);

  const reload = async () => {
    const [nextInvoices, policy] = await Promise.all([
      listMembershipFeeInvoices(100),
      listMembershipLifecycleSettings(),
    ]);

    setInvoices(nextInvoices);
    setEnforceFrom(policy.feeCompliance.enforceFromWithdrawalCount);
    setBlockOnOutstanding(policy.feeCompliance.blockOnOutstandingFee);
  };

  useEffect(() => {
    void reload().catch(() => setStatusMessage('Unable to load membership fee settings.'));
  }, []);

  const handlePolicySave = async () => {
    setIsSaving(true);
    setStatusMessage('');

    try {
      await updateMembershipLifecycleSettings({
        enforceFromWithdrawalCount: enforceFrom,
        blockWithoutFeeSettlement: blockOnOutstanding,
      });
      await reload();
      setStatusMessage('Membership fee policy updated.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to update fee policy.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvoiceStatus = async (invoiceId: string, status: 'unpaid' | 'paid' | 'waived') => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await updateMembershipFeeInvoiceStatus(invoiceId, status);
      await reload();
      setStatusMessage(`Invoice marked ${status}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to update invoice.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Fee compliance</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Membership fee policy</h1>
        <p className="mt-2 text-sm text-muted">Configure fee enforcement and manage fee invoice settlements.</p>
      </Card>

      <Card className="border border-border bg-surface-elevated space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">Policy controls</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2"><span className="text-sm text-muted">Enforce from withdrawal count</span><input type="number" min="1" className="input-base" value={enforceFrom} onChange={(event) => setEnforceFrom(Math.max(1, Number(event.target.value) || 1))} /></label>
          <label className="inline-flex items-center gap-3 text-sm text-foreground"><input type="checkbox" checked={blockOnOutstanding} onChange={(event) => setBlockOnOutstanding(event.target.checked)} className="h-4 w-4" />Block withdrawals when invoices are unpaid</label>
        </div>
        <Button onClick={() => void handlePolicySave()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save fee policy'}</Button>
        {statusMessage ? <p className="text-sm text-muted">{statusMessage}</p> : null}
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <h2 className="text-2xl font-semibold text-foreground">Fee invoices</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted"><th className="py-2 pr-4">Created</th><th className="py-2 pr-4">User</th><th className="py-2 pr-4">Cycle</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Actions</th></tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-border/70">
                  <td className="py-2 pr-4">{new Date(invoice.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4">{invoice.userId}</td>
                  <td className="py-2 pr-4">{invoice.feeCycleKey}</td>
                  <td className="py-2 pr-4">{new Intl.NumberFormat('en-US').format(invoice.amount)} {invoice.currency}</td>
                  <td className="py-2 pr-4">{invoice.status}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="rounded border border-border px-2 py-1 text-xs" onClick={() => void handleInvoiceStatus(invoice.id, 'paid')}>Mark paid</button>
                      <button type="button" className="rounded border border-border px-2 py-1 text-xs" onClick={() => void handleInvoiceStatus(invoice.id, 'waived')}>Waive</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
