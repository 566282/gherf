import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { listUsers } from '@/services/api/auth';
import type { UserProfile } from '@/types/auth';
import {
  sendInternalMessage,
  publishLiveAnnouncement,
  sendPromotionalNotification,
  communicationChannels,
  cancelNotificationQueueItem,
  listCommunicationConfig,
  listCommunicationTemplates,
  listNotificationQueue,
  listNotificationRetryHistory,
  processNotificationQueue,
  retryNotificationQueueItem,
  type CommunicationConfig,
} from '@/services/api/communications';

const channelLabels: Record<(typeof communicationChannels)[number], string> = {
  in_app: 'In-app',
  email: 'Email',
  push: 'Push',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
};

const variableGroups = [
  { label: 'User', values: ['{{full_name}}', '{{email}}', '{{user_id}}'] },
  { label: 'Money', values: ['{{amount}}', '{{currency}}', '{{net_amount}}'] },
  { label: 'Links', values: ['{{verification_link}}', '{{reset_link}}', '{{cta_link}}'] },
  { label: 'Announcements', values: ['{{announcement_title}}', '{{announcement_body}}', '{{message_body}}'] },
];

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Pending';

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isComplianceQueueItem(row: { template_key: string | null; metadata: Record<string, unknown> | null }): boolean {
  if (typeof row.template_key === 'string' && row.template_key.startsWith('compliance_')) {
    return true;
  }

  const metadata = row.metadata;
  return Boolean(metadata && typeof metadata.complianceEvent === 'string');
}

