import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { listMembershipWorkflows, upsertMembershipWorkflow, type MembershipWorkflowRecord } from '@/services/api/membershipAdmin';

const defaultDefinition = '{\n  "states": ["requested", "approved", "activated"],\n  "transitions": [\n    {"from": "requested", "event": "approve", "to": "approved", "requires": ["admin_approval"]},\n    {"from": "approved", "event": "activate", "to": "activated", "requires": ["fee_compliance"]}\n  ]\n}';

function safeParseJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function MembershipWorkflowPage(): JSX.Element {
  const [workflows, setWorkflows] = useState<MembershipWorkflowRecord[]>([]);
  const [workflowKey, setWorkflowKey] = useState('membership_upgrade_flow');
  const [version, setVersion] = useState('v1');
  const [status, setStatus] = useState('draft');
  const [definitionText, setDefinitionText] = useState(defaultDefinition);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const reload = async () => {
    setWorkflows(await listMembershipWorkflows());
  };

  useEffect(() => {
    void reload().catch(() => setStatusMessage('Unable to load workflows.'));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await upsertMembershipWorkflow({
        workflowKey,
        version,
        status,
        definition: safeParseJson(definitionText),
      });
      await reload();
      setStatusMessage(`Saved ${workflowKey} ${version}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save workflow definition.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Workflow builder</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Membership workflow</h1>
        <p className="mt-2 text-sm text-muted">Persist and version workflow transitions for membership lifecycle automation.</p>
      </Card>

      <Card className="border border-border bg-surface-elevated space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2"><span className="text-sm text-muted">Workflow key</span><input className="input-base" value={workflowKey} onChange={(event) => setWorkflowKey(event.target.value)} /></label>
          <label className="grid gap-2"><span className="text-sm text-muted">Version</span><input className="input-base" value={version} onChange={(event) => setVersion(event.target.value)} /></label>
          <label className="grid gap-2"><span className="text-sm text-muted">Status</span><select className="input-base" value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">draft</option><option value="published">published</option><option value="archived">archived</option></select></label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm text-muted">Workflow definition JSON</span>
          <textarea className="input-base min-h-52 font-mono text-sm" value={definitionText} onChange={(event) => setDefinitionText(event.target.value)} />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save workflow'}</Button>
          <Button variant="ghost" onClick={() => void reload()} disabled={isSaving}>Reload</Button>
        </div>

        {statusMessage ? <p className="text-sm text-muted">{statusMessage}</p> : null}
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <h2 className="text-2xl font-semibold text-foreground">Saved workflow versions</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted"><th className="py-2 pr-4">Workflow key</th><th className="py-2 pr-4">Version</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Updated</th></tr>
            </thead>
            <tbody>
              {workflows.map((workflow) => (
                <tr key={workflow.id} className="border-b border-border/70">
                  <td className="py-2 pr-4">{workflow.workflowKey}</td>
                  <td className="py-2 pr-4">{workflow.version}</td>
                  <td className="py-2 pr-4">{workflow.status}</td>
                  <td className="py-2 pr-4">{new Date(workflow.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
