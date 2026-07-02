import { useEffect, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  buildCampaignEngineConfig,
  campaignTypeOptions,
  campaignVerificationOptions,
  campaignToFormValues,
  createDefaultCampaignForm,
  getCampaign,
  getCampaignPreset,
  saveCampaign,
  type CampaignEditorFormValues,
} from '@/services/api/campaigns';

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <div>
        <span className="block text-sm font-medium text-white">{label}</span>
        {hint ? <span className="text-xs text-mist">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function TogglePill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition ${
        active ? 'border-ember bg-ember/15 text-ember' : 'border-white/10 bg-white/5 text-mist hover:border-ember/40'
      }`}
    >
      {children}
    </button>
  );
}

function buildPreview(values: CampaignEditorFormValues) {
  return {
    businessId: values.businessId,
    title: values.title,
    description: values.description,
    bannerUrl: values.bannerUrl,
    status: values.status,
    campaignType: values.campaignType,
    instructions: values.instructions,
    rewardAmount: values.rewardAmount,
    duration: {
      value: values.durationValue,
      unit: values.durationUnit,
    },
    completionLimit: values.completionLimit,
    dailyLimit: values.dailyLimit,
    restrictions: {
      countries: values.countryRestrictions,
      devices: values.deviceRestrictions,
      browsers: values.browserRestrictions,
    },
    verificationMethod: values.verificationMethod,
    approval: {
      auto: values.autoApproval,
      manual: values.manualApproval,
    },
    budget: values.budget,
    totalParticipants: values.totalParticipants,
    activeDates: {
      from: values.activeFrom,
      to: values.activeTo,
    },
    priority: values.priority,
    requiredScreenshots: values.requiredScreenshots,
    requiredProof: values.requiredProof,
    timeDelayBeforeReward: values.timeDelayBeforeReward,
    cooldownPeriod: values.cooldownPeriod,
    targetAudience: {
      ageRange: values.targetAgeRange,
      interests: values.targetInterests,
      regions: values.targetRegions,
      languages: values.targetLanguages,
      tags: values.targetTags,
      notes: values.targetNotes,
    },
    engineConfig: buildCampaignEngineConfig(values),
  };
}

function isPresetType(value: string | null): value is CampaignEditorFormValues['campaignType'] {
  return Boolean(value && campaignTypeOptions.some((option) => option.value === value));
}

export function CampaignEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const presetType = isPresetType(searchParams.get('type')) ? searchParams.get('type') : 'custom_tasks';
  const defaultValues = createDefaultCampaignForm(presetType);

  const form = useForm<CampaignEditorFormValues>({ defaultValues });
  const { register, handleSubmit, reset, watch, setValue } = form;

  const campaignQuery = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => getCampaign(id as string),
    enabled: Boolean(id),
  });

  const saveMutation = useMutation({
    mutationFn: (values: CampaignEditorFormValues) => saveCampaign(values, id),
    onSuccess: (savedCampaign) => {
      navigate(`/business/campaigns/${savedCampaign.id}/edit`);
    },
  });

  useEffect(() => {
    if (campaignQuery.data) {
      reset(campaignToFormValues(campaignQuery.data));
    }
  }, [campaignQuery.data, reset]);

  useEffect(() => {
    if (!id && isPresetType(searchParams.get('type'))) {
      const preset = getCampaignPreset(searchParams.get('type') as CampaignEditorFormValues['campaignType']);
      setValue('campaignType', preset.value, { shouldDirty: false });
      setValue('title', preset.label, { shouldDirty: false });
      setValue('description', preset.description, { shouldDirty: false });
      setValue('instructions', preset.defaultInstructions, { shouldDirty: false });
      setValue('verificationMethod', preset.defaultVerificationMethod, { shouldDirty: false });
    }
  }, [id, searchParams, setValue]);

  const values = watch();
  const preview = buildPreview(values);

  const onSubmit = handleSubmit(async (submittedValues) => {
    await saveMutation.mutateAsync(submittedValues);
  });

  const loadingCampaign = Boolean(id) && campaignQuery.isLoading;
  const notFound = Boolean(id) && campaignQuery.isSuccess && !campaignQuery.data;

  if (loadingCampaign) {
    return (
      <div className="p-6">
        <Card>
          <p className="text-mist">Loading campaign editor...</p>
        </Card>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="p-6">
        <Card className="space-y-4">
          <h1 className="text-3xl font-bold text-ember">Campaign not found</h1>
          <p className="text-mist">The campaign you requested does not exist or was removed.</p>
          <Link to="/business/campaigns" className="text-ember hover:text-[#ffb56b]">
            Back to campaign management
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-mint/80">Campaign engine editor</p>
          <h1 className="text-3xl font-bold text-ember">{id ? 'Edit campaign' : 'Create campaign'}</h1>
          <p className="max-w-3xl text-mist">
            Configure the full campaign lifecycle here: type, reward economics, approval logic, restrictions, audience
            targeting, and schedule. The configuration is stored as JSON so the engine remains extensible.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={() => navigate('/business/campaigns')}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save campaign'}
          </Button>
        </div>
      </div>

      <Card className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-white">Campaign type</h2>
          <p className="text-sm text-mist">Use a preset or start from a blank custom task definition.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {campaignTypeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setValue('campaignType', option.value, { shouldDirty: true });
                setValue('instructions', option.defaultInstructions, { shouldDirty: true });
                setValue('verificationMethod', option.defaultVerificationMethod, { shouldDirty: true });
                if (!values.title || values.title === defaultValues.title) {
                  setValue('title', option.label, { shouldDirty: true });
                }
                if (!values.description || values.description === defaultValues.description) {
                  setValue('description', option.description, { shouldDirty: true });
                }
              }}
              className={`rounded-2xl border p-4 text-left transition ${
                values.campaignType === option.value
                  ? 'border-ember bg-ember/10'
                  : 'border-white/10 bg-white/5 hover:border-ember/40'
              }`}
            >
              <p className="text-lg font-semibold text-white">{option.label}</p>
              <p className="mt-2 text-sm text-mist">{option.description}</p>
            </button>
          ))}
        </div>
      </Card>

      <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <Card className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Core details</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldGroup label="Business ID" hint="Reference the business that owns this campaign.">
                <input {...register('businessId')} className="input-base" placeholder="business-uuid-or-slug" />
              </FieldGroup>

              <FieldGroup label="Status">
                <select {...register('status')} className="input-base">
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </FieldGroup>

              <FieldGroup label="Campaign title">
                <input {...register('title', { required: true })} className="input-base" placeholder="Spring referral sprint" />
              </FieldGroup>

              <FieldGroup label="Campaign type">
                <select {...register('campaignType')} className="input-base">
                  {campaignTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FieldGroup>

              <FieldGroup label="Description" hint="Visible to the campaign team and often shown to participants.">
                <textarea {...register('description')} className="input-base min-h-28" />
              </FieldGroup>

              <FieldGroup label="Banner URL" hint="Optional hero image used in campaign listings.">
                <input {...register('bannerUrl')} className="input-base" placeholder="https://..." />
              </FieldGroup>
            </div>

            <FieldGroup label="Instructions" hint="These are the step-by-step instructions shown to participants.">
              <textarea {...register('instructions', { required: true })} className="input-base min-h-36" />
            </FieldGroup>
          </Card>

          <Card className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Reward and limits</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FieldGroup label="Reward amount">
                <input type="number" step="0.01" {...register('rewardAmount', { valueAsNumber: true })} className="input-base" />
              </FieldGroup>

              <FieldGroup label="Budget">
                <input type="number" step="0.01" {...register('budget', { valueAsNumber: true })} className="input-base" />
              </FieldGroup>

              <FieldGroup label="Budget currency">
                <input {...register('budgetCurrency')} className="input-base" placeholder="USD" />
              </FieldGroup>

              <FieldGroup label="Completion limit">
                <input type="number" {...register('completionLimit', { valueAsNumber: true })} className="input-base" />
              </FieldGroup>

              <FieldGroup label="Daily limit">
                <input type="number" {...register('dailyLimit', { valueAsNumber: true })} className="input-base" />
              </FieldGroup>

              <FieldGroup label="Total participants">
                <input type="number" {...register('totalParticipants', { valueAsNumber: true })} className="input-base" />
              </FieldGroup>

              <FieldGroup label="Priority" hint="Higher values bubble the campaign above lower-priority items.">
                <input type="number" {...register('priority', { valueAsNumber: true })} className="input-base" />
              </FieldGroup>

              <FieldGroup label="Time delay before reward (seconds)">
                <input type="number" {...register('timeDelayBeforeReward', { valueAsNumber: true })} className="input-base" />
              </FieldGroup>

              <FieldGroup label="Cooldown period (seconds)">
                <input type="number" {...register('cooldownPeriod', { valueAsNumber: true })} className="input-base" />
              </FieldGroup>
            </div>
          </Card>

          <Card className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Restrictions and approvals</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldGroup label="Country restrictions" hint="Comma-separated country codes or names.">
                <textarea {...register('countryRestrictions')} className="input-base min-h-24" placeholder="US, GB, NG" />
              </FieldGroup>

              <FieldGroup label="Device restrictions">
                <textarea {...register('deviceRestrictions')} className="input-base min-h-24" placeholder="desktop, mobile" />
              </FieldGroup>

              <FieldGroup label="Browser restrictions">
                <textarea {...register('browserRestrictions')} className="input-base min-h-24" placeholder="chrome, safari" />
              </FieldGroup>

              <FieldGroup label="Verification method">
                <select {...register('verificationMethod')} className="input-base">
                  {campaignVerificationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FieldGroup>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldGroup label="Auto approval" hint="Approve submissions instantly when validation rules pass.">
                <div className="flex gap-3 pt-1">
                  <TogglePill active={values.autoApproval} onClick={() => setValue('autoApproval', true, { shouldDirty: true })}>
                    Enabled
                  </TogglePill>
                  <TogglePill active={!values.autoApproval} onClick={() => setValue('autoApproval', false, { shouldDirty: true })}>
                    Disabled
                  </TogglePill>
                </div>
              </FieldGroup>

              <FieldGroup label="Manual approval" hint="Route submissions to a reviewer queue.">
                <div className="flex gap-3 pt-1">
                  <TogglePill active={values.manualApproval} onClick={() => setValue('manualApproval', true, { shouldDirty: true })}>
                    Enabled
                  </TogglePill>
                  <TogglePill active={!values.manualApproval} onClick={() => setValue('manualApproval', false, { shouldDirty: true })}>
                    Disabled
                  </TogglePill>
                </div>
              </FieldGroup>

              <FieldGroup label="Required screenshots">
                <input type="number" {...register('requiredScreenshots', { valueAsNumber: true })} className="input-base" />
              </FieldGroup>

              <FieldGroup label="Required proof" hint="Text or a proof template such as URL, code, or receipt reference.">
                <input {...register('requiredProof')} className="input-base" />
              </FieldGroup>
            </div>
          </Card>

          <Card className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Target audience and schedule</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldGroup label="Age range">
                <input {...register('targetAgeRange')} className="input-base" placeholder="18-35" />
              </FieldGroup>
              <FieldGroup label="Active from">
                <input type="datetime-local" {...register('activeFrom')} className="input-base" />
              </FieldGroup>
              <FieldGroup label="Interests" hint="Comma-separated audience interests.">
                <textarea {...register('targetInterests')} className="input-base min-h-24" placeholder="crypto, gaming, fintech" />
              </FieldGroup>
              <FieldGroup label="Active to">
                <input type="datetime-local" {...register('activeTo')} className="input-base" />
              </FieldGroup>
              <FieldGroup label="Regions">
                <textarea {...register('targetRegions')} className="input-base min-h-24" placeholder="Africa, Europe" />
              </FieldGroup>
              <FieldGroup label="Languages">
                <textarea {...register('targetLanguages')} className="input-base min-h-24" placeholder="en, fr" />
              </FieldGroup>
              <FieldGroup label="Tags">
                <textarea {...register('targetTags')} className="input-base min-h-24" placeholder="high-intent, web3" />
              </FieldGroup>
              <FieldGroup label="Audience notes">
                <textarea {...register('targetNotes')} className="input-base min-h-24" />
              </FieldGroup>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4 sticky top-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Live engine preview</h2>
              <p className="text-sm text-mist">This is the exact configuration payload stored in the database.</p>
            </div>
            <pre className="max-h-[34rem] overflow-auto rounded-2xl border border-white/10 bg-ink/80 p-4 text-xs leading-relaxed text-mist">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Engine notes</h2>
            <ul className="space-y-3 text-sm text-mist">
              <li>• Add more campaign presets in the service layer without changing the editor layout.</li>
              <li>• Unknown or future rules can be passed through the JSON engine config.</li>
              <li>• The editor persists both the campaign summary and the underlying engine payload.</li>
            </ul>
          </Card>
        </div>
      </form>
    </div>
  );
}
