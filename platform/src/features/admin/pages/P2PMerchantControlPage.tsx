import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  listFiatFeePolicies,
  listFiatProviderSettings,
  listP2PRuntimeSettings,
  listP2PRolloutFlags,
  listQualificationRules,
  upsertFiatFeePolicy,
  upsertFiatProviderSetting,
  upsertP2PRolloutFlag,
  upsertQualificationRule,
} from '@/services/api/p2pAdmin';
import {
  listP2PAssignmentEvents,
  listP2PKycQueue,
  processP2PNotificationEvents,
  runP2PComplianceJob,
  runP2PLiquidityHealthJob,
  runP2PMerchantAnalyticsJob,
} from '@/services/api/p2pCompliance';

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

export function P2PMerchantControlPage(): JSX.Element {
  const [providers, setProviders] = useState<Array<Record<string, unknown>>>([]);
  const [fees, setFees] = useState<Array<Record<string, unknown>>>([]);
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [rollouts, setRollouts] = useState<Array<Record<string, unknown>>>([]);
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
  const [statusMessage, setStatusMessage] = useState('Loading P2P merchant control plane...');
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [simulationBucket, setSimulationBucket] = useState(5);

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

  const refresh = async (): Promise<void> => {
    const [nextProviders, nextFees, nextRules, nextRollouts, nextRuntimeSettings, nextKycQueue, nextAssignmentEvents] = await Promise.all([
      listFiatProviderSettings(),
      listFiatFeePolicies(),
      listQualificationRules(),
      listP2PRolloutFlags(),
      listP2PRuntimeSettings(),
      listP2PKycQueue(120),
      listP2PAssignmentEvents(120),
    ]);

    setProviders(nextProviders);
    setFees(nextFees);
    setRules(nextRules);
    setRollouts(nextRollouts);
    setRuntimeSettings(nextRuntimeSettings);
    setKycQueue(nextKycQueue);
    setAssignmentEvents(nextAssignmentEvents);

    if (!selectedProvider && nextProviders.length) setSelectedProvider(String(nextProviders[0].provider_key));
    if (!selectedFee && nextFees.length) setSelectedFee(String(nextFees[0].policy_key));
    if (!selectedRule && nextRules.length) setSelectedRule(String(nextRules[0].rule_key));
    if (!selectedRollout && nextRollouts.length) setSelectedRollout(String(nextRollouts[0].flag_key));

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
    setStatusMessage('Running compliance, liquidity, and analytics jobs...');
    try {
      const [compliance, liquidity, analytics, notificationsSent] = await Promise.all([
        runP2PComplianceJob(),
        runP2PLiquidityHealthJob(),
        runP2PMerchantAnalyticsJob(),
        processP2PNotificationEvents(50),
      ]);
      setStatusMessage(
        `Jobs completed. compliance=${JSON.stringify(compliance)} liquidity=${JSON.stringify(liquidity)} analytics=${JSON.stringify(analytics)} notificationsSent=${notificationsSent}`,
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
                </tr>
              </thead>
              <tbody>
                {kycQueue.map((item) => (
                  <tr key={String(item.id)} className="border-b border-border/60 text-foreground last:border-0">
                    <td className="px-3 py-2">{String(item.merchant_id ?? '').slice(0, 8)}</td>
                    <td className="px-3 py-2">{String(item.requirement_key ?? 'unknown')}</td>
                    <td className="px-3 py-2">{String(item.status ?? 'required')}</td>
                    <td className="px-3 py-2">{Number(item.level_required ?? 1)}</td>
                  </tr>
                ))}
                {!kycQueue.length ? (
                  <tr>
                    <td className="px-3 py-4 text-muted" colSpan={4}>No KYC queue rows found.</td>
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
