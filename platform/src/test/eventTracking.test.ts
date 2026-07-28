import { describe, expect, it } from 'vitest';
import { eventMatchesCriteria, filterEligibleEventMappings } from '@/services/api/eventTracking';

describe('event tracking engine', () => {
  const event = { campaignId: 'campaign-1', provider: 'analytics', eventName: 'purchase', externalEventId: 'evt-1', actorUserId: 'user-1', payload: { plan: 'pro', region: 'US' } };
  const mapping = { id: 'map-1', campaignId: 'campaign-1', taskId: 'task-1', provider: 'analytics', eventName: 'purchase', criteria: { plan: 'pro' }, isActive: true };

  it('matches exact and list-based criteria', () => {
    expect(eventMatchesCriteria(event.payload, mapping.criteria)).toBe(true);
    expect(eventMatchesCriteria({ region: 'US' }, { region: ['US', 'CA'] })).toBe(true);
  });

  it('suppresses duplicate completions and fulfills eligible events', () => {
    expect(filterEligibleEventMappings(event, mapping, false).status).toBe('fulfilled');
    expect(filterEligibleEventMappings(event, mapping, true).status).toBe('suppressed');
    expect(filterEligibleEventMappings(event, mapping, false, { dailyCompletions: 10, dailyLimit: 10 }).reason).toContain('pacing');
    expect(filterEligibleEventMappings(event, mapping, false, { rewardAmount: 5, budgetRemaining: 2 }).reason).toContain('budget');
  });
});
