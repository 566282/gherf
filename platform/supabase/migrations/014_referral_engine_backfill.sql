-- 014_referral_engine_backfill.sql
-- Idempotent backfill for the new referral backend using existing profile referral codes.

DO $$
DECLARE
  default_program_id UUID;
BEGIN
  INSERT INTO referral_programs (
    slug,
    name,
    description,
    campaign_slug,
    status,
    invite_bonus_amount,
    tier_one_commission_percent,
    tier_two_commission_percent,
    qualification_window_days,
    payout_delay_days,
    max_tier_depth,
    milestone_config,
    leaderboard_config,
    fraud_config,
    analytics_config,
    metadata
  )
  VALUES (
    'default-referral-program',
    'Referral program',
    'Signup referrals, multi-level commissions, milestones, leaderboard ranking, and fraud controls.',
    'referral_campaigns',
    'active',
    4.00,
    8.00,
    3.00,
    14,
    7,
    2,
    '[{"key":"first_referral","label":"First referral","threshold":1,"rewardAmount":4},{"key":"ten_referrals","label":"Ten referrals","threshold":10,"rewardAmount":25},{"key":"fifty_referrals","label":"Fifty referrals","threshold":50,"rewardAmount":100}]'::jsonb,
    '{"period":"monthly","metric":"commission_total"}'::jsonb,
    '{"rules":["self_referral","duplicate_referral_attempt","invalid_referral_code"]}'::jsonb,
    '{"metrics":["referralsByDay","referralCommissions","fraudFlags"]}'::jsonb,
    '{"source":"migration_014_referral_engine_backfill"}'::jsonb
  )
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        campaign_slug = EXCLUDED.campaign_slug,
        status = EXCLUDED.status,
        invite_bonus_amount = EXCLUDED.invite_bonus_amount,
        tier_one_commission_percent = EXCLUDED.tier_one_commission_percent,
        tier_two_commission_percent = EXCLUDED.tier_two_commission_percent,
        qualification_window_days = EXCLUDED.qualification_window_days,
        payout_delay_days = EXCLUDED.payout_delay_days,
        max_tier_depth = EXCLUDED.max_tier_depth,
        milestone_config = EXCLUDED.milestone_config,
        leaderboard_config = EXCLUDED.leaderboard_config,
        fraud_config = EXCLUDED.fraud_config,
        analytics_config = EXCLUDED.analytics_config,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
  RETURNING id INTO default_program_id;

  IF default_program_id IS NULL THEN
    SELECT id INTO default_program_id FROM referral_programs WHERE slug = 'default-referral-program' LIMIT 1;
  END IF;

  INSERT INTO referral_attributions (
    program_id,
    referred_profile_id,
    referrer_profile_id,
    referral_code,
    source_campaign_slug,
    source_channel,
    qualification_status,
    fraud_status,
    is_duplicate_account,
    duplicate_signal,
    fraud_score,
    metadata
  )
  SELECT
    default_program_id,
    referred.id,
    referrer.id,
    referred.referred_by_code,
    'legacy_profile_backfill',
    'profile_seed',
    'qualified',
    'clear',
    FALSE,
    NULL,
    0,
    jsonb_build_object(
      'source', 'backfill',
      'referredByCode', referred.referred_by_code
    )
  FROM profiles referred
  INNER JOIN profiles referrer
    ON referrer.referral_code = referred.referred_by_code
  WHERE referred.referred_by_code IS NOT NULL
  ON CONFLICT (referred_profile_id) DO NOTHING;

  INSERT INTO referral_fraud_flags (
    program_id,
    profile_id,
    rule_key,
    severity,
    status,
    signal,
    metadata
  )
  SELECT
    default_program_id,
    referred.id,
    'invalid_referral_code',
    'medium',
    'open',
    'Backfill found a referral code without a matching referrer profile.',
    jsonb_build_object(
      'source', 'backfill',
      'referredByCode', referred.referred_by_code
    )
  FROM profiles referred
  LEFT JOIN profiles referrer
    ON referrer.referral_code = referred.referred_by_code
  WHERE referred.referred_by_code IS NOT NULL
    AND referrer.id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM referral_fraud_flags flags
      WHERE flags.program_id = default_program_id
        AND flags.profile_id = referred.id
        AND flags.rule_key = 'invalid_referral_code'
    );

  INSERT INTO referral_leaderboard_snapshots (
    program_id,
    profile_id,
    period_key,
    period_start,
    period_end,
    referral_count,
    commission_total,
    rank,
    metadata
  )
  SELECT
    default_program_id,
    attribution_counts.referrer_profile_id,
    TO_CHAR(CURRENT_DATE, 'YYYY-MM'),
    date_trunc('month', CURRENT_DATE)::DATE,
    (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE,
    attribution_counts.referral_count,
    0,
    RANK() OVER (ORDER BY attribution_counts.referral_count DESC, attribution_counts.referrer_profile_id ASC),
    jsonb_build_object('source', 'backfill')
  FROM (
    SELECT referrer_profile_id, COUNT(*) AS referral_count
    FROM referral_attributions
    WHERE program_id = default_program_id
    GROUP BY referrer_profile_id
  ) attribution_counts
  ON CONFLICT (program_id, profile_id, period_key) DO UPDATE
    SET referral_count = EXCLUDED.referral_count,
        commission_total = EXCLUDED.commission_total,
        rank = EXCLUDED.rank,
        updated_at = CURRENT_TIMESTAMP;
END;
$$;