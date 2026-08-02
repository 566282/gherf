import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { listMembershipRuleVersions, publishMembershipRuleVersion, upsertMembershipRuleVersion, type MembershipRuleVersionRecord } from '@/services/api/membershipAdmin';

const defaultPayload = '{\n  "dailyPercent": 10,\n  "cycleDays": 31,\n  "targetWallet": "main_wallet"\n}';

function safeParseJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function MembershipRulesPage(): JSX.Element {
  const [rules, setRules] = useState<MembershipRuleVersionRecord[]>([]);
  const [ruleKey, setRuleKey] = useState('reward_policy');
  const [version, setVersion] = useState('v2');
  const [status, setStatus] = useState('draft');
  const [payloadText, setPayloadText] = useState(defaultPayload);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const reload = async () => {
    setRules(await listMembershipRuleVersions());
  };

  useEffect(() => {
    void reload().catch(() => setStatusMessage('Unable to load membership rules.'));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await upsertMembershipRuleVersion({ ruleKey, version, status, payload: safeParseJson(payloadText) });
      await reload();
      setStatusMessage(`Saved ${ruleKey} ${version}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save membership rule.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async (target: MembershipRuleVersionRecord) => {
    setStatusMessage('');
    try {
      await publishMembershipRuleVersion(target.ruleKey, target.version);
      await reload();
      setStatusMessage(`Published ${target.ruleKey} ${target.version}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to publish membership rule.');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Rule engine</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Membership rules</h1>
        <p className="mt-2 text-sm text-muted">Create, version, and publish reward or withdrawal policy payloads from admin UI.</p>
      </Card>

      <Card className="border border-border bg-surface-elevated space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2"><span className="text-sm text-muted">Rule key</span><input className="input-base" value={ruleKey} onChange={(event) => setRuleKey(event.target.value)} /></label>
          <label className="grid gap-2"><span className="text-sm text-muted">Version</span><input className="input-base" value={version} onChange={(event) => setVersion(event.target.value)} /></label>
          <label className="grid gap-2"><span className="text-sm text-muted">Status</span><select className="input-base" value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">draft</option><option value="published">published</option><option value="archived">archived</option></select></label>
        </div>
        <label className="grid gap-2">
          <span className="text-sm text-muted">Rule payload JSON</span>
          <textarea className="input-base min-h-48 font-mono text-sm" value={payloadText} onChange={(event) => setPayloadText(event.target.value)} />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save rule version'}</Button>
          <Button variant="ghost" onClick={() => void reload()} disabled={isSaving}>Reload</Button>
        </div>
        {statusMessage ? <p className="text-sm text-muted">{statusMessage}</p> : null}
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <h2 className="text-2xl font-semibold text-foreground">Rule versions</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted"><th className="py-2 pr-4">Rule key</th><th className="py-2 pr-4">Version</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Updated</th><th className="py-2 pr-4">Action</th></tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-border/70">
                  <td className="py-2 pr-4">{rule.ruleKey}</td>
                  <td className="py-2 pr-4">{rule.version}</td>
                  <td className="py-2 pr-4">{rule.status}</td>
                  <td className="py-2 pr-4">{new Date(rule.updatedAt).toLocaleString()}</td>
                  <td className="py-2 pr-4"><button type="button" className="rounded border border-border px-2 py-1 text-xs hover:bg-surface" onClick={() => void handlePublish(rule)}>Publish</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
