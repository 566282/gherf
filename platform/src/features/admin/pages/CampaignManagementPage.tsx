import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { campaignTypeOptions, listCampaigns } from '@/services/api/campaigns';

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusStyle(status: string) {
  if (status === 'active') return 'badge bg-mint/20 text-mint';
  if (status === 'paused') return 'badge bg-amber-500/20 text-amber-300';
  if (status === 'scheduled') return 'badge bg-sky-500/20 text-sky-300';
  if (status === 'completed') return 'badge bg-emerald-500/20 text-emerald-300';
  if (status === 'archived') return 'badge bg-white/10 text-mist';

  return 'badge bg-slate-700 text-mist';
}

function formatType(value: string) {
  return value.split('_').join(' ');
}

export function CampaignManagementPage() {
  const navigate = useNavigate();
  const { data: campaigns = [], isLoading, error, refetch } = useQuery({
    queryKey: ['business-campaigns'],
    queryFn: listCampaigns,
  });

  const totalBudget = campaigns.reduce((sum, campaign) => sum + campaign.budget, 0);
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active').length;
  const draftCampaigns = campaigns.filter((campaign) => campaign.status === 'draft').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-mint/70">Dynamic campaign engine</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Campaign management</h1>
          <p className="max-w-3xl text-mist/80">
            Every campaign rule, restriction, approval mode, and reward setting is stored in campaign configuration so
            you can extend the engine without shipping code.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={() => refetch()}>
            Refresh
          </Button>
          <Button onClick={() => navigate(`/business/campaigns/new?type=${campaignTypeOptions[0].value}`)}>
            New campaign
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist/70">Total campaigns</p>
          <p className="mt-3 text-3xl font-bold text-white">{campaigns.length}</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist/70">Active campaigns</p>
          <p className="mt-3 text-3xl font-bold text-white">{activeCampaigns}</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist/70">Draft campaigns</p>
          <p className="mt-3 text-3xl font-bold text-white">{draftCampaigns}</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist/70">Allocated budget</p>
          <p className="mt-3 text-3xl font-bold text-white">{formatMoney(totalBudget, 'USD')}</p>
        </Card>
      </div>

      <Card className="space-y-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Campaign templates</h2>
            <p className="text-sm text-mist/80">Start from a preset, then tune the engine settings in the editor.</p>
          </div>
            <Link to="/business/campaigns/new" className="text-sm text-ember/90 hover:text-ember">
            Open blank editor
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {campaignTypeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => navigate(`/business/campaigns/new?type=${option.value}`)}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-ember/50 hover:bg-ember/5"
            >
              <p className="text-lg font-semibold text-white">{option.label}</p>
              <p className="mt-2 text-sm text-mist">{option.description}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 overflow-hidden">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Campaign inventory</h2>
            <p className="text-sm text-mist">Review the active data model and jump straight into editing.</p>
          </div>
          <p className="text-sm text-mist">
            {campaigns.length} campaigns loaded{error ? ' · unable to refresh from Supabase' : ''}
          </p>
        </div>

        {isLoading ? (
          <p className="text-mist">Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
            <p className="text-lg font-semibold text-white">No campaigns yet</p>
            <p className="mt-2 text-sm text-mist">Create the first campaign and define its dynamic engine config.</p>
            <Button className="mt-4" onClick={() => navigate(`/business/campaigns/new?type=${campaignTypeOptions[0].value}`)}>
              Create campaign
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.2em] text-mist">
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Reward</th>
                  <th className="px-4 py-3">Rules</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-white">{campaign.title}</p>
                      <p className="mt-1 max-w-md text-sm text-mist">{campaign.description || campaign.instructions}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-mist">{formatType(campaign.campaignType)}</td>
                    <td className="px-4 py-4 text-sm text-white">
                      {formatMoney(campaign.engineConfig.rewardAmount, campaign.budgetCurrency || 'USD')}
                      <p className="mt-1 text-xs text-mist">
                        Budget {formatMoney(campaign.budget, campaign.budgetCurrency || 'USD')}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm text-mist">
                      <p>Limit {campaign.engineConfig.completionLimit}</p>
                      <p>Daily {campaign.engineConfig.dailyLimit}</p>
                      <p>{formatType(campaign.engineConfig.verificationMethod)}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-mist">
                      <p>{formatDate(campaign.startDate)}</p>
                      <p>{formatDate(campaign.endDate)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={statusStyle(campaign.status)}>{campaign.status}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button variant="ghost" onClick={() => navigate(`/business/campaigns/${campaign.id}/edit`)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
