import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  buildCampaignEngineConfig,
  campaignTypeOptions,
  campaignVerificationOptions,
  campaignToFormValues,
  createDefaultCampaignForm,
  getCampaign,
  listCampaignCategories,
  listCampaignTypes,
  saveCampaign,
  type CampaignEditorFormValues,
} from '@/services/api/campaigns';

type WizardStep = 'type' | 'details' | 'rewards' | 'restrictions' | 'audience' | 'preview';

const WIZARD_STEPS: Array<{ id: WizardStep; label: string; description: string }> = [
  { id: 'type', label: 'Campaign type', description: 'Choose a template or start blank' },
  { id: 'details', label: 'Core details', description: 'Title, description, and assets' },
  { id: 'rewards', label: 'Rewards & limits', description: 'Budget, reward amount, and caps' },
  { id: 'restrictions', label: 'Restrictions', description: 'Devices, locations, approval' },
  { id: 'audience', label: 'Target audience', description: 'Demographics, categories, and schedule' },
  { id: 'preview', label: 'Review & launch', description: 'Preview and save campaign' },
];

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
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

function TogglePill({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition ${active ? 'border-ember bg-ember/15 text-ember' : 'border-white/10 bg-white/5 text-mist hover:border-ember/40'}`}
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
    campaignImageUrl: values.campaignImageUrl,
    videoUrl: values.videoUrl,
    landingUrl: values.landingUrl,
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
      ageMin: values.ageRestrictionMin,
      ageMax: values.ageRestrictionMax,
    },
    verificationMethod: values.verificationMethod,
    approval: {
      auto: values.autoApproval,
      manual: values.manualApproval,
    },
    budget: values.budget,
    totalParticipants: values.totalParticipants,
    campaignCategories: values.campaignCategories,
    activeDates: {
      from: values.activeFrom,
      to: values.activeTo,
    },
    recurring: {
      enabled: values.recurringEnabled,
      frequency: values.recurringFrequency,
      interval: values.recurringInterval,
      daysOfWeek: values.recurringDaysOfWeek,
      timezone: values.recurringTimezone,
      endsAt: values.recurringEndsAt,
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

function hasType(value: string | null, options: Array<{ value: string }>) {
  return Boolean(value && options.some((option) => option.value === value));
}

export function CampaignEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState<WizardStep>('type');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [presetApplied, setPresetApplied] = useState(false);

  const { data: campaignTypes = [] } = useQuery({
    queryKey: ['campaign-types'],
    queryFn: listCampaignTypes,
  });

  const { data: campaignCategories = [] } = useQuery({
    queryKey: ['campaign-categories'],
    queryFn: listCampaignCategories,
  });

  const availableCampaignTypes = campaignTypes.length ? campaignTypes : campaignTypeOptions;
  const availableCampaignCategories = campaignCategories.length ? campaignCategories : [];
  const selectedType = hasType(searchParams.get('type'), availableCampaignTypes) ? searchParams.get('type') : null;

  const form = useForm<CampaignEditorFormValues>({ defaultValues: createDefaultCampaignForm('custom_tasks') });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isDirty },
  } = form;

  const campaignQuery = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => getCampaign(id as string),
    enabled: Boolean(id),
  });

  const saveMutation = useMutation({
    mutationFn: (values: CampaignEditorFormValues) => saveCampaign(values, id),
    onSuccess: (savedCampaign) => {
      setLastSavedTime(new Date().toLocaleTimeString());
      navigate(`/business/campaigns/${savedCampaign.id}/edit`);
    },
  });

  useEffect(() => {
    if (campaignQuery.data) {
      reset(campaignToFormValues(campaignQuery.data));
      setPresetApplied(true);
    }
  }, [campaignQuery.data, reset]);

  useEffect(() => {
    if (id || presetApplied) return;

    const preset = selectedType
      ? availableCampaignTypes.find((option) => option.value === selectedType)
      : availableCampaignTypes[0];

    if (preset) {
      reset(createDefaultCampaignForm(preset));
      setPresetApplied(true);
    }
  }, [id, selectedType, availableCampaignTypes, presetApplied, reset]);

  useEffect(() => {
    if (!autoSaveEnabled || !isDirty || saveMutation.isPending) return;

    const autoSaveTimer = setTimeout(async () => {
      await saveMutation.mutateAsync(form.getValues());
    }, 3000);

    return () => clearTimeout(autoSaveTimer);
  }, [autoSaveEnabled, form, isDirty, saveMutation]);

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

  const currentStepIndex = WIZARD_STEPS.findIndex((step) => step.id === currentStep);

  const stepContent = (() => {
    switch (currentStep) {
      case 'type':
        return (
          <Card className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-white">Choose campaign type</h2>
              <p className="mt-2 text-sm text-mist">Select a database-backed type or use the blank custom task template.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {availableCampaignTypes.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setValue('campaignType', option.value, { shouldDirty: true });
                    setValue('instructions', option.defaultInstructions, { shouldDirty: true });
                    setValue('verificationMethod', option.defaultVerificationMethod, { shouldDirty: true });
                    if (!values.title || values.title === createDefaultCampaignForm('custom_tasks').title) {
                      setValue('title', option.label, { shouldDirty: true });
                    }
                    if (!values.description || values.description === createDefaultCampaignForm('custom_tasks').description) {
                      setValue('description', option.description, { shouldDirty: true });
                    }
                    setCurrentStep('details');
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${values.campaignType === option.value ? 'border-ember bg-ember/10' : 'border-white/10 bg-white/5 hover:border-ember/40'}`}
                >
                  <p className="text-lg font-semibold text-white">{option.label}</p>
                  <p className="mt-2 text-sm text-mist">{option.description}</p>
                </button>
              ))}
            </div>
          </Card>
        );
      case 'details':
        return (
          <Card className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Campaign details</h2>
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
                  {availableCampaignTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FieldGroup>
              <FieldGroup label="Description" hint="Visible to the campaign team and often shown to participants.">
                <textarea {...register('description')} className="input-base min-h-28" />
              </FieldGroup>
              <FieldGroup label="Campaign image" hint="Primary image used in campaign cards and previews.">
                <input {...register('campaignImageUrl')} className="input-base" placeholder="https://..." />
              </FieldGroup>
              <FieldGroup label="Banner URL" hint="Optional hero image used in campaign listings.">
                <input {...register('bannerUrl')} className="input-base" placeholder="https://..." />
              </FieldGroup>
              <FieldGroup label="Video URL" hint="Optional video asset shown with the campaign.">
                <input {...register('videoUrl')} className="input-base" placeholder="https://..." />
              </FieldGroup>
              <FieldGroup label="Landing URL" hint="Destination URL opened when participants start the campaign.">
                <input {...register('landingUrl')} className="input-base" placeholder="https://..." />
              </FieldGroup>
            </div>
            <FieldGroup label="Instructions" hint="Step-by-step instructions shown to participants.">
              <textarea {...register('instructions', { required: true })} className="input-base min-h-36" />
            </FieldGroup>
          </Card>
        );
      case 'rewards':
        return (
          <Card className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Rewards & limits</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FieldGroup label="Reward amount" hint="Per-completion payout.">
                <input type="number" step="0.01" {...register('rewardAmount', { valueAsNumber: true })} className="input-base" />
              </FieldGroup>
              <FieldGroup label="Budget" hint="Total campaign budget.">
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
        );
      case 'restrictions':
        return (
          <Card className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Restrictions & approvals</h2>
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
              <FieldGroup label="Age restriction minimum">
                <input type="number" {...register('ageRestrictionMin', { valueAsNumber: true })} className="input-base" placeholder="18" />
              </FieldGroup>
              <FieldGroup label="Age restriction maximum">
                <input type="number" {...register('ageRestrictionMax', { valueAsNumber: true })} className="input-base" placeholder="45" />
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
              <FieldGroup label="Required proof" hint="Text or proof template such as URL or receipt reference.">
                <input {...register('requiredProof')} className="input-base" />
              </FieldGroup>
            </div>
          </Card>
        );
      case 'audience':
        return (
          <Card className="space-y-5">
            <h2 className="text-2xl font-bold text-white">Target audience, categories, and schedule</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldGroup label="Age range" hint="e.g. 18-35 or 25-55">
                <input {...register('targetAgeRange')} className="input-base" placeholder="18-35" />
              </FieldGroup>
              <FieldGroup label="Campaign categories" hint="Comma-separated categories from the admin catalog.">
                <textarea {...register('campaignCategories')} className="input-base min-h-24" placeholder="acquisition, social, seasonal" />
              </FieldGroup>
              <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-mist">
                <p className="text-xs uppercase tracking-[0.18em] text-mist/60">Catalog categories</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableCampaignCategories.length ? (
                    availableCampaignCategories.map((category) => (
                      <span key={category.id} className="rounded-full border border-white/10 bg-ink/60 px-3 py-1 text-xs text-white">
                        {category.name}
                      </span>
                    ))
                  ) : (
                    <span>No categories loaded from Supabase yet.</span>
                  )}
                </div>
              </div>
              <FieldGroup label="Interests" hint="Comma-separated audience interests.">
                <textarea {...register('targetInterests')} className="input-base min-h-24" placeholder="crypto, gaming, fintech" />
              </FieldGroup>
              <FieldGroup label="Regions" hint="Geographic regions or continents.">
                <textarea {...register('targetRegions')} className="input-base min-h-24" placeholder="Africa, Europe" />
              </FieldGroup>
              <FieldGroup label="Languages">
                <textarea {...register('targetLanguages')} className="input-base min-h-24" placeholder="en, fr" />
              </FieldGroup>
              <FieldGroup label="Tags" hint="Internal categorization tags.">
                <textarea {...register('targetTags')} className="input-base min-h-24" placeholder="high-intent, web3" />
              </FieldGroup>
              <FieldGroup label="Audience notes" hint="Additional targeting context.">
                <textarea {...register('targetNotes')} className="input-base min-h-24" />
              </FieldGroup>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldGroup label="Active from">
                <input type="datetime-local" {...register('activeFrom')} className="input-base" />
              </FieldGroup>
              <FieldGroup label="Active to">
                <input type="datetime-local" {...register('activeTo')} className="input-base" />
              </FieldGroup>
              <FieldGroup label="Recurring campaigns" hint="Enable if this campaign should repeat on a schedule.">
                <div className="flex gap-3 pt-1">
                  <TogglePill active={values.recurringEnabled} onClick={() => setValue('recurringEnabled', true, { shouldDirty: true })}>
                    Enabled
                  </TogglePill>
                  <TogglePill active={!values.recurringEnabled} onClick={() => setValue('recurringEnabled', false, { shouldDirty: true })}>
                    Disabled
                  </TogglePill>
                </div>
              </FieldGroup>
              <FieldGroup label="Recurring frequency">
                <select {...register('recurringFrequency')} className="input-base">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom</option>
                </select>
              </FieldGroup>
              <FieldGroup label="Recurring interval">
                <input type="number" min={1} {...register('recurringInterval', { valueAsNumber: true })} className="input-base" />
              </FieldGroup>
              <FieldGroup label="Recurring days of week" hint="Comma-separated weekdays for weekly schedules.">
                <input {...register('recurringDaysOfWeek')} className="input-base" placeholder="monday, wednesday, friday" />
              </FieldGroup>
              <FieldGroup label="Recurring timezone">
                <input {...register('recurringTimezone')} className="input-base" placeholder="UTC" />
              </FieldGroup>
              <FieldGroup label="Recurring ends at">
                <input type="datetime-local" {...register('recurringEndsAt')} className="input-base" />
              </FieldGroup>
            </div>
          </Card>
        );
      case 'preview':
        return (
          <div className="grid gap-6 xl:grid-cols-[1fr_350px]">
            <Card className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-white">Review & launch</h2>
                <p className="mt-2 text-sm text-mist">Review the campaign payload before publishing.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-lg font-semibold text-white">Campaign summary</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <p><span className="text-mist/70">Title:</span> <span className="font-medium text-white">{values.title}</span></p>
                  <p><span className="text-mist/70">Type:</span> <span className="font-medium text-white">{values.campaignType.replace(/_/g, ' ')}</span></p>
                  <p><span className="text-mist/70">Image:</span> <span className="font-medium text-white">{values.campaignImageUrl || 'None'}</span></p>
                  <p><span className="text-mist/70">Video:</span> <span className="font-medium text-white">{values.videoUrl || 'None'}</span></p>
                  <p><span className="text-mist/70">Landing:</span> <span className="font-medium text-white">{values.landingUrl || 'None'}</span></p>
                  <p><span className="text-mist/70">Reward:</span> <span className="font-medium text-white">${values.rewardAmount.toFixed(2)}</span></p>
                  <p><span className="text-mist/70">Budget:</span> <span className="font-medium text-white">${values.budget.toFixed(0)} {values.budgetCurrency}</span></p>
                  <p><span className="text-mist/70">Participants:</span> <span className="font-medium text-white">{values.totalParticipants}</span></p>
                  <p><span className="text-mist/70">Categories:</span> <span className="font-medium text-white">{values.campaignCategories || 'None'}</span></p>
                  <p><span className="text-mist/70">Age restriction:</span> <span className="font-medium text-white">{values.ageRestrictionMin ?? 'Any'} - {values.ageRestrictionMax ?? 'Any'}</span></p>
                  <p><span className="text-mist/70">Recurring:</span> <span className="font-medium text-white">{values.recurringEnabled ? `${values.recurringFrequency} every ${values.recurringInterval}` : 'Disabled'}</span></p>
                  <p><span className="text-mist/70">Status:</span> <span className={`font-medium ${values.status === 'draft' ? 'text-mint' : 'text-amber-300'}`}>{values.status}</span></p>
                </div>
              </div>
            </Card>
            <Card className="sticky top-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Live preview</h2>
                <p className="mt-2 text-sm text-mist">Exact configuration stored in Supabase.</p>
              </div>
              <pre className="mt-4 max-h-[34rem] overflow-auto rounded-2xl border border-white/10 bg-ink/80 p-3 text-xs leading-relaxed text-mist">
                {JSON.stringify(preview, null, 2)}
              </pre>
            </Card>
          </div>
        );
    }
  })();

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Campaign wizard</p>
            <h1 className="text-3xl font-bold text-white">{id ? 'Edit campaign' : 'Create new campaign'}</h1>
          </div>
          <div className="text-sm text-mist">
            {lastSavedTime && <span className="text-mint">✓ Saved at {lastSavedTime}</span>}
            {isDirty && autoSaveEnabled && <span className="text-blue-400">Saving...</span>}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {WIZARD_STEPS.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={`flex flex-col gap-1 rounded-xl border px-4 py-3 text-left whitespace-nowrap transition ${currentStep === step.id ? 'border-ember bg-ember/10' : idx < currentStepIndex ? 'border-mint/30 bg-mint/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
            >
              <span className="text-xs uppercase tracking-[0.18em] text-mist/70">{step.label}</span>
              <span className="text-xs text-mist/60">{step.description}</span>
            </button>
          ))}
        </div>
      </div>

      {stepContent}

      <div className="sticky bottom-6 flex flex-wrap justify-between gap-3">
        <div className="flex gap-3">
          {currentStepIndex > 0 && (
            <Button variant="ghost" onClick={() => setCurrentStep(WIZARD_STEPS[currentStepIndex - 1].id)}>
              ← Previous
            </Button>
          )}
          {currentStepIndex < WIZARD_STEPS.length - 1 && (
            <Button onClick={() => setCurrentStep(WIZARD_STEPS[currentStepIndex + 1].id)}>
              Next →
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          {currentStepIndex === WIZARD_STEPS.length - 1 && (
            <>
              <label className="flex items-center gap-2 text-sm text-mist">
                <input
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(event) => setAutoSaveEnabled(event.target.checked)}
                  className="rounded border border-white/20"
                />
                Auto-save enabled
              </label>
              <Button variant="ghost" onClick={() => navigate('/business/campaigns')}>
                Cancel
              </Button>
              <Button onClick={onSubmit} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save & launch campaign'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}