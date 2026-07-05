import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationCenterPage } from '@/features/admin/pages/NotificationCenterPage';

const apiState = vi.hoisted(() => ({
  listCommunicationConfig: vi.fn(),
  listCommunicationTemplates: vi.fn(),
  listNotificationQueue: vi.fn(),
  listNotificationRetryHistory: vi.fn(),
  processNotificationQueue: vi.fn(),
  retryNotificationQueueItem: vi.fn(),
  cancelNotificationQueueItem: vi.fn(),
}));

vi.mock('@/services/api/communications', () => ({
  communicationChannels: ['in_app', 'email', 'push', 'sms', 'whatsapp', 'telegram'],
  listCommunicationConfig: apiState.listCommunicationConfig,
  listCommunicationTemplates: apiState.listCommunicationTemplates,
  listNotificationQueue: apiState.listNotificationQueue,
  listNotificationRetryHistory: apiState.listNotificationRetryHistory,
  processNotificationQueue: apiState.processNotificationQueue,
  retryNotificationQueueItem: apiState.retryNotificationQueueItem,
  cancelNotificationQueueItem: apiState.cancelNotificationQueueItem,
}));

describe('NotificationCenterPage', () => {
  beforeEach(() => {
    apiState.listCommunicationConfig.mockResolvedValue({
      timezone: 'UTC',
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      emailEnabled: true,
      pushEnabled: true,
      smsEnabled: false,
      promotionalEnabled: true,
      liveAnnouncementsEnabled: true,
      templates: {},
    });

    apiState.listCommunicationTemplates.mockResolvedValue([
      { key: 'reward_update', name: 'Reward update', description: 'Reward notification', channels: ['in_app'], subject: 'Subject', body: 'Body', enabled: true },
    ]);

    apiState.listNotificationQueue.mockResolvedValue([
      {
        id: 'queue-1',
        user_id: 'user-1',
        title: 'Withdrawal restriction',
        message: 'Withdrawals are not allowed until Jul 10, 2026.',
        type: 'info',
        channel: 'in_app',
        category: 'transactional',
        template_key: null,
        status: 'failed',
        scheduled_for: '2026-07-10T00:00:00.000Z',
        sent_at: null,
        retry_count: 1,
        max_retries: 3,
        last_error: 'Temporary error',
        metadata: { withdrawalRequestId: 'withdrawal-1' },
        created_at: '2026-07-05T12:00:00.000Z',
        updated_at: '2026-07-05T12:00:00.000Z',
      },
    ]);

    apiState.listNotificationRetryHistory.mockResolvedValue([]);
    apiState.processNotificationQueue.mockResolvedValue(1);
    apiState.retryNotificationQueueItem.mockResolvedValue(undefined);
    apiState.cancelNotificationQueueItem.mockResolvedValue(undefined);
  });

  it('inspects a queue row and allows retry or cancel actions', async () => {
    render(<NotificationCenterPage />);

    await screen.findByText('Notification center');
    await userEvent.click(screen.getByRole('button', { name: 'Inspect' }));

    expect(screen.getByText('Selected queue item')).toBeInTheDocument();
    expect(screen.getByText('Withdrawal restriction')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry item' }));
    await waitFor(() => expect(apiState.retryNotificationQueueItem).toHaveBeenCalledWith('queue-1'));

    await userEvent.click(screen.getByRole('button', { name: 'Cancel item' }));
    await waitFor(() => expect(apiState.cancelNotificationQueueItem).toHaveBeenCalledWith('queue-1'));
  });

  it('processes due notifications from the queue control', async () => {
    render(<NotificationCenterPage />);

    await screen.findByText('Notification center');
    await userEvent.click(screen.getByRole('button', { name: 'Process due notifications' }));

    await waitFor(() => expect(apiState.processNotificationQueue).toHaveBeenCalledWith(25));
  });
});