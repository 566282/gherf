import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  listMerchantProfiles,
  listFiatFeePolicies,
  listFiatProviderSettings,
  listP2PRuntimeSettings,
  listP2PRolloutFlags,
  listQualificationRules,
  upsertFiatFeePolicy,
  upsertFiatProviderSetting,
  upsertP2PRolloutFlag,
  upsertQualificationRule,
  updateMerchantProfileMetadata,
} from '@/services/api/p2pAdmin';
import {
  listP2PAssignmentEvents,
  listP2PKycQueue,
  processP2PNotificationEvents,
  runExternalAmlScreening,
  runP2PComplianceJob,
  runP2PLiquidityHealthJob,
  runP2PMerchantAnalyticsJob,
} from '@/services/api/p2pCompliance';
import { applyMerchantWalletOperation } from '@/services/api/p2pAdmin';
import { reviewMerchantKycRequirement } from '@/services/api/p2pKyc';
import { useAuth } from '@/app/providers/AuthProvider';
import { runP2PAssignmentOrchestrator } from '@/services/api/p2pAssignmentOrchestrator';

function toJsonText(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

type MerchantPaymentAccountDraft = {
  id: string;
  label: string;
  provider: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency: string;
  countryCode: string;
  paymentInstructions: string;
  isActive: boolean;
  isApproved: boolean;
};

function createEmptyPaymentAccountDraft(): MerchantPaymentAccountDraft {
  const timestamp = Date.now();
  return {
    id: `acct-${timestamp}-${Math.round(Math.random() * 1000)}`,
    label: '',
    provider: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    currency: 'USD',
    countryCode: '',
    paymentInstructions: '',
    isActive: true,
    isApproved: false,
  };
}

function readPaymentAccountsFromMetadata(metadata: Record<string, unknown> | null | undefined): MerchantPaymentAccountDraft[] {
  const payload = metadata ?? {};
  const raw = payload.paymentAccounts ?? payload.payment_accounts;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry, index) => ({
      id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : `acct-${Date.now()}-${index + 1}`,
      label: typeof entry.label === 'string' ? entry.label : '',
      provider: typeof entry.provider === 'string' ? entry.provider : '',
      bankName: typeof entry.bankName === 'string' ? entry.bankName : '',
      accountName: typeof entry.accountName === 'string' ? entry.accountName : '',
      accountNumber: typeof entry.accountNumber === 'string' ? entry.accountNumber : '',
      currency: typeof entry.currency === 'string' && entry.currency.trim() ? entry.currency.toUpperCase() : 'USD',
      countryCode: typeof entry.countryCode === 'string' ? entry.countryCode.toUpperCase() : '',
      paymentInstructions: typeof entry.paymentInstructions === 'string' ? entry.paymentInstructions : '',
      isActive: entry.isActive === false || entry.active === false ? false : true,
      isApproved:
        entry.isApproved === true
        || entry.approvedByAdmin === true
        || (typeof entry.approvalStatus === 'string' && entry.approvalStatus.toLowerCase() === 'approved')
        || (typeof entry.status === 'string' && entry.status.toLowerCase() === 'approved'),
    }));
}

