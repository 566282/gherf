import type { AppRole } from '../types/auth';

const knownRoles: AppRole[] = ['guest', 'registered_user', 'advertiser', 'moderator', 'campaign_manager', 'super_admin'];

type RuntimeEnvValue = string | boolean | undefined;

function getRuntimeEnvValue(...keys: string[]): string {
  const nodeEnv = typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>) : {};
  const viteEnv = (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined')
    ? (import.meta.env as Record<string, RuntimeEnvValue>)
    : {};

  for (const key of keys) {
    const viteValue = viteEnv[key];
    if (typeof viteValue === 'string' && viteValue.trim().length > 0) {
      return viteValue.trim();
    }

    const nodeValue = nodeEnv[key];
    if (typeof nodeValue === 'string' && nodeValue.trim().length > 0) {
      return nodeValue.trim();
    }
  }

  return '';
}

function normalizeRole(value: unknown): AppRole | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return knownRoles.includes(normalized as AppRole) ? (normalized as AppRole) : null;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function parseEmailList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => normalizeEmail(entry))
    .filter((entry): entry is string => Boolean(entry));
}

type RoleResolutionOptions = {
  bootstrapSuperAdminUserId?: string;
  bootstrapSuperAdminEmail?: string;
  campaignManagerEmails?: string[];
  moderatorEmails?: string[];
  advertiserEmails?: string[];
};

function resolveBootstrapSuperAdminRole(
  authUser: { id?: string; email?: string | null } | null | undefined,
  options?: RoleResolutionOptions,
): AppRole | null {
  const configuredBootstrapId = (options?.bootstrapSuperAdminUserId ?? getRuntimeEnvValue('VITE_AUTH_BOOTSTRAP_SUPER_ADMIN_USER_ID', 'AUTH_BOOTSTRAP_SUPER_ADMIN_USER_ID')).trim();
  const configuredBootstrapEmail = normalizeEmail(
    options?.bootstrapSuperAdminEmail
      ?? getRuntimeEnvValue('VITE_AUTH_BOOTSTRAP_SUPER_ADMIN_EMAIL', 'AUTH_BOOTSTRAP_SUPER_ADMIN_EMAIL')
      ?? 'walterdozie7@gmail.com',
  );
  const authUserId = (authUser?.id ?? '').trim();
  const authUserEmail = normalizeEmail(authUser?.email ?? null);

  if (!configuredBootstrapId || !configuredBootstrapEmail || !authUserId || !authUserEmail) {
    return null;
  }

  if (authUserId === configuredBootstrapId && authUserEmail === configuredBootstrapEmail) {
    return 'super_admin';
  }

  return null;
}

function resolveRoleFromTrustedEmail(email: string | null | undefined, options?: RoleResolutionOptions): AppRole | null {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const campaignManagerEmails = options?.campaignManagerEmails ?? parseEmailList(getRuntimeEnvValue('VITE_AUTH_CAMPAIGN_MANAGER_EMAILS', 'AUTH_CAMPAIGN_MANAGER_EMAILS'));
  const moderatorEmails = options?.moderatorEmails ?? parseEmailList(getRuntimeEnvValue('VITE_AUTH_MODERATOR_EMAILS', 'AUTH_MODERATOR_EMAILS'));
  const advertiserEmails = options?.advertiserEmails ?? parseEmailList(getRuntimeEnvValue('VITE_AUTH_ADVERTISER_EMAILS', 'AUTH_ADVERTISER_EMAILS'));

  if (campaignManagerEmails.includes(normalizedEmail)) {
    return 'campaign_manager';
  }

  if (moderatorEmails.includes(normalizedEmail)) {
    return 'moderator';
  }

  if (advertiserEmails.includes(normalizedEmail)) {
    return 'advertiser';
  }

  return null;
}

export function resolveAuthRoleFromMetadata(metadata: Record<string, unknown> | undefined | null): AppRole | null {
  if (!metadata) {
    return null;
  }

  return normalizeRole(metadata.role) ?? normalizeRole(metadata.user_role) ?? normalizeRole(metadata.userRole);
}

export function resolveAccountRole(
  profileRole: AppRole | null | undefined,
  authUser: { id?: string; email?: string | null; user_metadata?: Record<string, unknown> | null; app_metadata?: Record<string, unknown> | null } | null | undefined,
  options?: RoleResolutionOptions,
): AppRole {
  const metadataRole = resolveAuthRoleFromMetadata(authUser?.user_metadata) ?? resolveAuthRoleFromMetadata(authUser?.app_metadata);
  const bootstrapRole = resolveBootstrapSuperAdminRole(authUser, options);
  const trustedEmailRole = resolveRoleFromTrustedEmail(authUser?.email ?? null, options);

  if (metadataRole && metadataRole !== 'registered_user' && metadataRole !== 'guest') {
    return metadataRole;
  }

  if (bootstrapRole) {
    return bootstrapRole;
  }

  if (trustedEmailRole) {
    return trustedEmailRole;
  }

  return profileRole ?? 'registered_user';
}
