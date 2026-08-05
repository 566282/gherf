import { supabase } from '@/services/supabase/client';

export type PromotionalSurface = 'home' | 'signup' | 'membership-plans';

export interface PromotionalWheelSegment {
  id: string;
  label: string;
  accentClass: string;
}

export interface PromotionalSpinSettings {
  enabled: boolean;
  rolloutStage: 'internal' | 'beta' | 'production';
  enabledStages: Array<'internal' | 'beta' | 'production'>;
  triggerSurfaces: PromotionalSurface[];
  cooldownMinutes: number;
  showOncePerGuest: boolean;
  showReopenButton: boolean;
  reopenLabel: string;
  spinCampaignKey: string;
  wheelSegmentLabels: string[];
}

export interface PromotionalSpinStartResult {
  ok: boolean;
  error?: string;
  attemptId?: string;
  outcomeId?: string;
  campaignId?: string;
  prizeId?: string | null;
  rewardAmount?: number;
  currency?: string;
  canReserve?: boolean;
  firstSpin?: boolean;
}

export interface PromotionalReservationResult {
  ok: boolean;
  error?: string;
  reservationId?: string;
  reservationToken?: string;
  amount?: number;
  currency?: string;
  expiresAt?: string;
}

export interface PromotionalRequirementStatus {
  key: 'registration_complete' | 'verification_complete' | 'qualifying_referrals' | 'membership_purchase' | 'not_expired';
  status: 'pending' | 'completed' | 'failed';
  required: number;
  completed: number;
}

export interface RewardVaultReservationStatus {
  reservationId: string;
  amount: number;
  currency: string;
  status: 'reserved' | 'pending_unlock' | 'released' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
  nextBlockingStep: PromotionalRequirementStatus['key'] | null;
  requirements: PromotionalRequirementStatus[];
}

export interface RewardVaultStatusResponse {
  ok: boolean;
  reservations: RewardVaultReservationStatus[];
}

export interface PromotionalEventItem {
  id: string;
  reservation_id: string | null;
  event_type: string;
  actor_user_id: string | null;
  event_payload: Record<string, unknown>;
  created_at: string;
}

export interface SpinCampaignAdminSettings {
  dailySpinLimit: number;
  requiredVerifiedReferrals: number;
  requiredMembershipOrders: number;
  reservationExpiryHours: number;
  guaranteedNonLosingFirstSpin: boolean;
  currency: string;
  eligibleCountries: string[];
  minimumAccountAgeHours: number;
}

export interface SpinCampaignAdminItem {
  id: string;
  campaignKey: string;
  title: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  startsAt: string | null;
  endsAt: string | null;
  settings: SpinCampaignAdminSettings;
  createdAt: string;
  updatedAt: string;
}

export interface SpinCampaignAdminInput {
  id?: string;
  campaignKey: string;
  title: string;
  status: SpinCampaignAdminItem['status'];
  startsAt: string | null;
  endsAt: string | null;
  settings: SpinCampaignAdminSettings;
}

