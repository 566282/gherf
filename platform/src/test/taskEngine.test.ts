import { describe, expect, it } from 'vitest';
import { buildTaskEngineAnalytics, createTaskDraftFromTemplate, listTaskTemplates, validateTaskDraft } from '@/services/api/tasks';

describe('task engine helpers', () => {
  it('exposes reusable task templates', () => {
    const templates = listTaskTemplates();

    expect(templates.some((template) => template.id === 'survey_completion')).toBe(true);
    expect(templates.some((template) => template.id === 'app_install')).toBe(true);
    expect(templates.some((template) => template.id === 'social_follow')).toBe(true);
    expect(templates[0]).toHaveProperty('label');
    expect(templates[0]).toHaveProperty('taskType');
  });

  it('builds a template-driven task draft', () => {
    const draft = createTaskDraftFromTemplate('telegram_membership', 'campaign-1');

    expect(draft.campaignId).toBe('campaign-1');
    expect(draft.title).toContain('Telegram');
    expect(draft.taskType).toBe('join_telegram');
    expect(draft.fraudChecksText).toContain('duplicate_detection');
    expect(draft.taskConfigText).toContain('telegram_membership');
  });

  it('reports blocking validation issues for incomplete drafts', () => {
    const issues = validateTaskDraft({
      campaignId: '',
      title: '',
      description: '',
      taskType: '',
      mediaUrl: '',
      rewardAmount: 0,
      requirements: [{ key: '', label: '', value: '' }],
      cooldownSeconds: -1,
      maximumAttempts: 0,
      verificationMethod: '',
      fraudChecksText: '',
      expiresAt: 'not-a-date',
      taskConfigText: '{bad json',
      maxCompletions: 0,
      status: 'draft',
    });

    expect(issues.some((issue) => issue.severity === 'error')).toBe(true);
    expect(issues.map((issue) => issue.field)).toContain('taskConfigText');
    expect(issues.map((issue) => issue.field)).toContain('campaignId');
  });

  it('aggregates completion, latency, and fraud trends by campaign and month', () => {
    const analytics = buildTaskEngineAnalytics({
      campaigns: [
        { id: 'campaign-1', title: 'Summer promo', status: 'active' },
        { id: 'campaign-2', title: 'Brand launch', status: 'paused' },
      ],
      tasks: [
        { id: 'task-1', campaign_id: 'campaign-1', task_type: 'join_telegram', reward_amount: 2, current_completions: 1, status: 'active' },
        { id: 'task-2', campaign_id: 'campaign-1', task_type: 'join_telegram', reward_amount: 3, current_completions: 1, status: 'active' },
        { id: 'task-3', campaign_id: 'campaign-2', task_type: 'follow_social', reward_amount: 4, current_completions: 1, status: 'paused' },
      ],
      submissions: [
        { task_id: 'task-1', status: 'approved', created_at: '2026-06-01T00:00:00.000Z', reviewed_at: '2026-06-02T00:00:00.000Z' },
        { task_id: 'task-2', status: 'rejected', created_at: '2026-06-03T00:00:00.000Z', reviewed_at: '2026-06-05T00:00:00.000Z' },
        { task_id: 'task-3', status: 'approved', created_at: '2026-07-01T00:00:00.000Z', reviewed_at: '2026-07-04T00:00:00.000Z' },
      ],
      rewards: [
        { task_id: 'task-1', amount: 2, status: 'approved' },
        { task_id: 'task-3', amount: 4, status: 'claimed' },
      ],
    });

    expect(analytics.byCampaign).toHaveLength(2);
    expect(analytics.byCampaign[0]).toMatchObject({
      campaignId: 'campaign-1',
      completionRate: 50,
      averageReviewHours: 36,
    });
    expect(analytics.fraudFlagsByMonth).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ period: '2026-06', fraudFlags: 1 }),
      ]),
    );
  });
});
