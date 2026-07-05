import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  campaignTypeOptions,
  createCampaignCategory,
  createCampaignType,
  listCampaignCategories,
  listCampaigns,
  listCampaignTypes,
} from '@/services/api/campaigns';
import type { CampaignVerificationMethod } from '@/types';

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
  const [campaignTypeDraft, setCampaignTypeDraft] = useState({
    slug: '',
    label: '',
    description: '',
    defaultInstructions: '',
    defaultVerificationMethod: 'manual_review' as CampaignVerificationMethod,
  });
  const [campaignCategoryDraft, setCampaignCategoryDraft] = useState({
    slug: '',
    name: '',
    description: '',
  });

  const { data: campaigns = [], isLoading, error, refetch } = useQuery({
    queryKey: ['business-campaigns'],
    queryFn: listCampaigns,
  });

  const { data: campaignTypes = [], refetch: refetchCampaignTypes } = useQuery({
    queryKey: ['campaign-types'],
    queryFn: listCampaignTypes,
  });

  const { data: campaignCategories = [], refetch: refetchCampaignCategories } = useQuery({
    queryKey: ['campaign-categories'],
    queryFn: listCampaignCategories,
  });

  const createTypeMutation = useMutation({
    mutationFn: createCampaignType,
    onSuccess: () => {
      setCampaignTypeDraft({
        slug: '',
        label: '',
        description: '',
        defaultInstructions: '',
        defaultVerificationMethod: 'manual_review',
      });
      refetchCampaignTypes();
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: createCampaignCategory,
    onSuccess: () => {
      setCampaignCategoryDraft({ slug: '', name: '', description: '' });
      refetchCampaignCategories();
    },
  });

  const availableCampaignTypes = campaignTypes.length ? campaignTypes : campaignTypeOptions;
  const firstCampaignType = availableCampaignTypes[0]?.value ?? 'custom_tasks';

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
          <Button onClick={() => navigate(`/business/campaigns/new?type=${firstCampaignType}`)}>
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
          {availableCampaignTypes.map((option) => (
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

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Campaign type catalog</h2>
            <p className="text-sm text-mist">Create new types here and the editor will pick them up from Supabase.</p>
          </div>
          <div className="max-h-72 space-y-3 overflow-auto rounded-2xl border border-white/10 bg-white/5 p-3">
            {availableCampaignTypes.map((type) => (
              <div key={type.value} className="rounded-xl border border-white/10 bg-ink/40 p-3">
                <p className="font-semibold text-white">{type.label}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-mist/60">{type.value}</p>
                <p className="mt-1 text-sm text-mist">{type.description}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={campaignTypeDraft.slug}
              onChange={(event) => setCampaignTypeDraft((current) => ({ ...current, slug: event.target.value }))}
              className="input-base"
              placeholder="custom_type_slug"
            />
            <input
              value={campaignTypeDraft.label}
              onChange={(event) => setCampaignTypeDraft((current) => ({ ...current, label: event.target.value }))}
              className="input-base"
              placeholder="Campaign label"
            />
            <textarea
              value={campaignTypeDraft.description}
              onChange={(event) => setCampaignTypeDraft((current) => ({ ...current, description: event.target.value }))}
              className="input-base min-h-24 md:col-span-2"
              placeholder="Describe the type"
            />
            <textarea
              value={campaignTypeDraft.defaultInstructions}
              onChange={(event) => setCampaignTypeDraft((current) => ({ ...current, defaultInstructions: event.target.value }))}
              className="input-base min-h-24 md:col-span-2"
              placeholder="Default instructions"
            />
            <select
              value={campaignTypeDraft.defaultVerificationMethod}
              onChange={(event) => setCampaignTypeDraft((current) => ({ ...current, defaultVerificationMethod: event.target.value }))}
              className="input-base md:col-span-2"
            >
              <option value="manual_review">Manual review</option>
              <option value="automatic_verification">Automatic verification</option>
              <option value="screenshot_upload">Screenshot upload</option>
              <option value="video_proof">Video proof</option>
              <option value="link_validation">Link validation</option>
              <option value="api_verification">API verification</option>
              <option value="timer_verification">Timer verification</option>
              <option value="random_audit">Random audit</option>
            </select>
          </div>
          <Button
            onClick={() => createTypeMutation.mutate(campaignTypeDraft)}
            disabled={!campaignTypeDraft.label.trim() || createTypeMutation.isPending}
          >
            {createTypeMutation.isPending ? 'Creating...' : 'Create campaign type'}
          </Button>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Campaign categories</h2>
            <p className="text-sm text-mist">Categories are also Supabase-backed so you can grow the catalog without code changes.</p>
          </div>
          <div className="max-h-72 space-y-3 overflow-auto rounded-2xl border border-white/10 bg-white/5 p-3">
            {campaignCategories.map((category) => (
              <div key={category.id} className="rounded-xl border border-white/10 bg-ink/40 p-3">
                <p className="font-semibold text-white">{category.name}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-mist/60">{category.slug}</p>
                <p className="mt-1 text-sm text-mist">{category.description ?? 'No description yet.'}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={campaignCategoryDraft.slug}
              onChange={(event) => setCampaignCategoryDraft((current) => ({ ...current, slug: event.target.value }))}
              className="input-base"
              placeholder="category_slug"
            />
            <input
              value={campaignCategoryDraft.name}
              onChange={(event) => setCampaignCategoryDraft((current) => ({ ...current, name: event.target.value }))}
              className="input-base"
              placeholder="Category name"
            />
            <textarea
              value={campaignCategoryDraft.description}
              onChange={(event) => setCampaignCategoryDraft((current) => ({ ...current, description: event.target.value }))}
              className="input-base min-h-24 md:col-span-2"
              placeholder="Describe the category"
            />
          </div>
          <Button
            onClick={() => createCategoryMutation.mutate(campaignCategoryDraft)}
            disabled={!campaignCategoryDraft.name.trim() || createCategoryMutation.isPending}
          >
            {createCategoryMutation.isPending ? 'Creating...' : 'Create category'}
          </Button>
        </Card>
      </div>

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