export interface SpinPrizeInventoryItem {
  id: string;
  campaignId: string;
  prizeKey: string;
  label: string;
  rewardAmount: number;
  weight: number;
  stockRemaining: number | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SpinPrizeInventoryInput {
  id?: string;
  campaignId: string;
  prizeKey: string;
  label: string;
  rewardAmount: number;
  weight: number;
  stockRemaining: number | null;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface PromotionalRewardQueueItem {
  id: string;
  campaignId: string;
  userId: string | null;
  guestToken: string | null;
  amount: number;
  currency: string;
  status: RewardVaultReservationStatus['status'];
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

export interface PromotionalSpinAnalyticsSummary {
  rangeDays: number;
  attempts: number;
  wonOutcomes: number;
  winRate: number;
  reservationsCreated: number;
  signupBoundReservations: number;
  releasedRewards: number;
  pendingRewards: number;
  expiredRewards: number;
  revokedRewards: number;
  abuseSignals: number;
  unlockConversionRate: number;
  referralCompletionRate: number;
}

type SpinCampaignRow = {
  id: string;
  campaign_key: string;
  title: string;
  status: SpinCampaignAdminItem['status'];
  starts_at: string | null;
  ends_at: string | null;
  settings: unknown;
  created_at: string;
  updated_at: string;
};

type SpinPrizeInventoryRow = {
  id: string;
  campaign_id: string;
  prize_key: string;
  label: string;
  reward_amount: number | string;
  weight: number | string;
  stock_remaining: number | null;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type PromotionalRewardQueueRow = {
  id: string;
  campaign_id: string;
  user_id: string | null;
  guest_token: string | null;
  amount: number | string;
  currency: string;
  status: RewardVaultReservationStatus['status'];
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
};

type SettingRow = {
  value: unknown;
};

const SETTINGS_KEY = 'promotional_spin_settings';
const LOCAL_GUEST_KEY = 'promo_spin_guest_token';
const LOCAL_LAST_SHOWN_KEY = 'promo_spin_last_shown_at';
const LOCAL_DISMISSED_KEY = 'promo_spin_dismissed';
const LOCAL_RESERVATION_KEY = 'promo_spin_reservation_token';

const defaultSpinCampaignSettings: SpinCampaignAdminSettings = {
  dailySpinLimit: 1,
  requiredVerifiedReferrals: 2,
  requiredMembershipOrders: 1,
  reservationExpiryHours: 72,
  guaranteedNonLosingFirstSpin: false,
  currency: 'USD',
  eligibleCountries: [],
  minimumAccountAgeHours: 0,
};

export const promotionalWheelSegments: PromotionalWheelSegment[] = [
  { id: 's1', label: '$5', accentClass: 'bg-emerald-500/90' },
  { id: 's2', label: '$10', accentClass: 'bg-orange-500/90' },
  { id: 's3', label: '$15', accentClass: 'bg-cyan-500/90' },
  { id: 's4', label: '$20', accentClass: 'bg-rose-500/90' },
  { id: 's5', label: '$8', accentClass: 'bg-indigo-500/90' },
  { id: 's6', label: '$12', accentClass: 'bg-teal-500/90' },
  { id: 's7', label: '$18', accentClass: 'bg-fuchsia-500/90' },
  { id: 's8', label: '$25', accentClass: 'bg-amber-500/90' },
  { id: 's9', label: '$7', accentClass: 'bg-lime-500/90' },
  { id: 's10', label: '$9', accentClass: 'bg-sky-500/90' },
  { id: 's11', label: '$14', accentClass: 'bg-violet-500/90' },
  { id: 's12', label: '$30', accentClass: 'bg-red-500/90' },
];

export const defaultPromotionalSpinSettings: PromotionalSpinSettings = {
  enabled: false,
  rolloutStage: 'internal',
  enabledStages: ['internal'],
  triggerSurfaces: ['home', 'signup'],
  cooldownMinutes: 720,
  showOncePerGuest: true,
  showReopenButton: true,
  reopenLabel: 'Open reward wheel',
  spinCampaignKey: 'onboarding_spin_wheel',
  wheelSegmentLabels: promotionalWheelSegments.map((segment) => segment.label),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function toStage(value: unknown, fallback: PromotionalSpinSettings['rolloutStage']): PromotionalSpinSettings['rolloutStage'] {
  if (value === 'internal' || value === 'beta' || value === 'production') {
    return value;
  }
  return fallback;
}

function toStageList(value: unknown, fallback: PromotionalSpinSettings['enabledStages']): PromotionalSpinSettings['enabledStages'] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const filtered = value.filter((entry): entry is PromotionalSpinSettings['enabledStages'][number] => entry === 'internal' || entry === 'beta' || entry === 'production');
  return filtered.length ? filtered : fallback;
}

function toSurfaceList(value: unknown, fallback: PromotionalSurface[]): PromotionalSurface[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const filtered = value.filter((entry): entry is PromotionalSurface => entry === 'home' || entry === 'signup' || entry === 'membership-plans');
  return filtered.length ? filtered : fallback;
}

function toWheelSegmentLabels(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const labels = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
    .slice(0, promotionalWheelSegments.length);

  if (!labels.length) {
    return fallback;
  }

  while (labels.length < promotionalWheelSegments.length) {
    labels.push(fallback[labels.length] ?? promotionalWheelSegments[labels.length]?.label ?? `$${labels.length + 1}`);
  }

  return labels;
}

function normalizeSpinCampaignSettings(value: unknown): SpinCampaignAdminSettings {
  if (!isRecord(value)) {
    return defaultSpinCampaignSettings;
  }

  const eligibleCountriesRaw = Array.isArray(value.eligible_countries)
    ? value.eligible_countries
    : Array.isArray(value.eligibleCountries)
      ? value.eligibleCountries
      : [];

  const eligibleCountries = eligibleCountriesRaw
    .map((entry) => (typeof entry === 'string' ? entry.trim().toUpperCase() : ''))
    .filter(Boolean);

  return {
    dailySpinLimit: Math.max(1, Math.round(toNumber(value.daily_spin_limit ?? value.dailySpinLimit, defaultSpinCampaignSettings.dailySpinLimit))),
    requiredVerifiedReferrals: Math.max(0, Math.round(toNumber(value.required_verified_referrals ?? value.requiredVerifiedReferrals, defaultSpinCampaignSettings.requiredVerifiedReferrals))),
    requiredMembershipOrders: Math.max(0, Math.round(toNumber(value.required_membership_orders ?? value.requiredMembershipOrders, defaultSpinCampaignSettings.requiredMembershipOrders))),
    reservationExpiryHours: Math.max(1, Math.round(toNumber(value.reservation_expiry_hours ?? value.reservationExpiryHours, defaultSpinCampaignSettings.reservationExpiryHours))),
    guaranteedNonLosingFirstSpin: toBoolean(value.guaranteed_non_losing_first_spin ?? value.guaranteedNonLosingFirstSpin, defaultSpinCampaignSettings.guaranteedNonLosingFirstSpin),
    currency: typeof value.currency === 'string' && value.currency.trim() ? value.currency.trim().toUpperCase() : defaultSpinCampaignSettings.currency,
    eligibleCountries,
    minimumAccountAgeHours: Math.max(0, Math.round(toNumber(value.minimum_account_age_hours ?? value.minimumAccountAgeHours, defaultSpinCampaignSettings.minimumAccountAgeHours))),
  };
}

function serializeSpinCampaignSettings(settings: SpinCampaignAdminSettings): Record<string, unknown> {
  return {
    daily_spin_limit: Math.max(1, Math.round(settings.dailySpinLimit)),
    required_verified_referrals: Math.max(0, Math.round(settings.requiredVerifiedReferrals)),
    required_membership_orders: Math.max(0, Math.round(settings.requiredMembershipOrders)),
    reservation_expiry_hours: Math.max(1, Math.round(settings.reservationExpiryHours)),
    guaranteed_non_losing_first_spin: Boolean(settings.guaranteedNonLosingFirstSpin),
    currency: (settings.currency || 'USD').trim().toUpperCase(),
    eligible_countries: settings.eligibleCountries
      .map((entry) => entry.trim().toUpperCase())
      .filter(Boolean),
    minimum_account_age_hours: Math.max(0, Math.round(settings.minimumAccountAgeHours)),
  };
}

function mapSpinCampaignRow(row: SpinCampaignRow): SpinCampaignAdminItem {
  return {
    id: row.id,
    campaignKey: row.campaign_key,
    title: row.title,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    settings: normalizeSpinCampaignSettings(row.settings),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSpinPrizeInventoryRow(row: SpinPrizeInventoryRow): SpinPrizeInventoryItem {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    prizeKey: row.prize_key,
    label: row.label,
    rewardAmount: Number(row.reward_amount),
    weight: Number(row.weight),
    stockRemaining: row.stock_remaining,
    isActive: row.is_active,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeSpinSettings(value: unknown): PromotionalSpinSettings {
  if (!isRecord(value)) {
    return defaultPromotionalSpinSettings;
  }

  return {
    enabled: toBoolean(value.enabled, defaultPromotionalSpinSettings.enabled),
    rolloutStage: toStage(value.rolloutStage, defaultPromotionalSpinSettings.rolloutStage),
    enabledStages: toStageList(value.enabledStages, defaultPromotionalSpinSettings.enabledStages),
    triggerSurfaces: toSurfaceList(value.triggerSurfaces, defaultPromotionalSpinSettings.triggerSurfaces),
    cooldownMinutes: Math.max(1, Math.round(toNumber(value.cooldownMinutes, defaultPromotionalSpinSettings.cooldownMinutes))),
    showOncePerGuest: toBoolean(value.showOncePerGuest, defaultPromotionalSpinSettings.showOncePerGuest),
    showReopenButton: toBoolean(value.showReopenButton, defaultPromotionalSpinSettings.showReopenButton),
    reopenLabel: typeof value.reopenLabel === 'string' && value.reopenLabel.trim() ? value.reopenLabel.trim() : defaultPromotionalSpinSettings.reopenLabel,
    spinCampaignKey: typeof value.spinCampaignKey === 'string' && value.spinCampaignKey.trim() ? value.spinCampaignKey.trim() : defaultPromotionalSpinSettings.spinCampaignKey,
    wheelSegmentLabels: toWheelSegmentLabels(value.wheelSegmentLabels, defaultPromotionalSpinSettings.wheelSegmentLabels),
  };
}

export function resolvePromotionalSurface(pathname: string): PromotionalSurface | null {
  const normalized = pathname.split('?')[0].split('#')[0].trim().toLowerCase();

  if (normalized === '/' || normalized.startsWith('/pages/')) {
    return 'home';
  }

  if (normalized === '/signup') {
    return 'signup';
  }

  if (normalized === '/membership-plans' || normalized === '/membership') {
    return 'membership-plans';
  }

  return null;
}

export function buildPromotionalWheelSegments(wheelSegmentLabels?: string[] | null): PromotionalWheelSegment[] {
  if (!wheelSegmentLabels?.length) {
    return promotionalWheelSegments;
  }

  const normalizedLabels = toWheelSegmentLabels(wheelSegmentLabels, defaultPromotionalSpinSettings.wheelSegmentLabels);
  return promotionalWheelSegments.map((segment, index) => ({
    ...segment,
    label: normalizedLabels[index] ?? segment.label,
  }));
}

export function resolvePromotionalWheelSegmentId(
  rewardAmount: number | string | null | undefined,
  wheelSegments: PromotionalWheelSegment[] = promotionalWheelSegments,
): string {
  const parsedAmount = typeof rewardAmount === 'number' ? rewardAmount : Number(rewardAmount);
  const resolvedSegments = wheelSegments.length ? wheelSegments : promotionalWheelSegments;
  const index = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount % resolvedSegments.length : 0;
  return resolvedSegments[index]?.id ?? resolvedSegments[0]?.id ?? '';
}

export async function listPromotionalSpinSettings(): Promise<PromotionalSpinSettings> {
  const { data, error } = await supabase.from('platform_settings').select('value').eq('key', SETTINGS_KEY).single();
  if (error || !data) {
    return defaultPromotionalSpinSettings;
  }
  return normalizeSpinSettings((data as SettingRow).value);
}

export async function listSpinCampaignsAdmin(): Promise<SpinCampaignAdminItem[]> {
  const { data, error } = await supabase
    .from('spin_campaigns')
    .select('id,campaign_key,title,status,starts_at,ends_at,settings,created_at,updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapSpinCampaignRow(row as SpinCampaignRow));
}

export async function upsertSpinCampaignAdmin(input: SpinCampaignAdminInput): Promise<SpinCampaignAdminItem> {
  const payload = {
    campaign_key: input.campaignKey,
    title: input.title,
    status: input.status,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    settings: serializeSpinCampaignSettings(input.settings),
  };

  const query = input.id
    ? supabase.from('spin_campaigns').update(payload).eq('id', input.id)
    : supabase.from('spin_campaigns').insert(payload);

  const { data, error } = await query
    .select('id,campaign_key,title,status,starts_at,ends_at,settings,created_at,updated_at')
    .single();

  if (error) {
    throw error;
  }

  return mapSpinCampaignRow(data as SpinCampaignRow);
}

export async function listSpinPrizeInventory(campaignId: string): Promise<SpinPrizeInventoryItem[]> {
  const { data, error } = await supabase
    .from('spin_prize_inventory')
    .select('id,campaign_id,prize_key,label,reward_amount,weight,stock_remaining,is_active,metadata,created_at,updated_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapSpinPrizeInventoryRow(row as SpinPrizeInventoryRow));
}

export async function upsertSpinPrizeInventory(input: SpinPrizeInventoryInput): Promise<SpinPrizeInventoryItem> {
  const payload = {
    campaign_id: input.campaignId,
    prize_key: input.prizeKey,
    label: input.label,
    reward_amount: Number(input.rewardAmount),
    weight: Number(input.weight),
    stock_remaining: input.stockRemaining,
    is_active: input.isActive,
    metadata: input.metadata ?? {},
  };

  const query = input.id
    ? supabase.from('spin_prize_inventory').update(payload).eq('id', input.id)
    : supabase.from('spin_prize_inventory').insert(payload);

  const { data, error } = await query
    .select('id,campaign_id,prize_key,label,reward_amount,weight,stock_remaining,is_active,metadata,created_at,updated_at')
    .single();

  if (error) {
    throw error;
  }

  return mapSpinPrizeInventoryRow(data as SpinPrizeInventoryRow);
}

export async function deleteSpinPrizeInventory(prizeId: string): Promise<void> {
  const { error } = await supabase.from('spin_prize_inventory').delete().eq('id', prizeId);
  if (error) {
    throw error;
  }
}

export async function updatePromotionalSpinSettings(settings: PromotionalSpinSettings, updatedBy?: string): Promise<void> {
  const { error } = await supabase.from('platform_settings').upsert(
    {
      key: SETTINGS_KEY,
      value: settings,
      description: 'Promotional spin wheel trigger, rollout, and cooldown controls',
      updated_by: updatedBy ?? null,
    },
    { onConflict: 'key' },
  );

  if (error) {
    throw error;
  }
}

export function getOrCreateGuestSpinToken(): string {
  if (typeof window === 'undefined') {
    return 'server-guest-token';
  }

  const existing = window.localStorage.getItem(LOCAL_GUEST_KEY);
  if (existing) {
    return existing;
  }

  const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now()}${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(LOCAL_GUEST_KEY, generated);
  return generated;
}

export function storeReservationToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_RESERVATION_KEY, token);
}

export function getStoredReservationToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(LOCAL_RESERVATION_KEY);
}

export function clearStoredReservationToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LOCAL_RESERVATION_KEY);
}

export function shouldShowPromotionalPopup(settings: PromotionalSpinSettings, surface: PromotionalSurface): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!settings.enabled) {
    return false;
  }

  if (!settings.enabledStages.includes(settings.rolloutStage)) {
    return false;
  }

  if (!settings.triggerSurfaces.includes(surface)) {
    return false;
  }

  const dismissed = window.localStorage.getItem(LOCAL_DISMISSED_KEY) === '1';
  if (settings.showOncePerGuest && dismissed) {
    return false;
  }

  const lastShownRaw = window.localStorage.getItem(LOCAL_LAST_SHOWN_KEY);
  if (!lastShownRaw) {
    return true;
  }

  const cooldownMs = settings.cooldownMinutes * 60 * 1000;
  const elapsed = Date.now() - Number(lastShownRaw);
  return elapsed >= cooldownMs;
}

export function markPromotionalPopupShown(dismissed = false): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_LAST_SHOWN_KEY, String(Date.now()));
  if (dismissed) {
    window.localStorage.setItem(LOCAL_DISMISSED_KEY, '1');
  }
}

