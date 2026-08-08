import { supabase } from '@/services/supabase/client';
import { sendUserNotification } from '@/services/api/communications';
import { evaluateMerchantQualification } from '@/services/api/p2pCompliance';

export type MerchantKycRequirement = {
  id: string;
  merchantId: string;
  merchantUserId: string | null;
  requirementKey: string;
  requirementType: string;
  status: 'required' | 'submitted' | 'approved' | 'rejected' | 'expired' | 'waived';
  levelRequired: number;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  submissionPayload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

type MerchantKycRow = {
  id: string;
  merchant_id: string;
  requirement_key: string;
  requirement_type: string;
  status: MerchantKycRequirement['status'];
  level_required: number;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  submission_payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
};

function mapRequirement(row: MerchantKycRow, merchantUserId: string | null): MerchantKycRequirement {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    merchantUserId,
    requirementKey: row.requirement_key,
    requirementType: row.requirement_type,
    status: row.status,
    levelRequired: Number(row.level_required ?? 1),
    submittedAt: row.submitted_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    submissionPayload: row.submission_payload ?? {},
    metadata: row.metadata ?? {},
    updatedAt: row.updated_at,
  };
}

async function getMerchantProfileByUserId(userId: string): Promise<{ id: string; user_id: string | null } | null> {
  const { data, error } = await supabase
    .from('merchant_profiles')
    .select('id,user_id')
    .eq('user_id', userId)
    .maybeSingle<{ id: string; user_id: string | null }>();

  if (error) throw error;
  return data;
}

async function getMerchantUserId(merchantId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('merchant_profiles')
    .select('user_id')
    .eq('id', merchantId)
    .maybeSingle<{ user_id: string | null }>();

  if (error) throw error;
  return data?.user_id ?? null;
}

export async function listMerchantKycRequirementsForCurrentUser(userId: string): Promise<MerchantKycRequirement[]> {
  const merchant = await getMerchantProfileByUserId(userId);
  if (!merchant) return [];

  const { data, error } = await supabase
    .from('merchant_kyc_requirements')
    .select('id,merchant_id,requirement_key,requirement_type,status,level_required,submitted_at,reviewed_by,reviewed_at,rejection_reason,submission_payload,metadata,updated_at')
    .eq('merchant_id', merchant.id)
    .order('level_required', { ascending: true })
    .order('requirement_key', { ascending: true });

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load merchant KYC requirements.');
  }

  return data.map((row) => mapRequirement(row as MerchantKycRow, merchant.user_id));
}

export async function submitMerchantKycRequirement(input: {
  userId: string;
  requirementId: string;
  submissionPayload: Record<string, unknown>;
}): Promise<MerchantKycRequirement> {
  const merchant = await getMerchantProfileByUserId(input.userId);
  if (!merchant) throw new Error('Merchant profile was not found for this user.');

  const { data, error } = await supabase
    .from('merchant_kyc_requirements')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
      submission_payload: input.submissionPayload,
      metadata: {
        source: 'merchant_kyc_self_service',
        lastSubmissionAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.requirementId)
    .eq('merchant_id', merchant.id)
    .select('id,merchant_id,requirement_key,requirement_type,status,level_required,submitted_at,reviewed_by,reviewed_at,rejection_reason,submission_payload,metadata,updated_at')
    .single<MerchantKycRow>();

  if (error || !data) {
    throw error ?? new Error('Unable to submit merchant KYC requirement.');
  }

  await evaluateMerchantQualification(merchant.id, input.userId);

  return mapRequirement(data, merchant.user_id);
}

export async function reviewMerchantKycRequirement(input: {
  requirementId: string;
  action: 'approve' | 'reject' | 'request_resubmission';
  reviewerId: string;
  reason?: string;
}): Promise<MerchantKycRequirement> {
  const { data: existing, error: existingError } = await supabase
    .from('merchant_kyc_requirements')
    .select('id,merchant_id,requirement_key,requirement_type,status,level_required,submitted_at,reviewed_by,reviewed_at,rejection_reason,submission_payload,metadata,updated_at')
    .eq('id', input.requirementId)
    .single<MerchantKycRow>();

  if (existingError || !existing) {
    throw existingError ?? new Error('Unable to load KYC requirement for review.');
  }

  const nextStatus = input.action === 'approve' ? 'approved' : input.action === 'reject' ? 'rejected' : 'required';
  const rejectionReason = input.action === 'approve' ? null : input.reason?.trim() || 'Additional information is required.';

  const { data, error } = await supabase
    .from('merchant_kyc_requirements')
    .update({
      status: nextStatus,
      reviewed_by: input.reviewerId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason,
      metadata: {
        ...(existing.metadata ?? {}),
        reviewAction: input.action,
        reviewReason: rejectionReason,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.requirementId)
    .select('id,merchant_id,requirement_key,requirement_type,status,level_required,submitted_at,reviewed_by,reviewed_at,rejection_reason,submission_payload,metadata,updated_at')
    .single<MerchantKycRow>();

  if (error || !data) {
    throw error ?? new Error('Unable to save KYC review action.');
  }

  await evaluateMerchantQualification(data.merchant_id, input.reviewerId);

  const merchantUserId = await getMerchantUserId(data.merchant_id);
  if (merchantUserId) {
    const actionText = input.action === 'approve'
      ? 'approved'
      : input.action === 'reject'
        ? 'rejected'
        : 'returned for resubmission';

    await sendUserNotification(merchantUserId, {
      title: 'Merchant KYC requirement updated',
      message: `${data.requirement_key} was ${actionText}.`,
      type: input.action === 'approve' ? 'success' : 'warning',
      category: 'transactional',
      metadata: {
        requirementId: data.id,
        requirementKey: data.requirement_key,
        action: input.action,
        rejectionReason,
      },
    });
  }

  return mapRequirement(data, merchantUserId);
}