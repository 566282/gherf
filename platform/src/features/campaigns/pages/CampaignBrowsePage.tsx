import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, EmptyState } from '@/components/ui/DesignSystem';
import { Card } from '@/components/ui/Card';

const campaigns = [
  {
    title: 'Spring referral sprint',
    category: 'Referral campaign',
    description: 'Earn rewards by inviting qualified users through a clear, trackable workflow.',
    payout: '$4.50 per completion',
    status: 'Active',
  },
  {
    title: 'App install rollout',
    category: 'Mobile growth',
    description: 'Fast onboarding with lightweight proof and predictable completion steps.',
    payout: '$3.75 per completion',
    status: 'Paused',
  },
  {
    title: 'Video completion test',
    category: 'Content engagement',
    description: 'Simple watch-through campaign designed for high-volume participation.',
    payout: '$1.80 per completion',
    status: 'Scheduled',
  },
];

export function CampaignBrowsePage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const normalizedQuery = query.toLowerCase();

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) => {
        if (!normalizedQuery) {
          return true;
        }

        return [campaign.title, campaign.category, campaign.description, campaign.status, campaign.payout].some((field) =>
          field.toLowerCase().includes(normalizedQuery),
        );
      }),
    [normalizedQuery],
  );

  return (
    <div className="grid gap-6 p-6">
      <Card className="border border-border bg-surface/80">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/80">Campaigns</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Browse campaigns</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Explore available campaigns and complete tasks to earn rewards.
          {query ? ` Showing results for “${query}”.` : ''}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/app/tasks" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-strong">
            View tasks
          </Link>
          {query ? (
            <Link to="/app/campaigns" className="rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
              Clear search
            </Link>
          ) : null}
        </div>
      </Card>

      {filteredCampaigns.length ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {filteredCampaigns.map((campaign) => (
            <Card key={campaign.title} className="border border-border bg-surface/80">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">{campaign.category}</p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">{campaign.title}</h2>
                </div>
                <Badge tone="info">{campaign.status}</Badge>
              </div>
              <p className="mt-4 text-sm leading-7 text-muted">{campaign.description}</p>
              <p className="mt-4 text-sm font-medium text-foreground">{campaign.payout}</p>
              <Link to="/app/tasks" className="mt-5 inline-flex text-sm font-medium text-accent transition hover:text-accent-strong">
                Open tasks
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No campaigns match that search."
          description="Try a broader term or clear the query to see the current campaign list."
          action={<Link to="/app/campaigns" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-strong">Reset search</Link>}
        />
      )}
    </div>
  );
}