export function clearPromotionalPopupDismissedState(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LOCAL_DISMISSED_KEY);
}

export async function startPromotionalSpin(surface: PromotionalSurface): Promise<PromotionalSpinStartResult> {
  const guestToken = getOrCreateGuestSpinToken();
  const { data, error } = await supabase.rpc('promotional_spin_start', {
    p_guest_token: guestToken,
    p_trigger_surface: surface,
    p_request_meta: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    },
  });

  if (error) {
    throw error;
  }

  return (data ?? { ok: false, error: 'empty_response' }) as PromotionalSpinStartResult;
}

export async function claimPromotionalRewardReserve(attemptId: string): Promise<PromotionalReservationResult> {
  const guestToken = getOrCreateGuestSpinToken();
  const { data, error } = await supabase.rpc('promotional_spin_claim_reserve', {
    p_attempt_id: attemptId,
    p_guest_token: guestToken,
  });

  if (error) {
    throw error;
  }

  const payload = (data ?? { ok: false, error: 'empty_response' }) as PromotionalReservationResult;
  if (payload.ok && payload.reservationToken) {
    storeReservationToken(payload.reservationToken);
  }
  return payload;
}

export async function bindStoredReservationToUser(userId: string): Promise<void> {
  const token = getStoredReservationToken();
  if (!token) {
    return;
  }

  const { data, error } = await supabase.rpc('promotional_spin_bind_guest_reservation', {
    p_reservation_token: token,
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  const payload = data as { ok?: boolean } | null;
  if (payload?.ok) {
    clearStoredReservationToken();
  }
}

export async function refreshPromotionalRequirements(userId?: string): Promise<void> {
  const { error } = await supabase.rpc('promotional_reward_refresh_requirements', {
    p_user_id: userId ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function getRewardVaultStatus(userId?: string): Promise<RewardVaultStatusResponse> {
  const { data, error } = await supabase.rpc('promotional_reward_vault_status', {
    p_user_id: userId ?? null,
  });

  if (error) {
    throw error;
  }

  const payload = (data ?? { ok: true, reservations: [] }) as {
    ok: boolean;
    reservations: Array<{
      reservation_id: string;
      amount: number;
      currency: string;
      status: RewardVaultReservationStatus['status'];
      expires_at: string;
      created_at: string;
      next_blocking_step: RewardVaultReservationStatus['nextBlockingStep'];
      requirements: Array<{
        key: PromotionalRequirementStatus['key'];
        status: PromotionalRequirementStatus['status'];
        required: number;
        completed: number;
      }>;
    }>;
  };

  return {
    ok: payload.ok,
    reservations: payload.reservations.map((reservation) => ({
      reservationId: reservation.reservation_id,
      amount: reservation.amount,
      currency: reservation.currency,
      status: reservation.status,
      expiresAt: reservation.expires_at,
      createdAt: reservation.created_at,
      nextBlockingStep: reservation.next_blocking_step,
      requirements: reservation.requirements,
    })),
  };
}

export async function releasePromotionalReward(reservationId: string, userId?: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('promotional_reward_release', {
    p_reservation_id: reservationId,
    p_user_id: userId ?? null,
  });

  if (error) {
    throw error;
  }

  return (data ?? { ok: false, error: 'empty_response' }) as { ok: boolean; error?: string };
}

export async function reinstatePromotionalReward(reservationId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('promotional_reward_reinstate', {
    p_reservation_id: reservationId,
    p_reason: reason,
    p_actor_user_id: null,
  });

  if (error) {
    throw error;
  }

  return (data ?? { ok: false, error: 'empty_response' }) as { ok: boolean; error?: string };
}

export async function listPromotionalRewardQueue(limit = 50): Promise<PromotionalRewardQueueItem[]> {
  const { data, error } = await supabase
    .from('promotional_reward_reservations')
    .select('id,campaign_id,user_id,guest_token,amount,currency,status,expires_at,created_at,revoked_at,revoke_reason')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)));

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const typedRow = row as PromotionalRewardQueueRow;
    return {
      id: typedRow.id,
      campaignId: typedRow.campaign_id,
      userId: typedRow.user_id,
      guestToken: typedRow.guest_token,
      amount: Number(typedRow.amount),
      currency: typedRow.currency,
      status: typedRow.status,
      expiresAt: typedRow.expires_at,
      createdAt: typedRow.created_at,
      revokedAt: typedRow.revoked_at,
      revokeReason: typedRow.revoke_reason,
    };
  });
}

