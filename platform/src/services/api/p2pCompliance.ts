import { supabase } from '@/services/supabase/client';
import { sendUserNotification } from '@/services/api/communications';

export async function evaluateMerchantQualification(merchantId: string, triggeredBy?: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('evaluate_merchant_qualification', {
    p_merchant_id: merchantId,
    p_triggered_by: triggeredBy ?? null,
  });

  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? {};
}

export async function runP2PComplianceJob(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('run_p2p_compliance_job');
  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? {};
}

export async function runP2PLiquidityHealthJob(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('run_p2p_liquidity_health_job');
  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? {};
}

export async function runP2PMerchantAnalyticsJob(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('run_p2p_merchant_analytics_job');
  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? {};
}

export async function listP2PRiskSignals(limit = 100): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('p2p_risk_signals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load risk signals.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}

export async function listP2PFraudScores(limit = 100): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('p2p_fraud_scores')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load fraud scores.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}

export async function listP2PKycQueue(limit = 200): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('merchant_kyc_requirements')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load merchant KYC queue.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}

export async function listP2PAssignmentEvents(limit = 200): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('merchant_assignment_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load assignment events.');
  }

  return data.map((row) => ({ ...(row as Record<string, unknown>) }));
}

export async function processP2PNotificationEvents(limit = 25): Promise<number> {
  const { data, error } = await supabase
    .from('p2p_notification_events')
    .select('id,user_id,template_key,channel,payload')
    .eq('delivery_status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    throw error ?? new Error('Unable to load queued P2P notification events.');
  }

  let sentCount = 0;

  for (const row of data as Array<Record<string, unknown>>) {
    const eventId = String(row.id);
    const userId = row.user_id ? String(row.user_id) : null;
    const channel = String(row.channel ?? 'in_app');
    const payload = (row.payload as Record<string, unknown>) ?? {};
    const title = typeof payload.title === 'string' ? payload.title : 'P2P update';
    const message = typeof payload.message === 'string' ? payload.message : 'Your P2P order has a new update.';

    try {
      if (userId) {
        await sendUserNotification(userId, {
          title,
          message,
          type: 'info',
          category: 'transactional',
          channel: channel as 'in_app' | 'email' | 'push' | 'sms' | 'whatsapp' | 'telegram',
          templateKey: undefined,
          metadata: payload,
        });
      }

      const { error: markError } = await supabase
        .from('p2p_notification_events')
        .update({
          delivery_status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      if (markError) throw markError;
      sentCount += 1;
    } catch (sendError) {
      await supabase
        .from('p2p_notification_events')
        .update({
          delivery_status: 'failed',
          payload: {
            ...payload,
            lastError: sendError instanceof Error ? sendError.message : 'Failed to dispatch event',
          },
        })
        .eq('id', eventId);
    }
  }

  return sentCount;
}
