import { enqueueUserNotification, notifySuperAdmins } from '@/services/api/communications';

export type ComplianceLifecycleEvent =
  | 'withdrawal_compliance_held'
  | 'withdrawal_compliance_approved'
  | 'verification_review_required'
  | 'enforcement_applied'
  | 'appeal_submitted'
  | 'appeal_decided';

const complianceEventTemplateKeys: Record<ComplianceLifecycleEvent, 'compliance_withdrawal_held' | 'compliance_withdrawal_approved' | 'compliance_verification_review_required' | 'compliance_enforcement_applied' | 'compliance_appeal_submitted' | 'compliance_appeal_decided'> = {
  withdrawal_compliance_held: 'compliance_withdrawal_held',
  withdrawal_compliance_approved: 'compliance_withdrawal_approved',
  verification_review_required: 'compliance_verification_review_required',
  enforcement_applied: 'compliance_enforcement_applied',
  appeal_submitted: 'compliance_appeal_submitted',
  appeal_decided: 'compliance_appeal_decided',
};

export async function dispatchComplianceLifecycleEvent(input: {
  userId: string;
  event: ComplianceLifecycleEvent;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  notifyAdmins?: boolean;
}): Promise<void> {
  await enqueueUserNotification(input.userId, {
    title: input.title,
    message: input.message,
    type: input.event === 'enforcement_applied' ? 'warning' : 'info',
    category: 'compliance',
    templateKey: complianceEventTemplateKeys[input.event],
    metadata: {
      complianceEvent: input.event,
      ...(input.metadata ?? {}),
    },
  });

  if (input.notifyAdmins) {
    await notifySuperAdmins({
      title: `[Compliance] ${input.title}`,
      message: input.message,
      type: 'info',
      category: 'compliance',
      templateKey: complianceEventTemplateKeys[input.event],
      metadata: {
        userId: input.userId,
        complianceEvent: input.event,
        ...(input.metadata ?? {}),
      },
    });
  }
}
