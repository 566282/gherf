import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchComplianceLifecycleEvent } from '@/services/api/complianceNotifications';

const enqueueUserNotificationMock = vi.hoisted(() => vi.fn());
const notifySuperAdminsMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api/communications', () => ({
  enqueueUserNotification: enqueueUserNotificationMock,
  notifySuperAdmins: notifySuperAdminsMock,
}));

describe('dispatchComplianceLifecycleEvent', () => {
  beforeEach(() => {
    enqueueUserNotificationMock.mockReset();
    notifySuperAdminsMock.mockReset();
    enqueueUserNotificationMock.mockResolvedValue(undefined);
    notifySuperAdminsMock.mockResolvedValue(1);
  });

  it('sends dedicated template keys for user and admin compliance notifications', async () => {
    await dispatchComplianceLifecycleEvent({
      userId: 'user-1',
      event: 'verification_review_required',
      title: 'Verification queued',
      message: 'Manual review required.',
      notifyAdmins: true,
      metadata: { reviewId: 'review-1' },
    });

    expect(enqueueUserNotificationMock).toHaveBeenCalledWith('user-1', {
      title: 'Verification queued',
      message: 'Manual review required.',
      type: 'info',
      category: 'compliance',
      templateKey: 'compliance_verification_review_required',
      metadata: {
        complianceEvent: 'verification_review_required',
        reviewId: 'review-1',
      },
    });

    expect(notifySuperAdminsMock).toHaveBeenCalledWith({
      title: '[Compliance] Verification queued',
      message: 'Manual review required.',
      type: 'info',
      category: 'compliance',
      templateKey: 'compliance_verification_review_required',
      metadata: {
        userId: 'user-1',
        complianceEvent: 'verification_review_required',
        reviewId: 'review-1',
      },
    });
  });

  it('uses warning type for enforcement notifications', async () => {
    await dispatchComplianceLifecycleEvent({
      userId: 'user-2',
      event: 'enforcement_applied',
      title: 'Account restricted',
      message: 'A compliance action was applied.',
      notifyAdmins: false,
    });

    expect(enqueueUserNotificationMock).toHaveBeenCalledWith('user-2', expect.objectContaining({
      type: 'warning',
      templateKey: 'compliance_enforcement_applied',
    }));
    expect(notifySuperAdminsMock).not.toHaveBeenCalled();
  });
});
