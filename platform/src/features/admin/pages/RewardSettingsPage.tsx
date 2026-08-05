import { useEffect, useMemo, useState } from 'react';
import { EnterpriseModulePage } from '../components/EnterpriseModulePage';
import { enterpriseModuleConfigs } from '../data/enterpriseModules';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  adminDecidePromotionalReward,
  buildPromotionalWheelSegments,
  deleteSpinPrizeInventory,
  getPromotionalSpinAnalytics,
  listPromotionalRewardQueue,
  listPromotionalSpinSettings,
  listSpinCampaignsAdmin,
  listSpinPrizeInventory,
  reinstatePromotionalReward,
  upsertSpinCampaignAdmin,
  upsertSpinPrizeInventory,
  updatePromotionalSpinSettings,
  type PromotionalRewardQueueItem,
  type PromotionalSpinAnalyticsSummary,
  type PromotionalSpinSettings,
  type SpinCampaignAdminInput,
  type SpinCampaignAdminItem,
  type SpinPrizeInventoryInput,
  type SpinPrizeInventoryItem,
} from '@/services/api/promotionalRewards';

function formatDateTimeLocal(value: string | null): string {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const offset = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
}

function toIsoOrNull(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toCampaignDraft(campaign: SpinCampaignAdminItem): SpinCampaignAdminInput {
  return {
    id: campaign.id,
    campaignKey: campaign.campaignKey,
    title: campaign.title,
    status: campaign.status,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    settings: {
      ...campaign.settings,
      eligibleCountries: [...campaign.settings.eligibleCountries],
    },
  };
}

function buildNewCampaignDraft(): SpinCampaignAdminInput {
  return {
    campaignKey: `spin_campaign_${Date.now()}`,
    title: 'New spin campaign',
    status: 'draft',
    startsAt: null,
    endsAt: null,
    settings: {
      dailySpinLimit: 1,
      requiredVerifiedReferrals: 2,
      requiredMembershipOrders: 1,
      reservationExpiryHours: 72,
      guaranteedNonLosingFirstSpin: false,
      currency: 'USD',
      eligibleCountries: [],
      minimumAccountAgeHours: 0,
    },
  };
}

function toPrizeDraft(campaignId: string): SpinPrizeInventoryInput {
  return {
    campaignId,
    prizeKey: `prize_${Date.now()}`,
    label: 'New prize',
    rewardAmount: 5,
    weight: 1,
    stockRemaining: null,
    isActive: true,
    metadata: {},
  };
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function RewardSettingsPage(): JSX.Element {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<PromotionalSpinSettings | null>(null);
  const [campaigns, setCampaigns] = useState<SpinCampaignAdminItem[]>([]);
  const [campaignDraft, setCampaignDraft] = useState<SpinCampaignAdminInput | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [prizes, setPrizes] = useState<SpinPrizeInventoryItem[]>([]);
  const [prizeDraft, setPrizeDraft] = useState<SpinPrizeInventoryInput | null>(null);
  const [rewardQueue, setRewardQueue] = useState<PromotionalRewardQueueItem[]>([]);
  const [analytics, setAnalytics] = useState<PromotionalSpinAnalyticsSummary | null>(null);
  const [analyticsRangeDays, setAnalyticsRangeDays] = useState(30);
  const [reservationId, setReservationId] = useState('');
  const [syncMessage, setSyncMessage] = useState('Loading promotional controls...');
  const [saving, setSaving] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [savingPrize, setSavingPrize] = useState(false);
  const [queueBusyId, setQueueBusyId] = useState<string | null>(null);

  const selectedCampaign = useMemo(
    () => campaigns.find((item) => item.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  const parseWheelLabelInput = (input: string, fallback: string[]): string[] => {
    const labels = input
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 12);

    if (!labels.length) {
      return fallback;
    }

    while (labels.length < 12) {
      labels.push(fallback[labels.length] ?? `Prize ${labels.length + 1}`);
    }

    return labels;
  };

  useEffect(() => {
    let active = true;
    void Promise.all([
      listPromotionalSpinSettings(),
      listSpinCampaignsAdmin(),
      listPromotionalRewardQueue(),
      getPromotionalSpinAnalytics(30),
    ])
      .then(([spinSettings, spinCampaigns, queue, spinAnalytics]) => {
        if (!active) return;
        setSettings(spinSettings);
        setCampaigns(spinCampaigns);
        setRewardQueue(queue);
        setAnalytics(spinAnalytics);
        setSyncMessage('Promotional controls synced from platform settings.');

        const initialCampaign = spinCampaigns[0] ?? null;
        if (initialCampaign) {
          setSelectedCampaignId(initialCampaign.id);
          setCampaignDraft(toCampaignDraft(initialCampaign));
          void listSpinPrizeInventory(initialCampaign.id)
            .then((inventory) => {
              if (!active) return;
              setPrizes(inventory);
              setPrizeDraft(toPrizeDraft(initialCampaign.id));
            })
            .catch(() => {
              if (!active) return;
              setPrizes([]);
              setPrizeDraft(toPrizeDraft(initialCampaign.id));
            });
        } else {
          setCampaignDraft(buildNewCampaignDraft());
        }
      })
      .catch(() => {
        if (!active) return;
        setSyncMessage('Unable to load promotional controls right now.');
      });

    return () => {
      active = false;
    };
  }, []);

  const refreshRewardQueue = async () => {
    const queue = await listPromotionalRewardQueue();
    setRewardQueue(queue);
  };

  const refreshAnalytics = async () => {
    const result = await getPromotionalSpinAnalytics(analyticsRangeDays);
    setAnalytics(result);
  };

  const loadCampaignInventory = async (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    const campaign = campaigns.find((item) => item.id === campaignId) ?? null;
    if (campaign) {
      setCampaignDraft(toCampaignDraft(campaign));
    }

    const inventory = await listSpinPrizeInventory(campaignId);
    setPrizes(inventory);
    setPrizeDraft(toPrizeDraft(campaignId));
  };

  const save = async () => {
    if (!settings) {
      return;
    }

    setSaving(true);
    try {
      await updatePromotionalSpinSettings(settings, profile?.id);
      setSyncMessage('Saved promotional controls to platform settings.');
    } catch {
      setSyncMessage('Failed to save promotional controls.');
    } finally {
      setSaving(false);
    }
  };

  const reinstate = async () => {
    if (!reservationId.trim()) {
      setSyncMessage('Provide a reservation ID to reinstate.');
      return;
    }

    try {
      const result = await reinstatePromotionalReward(reservationId.trim(), 'manual admin reinstatement');
      setSyncMessage(result.ok ? 'Reservation reinstated.' : `Unable to reinstate: ${result.error ?? 'unknown_error'}`);
    } catch {
      setSyncMessage('Unable to reinstate reservation right now.');
    }
  };

  const saveCampaign = async () => {
    if (!campaignDraft) {
      return;
    }

    setSavingCampaign(true);
    try {
      const saved = await upsertSpinCampaignAdmin(campaignDraft);
      const updated = await listSpinCampaignsAdmin();
      setCampaigns(updated);
      setSelectedCampaignId(saved.id);
      setCampaignDraft(toCampaignDraft(saved));
      setSyncMessage('Spin campaign settings saved.');
      await loadCampaignInventory(saved.id);
    } catch {
      setSyncMessage('Unable to save spin campaign settings.');
    } finally {
      setSavingCampaign(false);
    }
  };

  const savePrize = async () => {
    if (!prizeDraft || !selectedCampaignId) {
      return;
    }

    setSavingPrize(true);
    try {
      await upsertSpinPrizeInventory({
        ...prizeDraft,
        campaignId: selectedCampaignId,
      });
      const inventory = await listSpinPrizeInventory(selectedCampaignId);
      setPrizes(inventory);
      setPrizeDraft(toPrizeDraft(selectedCampaignId));
      setSyncMessage('Spin prize inventory saved.');
      await refreshAnalytics();
    } catch {
      setSyncMessage('Unable to save prize inventory row.');
    } finally {
      setSavingPrize(false);
    }
  };

  const removePrize = async (prizeId: string) => {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await deleteSpinPrizeInventory(prizeId);
      const inventory = await listSpinPrizeInventory(selectedCampaignId);
      setPrizes(inventory);
      setSyncMessage('Prize removed from inventory.');
      await refreshAnalytics();
    } catch {
      setSyncMessage('Unable to remove prize from inventory.');
    }
  };

  const moderateReward = async (queueItem: PromotionalRewardQueueItem, decision: 'approve' | 'revoke') => {
    setQueueBusyId(queueItem.id);
    try {
      const result = await adminDecidePromotionalReward(
        queueItem.id,
        decision,
        decision === 'revoke' ? 'manual admin revoke from Reward Settings' : 'manual admin approval from Reward Settings',
      );

      if (!result.ok) {
        setSyncMessage(`Unable to ${decision} reward: ${result.error ?? 'unknown_error'}`);
      } else {
        setSyncMessage(`Reward ${decision === 'approve' ? 'approved' : 'revoked'} successfully.`);
        await Promise.all([refreshRewardQueue(), refreshAnalytics()]);
      }
    } catch {
      setSyncMessage(`Unable to ${decision} reward right now.`);
    } finally {
      setQueueBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <EnterpriseModulePage config={enterpriseModuleConfigs.rewardSettings} />

      {settings ? (
        <Card className="space-y-4 border border-border bg-surface-elevated">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Promotional spin controls</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Onboarding spin rollout</h2>
            <p className="text-sm text-muted">Configure trigger pages, cooldowns, stage rollout, and vault reinstatement actions.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Enabled</span>
              <select className="input-base" value={String(settings.enabled)} onChange={(event) => setSettings({ ...settings, enabled: event.target.value === 'true' })}>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Rollout stage</span>
              <select className="input-base" value={settings.rolloutStage} onChange={(event) => setSettings({ ...settings, rolloutStage: event.target.value as PromotionalSpinSettings['rolloutStage'] })}>
                <option value="internal">Internal</option>
                <option value="beta">Beta</option>
                <option value="production">Production</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Daily popup cooldown (minutes)</span>
              <input className="input-base" type="number" min={1} value={settings.cooldownMinutes} onChange={(event) => setSettings({ ...settings, cooldownMinutes: Math.max(1, Number(event.target.value) || 1) })} />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Reopen label</span>
              <input className="input-base" value={settings.reopenLabel} onChange={(event) => setSettings({ ...settings, reopenLabel: event.target.value })} />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Trigger surfaces</span>
              <input
                className="input-base"
                value={settings.triggerSurfaces.join(', ')}
                onChange={(event) => {
                  const values = event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean) as PromotionalSpinSettings['triggerSurfaces'];
                  setSettings({ ...settings, triggerSurfaces: values.length ? values : settings.triggerSurfaces });
                }}
                placeholder="home, signup, membership-plans"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Enabled stages</span>
              <input
                className="input-base"
                value={settings.enabledStages.join(', ')}
                onChange={(event) => {
                  const values = event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean) as PromotionalSpinSettings['enabledStages'];
                  setSettings({ ...settings, enabledStages: values.length ? values : settings.enabledStages });
                }}
                placeholder="internal, beta, production"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Wheel prize labels</span>
            <textarea
              className="input-base min-h-28"
              value={settings.wheelSegmentLabels.join(', ')}
              onChange={(event) => {
                const fallback = buildPromotionalWheelSegments().map((segment) => segment.label);
                const nextLabels = parseWheelLabelInput(event.target.value, fallback);
                setSettings({ ...settings, wheelSegmentLabels: nextLabels });
              }}
              placeholder="$5, $10, $15, $20, $8, $12, $18, $25, $7, $9, $14, $30"
            />
            <p className="text-xs text-muted">Enter up to 12 labels separated by commas or new lines. Missing entries are auto-filled.</p>
          </label>

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => void save()} disabled={saving}>{saving ? 'Saving...' : 'Save promotional controls'}</Button>
            <Button type="button" variant="ghost" onClick={() => setSettings({ ...settings, showOncePerGuest: !settings.showOncePerGuest })}>
              {settings.showOncePerGuest ? 'Disable one-show rule' : 'Enable one-show rule'}
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Manual reservation reinstatement</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <input className="input-base max-w-xl" value={reservationId} onChange={(event) => setReservationId(event.target.value)} placeholder="Reservation UUID" />
              <Button type="button" variant="ghost" onClick={() => void reinstate()}>Reinstate reservation</Button>
            </div>
          </div>

          <p className="text-xs text-muted">{syncMessage}</p>
        </Card>
      ) : null}

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Campaign-level controls</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Spin campaign lifecycle</h2>
            <p className="text-sm text-muted">Configure guaranteed-win onboarding, eligibility rules, daily limits, referral/membership gates, and expiration windows.</p>
          </div>
          <Button type="button" variant="ghost" onClick={() => setCampaignDraft(buildNewCampaignDraft())}>New campaign draft</Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {campaigns.map((campaign) => (
            <button
              key={campaign.id}
              type="button"
              onClick={() => void loadCampaignInventory(campaign.id)}
              className={`rounded-full border px-3 py-1 text-xs transition ${selectedCampaignId === campaign.id ? 'border-accent bg-accent/20 text-accent' : 'border-border bg-surface text-muted hover:border-accent/50'}`}
            >
              {campaign.title}
            </button>
          ))}
        </div>

        {campaignDraft ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Campaign key</span>
                <input className="input-base" value={campaignDraft.campaignKey} onChange={(event) => setCampaignDraft({ ...campaignDraft, campaignKey: event.target.value })} />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Title</span>
                <input className="input-base" value={campaignDraft.title} onChange={(event) => setCampaignDraft({ ...campaignDraft, title: event.target.value })} />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Status</span>
                <select className="input-base" value={campaignDraft.status} onChange={(event) => setCampaignDraft({ ...campaignDraft, status: event.target.value as SpinCampaignAdminItem['status'] })}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Currency</span>
                <input className="input-base" value={campaignDraft.settings.currency} onChange={(event) => setCampaignDraft({ ...campaignDraft, settings: { ...campaignDraft.settings, currency: event.target.value.toUpperCase() } })} />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Starts at</span>
                <input
                  className="input-base"
                  type="datetime-local"
                  value={formatDateTimeLocal(campaignDraft.startsAt)}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, startsAt: toIsoOrNull(event.target.value) })}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Ends at</span>
                <input
                  className="input-base"
                  type="datetime-local"
                  value={formatDateTimeLocal(campaignDraft.endsAt)}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, endsAt: toIsoOrNull(event.target.value) })}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Daily spin limit</span>
                <input
                  className="input-base"
                  type="number"
                  min={1}
                  value={campaignDraft.settings.dailySpinLimit}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, settings: { ...campaignDraft.settings, dailySpinLimit: Math.max(1, Number(event.target.value) || 1) } })}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Reservation expiry (hours)</span>
                <input
                  className="input-base"
                  type="number"
                  min={1}
                  value={campaignDraft.settings.reservationExpiryHours}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, settings: { ...campaignDraft.settings, reservationExpiryHours: Math.max(1, Number(event.target.value) || 1) } })}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Required referrals</span>
                <input
                  className="input-base"
                  type="number"
                  min={0}
                  value={campaignDraft.settings.requiredVerifiedReferrals}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, settings: { ...campaignDraft.settings, requiredVerifiedReferrals: Math.max(0, Number(event.target.value) || 0) } })}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Required membership orders</span>
                <input
                  className="input-base"
                  type="number"
                  min={0}
                  value={campaignDraft.settings.requiredMembershipOrders}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, settings: { ...campaignDraft.settings, requiredMembershipOrders: Math.max(0, Number(event.target.value) || 0) } })}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Minimum account age (hours)</span>
                <input
                  className="input-base"
                  type="number"
                  min={0}
                  value={campaignDraft.settings.minimumAccountAgeHours}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, settings: { ...campaignDraft.settings, minimumAccountAgeHours: Math.max(0, Number(event.target.value) || 0) } })}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Guaranteed non-losing first spin</span>
                <select
                  className="input-base"
                  value={String(campaignDraft.settings.guaranteedNonLosingFirstSpin)}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, settings: { ...campaignDraft.settings, guaranteedNonLosingFirstSpin: event.target.value === 'true' } })}
                >
                  <option value="false">Disabled</option>
                  <option value="true">Enabled</option>
                </select>
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Eligible countries (optional)</span>
              <input
                className="input-base"
                value={campaignDraft.settings.eligibleCountries.join(', ')}
                onChange={(event) => {
                  const eligibleCountries = event.target.value
                    .split(',')
                    .map((entry) => entry.trim().toUpperCase())
                    .filter(Boolean);
                  setCampaignDraft({
                    ...campaignDraft,
                    settings: {
                      ...campaignDraft.settings,
                      eligibleCountries,
                    },
                  });
                }}
                placeholder="US, CA, GB"
              />
            </label>

            <div className="flex gap-3">
              <Button type="button" onClick={() => void saveCampaign()} disabled={savingCampaign}>{savingCampaign ? 'Saving...' : 'Save campaign controls'}</Button>
              {selectedCampaign ? (
                <Button type="button" variant="ghost" onClick={() => setCampaignDraft(toCampaignDraft(selectedCampaign))}>Reset draft</Button>
              ) : null}
            </div>
          </>
        ) : null}
      </Card>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Prize inventory</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Spin prize weights and stock</h2>
          <p className="text-sm text-muted">Create, edit, activate, and retire individual prize rows for the selected spin campaign.</p>
        </div>

        {selectedCampaignId ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Prize key</span>
                <input className="input-base" value={prizeDraft?.prizeKey ?? ''} onChange={(event) => prizeDraft ? setPrizeDraft({ ...prizeDraft, prizeKey: event.target.value }) : null} />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Label</span>
                <input className="input-base" value={prizeDraft?.label ?? ''} onChange={(event) => prizeDraft ? setPrizeDraft({ ...prizeDraft, label: event.target.value }) : null} />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Reward amount</span>
                <input className="input-base" type="number" step="0.01" value={prizeDraft?.rewardAmount ?? 0} onChange={(event) => prizeDraft ? setPrizeDraft({ ...prizeDraft, rewardAmount: Number(event.target.value) || 0 }) : null} />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Weight</span>
                <input className="input-base" type="number" min={0} step="0.0001" value={prizeDraft?.weight ?? 0} onChange={(event) => prizeDraft ? setPrizeDraft({ ...prizeDraft, weight: Math.max(0, Number(event.target.value) || 0) }) : null} />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Stock remaining</span>
                <input
                  className="input-base"
                  type="number"
                  min={0}
                  value={prizeDraft?.stockRemaining ?? ''}
                  onChange={(event) => {
                    if (!prizeDraft) return;
                    const next = event.target.value.trim();
                    setPrizeDraft({ ...prizeDraft, stockRemaining: next === '' ? null : Math.max(0, Number(next) || 0) });
                  }}
                  placeholder="Blank = unlimited"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Status</span>
                <select className="input-base" value={String(prizeDraft?.isActive ?? true)} onChange={(event) => prizeDraft ? setPrizeDraft({ ...prizeDraft, isActive: event.target.value === 'true' }) : null}>
                  <option value="true">Active</option>
                  <option value="false">Disabled</option>
                </select>
              </label>
            </div>

            <div className="flex gap-3">
              <Button type="button" onClick={() => void savePrize()} disabled={!prizeDraft || savingPrize}>{savingPrize ? 'Saving...' : 'Save prize row'}</Button>
              <Button type="button" variant="ghost" onClick={() => setPrizeDraft(toPrizeDraft(selectedCampaignId))}>New prize draft</Button>
            </div>

            <div className="space-y-2">
              {prizes.length ? (
                prizes.map((prize) => (
                  <div key={prize.id} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{prize.label}</p>
                        <p className="text-xs text-muted">Key: {prize.prizeKey} | Amount: {prize.rewardAmount} | Weight: {prize.weight} | Stock: {prize.stockRemaining ?? 'unlimited'} | {prize.isActive ? 'Active' : 'Disabled'}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={() => setPrizeDraft({
                          id: prize.id,
                          campaignId: prize.campaignId,
                          prizeKey: prize.prizeKey,
                          label: prize.label,
                          rewardAmount: prize.rewardAmount,
                          weight: prize.weight,
                          stockRemaining: prize.stockRemaining,
                          isActive: prize.isActive,
                          metadata: prize.metadata,
                        })}>Edit</Button>
                        <Button type="button" variant="ghost" onClick={() => void removePrize(prize.id)}>Delete</Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No prize rows yet for this campaign.</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Create or select a spin campaign to manage prize inventory.</p>
        )}
      </Card>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Reward moderation</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Pending and blocked promotional rewards</h2>
            <p className="text-sm text-muted">Review queued reservations, approve/revoke rewards, and perform reinstatement when needed.</p>
          </div>
          <Button type="button" variant="ghost" onClick={() => void refreshRewardQueue()}>Refresh queue</Button>
        </div>

        <div className="space-y-2">
          {rewardQueue.length ? (
            rewardQueue.slice(0, 40).map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Reservation {item.id.slice(0, 8)}...</p>
                    <p className="text-xs text-muted">Status: {item.status} | Amount: {item.amount} {item.currency} | User: {item.userId ?? 'guest'} | Expires: {new Date(item.expiresAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" disabled={queueBusyId === item.id} onClick={() => void moderateReward(item, 'approve')}>Approve</Button>
                    <Button type="button" variant="ghost" disabled={queueBusyId === item.id} onClick={() => void moderateReward(item, 'revoke')}>Revoke</Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">No promotional rewards in queue.</p>
          )}
        </div>
      </Card>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Spin analytics</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Funnel and fraud observability</h2>
            <p className="text-sm text-muted">Track spin attempts, wins, reward lifecycle, referral unlock progress, and abuse signal rates.</p>
          </div>
          <div className="flex gap-2">
            <select className="input-base" value={analyticsRangeDays} onChange={(event) => setAnalyticsRangeDays(Math.max(1, Number(event.target.value) || 30))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <Button type="button" variant="ghost" onClick={() => void refreshAnalytics()}>Refresh analytics</Button>
          </div>
        </div>

        {analytics ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Spin attempts</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{analytics.attempts}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Win rate</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatPercent(analytics.winRate)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Unlock conversion</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatPercent(analytics.unlockConversionRate)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Referral completion</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatPercent(analytics.referralCompletionRate)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Pending rewards</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{analytics.pendingRewards}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Expired rewards</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{analytics.expiredRewards}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Revoked rewards</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{analytics.revokedRewards}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Abuse signals</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{analytics.abuseSignals}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Analytics are not available yet.</p>
        )}
      </Card>
    </div>
  );
}