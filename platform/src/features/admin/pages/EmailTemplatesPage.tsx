import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { listCommunicationConfig, type CommunicationConfig, type CommunicationTemplate } from '@/services/api/communications';

function formatChannelList(channels: CommunicationTemplate['channels']): string {
  return channels.map((channel) => channel.replace(/_/g, ' ')).join(' · ');
}

function channelTone(enabled: boolean): string {
  return enabled ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/20 bg-rose-500/10 text-rose-300';
}

export function EmailTemplatesPage(): JSX.Element {
  const [config, setConfig] = useState<CommunicationConfig | null>(null);
  const [statusMessage, setStatusMessage] = useState('Loading email template catalog...');

  useEffect(() => {
    let active = true;

    void listCommunicationConfig()
      .then((nextConfig) => {
        if (!active) return;
        setConfig(nextConfig);
        setStatusMessage('Loaded live email templates from communication settings and the template table.');
      })
      .catch(() => {
        if (!active) return;
        setConfig(null);
        setStatusMessage('Unable to load live email templates right now.');
      });

    return () => {
      active = false;
    };
  }, []);

  const templates = useMemo(() => Object.values(config?.templates ?? {}), [config]);
  const enabledTemplates = templates.filter((template) => template.enabled).length;

  return (
    <div className="page-transition space-y-6 p-6">
      <Card className="relative overflow-hidden border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--chart-1)/0.16),transparent_34%),linear-gradient(135deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,hsl(var(--color-foreground)/0.03),transparent)]" />
        <div className="relative space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-accent/70">Project-wide email templates</p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">Email template catalog</h1>
          <p className="text-base text-muted">Live templates are sourced from the communication system settings and communication templates table.</p>
          <p className="text-sm text-muted">{statusMessage}</p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border bg-surface-elevated">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Templates tracked</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{templates.length}</p>
          <p className="mt-1 text-xs text-muted">{enabledTemplates} enabled · {templates.length - enabledTemplates} disabled</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Timezone</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{config?.timezone ?? 'Loading...'}</p>
          <p className="mt-1 text-xs text-muted">Quiet hours {config?.quietHoursStart ?? '--'} to {config?.quietHoursEnd ?? '--'}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Email delivery</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{config?.emailEnabled ? 'Enabled' : 'Disabled'}</p>
          <p className="mt-1 text-xs text-muted">Promotional: {config?.promotionalEnabled ? 'Enabled' : 'Disabled'}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Live announcements</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{config?.liveAnnouncementsEnabled ? 'Enabled' : 'Disabled'}</p>
          <p className="mt-1 text-xs text-muted">Template table is synced on load</p>
        </Card>
      </div>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Live templates</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Template rows</h2>
          <p className="text-sm text-muted">Each row reflects the current communication template catalog, not static seeded content.</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-elevated text-muted">
              <tr>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Template</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Channels</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Subject</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Status</th>
              </tr>
            </thead>
            <tbody>
              {templates.length ? templates.map((template) => (
                <tr key={template.key} className="border-t border-border">
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-foreground">{template.name}</p>
                    <p className="mt-1 max-w-lg text-xs text-muted">{template.description}</p>
                  </td>
                  <td className="px-4 py-3 align-top text-foreground/85">{formatChannelList(template.channels)}</td>
                  <td className="px-4 py-3 align-top text-foreground/85">{template.subject || 'No subject configured'}</td>
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${channelTone(template.enabled)}`}>
                      {template.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">No email templates are currently available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}