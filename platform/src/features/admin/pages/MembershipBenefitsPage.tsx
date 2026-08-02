import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { listMembershipPlans, upsertMembershipPlan, type MembershipPlanRecord } from '@/services/api/membershipAdmin';

export function MembershipBenefitsPage(): JSX.Element {
  const [plans, setPlans] = useState<MembershipPlanRecord[]>([]);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [benefitsText, setBenefitsText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadPlans = async () => {
    const nextPlans = await listMembershipPlans();
    setPlans(nextPlans);
    const selected = nextPlans.find((plan) => plan.level === selectedLevel) ?? nextPlans[0];
    if (selected) {
      setSelectedLevel(selected.level);
      setBenefitsText(selected.benefits.join('\n'));
    }
  };

  useEffect(() => {
    void loadPlans().catch(() => setStatusMessage('Unable to load membership plans.'));
  }, []);

  const handleSelect = (nextLevel: number) => {
    setSelectedLevel(nextLevel);
    const selected = plans.find((plan) => plan.level === nextLevel);
    setBenefitsText(selected ? selected.benefits.join('\n') : '');
  };

  const handleSave = async () => {
    const selected = plans.find((plan) => plan.level === selectedLevel);
    if (!selected) {
      setStatusMessage('Select a plan first.');
      return;
    }

    setIsSaving(true);
    setStatusMessage('');

    try {
      await upsertMembershipPlan({
        level: selected.level,
        label: selected.label,
        price: selected.price,
        category: selected.category,
        durationDays: selected.durationDays,
        benefits: benefitsText.split('\n').map((item) => item.trim()).filter(Boolean),
        isActive: selected.isActive,
      });
      await loadPlans();
      setStatusMessage(`Updated benefits for tier ${selected.level}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to update benefits.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Benefits matrix</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Membership benefits</h1>
        <p className="mt-2 text-sm text-muted">Configure the plan benefit matrix without code deployments.</p>
      </Card>

      <Card className="border border-border bg-surface-elevated space-y-4">
        <label className="grid gap-2 max-w-xs">
          <span className="text-sm text-muted">Plan tier</span>
          <select className="input-base" value={selectedLevel} onChange={(event) => handleSelect(Number(event.target.value))}>
            {plans.map((plan) => <option key={plan.id} value={plan.level}>{`Tier ${plan.level} - ${plan.label}`}</option>)}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-muted">Benefits (one per line)</span>
          <textarea className="input-base min-h-56" value={benefitsText} onChange={(event) => setBenefitsText(event.target.value)} />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save benefits'}</Button>
          <Button variant="ghost" onClick={() => void loadPlans()} disabled={isSaving}>Reload</Button>
        </div>

        {statusMessage ? <p className="text-sm text-muted">{statusMessage}</p> : null}
      </Card>
    </div>
  );
}
