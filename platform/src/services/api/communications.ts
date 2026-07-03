import { supabase } from '@/services/supabase/client';

export const communicationChannels = ['in_app', 'email', 'push', 'sms'] as const;

export type CommunicationChannel = (typeof communicationChannels)[number];

export const communicationTemplateKeys = [
  'internal_message',
  'email_verification',
  'password_reset',
  'reward_update',
  'live_announcement',
  'promotional_blast',
] as const;

export type CommunicationTemplateKey = (typeof communicationTemplateKeys)[number];

export const communicationCategories = ['internal', 'transactional', 'live_announcement', 'promotional'] as const;

export type CommunicationCategory = (typeof communicationCategories)[number];

export interface CommunicationTemplate {
  key: CommunicationTemplateKey;
  name: string;
  description: string;
  channels: CommunicationChannel[];
  subject: string;
  body: string;
  pushTitle: string;
  pushBody: string;
  smsBody: string;
  enabled: boolean;
}

export interface CommunicationConfig {
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  promotionalEnabled: boolean;
  liveAnnouncementsEnabled: boolean;
  templates: Record<CommunicationTemplateKey, CommunicationTemplate>;
}

type SettingRow = {
  key: string;
  value: unknown;
};

type NotificationInsert = {
  user_id: string;
  title: string;
  message: string;
  type: string;
  channel?: CommunicationChannel;
  category?: CommunicationCategory;
  template_key?: CommunicationTemplateKey;
  is_promotional?: boolean;
  metadata?: Record<string, unknown>;
};

const COMMUNICATION_SETTING_KEY = 'communication_config';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isChannelArray(value: unknown): value is CommunicationChannel[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && communicationChannels.includes(entry as CommunicationChannel));
}

function buildDefaultTemplate(key: CommunicationTemplateKey): CommunicationTemplate {
  if (key === 'internal_message') {
    return {
      key,
      name: 'Internal message',
      description: 'Direct in-app messages from admins to selected users.',
      channels: ['in_app'],
      subject: 'Message from support',
      body: 'Hello {{full_name}},\n\n{{message_body}}\n\nRegards,\n{{sender_name}}',
      pushTitle: 'New internal message',
      pushBody: 'You received a new message from the admin team.',
      smsBody: 'New internal message in your Campaign Reward inbox.',
      enabled: true,
    };
  }

  if (key === 'email_verification') {
    return {
      key,
      name: 'Email verification',
      description: 'Transactional verification email copy.',
      channels: ['email'],
      subject: 'Verify your account',
      body: 'Hi {{full_name}},\n\nPlease verify your email to activate your account: {{verification_link}}',
      pushTitle: 'Verify your account',
      pushBody: 'Finish account setup by verifying your email.',
      smsBody: 'Verify your account: {{verification_link}}',
      enabled: true,
    };
  }

  if (key === 'password_reset') {
    return {
      key,
      name: 'Password reset',
      description: 'Recovery message sent when password reset is requested.',
      channels: ['email', 'sms'],
      subject: 'Reset your password',
      body: 'Hi {{full_name}},\n\nUse this secure link to reset your password: {{reset_link}}',
      pushTitle: 'Password reset requested',
      pushBody: 'A password reset was requested for your account.',
      smsBody: 'Reset your password using this link: {{reset_link}}',
      enabled: true,
    };
  }

  if (key === 'reward_update') {
    return {
      key,
      name: 'Reward update',
      description: 'Notifications for reward approvals and wallet changes.',
      channels: ['in_app', 'email', 'push'],
      subject: 'Your reward was updated',
      body: 'Hi {{full_name}},\n\nYour reward status changed to {{reward_status}}. Amount: {{amount}}.',
      pushTitle: 'Reward update',
      pushBody: 'Your reward status changed to {{reward_status}}.',
      smsBody: 'Reward update: status {{reward_status}}, amount {{amount}}.',
      enabled: true,
    };
  }

  if (key === 'live_announcement') {
    return {
      key,
      name: 'Live announcement',
      description: 'Urgent or time-sensitive announcements shown live in-app.',
      channels: ['in_app', 'push'],
      subject: 'Live platform announcement',
      body: '{{announcement_title}}\n\n{{announcement_body}}',
      pushTitle: '{{announcement_title}}',
      pushBody: '{{announcement_body}}',
      smsBody: 'Announcement: {{announcement_title}}',
      enabled: true,
    };
  }

  return {
    key: 'promotional_blast',
    name: 'Promotional blast',
    description: 'Marketing promotions and campaign incentives.',
    channels: ['in_app', 'email', 'push', 'sms'],
    subject: 'New promotion is live',
    body: 'Hi {{full_name}},\n\n{{promo_headline}}\n\n{{promo_body}}\n\nClaim now: {{cta_link}}',
    pushTitle: '{{promo_headline}}',
    pushBody: '{{promo_body}}',
    smsBody: '{{promo_headline}} - {{cta_link}}',
    enabled: true,
  };
}

export function buildDefaultCommunicationConfig(): CommunicationConfig {
  return {
    timezone: 'UTC',
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    emailEnabled: true,
    pushEnabled: true,
    smsEnabled: false,
    promotionalEnabled: true,
    liveAnnouncementsEnabled: true,
    templates: Object.fromEntries(
      communicationTemplateKeys.map((key) => [key, buildDefaultTemplate(key)]),
    ) as Record<CommunicationTemplateKey, CommunicationTemplate>,
  };
}

