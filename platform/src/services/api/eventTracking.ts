import { supabase } from '@/services/supabase/client';

export type TrackedCampaignEvent = {
  campaignId: string;
  provider: string;
  eventName: string;
  externalEventId: string;
  actorUserId: string;
  occurredAt?: string;
  payload?: Record<string, unknown>;
};

export type EventTaskMapping = {
  id: string;
  campaignId: string;
  taskId: string;
  provider: string;
  eventName: string;
  criteria: Record<string, unknown>;
  isActive: boolean;
};

export type EventFulfillment = {
  taskId: string;
  status: 'fulfilled' | 'suppressed';
  reason: string;
};

export type EventEligibilityContext = {
  rewardAmount?: number;
  budgetRemaining?: number;
  dailyCompletions?: number;
  dailyLimit?: number | null;
  cooldownActive?: boolean;
};

export function eventMatchesCriteria(payload: Record<string, unknown>, criteria: Record<string, unknown>): boolean {
  return Object.entries(criteria).every(([key, expected]) => {
    const actual = payload[key];
    if (Array.isArray(expected)) return expected.includes(actual);
    return actual === expected;
  });
}

export function filterEligibleEventMappings(event: TrackedCampaignEvent, mappings: EventTaskMapping, alreadyCompleted: boolean, context: EventEligibilityContext = {}): EventFulfillment {
  if (alreadyCompleted) return { taskId: mappings.taskId, status: 'suppressed', reason: 'Task already completed by this user.' };
  if (!mappings.isActive || mappings.campaignId !== event.campaignId || mappings.provider !== event.provider || mappings.eventName !== event.eventName) {
    return { taskId: mappings.taskId, status: 'suppressed', reason: 'Event mapping is not eligible.' };
  }
  if (!eventMatchesCriteria(event.payload ?? {}, mappings.criteria)) return { taskId: mappings.taskId, status: 'suppressed', reason: 'Event payload does not satisfy mapping criteria.' };
  if (context.cooldownActive) return { taskId: mappings.taskId, status: 'suppressed', reason: 'Task cooldown is active for this user.' };
  if (context.dailyLimit !== undefined && context.dailyLimit !== null && (context.dailyCompletions ?? 0) >= context.dailyLimit) return { taskId: mappings.taskId, status: 'suppressed', reason: 'Daily campaign pacing limit reached.' };
  if (context.budgetRemaining !== undefined && context.rewardAmount !== undefined && context.budgetRemaining < context.rewardAmount) return { taskId: mappings.taskId, status: 'suppressed', reason: 'Campaign budget cap reached.' };
  return { taskId: mappings.taskId, status: 'fulfilled', reason: 'Event matched an active task mapping.' };
}

export async function ingestCampaignEvent(event: TrackedCampaignEvent): Promise<EventFulfillment[]> {
  const { data: stored, error: eventError } = await supabase.from('campaign_events').upsert({
    campaign_id: event.campaignId,
    provider: event.provider,
    event_name: event.eventName,
    external_event_id: event.externalEventId,
    actor_user_id: event.actorUserId,
    occurred_at: event.occurredAt ?? new Date().toISOString(),
    payload: event.payload ?? {},
  }, { onConflict: 'provider,external_event_id' }).select('id').single();
  if (eventError) throw eventError;

  const { data: mappingRows, error: mappingError } = await supabase.from('campaign_event_task_mappings').select('id,campaign_id,task_id,provider,event_name,criteria,is_active').eq('campaign_id', event.campaignId).eq('provider', event.provider).eq('event_name', event.eventName).eq('is_active', true);
  if (mappingError) throw mappingError;

  const results: EventFulfillment[] = [];
  for (const row of mappingRows ?? []) {
    const { data: previous } = await supabase.from('campaign_event_completions').select('id').eq('task_id', row.task_id).eq('user_id', event.actorUserId).eq('status', 'fulfilled').maybeSingle();
    const mapping: EventTaskMapping = { id: row.id, campaignId: row.campaign_id, taskId: row.task_id, provider: row.provider, eventName: row.event_name, criteria: (row.criteria ?? {}) as Record<string, unknown>, isActive: row.is_active };
    const { data: task } = await supabase.from('campaign_tasks').select('reward_amount,max_completions,current_completions,cooldown_seconds').eq('id', row.task_id).maybeSingle();
    const { count: dailyCompletions } = await supabase.from('campaign_event_completions').select('id', { count: 'exact', head: true }).eq('task_id', row.task_id).eq('user_id', event.actorUserId).eq('status', 'fulfilled').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    const fulfillment = filterEligibleEventMappings(event, mapping, Boolean(previous), {
      rewardAmount: Number(task?.reward_amount ?? 0),
      dailyCompletions: dailyCompletions ?? 0,
      dailyLimit: task?.max_completions ?? null,
    });
    results.push(fulfillment);
    await supabase.from('campaign_event_completions').upsert({ event_id: stored.id, task_id: row.task_id, user_id: event.actorUserId, status: fulfillment.status, reason: fulfillment.reason }, { onConflict: 'event_id,task_id,user_id' });
  }
  return results;
}

export async function listCampaignEventHistory(campaignId: string, limit = 100) {
  const { data, error } = await supabase
    .from('campaign_events')
    .select('id,campaign_id,provider,event_name,external_event_id,actor_user_id,occurred_at,payload,created_at')
    .eq('campaign_id', campaignId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
