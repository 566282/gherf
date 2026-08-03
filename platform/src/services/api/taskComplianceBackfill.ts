import { supabase } from '@/services/supabase/client';

export interface BackfillResult {
  withdrawalReviewsCreated: number;
  verificationEventsCreated: number;
}

export async function runTaskComplianceBackfill(limit = 500): Promise<BackfillResult> {
  let withdrawalReviewsCreated = 0;
  let verificationEventsCreated = 0;

  const { data: withdrawals, error: withdrawalsError } = await supabase
    .from('withdrawal_requests')
    .select('id,user_id,status,amount,currency,created_at,compliance_review_id')
    .is('compliance_review_id', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (withdrawalsError) throw withdrawalsError;

  if (Array.isArray(withdrawals) && withdrawals.length) {
    for (const row of withdrawals as Array<Record<string, unknown>>) {
      const state = String(row.status) === 'held' ? 'held_compliance' : 'approved';
      const { data: reviewRow, error: reviewError } = await supabase
        .from('withdrawal_compliance_reviews')
        .insert({
          withdrawal_request_id: String(row.id),
          user_id: String(row.user_id),
          policy_key: 'task_compliance_policy',
          policy_version: 'v1-baseline',
          state,
          risk_score: state === 'held_compliance' ? 70 : 20,
          summary: {
            source: 'phase10_backfill',
            originalStatus: row.status,
          },
          decided_at: new Date().toISOString(),
        })
        .select('id')
        .single<{ id: string }>();

      if (reviewError || !reviewRow) throw reviewError ?? new Error('Unable to insert backfill review row.');

      const { error: withdrawalUpdateError } = await supabase
        .from('withdrawal_requests')
        .update({
          compliance_review_id: reviewRow.id,
          compliance_state: state,
        })
        .eq('id', String(row.id));

      if (withdrawalUpdateError) throw withdrawalUpdateError;

      withdrawalReviewsCreated += 1;
    }
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from('task_submissions')
    .select('id,user_id,task_id,status,created_at')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (submissionsError) throw submissionsError;

  if (Array.isArray(submissions) && submissions.length) {
    for (const row of submissions as Array<Record<string, unknown>>) {
      const submissionId = String(row.id);
      const { data: existingEvent, error: existingEventError } = await supabase
        .from('task_verification_events')
        .select('id')
        .eq('submission_id', submissionId)
        .maybeSingle();

      if (existingEventError) throw existingEventError;
      if (existingEvent) continue;

      const submissionStatus = String(row.status ?? 'pending');
      const verificationState =
        submissionStatus === 'approved'
          ? 'approved'
          : submissionStatus === 'rejected'
            ? 'rejected'
            : 'review_required';

      const { error: insertEventError } = await supabase.from('task_verification_events').insert({
        user_id: String(row.user_id),
        task_id: String(row.task_id),
        submission_id: submissionId,
        verification_method: 'manual_review',
        verification_state: verificationState,
        confidence_score: verificationState === 'approved' ? 82 : verificationState === 'rejected' ? 25 : 50,
        risk_score: verificationState === 'rejected' ? 78 : 35,
        requires_manual_review: verificationState === 'review_required',
        raw_result: {
          source: 'phase10_backfill',
          submissionStatus,
        },
      });

      if (insertEventError) throw insertEventError;
      verificationEventsCreated += 1;
    }
  }

  return {
    withdrawalReviewsCreated,
    verificationEventsCreated,
  };
}