function mergeTemplate(key: CommunicationTemplateKey, value: unknown): CommunicationTemplate {
  const fallback = buildDefaultTemplate(key);

  if (!isRecord(value)) {
    return fallback;
  }

  return {
    key,
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : fallback.name,
    description:
      typeof value.description === 'string' && value.description.trim() ? value.description.trim() : fallback.description,
    channels: isChannelArray(value.channels) && value.channels.length ? value.channels : fallback.channels,
    subject: typeof value.subject === 'string' && value.subject.trim() ? value.subject : fallback.subject,
    body: typeof value.body === 'string' && value.body.trim() ? value.body : fallback.body,
    pushTitle: typeof value.pushTitle === 'string' && value.pushTitle.trim() ? value.pushTitle : fallback.pushTitle,
    pushBody: typeof value.pushBody === 'string' && value.pushBody.trim() ? value.pushBody : fallback.pushBody,
    smsBody: typeof value.smsBody === 'string' && value.smsBody.trim() ? value.smsBody : fallback.smsBody,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled,
  };
}

function mergeCommunicationConfig(value: unknown): CommunicationConfig {
  const fallback = buildDefaultCommunicationConfig();

  if (!isRecord(value)) {
    return fallback;
  }

  return {
    timezone: typeof value.timezone === 'string' && value.timezone.trim() ? value.timezone : fallback.timezone,
    quietHoursStart:
      typeof value.quietHoursStart === 'string' && value.quietHoursStart.trim() ? value.quietHoursStart : fallback.quietHoursStart,
    quietHoursEnd:
      typeof value.quietHoursEnd === 'string' && value.quietHoursEnd.trim() ? value.quietHoursEnd : fallback.quietHoursEnd,
    emailEnabled: typeof value.emailEnabled === 'boolean' ? value.emailEnabled : fallback.emailEnabled,
    pushEnabled: typeof value.pushEnabled === 'boolean' ? value.pushEnabled : fallback.pushEnabled,
    smsEnabled: typeof value.smsEnabled === 'boolean' ? value.smsEnabled : fallback.smsEnabled,
    promotionalEnabled: typeof value.promotionalEnabled === 'boolean' ? value.promotionalEnabled : fallback.promotionalEnabled,
    liveAnnouncementsEnabled:
      typeof value.liveAnnouncementsEnabled === 'boolean'
        ? value.liveAnnouncementsEnabled
        : fallback.liveAnnouncementsEnabled,
    templates: Object.fromEntries(
      communicationTemplateKeys.map((key) => [key, mergeTemplate(key, value.templates?.[key])]),
    ) as Record<CommunicationTemplateKey, CommunicationTemplate>,
  };
}

export async function listCommunicationConfig(): Promise<CommunicationConfig> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key,value')
    .eq('key', COMMUNICATION_SETTING_KEY)
    .single();

  if (error || !data) {
    return buildDefaultCommunicationConfig();
  }

  return mergeCommunicationConfig((data as SettingRow).value);
}

export async function updateCommunicationConfig(config: CommunicationConfig): Promise<void> {
  const { error } = await supabase.from('platform_settings').upsert(
    {
      key: COMMUNICATION_SETTING_KEY,
      value: config,
      description: 'Communication system settings, templates, and channel controls',
    },
    { onConflict: 'key' },
  );

  if (error) throw error;
}

async function insertNotificationBatch(rows: NotificationInsert[]): Promise<number> {
  if (!rows.length) return 0;

  const { error } = await supabase.from('user_notifications').insert(rows);
  if (error) throw error;

  return rows.length;
}

export async function sendInternalMessage(input: {
  recipientIds: string[];
  title: string;
  body: string;
  templateKey?: CommunicationTemplateKey;
}): Promise<number> {
  const rows: NotificationInsert[] = input.recipientIds.map((userId) => ({
    user_id: userId,
    title: input.title,
    message: input.body,
    type: 'info',
    channel: 'in_app',
    category: 'internal',
    template_key: input.templateKey ?? 'internal_message',
    is_promotional: false,
    metadata: { source: 'internal_messaging' },
  }));

  return insertNotificationBatch(rows);
}

export async function publishLiveAnnouncement(input: {
  recipientIds: string[];
  title: string;
  body: string;
}): Promise<number> {
  const rows: NotificationInsert[] = input.recipientIds.map((userId) => ({
    user_id: userId,
    title: input.title,
    message: input.body,
    type: 'warning',
    channel: 'in_app',
    category: 'live_announcement',
    template_key: 'live_announcement',
    is_promotional: false,
    metadata: { source: 'live_announcements' },
  }));

  return insertNotificationBatch(rows);
}

export async function sendPromotionalNotification(input: {
  recipientIds: string[];
  title: string;
  body: string;
  channels: CommunicationChannel[];
}): Promise<number> {
  const effectiveChannels = input.channels.length ? input.channels : ['in_app'];

  const rows: NotificationInsert[] = input.recipientIds.flatMap((userId) =>
    effectiveChannels.map((channel) => ({
      user_id: userId,
      title: input.title,
      message: input.body,
      type: 'success',
      channel,
      category: 'promotional',
      template_key: 'promotional_blast',
      is_promotional: true,
      metadata: { source: 'promotional_notifications', channel },
    })),
  );

  return insertNotificationBatch(rows);
}