export function P2PMerchantControlPage(): JSX.Element {
  const { profile } = useAuth();
  const [providers, setProviders] = useState<Array<Record<string, unknown>>>([]);
  const [fees, setFees] = useState<Array<Record<string, unknown>>>([]);
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [rollouts, setRollouts] = useState<Array<Record<string, unknown>>>([]);
  const [merchants, setMerchants] = useState<Array<Record<string, unknown>>>([]);
  const [runtimeSettings, setRuntimeSettings] = useState<Record<string, unknown>>({});
  const [kycQueue, setKycQueue] = useState<Array<Record<string, unknown>>>([]);
  const [assignmentEvents, setAssignmentEvents] = useState<Array<Record<string, unknown>>>([]);
  const [selectedProvider, setSelectedProvider] = useState('p2p_merchant');
  const [selectedFee, setSelectedFee] = useState('default_global_hybrid_fee');
  const [selectedRule, setSelectedRule] = useState('merchant_kyc_mandatory');
  const [selectedRollout, setSelectedRollout] = useState('p2p_fiat_default_provider');
  const [providerConfigText, setProviderConfigText] = useState('{}');
  const [feeMetadataText, setFeeMetadataText] = useState('{}');
  const [ruleCriteriaText, setRuleCriteriaText] = useState('{}');
  const [rolloutCohortText, setRolloutCohortText] = useState('{}');
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [walletEntryType, setWalletEntryType] = useState<'top_up' | 'withdrawal'>('top_up');
  const [walletAmount, setWalletAmount] = useState('250');
  const [walletCurrency, setWalletCurrency] = useState('USD');
  const [walletNote, setWalletNote] = useState('Admin merchant wallet adjustment');
  const [amlSummary, setAmlSummary] = useState('No AML screening run yet.');
  const [statusMessage, setStatusMessage] = useState('Loading P2P merchant control plane...');
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [simulationBucket, setSimulationBucket] = useState(5);
  const [kycReviewReasonById, setKycReviewReasonById] = useState<Record<string, string>>({});
  const [merchantPaymentAccounts, setMerchantPaymentAccounts] = useState<MerchantPaymentAccountDraft[]>([]);

  const activeProvider = useMemo(
    () => providers.find((item) => String(item.provider_key) === selectedProvider) ?? providers[0] ?? null,
    [providers, selectedProvider],
  );
  const activeFee = useMemo(
    () => fees.find((item) => String(item.policy_key) === selectedFee) ?? fees[0] ?? null,
    [fees, selectedFee],
  );
  const activeRule = useMemo(
    () => rules.find((item) => String(item.rule_key) === selectedRule) ?? rules[0] ?? null,
    [rules, selectedRule],
  );
  const activeRollout = useMemo(
    () => rollouts.find((item) => String(item.flag_key) === selectedRollout) ?? rollouts[0] ?? null,
    [rollouts, selectedRollout],
  );
  const activeMerchant = useMemo(
    () => merchants.find((item) => String(item.id) === selectedMerchantId) ?? merchants[0] ?? null,
    [merchants, selectedMerchantId],
  );

  const refresh = async (): Promise<void> => {
    const [nextProviders, nextFees, nextRules, nextRollouts, nextMerchants, nextRuntimeSettings, nextKycQueue, nextAssignmentEvents] = await Promise.all([
      listFiatProviderSettings(),
      listFiatFeePolicies(),
      listQualificationRules(),
      listP2PRolloutFlags(),
      listMerchantProfiles(120),
      listP2PRuntimeSettings(),
      listP2PKycQueue(120),
      listP2PAssignmentEvents(120),
    ]);

    setProviders(nextProviders);
    setFees(nextFees);
    setRules(nextRules);
    setRollouts(nextRollouts);
    setMerchants(nextMerchants);
    setRuntimeSettings(nextRuntimeSettings);
    setKycQueue(nextKycQueue);
    setAssignmentEvents(nextAssignmentEvents);

    if (!selectedProvider && nextProviders.length) setSelectedProvider(String(nextProviders[0].provider_key));
    if (!selectedFee && nextFees.length) setSelectedFee(String(nextFees[0].policy_key));
    if (!selectedRule && nextRules.length) setSelectedRule(String(nextRules[0].rule_key));
    if (!selectedRollout && nextRollouts.length) setSelectedRollout(String(nextRollouts[0].flag_key));
    if (!selectedMerchantId && nextMerchants.length) setSelectedMerchantId(String(nextMerchants[0].id));

    setStatusMessage('P2P merchant control plane synced from Supabase.');
  };

  useEffect(() => {
    void refresh().catch(() => {
      setStatusMessage('Unable to sync P2P merchant control plane.');
    });
  }, []);

  useEffect(() => {
    if (activeProvider) setProviderConfigText(toJsonText(activeProvider.config));
  }, [activeProvider]);

  useEffect(() => {
    if (activeFee) setFeeMetadataText(toJsonText(activeFee.metadata));
  }, [activeFee]);

  useEffect(() => {
    if (activeRule) setRuleCriteriaText(toJsonText(activeRule.criteria));
  }, [activeRule]);

  useEffect(() => {
    if (activeRollout) setRolloutCohortText(toJsonText(activeRollout.cohort_rule));
  }, [activeRollout]);

  useEffect(() => {
    if (!activeMerchant) {
      setMerchantPaymentAccounts([]);
      return;
    }

    setMerchantPaymentAccounts(readPaymentAccountsFromMetadata((activeMerchant.metadata as Record<string, unknown>) ?? {}));
  }, [activeMerchant]);

  const saveProvider = async (): Promise<void> => {
    if (!activeProvider) return;
    setIsSaving(true);
    setStatusMessage('');
    try {
      await upsertFiatProviderSetting({
        providerKey: String(activeProvider.provider_key),
        providerClass: String(activeProvider.provider_class) as 'direct_gateway' | 'p2p_merchant' | 'hybrid',
        status: String(activeProvider.status) as 'active' | 'paused' | 'disabled',
        rankOrder: Number(activeProvider.rank_order ?? 100),
        supportedModules: Array.isArray(activeProvider.supported_modules) ? activeProvider.supported_modules.map((item) => String(item)) : ['*'],
        supportedCountries: Array.isArray(activeProvider.supported_countries) ? activeProvider.supported_countries.map((item) => String(item)) : ['*'],
        supportedCurrencies: Array.isArray(activeProvider.supported_currencies) ? activeProvider.supported_currencies.map((item) => String(item)) : ['USD'],
        fallbackChain: Array.isArray(activeProvider.fallback_chain) ? activeProvider.fallback_chain.map((item) => String(item)) : [],
        config: safeJsonParse<Record<string, unknown>>(providerConfigText, {}),
      });
      await refresh();
      setStatusMessage('Provider settings saved.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save provider settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveFee = async (): Promise<void> => {
    if (!activeFee) return;
    setIsSaving(true);
    setStatusMessage('');
    try {
      await upsertFiatFeePolicy({
        policyKey: String(activeFee.policy_key),
        status: String(activeFee.status) as 'active' | 'draft' | 'paused' | 'archived',
        feeModel: String(activeFee.fee_model) as 'fixed' | 'percentage' | 'hybrid',
        appliesToModules: Array.isArray(activeFee.applies_to_modules) ? activeFee.applies_to_modules.map((item) => String(item)) : ['*'],
        appliesToIntentTypes: Array.isArray(activeFee.applies_to_intent_types) ? activeFee.applies_to_intent_types.map((item) => String(item)) : ['*'],
        countries: Array.isArray(activeFee.countries) ? activeFee.countries.map((item) => String(item)) : ['*'],
        currencies: Array.isArray(activeFee.currencies) ? activeFee.currencies.map((item) => String(item)) : ['USD'],
        minAmount: Number(activeFee.min_amount ?? 0),
        maxAmount: activeFee.max_amount == null ? null : Number(activeFee.max_amount),
        fixedFee: Number(activeFee.fixed_fee ?? 0),
        percentFee: Number(activeFee.percent_fee ?? 0),
        waiverRules: Array.isArray(activeFee.waiver_rules) ? activeFee.waiver_rules : [],
        discountRules: Array.isArray(activeFee.discount_rules) ? activeFee.discount_rules : [],
        metadata: safeJsonParse<Record<string, unknown>>(feeMetadataText, {}),
      });
      await refresh();
      setStatusMessage('Fee policy saved.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save fee policy.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveRule = async (): Promise<void> => {
    if (!activeRule) return;
    setIsSaving(true);
    setStatusMessage('');
    try {
      await upsertQualificationRule({
        ruleKey: String(activeRule.rule_key),
        status: String(activeRule.status) as 'active' | 'draft' | 'paused' | 'archived',
        priority: Number(activeRule.priority ?? 100),
        criteria: safeJsonParse<Record<string, unknown>>(ruleCriteriaText, {}),
        outcomeOnFail: String(activeRule.outcome_on_fail) as 'disable' | 'suspend' | 'review',
        metadata: (activeRule.metadata as Record<string, unknown>) ?? {},
      });
      await refresh();
      setStatusMessage('Qualification rule saved.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save qualification rule.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveRollout = async (): Promise<void> => {
    if (!activeRollout) return;
    setIsSaving(true);
    setStatusMessage('');
    try {
      await upsertP2PRolloutFlag({
        flagKey: String(activeRollout.flag_key),
        status: String(activeRollout.status) as 'active' | 'draft' | 'paused' | 'archived',
        mode: String(activeRollout.mode) as 'shadow' | 'progressive' | 'enforced',
        rolloutPercent: Number(activeRollout.rollout_percent ?? 0),
        cohortRule: safeJsonParse<Record<string, unknown>>(rolloutCohortText, {}),
        fallbackProviderKey: activeRollout.fallback_provider_key ? String(activeRollout.fallback_provider_key) : null,
        metadata: (activeRollout.metadata as Record<string, unknown>) ?? {},
      });
      await refresh();
      setStatusMessage('Rollout flag saved.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save rollout flag.');
    } finally {
      setIsSaving(false);
    }
  };

  const runOps = async (): Promise<void> => {
    setIsRunning(true);
    setStatusMessage('Running compliance, AML, liquidity, and analytics jobs...');
    try {
      const [compliance, aml, liquidity, analytics, notificationsSent, assignment] = await Promise.all([
        runP2PComplianceJob(),
        runExternalAmlScreening(25),
        runP2PLiquidityHealthJob(),
        runP2PMerchantAnalyticsJob(),
        processP2PNotificationEvents(50),
        runP2PAssignmentOrchestrator(40),
      ]);
      setAmlSummary(`provider=${aml.providerName} screened=${aml.screened} flagged=${aml.flagged} mocked=${aml.mocked ? 'yes' : 'no'}`);
      setStatusMessage(
        `Jobs completed. compliance=${JSON.stringify(compliance)} aml=${JSON.stringify({ screened: aml.screened, flagged: aml.flagged, mocked: aml.mocked })} liquidity=${JSON.stringify(liquidity)} analytics=${JSON.stringify(analytics)} assignment=${JSON.stringify(assignment)} notificationsSent=${notificationsSent}`,
      );
      await refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to run P2P jobs.');
    } finally {
      setIsRunning(false);
    }
  };

  const rolloutSimulation = useMemo(() => {
    const rolloutMode = String(activeRollout?.mode ?? runtimeSettings.p2p_rollout_mode ?? 'progressive');
    const rolloutPercent = Number(activeRollout?.rollout_percent ?? runtimeSettings.p2p_rollout_percent ?? 0);
    const fallbackProvider = activeRollout?.fallback_provider_key
      ? String(activeRollout.fallback_provider_key)
      : Array.isArray(runtimeSettings.fiat_provider_fallback_chain) && runtimeSettings.fiat_provider_fallback_chain.length
        ? String(runtimeSettings.fiat_provider_fallback_chain[0])
        : 'direct_gateway_primary';

    const inBucket = simulationBucket >= 0 && simulationBucket < Math.max(0, Math.min(100, rolloutPercent));
    const selectedProvider = rolloutMode === 'enforced'
      ? 'p2p_merchant'
      : rolloutMode === 'shadow'
        ? fallbackProvider
        : inBucket
          ? 'p2p_merchant'
          : fallbackProvider;

    return {
      rolloutMode,
      rolloutPercent,
      selectedProvider,
      fallbackProvider,
      bucketInCohort: inBucket,
    };
  }, [activeRollout, runtimeSettings, simulationBucket]);

  const saveMerchantWalletOperation = async (): Promise<void> => {
    if (!activeMerchant) return;

    setIsSaving(true);
    setStatusMessage('');
    try {
      await applyMerchantWalletOperation({
        merchantId: String(activeMerchant.id),
        entryType: walletEntryType,
        amount: Number(walletAmount || 0),
        currency: walletCurrency,
        note: walletNote,
        referenceType: 'admin_wallet_operation',
        referenceId: `${walletEntryType}-${Date.now()}`,
        metadata: {
          merchantCode: activeMerchant.merchant_code,
          source: 'p2p_control_plane',
        },
      });
      await refresh();
      setStatusMessage(`Merchant wallet ${walletEntryType === 'top_up' ? 'top-up' : 'withdrawal'} applied.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to apply merchant wallet operation.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateMerchantAccountField = <K extends keyof MerchantPaymentAccountDraft>(
    accountId: string,
    field: K,
    value: MerchantPaymentAccountDraft[K],
  ) => {
    setMerchantPaymentAccounts((current) => current.map((account) => (
      account.id === accountId
        ? {
            ...account,
            [field]: value,
          }
        : account
    )));
  };

  const removeMerchantAccount = (accountId: string) => {
    setMerchantPaymentAccounts((current) => current.filter((account) => account.id !== accountId));
  };

  const addMerchantAccount = () => {
    setMerchantPaymentAccounts((current) => [...current, createEmptyPaymentAccountDraft()]);
  };

  const saveMerchantPaymentAccounts = async (): Promise<void> => {
    if (!activeMerchant) return;

    const invalid = merchantPaymentAccounts.find((account) => {
      if (!account.accountName.trim() || !account.accountNumber.trim()) return true;
      if (!account.currency.trim()) return true;
      return false;
    });

    if (invalid) {
      setStatusMessage('Every merchant payment account must include account name, account number, and currency before saving.');
      return;
    }

    const baseMetadata = ((activeMerchant.metadata as Record<string, unknown>) ?? {});
    const nextMetadata: Record<string, unknown> = {
      ...baseMetadata,
      paymentAccounts: merchantPaymentAccounts.map((account) => ({
        id: account.id,
        label: account.label.trim() || null,
        provider: account.provider.trim() || null,
        bankName: account.bankName.trim() || null,
        accountName: account.accountName.trim(),
        accountNumber: account.accountNumber.trim(),
        currency: account.currency.trim().toUpperCase(),
        countryCode: account.countryCode.trim().toUpperCase() || null,
        paymentInstructions: account.paymentInstructions.trim() || null,
        isActive: account.isActive,
        active: account.isActive,
        isApproved: account.isApproved,
        approvedByAdmin: account.isApproved,
        approvalStatus: account.isApproved ? 'approved' : 'pending',
        status: account.isApproved ? 'approved' : 'pending',
      })),
    };

    setIsSaving(true);
    setStatusMessage('Saving merchant payment accounts...');

    try {
      await updateMerchantProfileMetadata({
        merchantId: String(activeMerchant.id),
        metadata: nextMetadata,
      });

      await refresh();
      setStatusMessage('Merchant payment accounts saved. Active approved accounts are now available to users immediately.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save merchant payment accounts.');
    } finally {
      setIsSaving(false);
    }
  };

  const runAmlScreening = async (): Promise<void> => {
    setIsRunning(true);
    setStatusMessage('Running external AML and sanctions screening...');
    try {
      const aml = await runExternalAmlScreening(25);
      setAmlSummary(`provider=${aml.providerName} screened=${aml.screened} flagged=${aml.flagged} mocked=${aml.mocked ? 'yes' : 'no'}`);
      setStatusMessage('External AML screening completed.');
      await refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to run AML screening.');
    } finally {
      setIsRunning(false);
    }
  };

  const applyKycReview = async (requirementId: string, action: 'approve' | 'reject' | 'request_resubmission'): Promise<void> => {
    if (!profile?.id) {
      setStatusMessage('You must be signed in as an admin reviewer.');
      return;
    }

    setIsSaving(true);
    setStatusMessage('Applying KYC review action...');

    try {
      await reviewMerchantKycRequirement({
        requirementId,
        action,
        reviewerId: profile.id,
        reason: kycReviewReasonById[requirementId],
      });

      await refresh();
      setStatusMessage(`KYC requirement ${action.replace('_', ' ')} completed.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to apply KYC review action.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">P2P merchant</p>
        <h1 className="mt-2 text-4xl font-semibold text-foreground">P2P merchant control plane</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Configure default fiat providers, fee engines, qualification rules, and rollout behavior without code changes.
        </p>
        <p className="mt-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">{statusMessage}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Providers</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{providers.length}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Fee policies</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{fees.length}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Qualification rules</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{rules.length}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Rollout flags</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{rollouts.length}</p>
        </Card>
      </div>

      <Card className="space-y-3 border border-border bg-surface-elevated">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void runOps()} disabled={isRunning}>{isRunning ? 'Running jobs...' : 'Run compliance + liquidity + analytics'}</Button>
          <Button variant="ghost" onClick={() => void refresh()}>Reload control plane</Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3 border border-border bg-surface-elevated">
          <h2 className="text-2xl font-semibold text-foreground">Runtime settings snapshot</h2>
          <p className="text-sm text-muted">Current no-code runtime values loaded from platform settings.</p>
          <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-surface p-3 text-xs text-muted">{toJsonText(runtimeSettings)}</pre>
        </Card>

        <Card className="space-y-3 border border-border bg-surface-elevated">
          <h2 className="text-2xl font-semibold text-foreground">Rollout simulation preview</h2>
          <p className="text-sm text-muted">Preview provider outcome for a sample cohort bucket before saving rollout changes.</p>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Sample user bucket (0-99)</span>
            <input
              className="input-base"
              type="number"
              min={0}
              max={99}
              value={simulationBucket}
              onChange={(event) => setSimulationBucket(Math.max(0, Math.min(99, Number(event.target.value || 0))))}
            />
          </label>
          <div className="rounded-xl border border-border bg-surface p-3 text-sm text-muted">
            <p>Mode: <span className="text-foreground">{rolloutSimulation.rolloutMode}</span></p>
            <p>Percent: <span className="text-foreground">{rolloutSimulation.rolloutPercent}%</span></p>
            <p>Bucket in cohort: <span className="text-foreground">{rolloutSimulation.bucketInCohort ? 'yes' : 'no'}</span></p>
            <p>Fallback provider: <span className="text-foreground">{rolloutSimulation.fallbackProvider}</span></p>
            <p>Selected provider: <span className="text-foreground">{rolloutSimulation.selectedProvider}</span></p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3 border border-border bg-surface-elevated">
          <h2 className="text-2xl font-semibold text-foreground">Merchant wallet operations</h2>
          <p className="text-sm text-muted">Dedicated admin top-up and withdrawal operations against merchant liquidity wallets.</p>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Merchant</span>
            <select className="input-base" value={selectedMerchantId} onChange={(event) => setSelectedMerchantId(event.target.value)}>
              {merchants.map((item) => (
                <option key={String(item.id)} value={String(item.id)}>
                  {String(item.merchant_code ?? item.id)} · {String(item.display_name ?? item.legal_name ?? 'merchant')}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm text-muted">Operation</span>
              <select className="input-base" value={walletEntryType} onChange={(event) => setWalletEntryType(event.target.value as 'top_up' | 'withdrawal')}>
                <option value="top_up">Top up</option>
                <option value="withdrawal">Withdraw</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-muted">Amount</span>
              <input className="input-base" type="number" min="0.01" step="0.01" value={walletAmount} onChange={(event) => setWalletAmount(event.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-muted">Currency</span>
              <select className="input-base" value={walletCurrency} onChange={(event) => setWalletCurrency(event.target.value)}>
                {['USD', 'NGN', 'EUR', 'GBP'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </label>
          </div>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Note</span>
            <input className="input-base" value={walletNote} onChange={(event) => setWalletNote(event.target.value)} />
          </label>
          <div className="rounded-xl border border-border bg-surface p-3 text-sm text-muted">
            <p>Merchant: <span className="text-foreground">{activeMerchant ? String(activeMerchant.display_name ?? activeMerchant.legal_name ?? activeMerchant.merchant_code) : 'n/a'}</span></p>
            <p>Current status: <span className="text-foreground">{activeMerchant ? String(activeMerchant.status ?? 'unknown') : 'n/a'}</span></p>
          </div>
          <Button onClick={() => void saveMerchantWalletOperation()} disabled={isSaving || !activeMerchant}>
            {isSaving ? 'Applying...' : walletEntryType === 'top_up' ? 'Apply top-up' : 'Apply withdrawal'}
          </Button>
        </Card>

        <Card className="space-y-3 border border-border bg-surface-elevated">
          <h2 className="text-2xl font-semibold text-foreground">Merchant payment accounts</h2>
          <p className="text-sm text-muted">
            Create and approve merchant payment accounts used by users after intent creation. Only active and approved accounts are shown to users.
          </p>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Merchant</span>
            <select className="input-base" value={selectedMerchantId} onChange={(event) => setSelectedMerchantId(event.target.value)}>
              {merchants.map((item) => (
                <option key={String(item.id)} value={String(item.id)}>
                  {String(item.merchant_code ?? item.id)} · {String(item.display_name ?? item.legal_name ?? 'merchant')}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-3">
            {merchantPaymentAccounts.map((account) => (
              <div key={account.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-muted">Label</span>
                    <input className="input-base" value={account.label} onChange={(event) => updateMerchantAccountField(account.id, 'label', event.target.value)} placeholder="Primary NGN payout" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-muted">Provider</span>
                    <input className="input-base" value={account.provider} onChange={(event) => updateMerchantAccountField(account.id, 'provider', event.target.value)} placeholder="Bank / Provider" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-muted">Bank name</span>
                    <input className="input-base" value={account.bankName} onChange={(event) => updateMerchantAccountField(account.id, 'bankName', event.target.value)} placeholder="Bank name" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-muted">Account name</span>
                    <input className="input-base" value={account.accountName} onChange={(event) => updateMerchantAccountField(account.id, 'accountName', event.target.value)} placeholder="Account holder" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-muted">Account number</span>
                    <input className="input-base" value={account.accountNumber} onChange={(event) => updateMerchantAccountField(account.id, 'accountNumber', event.target.value)} placeholder="0123456789" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-muted">Currency</span>
                    <input className="input-base" value={account.currency} onChange={(event) => updateMerchantAccountField(account.id, 'currency', event.target.value.toUpperCase())} placeholder="USD" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-muted">Country code</span>
                    <input className="input-base" value={account.countryCode} onChange={(event) => updateMerchantAccountField(account.id, 'countryCode', event.target.value.toUpperCase())} placeholder="NG" />
                  </label>
                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-xs text-muted">Payment instructions</span>
                    <input className="input-base" value={account.paymentInstructions} onChange={(event) => updateMerchantAccountField(account.id, 'paymentInstructions', event.target.value)} placeholder="Add transfer note before sending receipt" />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" checked={account.isActive} onChange={(event) => updateMerchantAccountField(account.id, 'isActive', event.target.checked)} />
                    Active
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" checked={account.isApproved} onChange={(event) => updateMerchantAccountField(account.id, 'isApproved', event.target.checked)} />
                    Approved by admin
                  </label>
                  <Button variant="ghost" onClick={() => removeMerchantAccount(account.id)} disabled={isSaving}>Remove</Button>
                </div>
              </div>
            ))}
            {!merchantPaymentAccounts.length ? (
              <p className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted">No payment accounts configured for this merchant.</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={addMerchantAccount} disabled={isSaving || !activeMerchant}>Add payment account</Button>
            <Button onClick={() => void saveMerchantPaymentAccounts()} disabled={isSaving || !activeMerchant}>{isSaving ? 'Saving...' : 'Save payment accounts'}</Button>
          </div>
        </Card>

        <Card className="space-y-3 border border-border bg-surface-elevated">
          <h2 className="text-2xl font-semibold text-foreground">AML and sanctions connector</h2>
          <p className="text-sm text-muted">Normalized screening connector with optional external provider URL and deterministic mock fallback.</p>
          <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            <p>Enabled: <span className="text-foreground">{String(runtimeSettings.p2p_aml_provider_enabled ?? true)}</span></p>
            <p>Provider: <span className="text-foreground">{String(runtimeSettings.p2p_aml_provider_name ?? 'mock-sanctions-grid')}</span></p>
            <p>Provider URL: <span className="text-foreground">{String(runtimeSettings.p2p_aml_provider_url ?? 'not configured')}</span></p>
            <p>Mock mode: <span className="text-foreground">{String(runtimeSettings.p2p_aml_provider_mock_mode ?? true)}</span></p>
          </div>
          <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">{amlSummary}</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void runAmlScreening()} disabled={isRunning}>{isRunning ? 'Running AML...' : 'Run AML screening'}</Button>
            <Button variant="ghost" onClick={() => void refresh()} disabled={isRunning}>Reload settings</Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3 border border-border bg-surface-elevated">
          <h2 className="text-2xl font-semibold text-foreground">Provider settings</h2>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Provider</span>
            <select className="input-base" value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value)}>
              {providers.map((item) => (
                <option key={String(item.provider_key)} value={String(item.provider_key)}>{String(item.provider_key)}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Config JSON</span>
            <textarea className="input-base min-h-48 font-mono text-xs" value={providerConfigText} onChange={(event) => setProviderConfigText(event.target.value)} />
          </label>
          <Button onClick={() => void saveProvider()} disabled={isSaving}>Save provider</Button>
        </Card>

        <Card className="space-y-3 border border-border bg-surface-elevated">
          <h2 className="text-2xl font-semibold text-foreground">Fee policies</h2>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Policy</span>
            <select className="input-base" value={selectedFee} onChange={(event) => setSelectedFee(event.target.value)}>
              {fees.map((item) => (
                <option key={String(item.policy_key)} value={String(item.policy_key)}>{String(item.policy_key)}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Metadata JSON</span>
            <textarea className="input-base min-h-48 font-mono text-xs" value={feeMetadataText} onChange={(event) => setFeeMetadataText(event.target.value)} />
          </label>
          <Button onClick={() => void saveFee()} disabled={isSaving}>Save fee policy</Button>
        </Card>

        <Card className="space-y-3 border border-border bg-surface-elevated">
          <h2 className="text-2xl font-semibold text-foreground">Qualification rules</h2>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Rule</span>
            <select className="input-base" value={selectedRule} onChange={(event) => setSelectedRule(event.target.value)}>
              {rules.map((item) => (
                <option key={String(item.rule_key)} value={String(item.rule_key)}>{String(item.rule_key)}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Criteria JSON</span>
            <textarea className="input-base min-h-48 font-mono text-xs" value={ruleCriteriaText} onChange={(event) => setRuleCriteriaText(event.target.value)} />
          </label>
          <Button onClick={() => void saveRule()} disabled={isSaving}>Save rule</Button>
        </Card>

        <Card className="space-y-3 border border-border bg-surface-elevated">
          <h2 className="text-2xl font-semibold text-foreground">Rollout</h2>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Flag</span>
            <select className="input-base" value={selectedRollout} onChange={(event) => setSelectedRollout(event.target.value)}>
              {rollouts.map((item) => (
                <option key={String(item.flag_key)} value={String(item.flag_key)}>{String(item.flag_key)}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Cohort JSON</span>
            <textarea className="input-base min-h-48 font-mono text-xs" value={rolloutCohortText} onChange={(event) => setRolloutCohortText(event.target.value)} />
          </label>
          <Button onClick={() => void saveRollout()} disabled={isSaving}>Save rollout flag</Button>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border border-border bg-surface-elevated">
          <h2 className="text-2xl font-semibold text-foreground">KYC queue</h2>
          <p className="mt-2 text-sm text-muted">Merchant KYC requirements with current compliance status.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-3 py-2">Merchant</th>
                  <th className="px-3 py-2">Requirement</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">Review</th>
                </tr>
              </thead>
              <tbody>
                {kycQueue.map((item) => (
                  <tr key={String(item.id)} className="border-b border-border/60 text-foreground last:border-0">
                    <td className="px-3 py-2">{String(item.merchant_id ?? '').slice(0, 8)}</td>
                    <td className="px-3 py-2">{String(item.requirement_key ?? 'unknown')}</td>
                    <td className="px-3 py-2">{String(item.status ?? 'required')}</td>
                    <td className="px-3 py-2">{Number(item.level_required ?? 1)}</td>
                    <td className="px-3 py-2">
                      <div className="grid gap-2">
                        <input
                          className="input-base h-8 text-xs"
                          placeholder="Reason (required for reject/resubmit)"
                          value={kycReviewReasonById[String(item.id)] ?? ''}
                          onChange={(event) =>
                            setKycReviewReasonById((current) => ({
                              ...current,
                              [String(item.id)]: event.target.value,
                            }))
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-border px-2 py-1 text-xs hover:border-success/40"
                            onClick={() => void applyKycReview(String(item.id), 'approve')}
                            disabled={isSaving}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-border px-2 py-1 text-xs hover:border-warning/40"
                            onClick={() => void applyKycReview(String(item.id), 'request_resubmission')}
                            disabled={isSaving}
                          >
                            Resubmit
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-border px-2 py-1 text-xs hover:border-error/40"
                            onClick={() => void applyKycReview(String(item.id), 'reject')}
                            disabled={isSaving}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {!kycQueue.length ? (
                  <tr>
                    <td className="px-3 py-4 text-muted" colSpan={5}>No KYC queue rows found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="border border-border bg-surface-elevated">
          <h2 className="text-2xl font-semibold text-foreground">Assignment trace explorer</h2>
          <p className="mt-2 text-sm text-muted">Inspect matching decisions and score traces for shadow/progressive rollout debugging.</p>
          <div className="mt-4 space-y-3">
            {assignmentEvents.map((event) => (
              <div key={String(event.id)} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-sm text-foreground">Decision: {String(event.decision ?? 'unknown')} · Score: {event.score == null ? 'n/a' : Number(event.score).toFixed(4)}</p>
                <p className="text-xs text-muted">Reason: {String(event.reason_code ?? 'n/a')} · Order: {String(event.order_id ?? '').slice(0, 8)}</p>
                <pre className="mt-2 max-h-32 overflow-auto rounded-lg border border-border/60 bg-background p-2 text-[11px] text-muted">{toJsonText(event.trace)}</pre>
              </div>
            ))}
            {!assignmentEvents.length ? <p className="text-sm text-muted">No assignment events yet.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
