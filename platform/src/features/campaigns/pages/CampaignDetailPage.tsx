import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Badge, EmptyState } from '@/components/ui/DesignSystem';
import { Card } from '@/components/ui/Card';
import { getCampaign } from '@/services/api/campaigns';
import { getCampaignTaskViews } from '@/services/api/tasks';

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function readable(value: string) {
  return value.replace(/_/g, ' ');
}

export function CampaignDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const campaignQuery = useQuery({ queryKey: ['campaign', id], queryFn: () => getCampaign(id), enabled: Boolean(id) });
  const tasksQuery = useQuery({ queryKey: ['campaign-tasks', id], queryFn: () => getCampaignTaskViews(id), enabled: Boolean(id) });

  if (campaignQuery.isLoading) return <Card className="m-6"><p className="text-muted">Loading campaign...</p></Card>;
  if (campaignQuery.error) return <Card className="m-6"><p role="alert" className="text-muted">Unable to load this campaign right now.</p></Card>;
  if (!campaignQuery.data) return <EmptyState title="Campaign not found" description="This campaign may have been archived or is no longer available." action={<Link to="/app/campaigns">Back to campaigns</Link>} />;

  const campaign = campaignQuery.data;
  const tasks = tasksQuery.data ?? [];

  return (
    <div className="grid gap-6 p-6">
      <Card className="border border-border bg-surface/80">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/80">{readable(campaign.campaignType)}</p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">{campaign.title}</h1>
            <p className="mt-3 max-w-3xl text-muted">{campaign.description || campaign.instructions}</p>
          </div>
          <Badge tone={campaign.status === 'active' ? 'success' : 'info'}>{campaign.status}</Badge>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs text-muted">Reward</p><p className="mt-1 font-semibold text-foreground">{money(campaign.engineConfig.rewardAmount, campaign.budgetCurrency)}</p></div>
          <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs text-muted">Completions</p><p className="mt-1 font-semibold text-foreground">{campaign.currentParticipants} / {campaign.engineConfig.completionLimit}</p></div>
          <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs text-muted">Schedule</p><p className="mt-1 font-semibold text-foreground">{new Date(campaign.startDate).toLocaleDateString()} – {new Date(campaign.endDate).toLocaleDateString()}</p></div>
          <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs text-muted">Verification</p><p className="mt-1 font-semibold capitalize text-foreground">{readable(campaign.engineConfig.verificationMethod)}</p></div>
        </div>
      </Card>

      <Card className="border border-border bg-surface/80">
        <h2 className="text-2xl font-semibold text-foreground">How to complete</h2>
        <p className="mt-3 whitespace-pre-line leading-7 text-muted">{campaign.instructions}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {campaign.engineConfig.targetAudience.regions.map((region) => <span key={region} className="rounded-full border border-border px-3 py-1 text-xs text-muted">{region}</span>)}
          {campaign.engineConfig.deviceRestrictions.map((device) => <span key={device} className="rounded-full border border-border px-3 py-1 text-xs capitalize text-muted">{device}</span>)}
        </div>
      </Card>

      <Card className="border border-border bg-surface/80">
        <div className="flex items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold text-foreground">Available tasks</h2><p className="mt-1 text-sm text-muted">Complete the tasks below to earn the listed reward.</p></div><Link to="/app/tasks" className="text-sm text-accent">Open task center</Link></div>
        {tasksQuery.isLoading ? <p className="mt-5 text-muted">Loading tasks...</p> : tasks.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{tasks.map((task) => <div key={task.id} className="rounded-2xl border border-border bg-background p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-foreground">{task.title}</h3><Badge tone={task.status === 'active' ? 'success' : 'info'}>{task.status}</Badge></div><p className="mt-2 text-sm text-muted">{task.description || 'Follow the campaign instructions and submit the required proof.'}</p><p className="mt-4 font-semibold text-accent">{money(task.rewardAmount, campaign.budgetCurrency)}</p><p className="mt-2 text-xs capitalize text-muted">{readable(task.verificationMethod)}</p></div>)}</div> : <p className="mt-5 text-sm text-muted">Tasks are being prepared for this campaign.</p>}
      </Card>
    </div>
  );
}
