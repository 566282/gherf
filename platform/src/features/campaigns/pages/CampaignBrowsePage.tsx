import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, EmptyState } from '@/components/ui/DesignSystem';
import { Card } from '@/components/ui/Card';
import { listCampaigns } from '@/services/api/campaigns';

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatType(value: string) {
  return value.split('_').join(' ');
}

export function CampaignBrowsePage() {
  const { data: campaigns = [], isLoading, error } = useQuery({
    queryKey: ['public-campaigns'],
    queryFn: listCampaigns,
  });
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const normalizedQuery = query.toLowerCase();

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) => {
        if (!normalizedQuery) {
          return true;
        }

        return [campaign.title, campaign.campaignType, campaign.description ?? '', campaign.status, campaign.instructions, ...(campaign.campaignCategories ?? [])].some((field) =>
          field.toLowerCase().includes(normalizedQuery),
        );
      }),
    [campaigns, normalizedQuery],
  );

  const hasQuery = Boolean(query);

  return (
    <div className="grid gap-6 p-6">
      <Card className="border border-border bg-surface/80">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/80">Campaigns</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Browse campaigns</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Explore live campaigns loaded from Supabase and complete tasks to earn rewards.
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

      {isLoading ? (
        <Card className="border border-border bg-surface/80">
          <p className="text-muted">Loading campaigns...</p>
        </Card>
      ) : filteredCampaigns.length ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {filteredCampaigns.map((campaign) => (
            <Card key={campaign.title} className="border border-border bg-surface/80">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">{formatType(campaign.campaignType)}</p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">{campaign.title}</h2>
                </div>
                <Badge tone="info">{campaign.status}</Badge>
              </div>
              <p className="mt-4 text-sm leading-7 text-muted">{campaign.description ?? campaign.instructions}</p>
              <p className="mt-4 text-sm font-medium text-foreground">{formatMoney(campaign.engineConfig.rewardAmount, campaign.budgetCurrency || 'USD')} per completion</p>
              <p className="mt-2 text-xs text-muted">Categories: {(campaign.campaignCategories ?? []).join(', ') || 'Uncategorized'}</p>
              <Link to="/app/tasks" className="mt-5 inline-flex text-sm font-medium text-accent transition hover:text-accent-strong">
                Open tasks
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title={hasQuery ? 'No campaigns match that search.' : 'No campaigns available yet.'}
          description={hasQuery ? 'Try a broader term or clear the query to see the current campaign list.' : 'Campaigns will appear here once they are published in Supabase.'}
          action={<Link to="/app/campaigns" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-strong">Reset search</Link>}
        />
      )}

      {error ? (
        <Card className="border border-border bg-surface/80">
          <p className="text-sm text-muted">Unable to refresh campaigns from Supabase right now.</p>
        </Card>
      ) : null}
    </div>
  );
}
