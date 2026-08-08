import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailTemplatesPage } from '@/features/admin/pages/EmailTemplatesPage';

const communicationApiState = vi.hoisted(() => ({
  listCommunicationConfig: vi.fn(),
}));

vi.mock('@/services/api/communications', () => ({
  listCommunicationConfig: communicationApiState.listCommunicationConfig,
}));

describe('EmailTemplatesPage', () => {
  beforeEach(() => {
    communicationApiState.listCommunicationConfig.mockResolvedValue({
      timezone: 'UTC',
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
      emailEnabled: true,
      pushEnabled: true,
      smsEnabled: false,
      promotionalEnabled: true,
      liveAnnouncementsEnabled: true,
      templates: {
        internal_message: {
          key: 'internal_message',
          name: 'Internal message',
          description: 'Admin-to-admin broadcast',
          channels: ['in_app', 'email'],
          subject: 'Internal update',
          body: 'Hello team',
          pushTitle: 'Internal update',
          pushBody: 'Hello team',
          smsBody: 'Hello team',
          enabled: true,
        },
        email_verification: {
          key: 'email_verification',
          name: 'Email verification',
          description: 'Verify new users',
          channels: ['email'],
          subject: 'Verify your email',
          body: 'Please verify',
          pushTitle: '',
          pushBody: '',
          smsBody: '',
          enabled: false,
        },
        password_reset: {
          key: 'password_reset',
          name: 'Password reset',
          description: 'Password recovery flow',
          channels: ['email'],
          subject: 'Reset your password',
          body: 'Reset link',
          pushTitle: '',
          pushBody: '',
          smsBody: '',
          enabled: true,
        },
        reward_update: {
          key: 'reward_update',
          name: 'Reward update',
          description: 'Reward notification',
          channels: ['email', 'push'],
          subject: 'Reward update',
          body: 'You earned a reward',
          pushTitle: 'Reward update',
          pushBody: 'You earned a reward',
          smsBody: '',
          enabled: true,
        },
        live_announcement: {
          key: 'live_announcement',
          name: 'Live announcement',
          description: 'Broadcast announcements',
          channels: ['email', 'push'],
          subject: 'Announcement',
          body: 'Announcement body',
          pushTitle: 'Announcement',
          pushBody: 'Announcement body',
          smsBody: '',
          enabled: true,
        },
        promotional_blast: {
          key: 'promotional_blast',
          name: 'Promotional blast',
          description: 'Promo campaign emails',
          channels: ['email'],
          subject: 'Special offer',
          body: 'Promo body',
          pushTitle: '',
          pushBody: '',
          smsBody: '',
          enabled: true,
        },
        compliance_withdrawal_held: {
          key: 'compliance_withdrawal_held',
          name: 'Compliance withdrawal held',
          description: 'Held payout notices',
          channels: ['email'],
          subject: 'Withdrawal held',
          body: 'Held notice',
          pushTitle: '',
          pushBody: '',
          smsBody: '',
          enabled: true,
        },
        compliance_withdrawal_approved: {
          key: 'compliance_withdrawal_approved',
          name: 'Compliance withdrawal approved',
          description: 'Approved payout notices',
          channels: ['email'],
          subject: 'Withdrawal approved',
          body: 'Approved notice',
          pushTitle: '',
          pushBody: '',
          smsBody: '',
          enabled: true,
        },
        compliance_verification_review_required: {
          key: 'compliance_verification_review_required',
          name: 'Verification review required',
          description: 'Review queue notices',
          channels: ['email'],
          subject: 'Review required',
          body: 'Review body',
          pushTitle: '',
          pushBody: '',
          smsBody: '',
          enabled: true,
        },
        compliance_enforcement_applied: {
          key: 'compliance_enforcement_applied',
          name: 'Compliance enforcement applied',
          description: 'Enforcement notices',
          channels: ['email'],
          subject: 'Enforcement applied',
          body: 'Enforcement body',
          pushTitle: '',
          pushBody: '',
          smsBody: '',
          enabled: true,
        },
        compliance_appeal_submitted: {
          key: 'compliance_appeal_submitted',
          name: 'Compliance appeal submitted',
          description: 'Appeal notices',
          channels: ['email'],
          subject: 'Appeal submitted',
          body: 'Appeal body',
          pushTitle: '',
          pushBody: '',
          smsBody: '',
          enabled: true,
        },
        compliance_appeal_decided: {
          key: 'compliance_appeal_decided',
          name: 'Compliance appeal decided',
          description: 'Appeal decision notices',
          channels: ['email'],
          subject: 'Appeal decided',
          body: 'Decision body',
          pushTitle: '',
          pushBody: '',
          smsBody: '',
          enabled: true,
        },
        compliance_ops_alert: {
          key: 'compliance_ops_alert',
          name: 'Compliance ops alert',
          description: 'Operations alert notices',
          channels: ['email'],
          subject: 'Ops alert',
          body: 'Alert body',
          pushTitle: '',
          pushBody: '',
          smsBody: '',
          enabled: true,
        },
      },
    });
  });

  it('renders live email template catalog instead of seeded module content', async () => {
    render(<EmailTemplatesPage />);

    expect(await screen.findByText('Email template catalog')).toBeInTheDocument();
    expect(screen.getByText('Internal message')).toBeInTheDocument();
    expect(screen.getByText('Verify your email')).toBeInTheDocument();
    expect(screen.queryByText('Templates live')).not.toBeInTheDocument();
  });
});
