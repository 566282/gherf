import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { listMembershipPlans, upsertMembershipPlan, archiveMembershipPlan, type MembershipPlanRecord } from '@/services/api/membershipAdmin';

export function MembershipPlansPage(): JSX.Element {
  const [plans, setPlans] = useState<MembershipPlanRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [level, setLevel] = useState(1);
  const [label, setLabel] = useState('Starter');
  const [price, setPrice] = useState(5000);
  const [category, setCategory] = useState('starter');
  const [durationDays, setDurationDays] = useState(30);
  const [benefitsText, setBenefitsText] = useState('Priority support\nReward multiplier access\nWithdrawal eligibility');

  const reload = async () => {
    setIsLoading(true);
    try {
      setPlans(await listMembershipPlans());
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to load membership plans.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const summary = useMemo(() => ({
    total: plans.length,
    active: plans.filter((plan) => plan.isActive).length,
    highestTier: Math.max(...plans.map((plan) => plan.level), 1),
  }), [plans]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await upsertMembershipPlan({
        level,
        label,
        price,
        category,
        durationDays,
        benefits: benefitsText.split('\n').map((item) => item.trim()).filter(Boolean),
        isActive: true,
      });
      setStatusMessage(`Saved tier ${level} (${label}).`);
      await reload();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save plan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (targetLevel: number) => {
    setStatusMessage('');
    try {
      await archiveMembershipPlan(targetLevel);
      setStatusMessage(`Archived tier ${targetLevel}.`);
      await reload();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to archive plan.');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Membership catalog</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Membership plans</h1>
        <p className="mt-2 text-sm text-muted">Live CRUD for the 100-tier membership catalog, pricing, duration, and benefit baselines.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs text-muted">Plans</p><p className="mt-2 text-2xl font-bold">{summary.total}</p></div>
          <div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs text-muted">Active</p><p className="mt-2 text-2xl font-bold">{summary.active}</p></div>
          <div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs text-muted">Top tier</p><p className="mt-2 text-2xl font-bold">{summary.highestTier}</p></div>
        </div>
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <h2 className="text-2xl font-semibold text-foreground">Create or update plan</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2"><span className="text-sm text-muted">Tier level</span><input type="number" min="1" max="100" className="input-base" value={level} onChange={(event) => setLevel(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /></label>
          <label className="grid gap-2"><span className="text-sm text-muted">Label</span><input className="input-base" value={label} onChange={(event) => setLabel(event.target.value)} /></label>
          <label className="grid gap-2"><span className="text-sm text-muted">Price (NGN)</span><input type="number" min="0" className="input-base" value={price} onChange={(event) => setPrice(Math.max(0, Number(event.target.value) || 0))} /></label>
          <label className="grid gap-2"><span className="text-sm text-muted">Duration (days)</span><input type="number" min="1" className="input-base" value={durationDays} onChange={(event) => setDurationDays(Math.max(1, Number(event.target.value) || 30))} /></label>
          <label className="grid gap-2"><span className="text-sm text-muted">Category</span><select className="input-base" value={category} onChange={(event) => setCategory(event.target.value)}><option value="starter">starter</option><option value="growth">growth</option><option value="enterprise">enterprise</option></select></label>
          <label className="grid gap-2 md:col-span-2"><span className="text-sm text-muted">Benefits (one per line)</span><textarea className="input-base min-h-32" value={benefitsText} onChange={(event) => setBenefitsText(event.target.value)} /></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save plan'}</Button>
          <Button variant="ghost" onClick={() => void reload()} disabled={isLoading}>Refresh</Button>
        </div>
        {statusMessage ? <p className="mt-3 text-sm text-muted">{statusMessage}</p> : null}
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <h2 className="text-2xl font-semibold text-foreground">Catalog table</h2>
        {isLoading ? <p className="mt-3 text-sm text-muted">Loading plans...</p> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted"><th className="py-2 pr-4">Tier</th><th className="py-2 pr-4">Label</th><th className="py-2 pr-4">Price</th><th className="py-2 pr-4">Category</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Actions</th></tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b border-border/70">
                  <td className="py-2 pr-4">{plan.level}</td>
                  <td className="py-2 pr-4">{plan.label}</td>
                  <td className="py-2 pr-4">{new Intl.NumberFormat('en-US').format(plan.price)}</td>
                  <td className="py-2 pr-4">{plan.category}</td>
                  <td className="py-2 pr-4">{plan.isActive ? 'active' : 'archived'}</td>
                  <td className="py-2 pr-4">
                    <button type="button" className="rounded border border-border px-2 py-1 text-xs hover:bg-surface" onClick={() => void handleArchive(plan.level)}>
                      Archive
                    </button>
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
