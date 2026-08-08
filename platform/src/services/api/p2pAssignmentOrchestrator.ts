import { supabase } from '@/services/supabase/client';
import { assignP2POrder } from '@/services/api/p2pMatching';

type RolloutMode = 'shadow' | 'progressive' | 'enforced';

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function toMode(value: unknown, fallback: RolloutMode): RolloutMode {
  if (value === 'shadow' || value === 'progressive' || value === 'enforced') {
    return value;
  }
  return fallback;
}

function toPercent(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

async function loadOrchestratorSettings(): Promise<{ enabled: boolean; mode: RolloutMode; percent: number }> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key,value')
    .in('key', ['assignment_orchestrator_enabled', 'p2p_rollout_mode', 'p2p_rollout_percent']);

  if (error || !Array.isArray(data)) {
    return { enabled: true, mode: 'progressive', percent: 20 };
  }

  const settings = Object.fromEntries(data.map((row) => [String((row as Record<string, unknown>).key), (row as Record<string, unknown>).value]));
  return {
    enabled: toBoolean(settings.assignment_orchestrator_enabled, true),
    mode: toMode(settings.p2p_rollout_mode, 'progressive'),
    percent: toPercent(settings.p2p_rollout_percent, 20),
  };
}

async function writeDeadLetter(orderId: string, failureStage: string, failureReason: string, payload: Record<string, unknown>): Promise<void> {
  await supabase.from('assignment_orchestrator_dead_letters').insert({
    order_id: orderId,
    failure_stage: failureStage,
    failure_reason: failureReason,
    payload,
    retry_count: 0,
    next_retry_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
}

export async function runP2PAssignmentOrchestrator(limit = 25): Promise<{
  enabled: boolean;
  mode: RolloutMode;
  percent: number;
  processed: number;
  assigned: number;
  shadowOnly: number;
  noEligibleMerchant: number;
  failed: number;
}> {
  const settings = await loadOrchestratorSettings();
  if (!settings.enabled) {
    return {
      ...settings,
      processed: 0,
      assigned: 0,
      shadowOnly: 0,
      noEligibleMerchant: 0,
      failed: 0,
    };
  }

  const { data, error } = await supabase
    .from('p2p_orders')
    .select('id,created_at')
    .in('current_state', ['created', 'pending_merchant_assignment'])
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load pending P2P orders for assignment orchestration.');
  }

  let processed = 0;
  let assigned = 0;
  let shadowOnly = 0;
  let noEligibleMerchant = 0;
  let failed = 0;

  for (const row of data as Array<Record<string, unknown>>) {
    const orderId = String(row.id);
    processed += 1;

    try {
      if (settings.mode === 'progressive') {
        const bucket = Math.abs(orderId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 100;
        if (bucket >= settings.percent) {
          shadowOnly += 1;
          continue;
        }
      }

      const decision = await assignP2POrder(orderId);

      if (decision.decision === 'assigned' || decision.decision === 'reassigned') {
        assigned += 1;
      } else if (decision.decision === 'shadow_only') {
        shadowOnly += 1;
      } else if (decision.decision === 'no_liquidity') {
        noEligibleMerchant += 1;
      }
    } catch (error) {
      failed += 1;
      await writeDeadLetter(orderId, 'assignment_rpc', error instanceof Error ? error.message : 'Assignment failed', {
        mode: settings.mode,
        percent: settings.percent,
      });
    }
  }

  return {
    ...settings,
    processed,
    assigned,
    shadowOnly,
    noEligibleMerchant,
    failed,
  };
}
