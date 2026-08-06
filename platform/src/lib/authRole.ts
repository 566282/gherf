import { env } from '@/lib/env';
import type { AppRole } from '@/types/auth';

const knownRoles: AppRole[] = ['guest', 'registered_user', 'advertiser', 'moderator', 'campaign_manager', 'super_admin'];

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
  const configuredBootstrapId = (options?.bootstrapSuperAdminUserId ?? env.authBootstrapSuperAdminUserId ?? '').trim();
  const configuredBootstrapEmail = normalizeEmail(options?.bootstrapSuperAdminEmail ?? env.authBootstrapSuperAdminEmail);
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

  const campaignManagerEmails = options?.campaignManagerEmails ?? parseEmailList(env.authCampaignManagerEmails);
  const moderatorEmails = options?.moderatorEmails ?? parseEmailList(env.authModeratorEmails);
  const advertiserEmails = options?.advertiserEmails ?? parseEmailList(env.authAdvertiserEmails);

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