export function NotificationCenterPage(): JSX.Element {
  const [config, setConfig] = useState<CommunicationConfig | null>(null);
  const [templates, setTemplates] = useState<Array<{ key: string; name: string; description: string; channels: string[]; subject: string; body: string; enabled: boolean }>>([]);
  const [queueRows, setQueueRows] = useState<Awaited<ReturnType<typeof listNotificationQueue>>>([]);
  const [retryRows, setRetryRows] = useState<Awaited<ReturnType<typeof listNotificationRetryHistory>>>([]);
  const [statusMessage, setStatusMessage] = useState('Loading notification center...');
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [retryingQueueId, setRetryingQueueId] = useState<string | null>(null);
  const [selectedQueueRow, setSelectedQueueRow] = useState<Awaited<ReturnType<typeof listNotificationQueue>>[number] | null>(null);
  const [queueSearch, setQueueSearch] = useState('');
  const [queueStatus, setQueueStatus] = useState<'all' | 'queued' | 'processing' | 'failed' | 'retry' | 'sent' | 'cancelled'>('all');
  const [queuePage, setQueuePage] = useState(1);
  const [hasMoreQueuePages, setHasMoreQueuePages] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [recipientMode, setRecipientMode] = useState<'all' | 'selected'>('all');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [sendMode, setSendMode] = useState<'internal' | 'announcement' | 'promotional'>('internal');
  const [sendTitle, setSendTitle] = useState('Important account update');
  const [sendBody, setSendBody] = useState('Your account settings were reviewed. Visit profile to confirm details.');
  const [sendChannels, setSendChannels] = useState<Array<(typeof communicationChannels)[number]>>(['in_app', 'email', 'push']);
  const [isSending, setIsSending] = useState(false);
  const queuePageSize = 8;

  const loadData = async (pageNumber = queuePage) => {
    const queueOffset = (pageNumber - 1) * queuePageSize;
    const [nextConfig, nextTemplates, nextQueueRows, nextRetryRows] = await Promise.all([
      listCommunicationConfig(),
      listCommunicationTemplates(),
      listNotificationQueue(queuePageSize + 1, queueOffset),
      listNotificationRetryHistory(8),
    ]);

    setConfig(nextConfig);
    setTemplates(nextTemplates);
    setQueueRows(nextQueueRows.slice(0, queuePageSize));
    setHasMoreQueuePages(nextQueueRows.length > queuePageSize);
    setRetryRows(nextRetryRows);
  };

  useEffect(() => {
    void loadData()
      .then(() => setStatusMessage('Notification center backed by Supabase templates, queue, and retry history.'))
      .catch(() => setStatusMessage('Notification center loaded from local defaults until Supabase data is available.'));
  }, [queuePage]);

  useEffect(() => {
    void listUsers()
      .then((nextUsers) => setUsers(nextUsers))
      .catch(() => setUsers([]));
  }, []);

  const activeChannels = useMemo(
    () => communicationChannels.filter((channel) => config?.templates ? Object.values(config.templates).some((template) => template.channels.includes(channel)) : true),
    [config],
  );

  const queueMetrics = useMemo(() => {
    const counts = queueRows.reduce(
      (accumulator, row) => {
        accumulator.total += 1;
        if (row.status === 'queued') accumulator.queued += 1;
        if (row.status === 'processing') accumulator.processing += 1;
        if (row.status === 'failed') accumulator.failed += 1;
        if (row.status === 'retry') accumulator.retrying += 1;
        if (row.status === 'sent') accumulator.sent += 1;
        if (row.status === 'cancelled') accumulator.cancelled += 1;
        return accumulator;
      },
      { total: 0, queued: 0, processing: 0, failed: 0, retrying: 0, sent: 0, cancelled: 0 },
    );

    return counts;
  }, [queueRows]);

  const complianceObservability = useMemo(() => {
    const complianceRows = queueRows.filter((row) => isComplianceQueueItem(row));

    const statusCounts = complianceRows.reduce(
      (accumulator, row) => {
        accumulator.total += 1;
        if (row.status === 'queued') accumulator.queued += 1;
        if (row.status === 'processing') accumulator.processing += 1;
        if (row.status === 'failed') accumulator.failed += 1;
        if (row.status === 'retry') accumulator.retry += 1;
        if (row.status === 'sent') accumulator.sent += 1;
        return accumulator;
      },
      { total: 0, queued: 0, processing: 0, failed: 0, retry: 0, sent: 0 },
    );

    const channelCounts = communicationChannels.map((channel) => ({
      channel,
      total: complianceRows.filter((row) => row.channel === channel).length,
      failed: complianceRows.filter((row) => row.channel === channel && row.status === 'failed').length,
      retry: complianceRows.filter((row) => row.channel === channel && row.status === 'retry').length,
      sent: complianceRows.filter((row) => row.channel === channel && row.status === 'sent').length,
    }));

    const eventCounts = complianceRows.reduce<Record<string, number>>((accumulator, row) => {
      const metadata = row.metadata;
      const eventKey =
        metadata && typeof metadata.complianceEvent === 'string'
          ? metadata.complianceEvent
          : row.template_key ?? 'unknown';

      accumulator[eventKey] = (accumulator[eventKey] ?? 0) + 1;
      return accumulator;
    }, {});

    const topEvents = Object.entries(eventCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);

    return {
      ...statusCounts,
      channelCounts,
      topEvents,
    };
  }, [queueRows]);

  const filteredQueueRows = useMemo(() => {
    const search = queueSearch.trim().toLowerCase();

    return queueRows.filter((row) => {
      const matchesStatus = queueStatus === 'all' || row.status === queueStatus;
      const matchesSearch =
        !search ||
        row.title.toLowerCase().includes(search) ||
        row.message.toLowerCase().includes(search) ||
        row.id.toLowerCase().includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [queueRows, queueSearch, queueStatus]);

  const currentQueuePage = queuePage;
  const pagedQueueRows = filteredQueueRows;

  const recipientIds = useMemo(() => {
    if (recipientMode === 'all') {
      return users.map((user) => user.id);
    }

    return selectedRecipients;
  }, [recipientMode, selectedRecipients, users]);

  const sendCtaLabel = useMemo(() => {
    if (sendMode === 'announcement') return 'Publish announcement';
    if (sendMode === 'promotional') return 'Send promotional notification';
    return 'Send internal message';
  }, [sendMode]);

  const handleProcessQueue = async () => {
    setIsProcessingQueue(true);
    setStatusMessage('Processing due notifications...');

    try {
      const processedCount = await processNotificationQueue(25);
      await loadData();
      setStatusMessage(`Processed ${processedCount} queued notifications.`);
    } catch {
      setStatusMessage('Unable to process the notification queue right now.');
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const handleRetryQueueItem = async (queueId: string) => {
    setRetryingQueueId(queueId);
    setStatusMessage('Retrying notification...');

    try {
      await retryNotificationQueueItem(queueId);
      await processNotificationQueue(1);
      await loadData();
      setStatusMessage('Notification retry queued and processed when due.');
    } catch {
      setStatusMessage('Unable to retry the selected notification.');
    } finally {
      setRetryingQueueId(null);
    }
  };

  const handleCancelQueueItem = async (queueId: string) => {
    setStatusMessage('Cancelling notification...');

    try {
      await cancelNotificationQueueItem(queueId);
      await loadData();
      setSelectedQueueRow((current) => (current?.id === queueId ? null : current));
      setStatusMessage('Notification cancelled.');
    } catch {
      setStatusMessage('Unable to cancel the selected notification.');
    }
  };

  const handleSendNotification = async () => {
    if (!sendTitle.trim() || !sendBody.trim()) {
      setStatusMessage('Add a title and body before sending.');
      return;
    }

    if (!recipientIds.length) {
      setStatusMessage('Choose at least one recipient.');
      return;
    }

    if (sendMode === 'announcement' && !config?.liveAnnouncementsEnabled) {
      setStatusMessage('Live announcements are currently disabled.');
      return;
    }

    if (sendMode === 'promotional' && !config?.promotionalEnabled) {
      setStatusMessage('Promotional notifications are currently disabled.');
      return;
    }

    setIsSending(true);
    setStatusMessage('Sending notifications...');

    try {
      if (sendMode === 'announcement') {
        const sentCount = await publishLiveAnnouncement({
          recipientIds,
          title: sendTitle,
          body: sendBody,
        });
        setStatusMessage(`Live announcement sent to ${sentCount} recipients.`);
      } else if (sendMode === 'promotional') {
        const sentCount = await sendPromotionalNotification({
          recipientIds,
          title: sendTitle,
          body: sendBody,
          channels: sendChannels,
        });
        setStatusMessage(`Promotional notifications queued: ${sentCount}.`);
      } else {
        const sentCount = await sendInternalMessage({
          recipientIds,
          title: sendTitle,
          body: sendBody,
          templateKey: 'internal_message',
        });
        setStatusMessage(`Internal message sent to ${sentCount} recipients.`);
      }

      await loadData();
    } catch {
      setStatusMessage('Unable to send notification right now.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="page-transition space-y-6 p-6">
      <Card className="relative overflow-hidden border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--chart-1)/0.16),transparent_34%),linear-gradient(135deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,hsl(var(--color-foreground)/0.03),transparent)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-accent/70">Omnichannel alerts</p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">Notification center</h1>
            <p className="text-base text-muted">
              Manage email, SMS, push, in-app, WhatsApp, Telegram, templates, variables, queueing, and retry handling from one backend-linked control surface.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[30rem] xl:grid-cols-4">
            {config ? (
              <>
                <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Channels</p><p className="mt-2 text-3xl font-bold text-foreground">{communicationChannels.length}</p></Card>
                <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Templates</p><p className="mt-2 text-3xl font-bold text-foreground">{templates.length}</p></Card>
                <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Queued</p><p className="mt-2 text-3xl font-bold text-foreground">{queueRows.filter((row) => row.status === 'queued').length}</p></Card>
                <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Retries</p><p className="mt-2 text-3xl font-bold text-foreground">{retryRows.length}</p></Card>
              </>
            ) : (
              <>
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Queue total</p><p className="mt-2 text-3xl font-bold text-foreground">{queueMetrics.total}</p></Card>
        <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Queued</p><p className="mt-2 text-3xl font-bold text-foreground">{queueMetrics.queued}</p></Card>
        <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Processing</p><p className="mt-2 text-3xl font-bold text-foreground">{queueMetrics.processing}</p></Card>
        <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Failed</p><p className="mt-2 text-3xl font-bold text-foreground">{queueMetrics.failed}</p></Card>
        <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Retrying</p><p className="mt-2 text-3xl font-bold text-foreground">{queueMetrics.retrying}</p></Card>
        <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Cancelled</p><p className="mt-2 text-3xl font-bold text-foreground">{queueMetrics.cancelled}</p></Card>
      </div>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Compliance delivery observability</p>
        <h2 className="text-2xl font-semibold text-foreground">Compliance lifecycle notifications</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Card className="border border-border bg-surface p-4"><p className="text-sm text-muted">Total</p><p className="mt-2 text-2xl font-bold text-foreground">{complianceObservability.total}</p></Card>
          <Card className="border border-border bg-surface p-4"><p className="text-sm text-muted">Queued</p><p className="mt-2 text-2xl font-bold text-foreground">{complianceObservability.queued}</p></Card>
          <Card className="border border-border bg-surface p-4"><p className="text-sm text-muted">Processing</p><p className="mt-2 text-2xl font-bold text-foreground">{complianceObservability.processing}</p></Card>
          <Card className="border border-border bg-surface p-4"><p className="text-sm text-muted">Failed</p><p className="mt-2 text-2xl font-bold text-foreground">{complianceObservability.failed}</p></Card>
          <Card className="border border-border bg-surface p-4"><p className="text-sm text-muted">Retry</p><p className="mt-2 text-2xl font-bold text-foreground">{complianceObservability.retry}</p></Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-elevated text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Channel</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Total</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Sent</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Failed</th>
                </tr>
              </thead>
              <tbody>
                {complianceObservability.channelCounts.map((entry) => (
                  <tr key={entry.channel} className="border-t border-border">
                    <td className="px-4 py-3 text-foreground">{channelLabels[entry.channel]}</td>
                    <td className="px-4 py-3 text-muted">{entry.total}</td>
                    <td className="px-4 py-3 text-muted">{entry.sent}</td>
                    <td className="px-4 py-3 text-muted">{entry.failed + entry.retry}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-elevated text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Lifecycle event</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Count</th>
                </tr>
              </thead>
              <tbody>
                {complianceObservability.topEvents.map(([eventKey, count]) => (
                  <tr key={eventKey} className="border-t border-border">
                    <td className="px-4 py-3 text-muted">{eventKey}</td>
                    <td className="px-4 py-3 text-foreground">{count}</td>
                  </tr>
                ))}
                {!complianceObservability.topEvents.length ? (
                  <tr>
                    <td className="px-4 py-6 text-muted" colSpan={2}>No compliance lifecycle notifications recorded in this queue slice.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <p className="rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-muted">{statusMessage}</p>

      <Card className="space-y-5 border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Phase 1 unified composer</p>
        <h2 className="text-2xl font-semibold text-foreground">Create and send notifications from this surface</h2>
        <p className="text-sm text-muted">
          This phase unifies message composition and send actions here. Delivery writes to backend notification records per selected channel.
        </p>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Notification type</span>
              <select
                className="input-base"
                value={sendMode}
                onChange={(event) => setSendMode(event.target.value as 'internal' | 'announcement' | 'promotional')}
              >
                <option value="internal">Internal message</option>
                <option value="announcement">Live announcement</option>
                <option value="promotional">Promotional notification</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Title</span>
              <input
                className="input-base"
                value={sendTitle}
                onChange={(event) => setSendTitle(event.target.value)}
                placeholder="Notification title"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Message</span>
              <textarea
                className="input-base min-h-24"
                value={sendBody}
                onChange={(event) => setSendBody(event.target.value)}
                placeholder="Notification body"
              />
            </label>

            {sendMode === 'promotional' ? (
              <div className="grid gap-2 md:grid-cols-2">
                {communicationChannels.map((channel) => (
                  <label key={channel} className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={sendChannels.includes(channel)}
                      onChange={(event) => {
                        setSendChannels((current) => {
                          if (event.target.checked) {
                            return Array.from(new Set([...current, channel]));
                          }

                          const next = current.filter((entry) => entry !== channel);
                          return next.length ? next : ['in_app'];
                        });
                      }}
                    />
                    {channelLabels[channel]}
                  </label>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-elevated disabled:opacity-50"
              onClick={() => void handleSendNotification()}
              disabled={isSending}
            >
              {isSending ? 'Sending...' : sendCtaLabel}
            </button>
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Audience</p>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground">
              <input type="radio" checked={recipientMode === 'all'} onChange={() => setRecipientMode('all')} />
              All users ({users.length})
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground">
              <input type="radio" checked={recipientMode === 'selected'} onChange={() => setRecipientMode('selected')} />
              Selected users
            </label>

            <div className="grid max-h-56 gap-2 overflow-auto rounded-xl border border-border bg-surface-elevated p-3">
              {users.length ? users.map((user) => (
                <label key={user.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    disabled={recipientMode === 'all'}
                    checked={selectedRecipients.includes(user.id)}
                    onChange={(event) => {
                      setSelectedRecipients((current) =>
                        event.target.checked ? [...current, user.id] : current.filter((entry) => entry !== user.id),
                      );
                    }}
                  />
                  <span>{user.fullName ?? user.email ?? user.id}</span>
                </label>
              )) : <p className="text-sm text-muted">No users available.</p>}
            </div>

            <p className="text-sm text-muted">
              Current recipient count: {recipientIds.length}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="space-y-4 border border-border bg-surface-elevated">
          <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Channels</p>
          <h2 className="text-2xl font-semibold text-foreground">Delivery matrix</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {communicationChannels.map((channel) => (
              <div key={channel} className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Channel</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{channelLabels[channel]}</p>
                <p className="mt-1 text-sm text-muted">{config ? activeChannels.includes(channel) ? 'Enabled in at least one template' : 'Available for template assignment' : 'Loading channel data...'}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4 border border-border bg-surface-elevated">
          <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Variables</p>
          <h2 className="text-2xl font-semibold text-foreground">Template tokens</h2>
          <div className="space-y-3">
            {variableGroups.map((group) => (
              <div key={group.label} className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-sm font-medium text-foreground">{group.label}</p>
                <p className="mt-2 text-sm text-muted">{group.values.join(' · ')}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4 border border-border bg-surface-elevated">
          <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Templates</p>
          <h2 className="text-2xl font-semibold text-foreground">Live Supabase templates</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-elevated text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Template</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Channels</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Status</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.key} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{template.name}</p>
                      <p className="mt-1 text-xs text-muted">{template.description}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{template.channels.map((channel) => channelLabels[channel as keyof typeof channelLabels] ?? channel).join(', ')}</td>
                    <td className="px-4 py-3 text-muted">{template.enabled ? 'Enabled' : 'Disabled'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="space-y-4 border border-border bg-surface-elevated">
          <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Queue system</p>
          <h2 className="text-2xl font-semibold text-foreground">Pending deliveries</h2>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search queued notifications</span>
              <input
                value={queueSearch}
                onChange={(event) => {
                  setQueueSearch(event.target.value);
                  setQueuePage(1);
                }}
                placeholder="Search title, message, or queue ID"
                className="input-base w-full bg-surface"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'queued', 'processing', 'failed', 'retry', 'sent', 'cancelled'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setQueueStatus(option);
                    setQueuePage(1);
                  }}
                  className={option === queueStatus ? 'rounded-full bg-ember px-4 py-2 text-sm font-medium text-ink' : 'rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground'}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-elevated disabled:opacity-50"
              onClick={() => void handleProcessQueue()}
              disabled={isProcessingQueue}
            >
              {isProcessingQueue ? 'Processing...' : 'Process due notifications'}
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-elevated text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Title</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Channel</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Status</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">When</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedQueueRows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.title}</p>
                      <p className="mt-1 text-xs text-muted">{row.message}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{channelLabels[row.channel as keyof typeof channelLabels] ?? row.channel}</td>
                    <td className="px-4 py-3 text-muted">{row.status}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(row.scheduled_for ?? row.sent_at ?? row.created_at)}</td>
                    <td className="px-4 py-3 text-muted">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-elevated"
                          onClick={() => setSelectedQueueRow(row)}
                        >
                          Inspect
                        </button>
                        {row.status === 'failed' || row.status === 'retry' ? (
                          <button
                            type="button"
                            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-elevated disabled:opacity-50"
                            onClick={() => void handleRetryQueueItem(row.id)}
                            disabled={retryingQueueId === row.id}
                          >
                            {retryingQueueId === row.id ? 'Retrying...' : 'Retry'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!pagedQueueRows.length ? (
                  <tr>
                    <td className="px-4 py-6 text-muted" colSpan={5}>No queued notifications yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            <p>
              Showing {pagedQueueRows.length} queue items on page {currentQueuePage}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQueuePage((current) => Math.max(1, current - 1))}
                disabled={currentQueuePage <= 1}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-foreground disabled:opacity-40"
              >
                Prev
              </button>
              <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-foreground">
                Page {currentQueuePage}
              </span>
              <button
                type="button"
                onClick={() => setQueuePage((current) => current + 1)}
                disabled={!hasMoreQueuePages}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-foreground disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </Card>

        {selectedQueueRow ? (
          <Card className="space-y-4 border border-border bg-surface-elevated">
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Selected queue item</p>
            <h2 className="text-2xl font-semibold text-foreground">{selectedQueueRow.title}</h2>
            <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
              <p><span className="text-foreground">Status:</span> {selectedQueueRow.status}</p>
              <p><span className="text-foreground">Channel:</span> {channelLabels[selectedQueueRow.channel as keyof typeof channelLabels] ?? selectedQueueRow.channel}</p>
              <p><span className="text-foreground">Category:</span> {selectedQueueRow.category}</p>
              <p><span className="text-foreground">Scheduled:</span> {formatDate(selectedQueueRow.scheduled_for)}</p>
              <p><span className="text-foreground">Retries:</span> {selectedQueueRow.retry_count} / {selectedQueueRow.max_retries}</p>
              <p><span className="text-foreground">Last error:</span> {selectedQueueRow.last_error ?? 'None'}</p>
              <div>
                <p className="text-foreground">Message</p>
                <p className="mt-1 whitespace-pre-wrap">{selectedQueueRow.message}</p>
              </div>
              <div>
                <p className="text-foreground">Metadata</p>
                <pre className="mt-1 overflow-auto rounded-xl bg-background p-3 text-xs text-muted">{JSON.stringify(selectedQueueRow.metadata ?? {}, null, 2)}</pre>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {(selectedQueueRow.status === 'failed' || selectedQueueRow.status === 'retry') ? (
                <button
                  type="button"
                  className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-elevated disabled:opacity-50"
                  onClick={() => void handleRetryQueueItem(selectedQueueRow.id)}
                  disabled={retryingQueueId === selectedQueueRow.id}
                >
                  {retryingQueueId === selectedQueueRow.id ? 'Retrying...' : 'Retry item'}
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-elevated"
                onClick={() => void handleCancelQueueItem(selectedQueueRow.id)}
              >
                Cancel item
              </button>
              <button
                type="button"
                className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-elevated"
                onClick={() => setSelectedQueueRow(null)}
              >
                Close
              </button>
            </div>
          </Card>
        ) : null}
      </div>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Retry system</p>
        <h2 className="text-2xl font-semibold text-foreground">Failed delivery attempts</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-elevated text-muted">
              <tr>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Queue ID</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Attempt</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Status</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Error</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">When</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {retryRows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3 text-muted">{row.queue_id}</td>
                  <td className="px-4 py-3 text-muted">{row.attempt_number}</td>
                  <td className="px-4 py-3 text-muted">{row.status}</td>
                  <td className="px-4 py-3 text-muted">{row.error_message ?? 'None'}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(row.attempted_at)}</td>
                  <td className="px-4 py-3 text-muted">{row.status === 'failed' ? 'Retry from queue' : 'Recorded'}</td>
                </tr>
              ))}
              {!retryRows.length ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={6}>No retry attempts recorded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}