export async function adminDecidePromotionalReward(
  reservationId: string,
  decision: 'approve' | 'revoke',
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('promotional_reward_admin_decision', {
    p_reservation_id: reservationId,
    p_decision: decision,
    p_reason: reason ?? null,
    p_actor_user_id: null,
  });

  if (error) {
    throw error;
  }

  return (data ?? { ok: false, error: 'empty_response' }) as { ok: boolean; error?: string };
}

export async function getPromotionalSpinAnalytics(rangeDays = 30): Promise<PromotionalSpinAnalyticsSummary> {
  const clampedRange = Math.max(1, Math.min(365, Math.round(rangeDays)));
  const since = new Date(Date.now() - clampedRange * 24 * 60 * 60 * 1000).toISOString();

  const [
    attemptsRes,
    wonOutcomesRes,
    reservationsRes,
    signupBoundRes,
    releasedRes,
    pendingRes,
    expiredRes,
    revokedRes,
    abuseRes,
    referralCompletedRes,
  ] = await Promise.all([
    supabase.from('spin_attempts').select('id', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('spin_outcomes').select('id', { count: 'exact', head: true }).eq('outcome_status', 'won').gte('created_at', since),
    supabase.from('promotional_reward_reservations').select('id', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('promotional_reward_reservations').select('id', { count: 'exact', head: true }).not('user_id', 'is', null).gte('created_at', since),
    supabase.from('promotional_reward_reservations').select('id', { count: 'exact', head: true }).eq('status', 'released').gte('created_at', since),
    supabase.from('promotional_reward_reservations').select('id', { count: 'exact', head: true }).eq('status', 'pending_unlock').gte('created_at', since),
    supabase.from('promotional_reward_reservations').select('id', { count: 'exact', head: true }).eq('status', 'expired').gte('created_at', since),
    supabase.from('promotional_reward_reservations').select('id', { count: 'exact', head: true }).eq('status', 'revoked').gte('created_at', since),
    supabase.from('spin_abuse_signals').select('id', { count: 'exact', head: true }).gte('created_at', since),
    supabase
      .from('promotional_reward_requirements')
      .select('id', { count: 'exact', head: true })
      .eq('requirement_key', 'qualifying_referrals')
      .eq('requirement_status', 'completed')
      .gte('updated_at', since),
  ]);

  const results = [
    attemptsRes,
    wonOutcomesRes,
    reservationsRes,
    signupBoundRes,
    releasedRes,
    pendingRes,
    expiredRes,
    revokedRes,
    abuseRes,
    referralCompletedRes,
  ];

  for (const result of results) {
    if (result.error) {
      throw result.error;
    }
  }

  const attempts = attemptsRes.count ?? 0;
  const wonOutcomes = wonOutcomesRes.count ?? 0;
  const reservationsCreated = reservationsRes.count ?? 0;
  const signupBoundReservations = signupBoundRes.count ?? 0;
  const releasedRewards = releasedRes.count ?? 0;
  const pendingRewards = pendingRes.count ?? 0;
  const expiredRewards = expiredRes.count ?? 0;
  const revokedRewards = revokedRes.count ?? 0;
  const abuseSignals = abuseRes.count ?? 0;
  const referralCompleted = referralCompletedRes.count ?? 0;

  return {
    rangeDays: clampedRange,
    attempts,
    wonOutcomes,
    winRate: attempts > 0 ? wonOutcomes / attempts : 0,
    reservationsCreated,
    signupBoundReservations,
    releasedRewards,
    pendingRewards,
    expiredRewards,
    revokedRewards,
    abuseSignals,
    unlockConversionRate: reservationsCreated > 0 ? releasedRewards / reservationsCreated : 0,
    referralCompletionRate: reservationsCreated > 0 ? referralCompleted / reservationsCreated : 0,
  };
}

export async function listRewardVaultHistory(reservationId?: string): Promise<PromotionalEventItem[]> {
  let query = supabase
    .from('promotional_reward_events')
    .select('id,reservation_id,event_type,actor_user_id,event_payload,created_at')
    .order('created_at', { ascending: false })
    .limit(40);

  if (reservationId) {
    query = query.eq('reservation_id', reservationId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []) as PromotionalEventItem[];
}
