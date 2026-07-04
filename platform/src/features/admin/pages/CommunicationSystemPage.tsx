import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/DesignSystem';
import {
  buildDefaultCommunicationConfig,
  communicationChannels,
  communicationTemplateKeys,
  listCommunicationConfig,
  publishLiveAnnouncement,
  sendInternalMessage,
  sendPromotionalNotification,
  updateCommunicationConfig,
  type CommunicationChannel,
  type CommunicationConfig,
  type CommunicationTemplateKey,
} from '@/services/api/communications';
import { listUsers } from '@/services/api/auth';
import type { UserProfile } from '@/types/auth';

const templateLabels: Record<CommunicationTemplateKey, string> = {
  internal_message: 'Internal message',
  email_verification: 'Email verification',
  password_reset: 'Password reset',
  reward_update: 'Reward update',
  live_announcement: 'Live announcement',
  promotional_blast: 'Promotional blast',
};

const channelLabels: Record<CommunicationChannel, string> = {
  in_app: 'In-app',
  email: 'Email',
  push: 'Push',
  sms: 'SMS',
};

export function CommunicationSystemPage(): JSX.Element {
  const [config, setConfig] = useState<CommunicationConfig>(buildDefaultCommunicationConfig());
  const [selectedTemplate, setSelectedTemplate] = useState<CommunicationTemplateKey>('internal_message');
  const [statusMessage, setStatusMessage] = useState('Loading communication system...');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [recipientMode, setRecipientMode] = useState<'all' | 'selected'>('all');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);

  const [internalTitle, setInternalTitle] = useState('Important account update');
  const [internalBody, setInternalBody] = useState('Your account settings were reviewed. Visit profile to confirm details.');

  const [announcementTitle, setAnnouncementTitle] = useState('Maintenance starts in 15 minutes');
  const [announcementBody, setAnnouncementBody] = useState('Deposits and withdrawals will pause for a short release window.');

  const [promoTitle, setPromoTitle] = useState('Weekend bonus campaign is live');
  const [promoBody, setPromoBody] = useState('Complete two tasks today and receive a 20% wallet bonus.');
  const [promoChannels, setPromoChannels] = useState<CommunicationChannel[]>(['in_app', 'email', 'push']);
  const lastSavedConfig = useRef('');

  useEffect(() => {
    void Promise.all([listCommunicationConfig(), listUsers()])
      .then(([nextConfig, nextUsers]) => {
        setConfig(nextConfig);
        setUsers(nextUsers);
        lastSavedConfig.current = JSON.stringify(nextConfig);
        setIsLoading(false);
        setStatusMessage('Communication system loaded. Templates are editable.');
      })
      .catch(() => {
        setIsLoading(false);
        setStatusMessage('Using local defaults until communication settings are available.');
      });
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const snapshot = JSON.stringify(config);
    if (snapshot === lastSavedConfig.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setStatusMessage('Auto-saving communication settings...');
      void updateCommunicationConfig(config)
        .then(() => {
          lastSavedConfig.current = snapshot;
          setStatusMessage('Communication settings auto-saved.');
        })
        .catch(() => setStatusMessage('Unable to auto-save communication settings right now.'));
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [config, isLoading]);

  const recipientIds = useMemo(() => {
    if (recipientMode === 'all') {
      return users.map((user) => user.id);
    }

    return selectedRecipients;
  }, [recipientMode, selectedRecipients, users]);

  const selectedTemplateConfig = config.templates[selectedTemplate];
  const sendValidation = useMemo(
    () => ({
      internal: !internalTitle.trim() || !internalBody.trim() ? 'Add a title and body before sending.' : null,
      announcement: !announcementTitle.trim() || !announcementBody.trim() ? 'Add a title and body before publishing.' : null,
      promotional: !promoTitle.trim() || !promoBody.trim() ? 'Add a title and body before queueing.' : null,
    }),
    [announcementBody, announcementTitle, internalBody, internalTitle, promoBody, promoTitle],
  );

  const updateTemplate = (templateKey: CommunicationTemplateKey, patch: Partial<CommunicationConfig['templates'][CommunicationTemplateKey]>) => {
    setConfig((current) => ({
      ...current,
      templates: {
        ...current.templates,
        [templateKey]: {
          ...current.templates[templateKey],
          ...patch,
        },
      },
    }));
  };

  const toggleTemplateChannel = (templateKey: CommunicationTemplateKey, channel: CommunicationChannel, checked: boolean) => {
    const currentChannels = config.templates[templateKey].channels;
    const nextChannels = checked ? Array.from(new Set([...currentChannels, channel])) : currentChannels.filter((entry) => entry !== channel);
    updateTemplate(templateKey, { channels: nextChannels.length ? nextChannels : ['in_app'] });
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      await updateCommunicationConfig(config);
      setStatusMessage('Communication settings and templates saved.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendInternal = async () => {
    if (sendValidation.internal) {
      setStatusMessage(sendValidation.internal);
      return;
    }

    if (!recipientIds.length) {
      setStatusMessage('Choose at least one recipient.');
      return;
    }

    const sentCount = await sendInternalMessage({
      recipientIds,
      title: internalTitle,
      body: internalBody,
      templateKey: 'internal_message',
    });

    setStatusMessage(`Internal message sent to ${sentCount} recipients.`);
  };

  const handleSendAnnouncement = async () => {
    if (sendValidation.announcement) {
      setStatusMessage(sendValidation.announcement);
      return;
    }

    if (!config.liveAnnouncementsEnabled) {
      setStatusMessage('Live announcements are currently disabled.');
      return;
    }

    if (!recipientIds.length) {
      setStatusMessage('Choose at least one recipient.');
      return;
    }

    const sentCount = await publishLiveAnnouncement({
      recipientIds,
      title: announcementTitle,
      body: announcementBody,
    });

    setStatusMessage(`Live announcement sent to ${sentCount} recipients.`);
  };

  const handleSendPromotional = async () => {
    if (sendValidation.promotional) {
      setStatusMessage(sendValidation.promotional);
      return;
    }

    if (!config.promotionalEnabled) {
      setStatusMessage('Promotional notifications are disabled.');
      return;
    }

    if (!recipientIds.length) {
      setStatusMessage('Choose at least one recipient.');
      return;
    }

    const sentCount = await sendPromotionalNotification({
      recipientIds,
      title: promoTitle,
      body: promoBody,
      channels: promoChannels,
    });

    setStatusMessage(`Promotional notifications queued: ${sentCount}.`);
  };

  return (
    <div className="page-transition space-y-6 p-6">
      {isLoading ? (
        <>
          <Card className="space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-3/5" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </Card>
          <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
            <Skeleton className="h-[42rem]" />
            <Skeleton className="h-[42rem]" />
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <Skeleton className="h-[18rem]" />
            <Skeleton className="h-[18rem]" />
            <Skeleton className="h-[18rem]" />
          </div>
        </>
      ) : null}
      <Card className="relative overflow-hidden border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--color-success)/0.16),transparent_34%),linear-gradient(135deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,hsl(var(--color-foreground)/0.03),transparent)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-success/80">Phase 9 communication system</p>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">Messaging, announcements, and omnichannel notifications</h1>
            <p className="text-base text-muted">
              Run internal messaging, transactional email notifications, push delivery, optional SMS, live announcements, and promotional campaigns.
              Every template is editable from this admin console.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[30rem] xl:grid-cols-3">
            <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Templates</p><p className="mt-2 text-3xl font-bold text-foreground">{communicationTemplateKeys.length}</p></Card>
            <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Email</p><p className="mt-2 text-3xl font-bold text-foreground">{config.emailEnabled ? 'On' : 'Off'}</p></Card>
            <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Push</p><p className="mt-2 text-3xl font-bold text-foreground">{config.pushEnabled ? 'On' : 'Off'}</p></Card>
            <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">SMS</p><p className="mt-2 text-3xl font-bold text-foreground">{config.smsEnabled ? 'On' : 'Optional'}</p></Card>
            <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Live announcements</p><p className="mt-2 text-3xl font-bold text-foreground">{config.liveAnnouncementsEnabled ? 'On' : 'Off'}</p></Card>
            <Card className="border border-border bg-surface-elevated p-4"><p className="text-sm text-muted">Promotional</p><p className="mt-2 text-3xl font-bold text-foreground">{config.promotionalEnabled ? 'On' : 'Off'}</p></Card>
          </div>
        </div>
      </Card>

      {statusMessage ? <p className="rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-muted">{statusMessage}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
        <Card className="interactive-card">
          <p className="text-sm uppercase tracking-[0.24em] text-success/70">Channel controls</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Global communication policy</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm text-muted">Timezone</span>
              <input className="input-base" value={config.timezone} onChange={(event) => setConfig((current) => ({ ...current, timezone: event.target.value }))} />
              <p className="form-hint">Use an IANA timezone such as UTC or Africa/Lagos.</p>
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-muted">Quiet hours start</span>
              <input className="input-base" type="time" value={config.quietHoursStart} onChange={(event) => setConfig((current) => ({ ...current, quietHoursStart: event.target.value }))} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-muted">Quiet hours end</span>
              <input className="input-base" type="time" value={config.quietHoursEnd} onChange={(event) => setConfig((current) => ({ ...current, quietHoursEnd: event.target.value }))} />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground">
              <input type="checkbox" checked={config.emailEnabled} onChange={(event) => setConfig((current) => ({ ...current, emailEnabled: event.target.checked }))} />
              Enable email notifications
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground">
              <input type="checkbox" checked={config.pushEnabled} onChange={(event) => setConfig((current) => ({ ...current, pushEnabled: event.target.checked }))} />
              Enable push notifications
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground">
              <input type="checkbox" checked={config.smsEnabled} onChange={(event) => setConfig((current) => ({ ...current, smsEnabled: event.target.checked }))} />
              Enable SMS channel (optional)
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground md:col-span-2">
              <input
                type="checkbox"
                checked={config.liveAnnouncementsEnabled}
                onChange={(event) => setConfig((current) => ({ ...current, liveAnnouncementsEnabled: event.target.checked }))}
              />
              Enable live announcements
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground md:col-span-2">
              <input
                type="checkbox"
                checked={config.promotionalEnabled}
                onChange={(event) => setConfig((current) => ({ ...current, promotionalEnabled: event.target.checked }))}
              />
              Enable promotional notifications
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => void handleSaveConfig()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save communication settings'}
            </Button>
            <Button variant="ghost" onClick={() => setConfig(buildDefaultCommunicationConfig())}>
              Reset defaults
            </Button>
          </div>
        </Card>

        <Card className="interactive-card">
          <p className="text-sm uppercase tracking-[0.24em] text-success/70">Template studio</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Editable notification templates</h2>

          <div className="mt-4 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm text-muted">Template</span>
              <select className="input-base" value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value as CommunicationTemplateKey)}>
                {communicationTemplateKeys.map((key) => (
                  <option key={key} value={key}>
                    {templateLabels[key]}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-muted">Template name</span>
              <input className="input-base" value={selectedTemplateConfig.name} onChange={(event) => updateTemplate(selectedTemplate, { name: event.target.value })} />
              <p className="form-hint">This label is shown to admins only.</p>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-muted">Description</span>
              <input className="input-base" value={selectedTemplateConfig.description} onChange={(event) => updateTemplate(selectedTemplate, { description: event.target.value })} />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-muted">Subject</span>
              <input className="input-base" value={selectedTemplateConfig.subject} onChange={(event) => updateTemplate(selectedTemplate, { subject: event.target.value })} />
              <p className="form-hint">Keep it short so transactional notifications stay readable.</p>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-muted">Email / in-app body</span>
              <textarea className="input-base min-h-24" value={selectedTemplateConfig.body} onChange={(event) => updateTemplate(selectedTemplate, { body: event.target.value })} />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-muted">Push title</span>
              <input className="input-base" value={selectedTemplateConfig.pushTitle} onChange={(event) => updateTemplate(selectedTemplate, { pushTitle: event.target.value })} />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-muted">Push body</span>
              <input className="input-base" value={selectedTemplateConfig.pushBody} onChange={(event) => updateTemplate(selectedTemplate, { pushBody: event.target.value })} />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-muted">SMS body</span>
              <input className="input-base" value={selectedTemplateConfig.smsBody} onChange={(event) => updateTemplate(selectedTemplate, { smsBody: event.target.value })} />
            </label>

            <div className="grid gap-2 md:grid-cols-2">
              {communicationChannels.map((channel) => (
                <label key={channel} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={selectedTemplateConfig.channels.includes(channel)}
                    onChange={(event) => toggleTemplateChannel(selectedTemplate, channel, event.target.checked)}
                  />
                  {channelLabels[channel]}
                </label>
              ))}
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground">
              <input type="checkbox" checked={selectedTemplateConfig.enabled} onChange={(event) => updateTemplate(selectedTemplate, { enabled: event.target.checked })} />
              Template enabled
            </label>
          </div>
        </Card>
      </div>

      <Card>
        <p className="text-sm uppercase tracking-[0.24em] text-success/70">Audience</p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">Recipient targeting</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.45fr_0.55fr]">
          <div className="space-y-3">
            <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground">
              <input type="radio" checked={recipientMode === 'all'} onChange={() => setRecipientMode('all')} />
              All users ({users.length})
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground">
              <input type="radio" checked={recipientMode === 'selected'} onChange={() => setRecipientMode('selected')} />
              Selected users
            </label>
          </div>

          <div className="grid max-h-56 gap-2 overflow-auto rounded-xl border border-border bg-surface p-3">
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
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="interactive-card">
            <p className="text-sm uppercase tracking-[0.24em] text-success/70">Internal messaging</p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">Direct admin message</h3>
          <div className="mt-4 grid gap-3">
            <input className="input-base" value={internalTitle} onChange={(event) => setInternalTitle(event.target.value)} placeholder="Message title" />
            <textarea className="input-base min-h-24" value={internalBody} onChange={(event) => setInternalBody(event.target.value)} placeholder="Message body" />
            <p className="form-hint">Messages can target all users or a manual recipient set above.</p>
            {sendValidation.internal ? <p className="form-error">{sendValidation.internal}</p> : null}
            <Button onClick={() => void handleSendInternal()}>Send internal message</Button>
          </div>
        </Card>

        <Card className="interactive-card">
            <p className="text-sm uppercase tracking-[0.24em] text-success/70">Live announcements</p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">Broadcast now</h3>
          <div className="mt-4 grid gap-3">
            <input className="input-base" value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="Announcement title" />
            <textarea className="input-base min-h-24" value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} placeholder="Announcement body" />
            <p className="form-hint">Announcements respect quiet hours and the live-announcement toggle.</p>
            {sendValidation.announcement ? <p className="form-error">{sendValidation.announcement}</p> : null}
            <Button onClick={() => void handleSendAnnouncement()}>Publish announcement</Button>
          </div>
        </Card>

        <Card className="interactive-card">
            <p className="text-sm uppercase tracking-[0.24em] text-success/70">Promotional notifications</p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">Offer and campaigns</h3>
          <div className="mt-4 grid gap-3">
            <input className="input-base" value={promoTitle} onChange={(event) => setPromoTitle(event.target.value)} placeholder="Promotion title" />
            <textarea className="input-base min-h-24" value={promoBody} onChange={(event) => setPromoBody(event.target.value)} placeholder="Promotion body" />
            <div className="grid gap-2 md:grid-cols-2">
              {communicationChannels.map((channel) => (
                  <label key={channel} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={promoChannels.includes(channel)}
                    onChange={(event) => {
                      setPromoChannels((current) => {
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
            <p className="form-hint">Promo sends use the selected channels and the shared audience above.</p>
            {sendValidation.promotional ? <p className="form-error">{sendValidation.promotional}</p> : null}
            <Button onClick={() => void handleSendPromotional()}>Send promotional notification</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
