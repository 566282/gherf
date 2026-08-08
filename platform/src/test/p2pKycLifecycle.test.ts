import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reviewMerchantKycRequirement, submitMerchantKycRequirement } from '@/services/api/p2pKyc';

const supabaseState = vi.hoisted(() => ({
  from: vi.fn(),
}));

const complianceState = vi.hoisted(() => ({
  evaluateMerchantQualification: vi.fn(),
}));

const communicationsState = vi.hoisted(() => ({
  sendUserNotification: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: supabaseState.from,
  },
}));

vi.mock('@/services/api/p2pCompliance', () => ({
  evaluateMerchantQualification: complianceState.evaluateMerchantQualification,
}));

vi.mock('@/services/api/communications', () => ({
  sendUserNotification: communicationsState.sendUserNotification,
}));

describe('merchant KYC lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    complianceState.evaluateMerchantQualification.mockResolvedValue({ ok: true });
    communicationsState.sendUserNotification.mockResolvedValue(undefined);

    supabaseState.from.mockImplementation((table: string) => {
      if (table === 'merchant_profiles') {
        return {
          select: () => ({
            eq: (_col: string, value: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: value === 'merchant-1'
                  ? { user_id: 'merchant-user-1' }
                  : { id: 'merchant-1', user_id: 'merchant-user-1' },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'merchant_kyc_requirements') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'req-1',
                  merchant_id: 'merchant-1',
                  requirement_key: 'government_id',
                  requirement_type: 'document',
                  status: 'submitted',
                  level_required: 2,
                  submitted_at: '2026-08-06T12:00:00.000Z',
                  reviewed_by: null,
                  reviewed_at: null,
                  rejection_reason: null,
                  submission_payload: { documentUrl: 'https://example.com/id.png' },
                  metadata: {},
                  updated_at: '2026-08-06T12:00:00.000Z',
                },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'req-1',
                      merchant_id: 'merchant-1',
                      requirement_key: 'government_id',
                      requirement_type: 'document',
                      status: 'submitted',
                      level_required: 2,
                      submitted_at: '2026-08-06T12:00:00.000Z',
                      reviewed_by: null,
                      reviewed_at: null,
                      rejection_reason: null,
                      submission_payload: { documentUrl: 'https://example.com/id.png' },
                      metadata: {},
                      updated_at: '2026-08-06T12:00:00.000Z',
                    },
                    error: null,
                  }),
                }),
              }),
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'req-1',
                    merchant_id: 'merchant-1',
                    requirement_key: 'government_id',
                    requirement_type: 'document',
                    status: 'required',
                    level_required: 2,
                    submitted_at: '2026-08-06T12:00:00.000Z',
                    reviewed_by: 'admin-1',
                    reviewed_at: '2026-08-06T12:05:00.000Z',
                    rejection_reason: 'Please provide clearer image',
                    submission_payload: { documentUrl: 'https://example.com/id.png' },
                    metadata: {},
                    updated_at: '2026-08-06T12:05:00.000Z',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('submits KYC requirement and triggers qualification evaluation', async () => {
    const result = await submitMerchantKycRequirement({
      userId: 'user-1',
      requirementId: 'req-1',
      submissionPayload: { documentUrl: 'https://example.com/id.png' },
    });

    expect(result.id).toBe('req-1');
    expect(result.status).toBe('submitted');
    expect(complianceState.evaluateMerchantQualification).toHaveBeenCalledWith('merchant-1', 'user-1');
  });

  it('requests resubmission and notifies merchant user', async () => {
    const result = await reviewMerchantKycRequirement({
      requirementId: 'req-1',
      action: 'request_resubmission',
      reviewerId: 'admin-1',
      reason: 'Please provide clearer image',
    });

    expect(result.status).toBe('required');
    expect(result.rejectionReason).toBe('Please provide clearer image');
    expect(complianceState.evaluateMerchantQualification).toHaveBeenCalledWith('merchant-1', 'admin-1');
    expect(communicationsState.sendUserNotification).toHaveBeenCalledTimes(1);
  });
});
