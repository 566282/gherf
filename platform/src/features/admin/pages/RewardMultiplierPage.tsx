import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { createMultiplierOrder, listMultiplierOrders, type MembershipMultiplierOrderRecord } from '@/services/api/membershipAdmin';
import { listMembershipGatewayProviders, selectMembershipGateway } from '@/services/api/membershipGateway';

export function RewardMultiplierPage(): JSX.Element {
  const [orders, setOrders] = useState<MembershipMultiplierOrderRecord[]>([]);
  const [userId, setUserId] = useState('');
  const [level, setLevel] = useState(2);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState('');

  const reload = async () => {
    setOrders(await listMultiplierOrders(100));
  };

  useEffect(() => {
    void reload().catch(() => setStatusMessage('Unable to load multiplier orders.'));
  }, []);

  const handleCreate = async () => {
    if (!userId.trim()) {
      setStatusMessage('Enter a user ID.');
      return;
    }

    setIsSaving(true);
    setStatusMessage('');

    try {
      let provider = selectedGateway;
      if (!provider) {
        provider = await selectMembershipGateway(level >= 45 ? 1000000 : 50000, 'NGN');
      }

      await createMultiplierOrder({
        userId: userId.trim(),
        planLevel: level,
        provider,
      });

      await reload();
      setStatusMessage(`Created multiplier order via ${provider}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to create multiplier order.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadGateways = async () => {
    try {
      const providers = await listMembershipGatewayProviders();
      setStatusMessage(`Active gateways: ${providers.map((item) => item.providerKey).join(', ') || 'none'}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to load gateways.');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Reward multiplier</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Multiplier premium module</h1>
        <p className="mt-2 text-sm text-muted">Manage gateway-routed multiplier activation orders and track paid status updates.</p>
      </Card>

      <Card className="border border-border bg-surface-elevated space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2"><span className="text-sm text-muted">User ID</span><input className="input-base" value={userId} onChange={(event) => setUserId(event.target.value)} /></label>
          <label className="grid gap-2"><span className="text-sm text-muted">Tier</span><input type="number" min="1" max="100" className="input-base" value={level} onChange={(event) => setLevel(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /></label>
          <label className="grid gap-2"><span className="text-sm text-muted">Gateway (optional)</span><input className="input-base" value={selectedGateway} onChange={(event) => setSelectedGateway(event.target.value)} placeholder="auto-select if empty" /></label>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void handleCreate()} disabled={isSaving}>{isSaving ? 'Creating...' : 'Create multiplier order'}</Button>
          <Button variant="ghost" onClick={() => void reload()} disabled={isSaving}>Reload orders</Button>
          <Button variant="ghost" onClick={() => void handleLoadGateways()} disabled={isSaving}>Show active gateways</Button>
        </div>

        {statusMessage ? <p className="text-sm text-muted">{statusMessage}</p> : null}
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <h2 className="text-2xl font-semibold text-foreground">Multiplier orders</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted"><th className="py-2 pr-4">Created</th><th className="py-2 pr-4">User</th><th className="py-2 pr-4">Tier</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Provider</th><th className="py-2 pr-4">Status</th></tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-border/70">
                  <td className="py-2 pr-4">{new Date(order.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4">{order.userId}</td>
                  <td className="py-2 pr-4">{order.planLevel}</td>
                  <td className="py-2 pr-4">{new Intl.NumberFormat('en-US').format(order.amount)} {order.currency}</td>
                  <td className="py-2 pr-4">{order.paymentProvider ?? 'n/a'}</td>
                  <td className="py-2 pr-4">{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
