import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  createDefaultTaskCompliancePolicy,
  getActiveCompliancePolicySelection,
  listCompliancePolicies,
  listCompliancePolicyVersions,
  publishCompliancePolicyVersion,
  setActiveCompliancePolicySelection,
  TASK_COMPLIANCE_POLICY_KEY,
  TASK_COMPLIANCE_POLICY_SCHEMA_VERSION,
  upsertCompliancePolicy,
  upsertCompliancePolicyVersion,
  validateTaskCompliancePolicy,
  type CompliancePolicyRecord,
  type CompliancePolicyVersionRecord,
} from '@/services/api/compliancePolicy';

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function CompliancePoliciesPage(): JSX.Element {
  const { profile } = useAuth();
  const [policies, setPolicies] = useState<CompliancePolicyRecord[]>([]);
  const [versions, setVersions] = useState<CompliancePolicyVersionRecord[]>([]);
  const [selectedPolicyKey, setSelectedPolicyKey] = useState(TASK_COMPLIANCE_POLICY_KEY);
  const [selectedVersion, setSelectedVersion] = useState('v1-baseline');
  const [title, setTitle] = useState('Task Compliance Baseline');
  const [description, setDescription] = useState('Policy DSL baseline for verification strategy, withdrawal gate, risk scoring, and enforcement transitions.');
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('active');
  const [policyText, setPolicyText] = useState(JSON.stringify(createDefaultTaskCompliancePolicy(), null, 2));
  const [activeSelectionText, setActiveSelectionText] = useState('Loading active policy selection...');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredVersions = useMemo(
    () => versions.filter((version) => version.policyKey === selectedPolicyKey),
    [versions, selectedPolicyKey],
  );

  const reload = async () => {
    const [nextPolicies, nextVersions, activeSelection] = await Promise.all([
      listCompliancePolicies(),
      listCompliancePolicyVersions(),
      getActiveCompliancePolicySelection(),
    ]);

    setPolicies(nextPolicies);
    setVersions(nextVersions);
    setActiveSelectionText(`Active policy: ${activeSelection.policyKey} @ ${activeSelection.version}`);

    if (!nextPolicies.find((policy) => policy.policyKey === selectedPolicyKey) && nextPolicies.length) {
      const first = nextPolicies[0];
      setSelectedPolicyKey(first.policyKey);
      setTitle(first.title);
      setDescription(first.description);
      setStatus(first.status === 'archived' ? 'archived' : first.status === 'draft' ? 'draft' : 'active');
    }
  };

  useEffect(() => {
    void reload().catch(() => setStatusMessage('Unable to load compliance policy data.'));
  }, []);

  useEffect(() => {
    const selected = policies.find((policy) => policy.policyKey === selectedPolicyKey);
    if (!selected) return;

    setTitle(selected.title);
    setDescription(selected.description);
    setStatus(selected.status === 'archived' ? 'archived' : selected.status === 'draft' ? 'draft' : 'active');

    const latestVersion = versions.find((version) => version.policyKey === selectedPolicyKey);
    if (latestVersion) {
      setSelectedVersion(latestVersion.version);
      setPolicyText(JSON.stringify(latestVersion.policy, null, 2));
    }
  }, [policies, selectedPolicyKey, versions]);

  const handleSave = async () => {
    const parsed = safeParseJson(policyText);
    if (!parsed) {
      setStatusMessage('Policy JSON is invalid.');
      return;
    }

    const validation = validateTaskCompliancePolicy(parsed);
    if (!validation.valid) {
      setStatusMessage(`Validation failed: ${validation.errors.join(' | ')}`);
      return;
    }

    setIsSaving(true);
    setStatusMessage('');

    try {
      await upsertCompliancePolicy({
        policyKey: selectedPolicyKey,
        title,
        description,
        status,
        metadata: { module: 'task_verification', phase: 0 },
        updatedBy: profile?.id ?? null,
      });

      await upsertCompliancePolicyVersion({
        policyKey: selectedPolicyKey,
        version: selectedVersion,
        status: 'draft',
        schemaVersion: TASK_COMPLIANCE_POLICY_SCHEMA_VERSION,
        policy: parsed,
        updatedBy: profile?.id ?? null,
      });

      await reload();
      setStatusMessage(`Saved ${selectedPolicyKey} ${selectedVersion}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save compliance policy version.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async (target: CompliancePolicyVersionRecord) => {
    setIsSaving(true);
    setStatusMessage('');

    try {
      await publishCompliancePolicyVersion(target.policyKey, target.version, profile?.id ?? null);
      await reload();
      setStatusMessage(`Published ${target.policyKey} ${target.version}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to publish compliance policy version.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetActive = async (target: CompliancePolicyVersionRecord) => {
    setIsSaving(true);
    setStatusMessage('');

    try {
      await setActiveCompliancePolicySelection({
        policyKey: target.policyKey,
        version: target.version,
        schemaVersion: target.schemaVersion,
      }, profile?.id ?? null);
      await reload();
      setStatusMessage(`Set active policy to ${target.policyKey} @ ${target.version}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to set active compliance policy.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Phase 0</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Task compliance policy contract</h1>
        <p className="mt-2 text-sm text-muted">
          Edit and publish the policy DSL for verification strategy, state transitions, withdrawal gate behavior, risk scoring,
          and enforcement rules without hardcoding business decisions in UI code.
        </p>
      </Card>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <p className="text-sm text-muted">{activeSelectionText}</p>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm text-muted">Policy key</span>
            <input className="input-base" value={selectedPolicyKey} onChange={(event) => setSelectedPolicyKey(event.target.value)} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Version</span>
            <input className="input-base" value={selectedVersion} onChange={(event) => setSelectedVersion(event.target.value)} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm text-muted">Policy title</span>
            <input className="input-base" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Policy status</span>
            <select className="input-base" value={status} onChange={(event) => setStatus(event.target.value as 'draft' | 'active' | 'archived')}>
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="archived">archived</option>
            </select>
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm text-muted">Description</span>
          <input className="input-base" value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-muted">Policy JSON</span>
          <textarea
            className="input-base min-h-[24rem] font-mono text-xs"
            value={policyText}
            onChange={(event) => setPolicyText(event.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save draft version'}</Button>
          <Button variant="ghost" onClick={() => void reload()} disabled={isSaving}>Reload</Button>
        </div>

        {statusMessage ? <p className="text-sm text-muted">{statusMessage}</p> : null}
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <h2 className="text-2xl font-semibold text-foreground">Policy versions</h2>
        <p className="mt-2 text-sm text-muted">Publish or activate immutable versions from this queue.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 pr-4">Policy</th>
                <th className="py-2 pr-4">Version</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Schema</th>
                <th className="py-2 pr-4">Updated</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVersions.map((version) => (
                <tr key={version.id} className="border-b border-border/70">
                  <td className="py-2 pr-4">{version.policyKey}</td>
                  <td className="py-2 pr-4">{version.version}</td>
                  <td className="py-2 pr-4">{version.status}</td>
                  <td className="py-2 pr-4">{version.schemaVersion}</td>
                  <td className="py-2 pr-4">{new Date(version.updatedAt).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                        onClick={() => void handlePublish(version)}
                        disabled={isSaving}
                      >
                        Publish
                      </button>
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                        onClick={() => void handleSetActive(version)}
                        disabled={isSaving}
                      >
                        Set active
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredVersions.length ? (
                <tr>
                  <td className="py-4 text-muted" colSpan={6}>No versions found for this policy key yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
