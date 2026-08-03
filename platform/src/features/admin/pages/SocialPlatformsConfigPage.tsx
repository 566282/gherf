import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import { listSocialPlatformDefinitions, upsertSocialPlatformDefinition, type SocialPlatformDefinition } from '@/services/api/taskProfile';

const defaultSchemaText = '{\n  "fields": [\n    { "key": "handle", "type": "text", "required": true }\n  ]\n}';

export function SocialPlatformsConfigPage(): JSX.Element {
  const { profile } = useAuth();
  const [platforms, setPlatforms] = useState<SocialPlatformDefinition[]>([]);
  const [platformKey, setPlatformKey] = useState('linkedin');
  const [displayName, setDisplayName] = useState('LinkedIn');
  const [status, setStatus] = useState<'active' | 'paused' | 'archived'>('active');
  const [capabilities, setCapabilities] = useState('api_signal,oauth_link,evidence_upload,manual_review');
  const [fieldSchemaText, setFieldSchemaText] = useState(defaultSchemaText);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const reload = async () => {
    setPlatforms(await listSocialPlatformDefinitions());
  };

  useEffect(() => {
    void reload().catch(() => setStatusMessage('Unable to load social platform definitions.'));
  }, []);

  const handleSave = async () => {
    let parsedSchema: Record<string, unknown> = {};
    try {
      parsedSchema = JSON.parse(fieldSchemaText) as Record<string, unknown>;
    } catch {
      setStatusMessage('Field schema JSON is invalid.');
      return;
    }

    setIsSaving(true);
    setStatusMessage('');

    try {
      await upsertSocialPlatformDefinition({
        platformKey,
        displayName,
        status,
        fieldSchema: parsedSchema,
        verificationCapabilities: capabilities.split(',').map((item) => item.trim()).filter(Boolean),
        metadata: { source: 'social_platforms_config_page' },
        updatedBy: profile?.id ?? null,
      });
      await reload();
      setStatusMessage('Platform definition saved.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save platform definition.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Phase 7</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Social platform schema config</h1>
        <p className="mt-2 text-sm text-muted">Admin-controlled dynamic schema for user social profile onboarding.</p>
      </Card>

      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2"><span className="text-sm text-muted">Platform key</span><input className="input-base" value={platformKey} onChange={(event) => setPlatformKey(event.target.value)} /></label>
          <label className="grid gap-2"><span className="text-sm text-muted">Display name</span><input className="input-base" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2"><span className="text-sm text-muted">Status</span><select className="input-base" value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'paused' | 'archived')}><option value="active">active</option><option value="paused">paused</option><option value="archived">archived</option></select></label>
          <label className="grid gap-2"><span className="text-sm text-muted">Verification capabilities</span><input className="input-base" value={capabilities} onChange={(event) => setCapabilities(event.target.value)} /></label>
        </div>
        <label className="grid gap-2"><span className="text-sm text-muted">Field schema JSON</span><textarea className="input-base min-h-48 font-mono text-xs" value={fieldSchemaText} onChange={(event) => setFieldSchemaText(event.target.value)} /></label>
        <div className="flex gap-3">
          <Button onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save platform definition'}</Button>
          <Button variant="ghost" onClick={() => void reload()} disabled={isSaving}>Reload</Button>
        </div>
        {statusMessage ? <p className="text-sm text-muted">{statusMessage}</p> : null}
      </Card>

      <Card>
        <h2 className="text-2xl font-semibold text-foreground">Existing definitions</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted"><th className="py-2 pr-4">Platform</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Capabilities</th></tr>
            </thead>
            <tbody>
              {platforms.map((platform) => (
                <tr key={platform.id} className="border-b border-border/60"><td className="py-2 pr-4">{platform.displayName} ({platform.platformKey})</td><td className="py-2 pr-4">{platform.status}</td><td className="py-2 pr-4">{platform.verificationCapabilities.join(', ')}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
