import { supabase } from '@/services/supabase/client';
import { notifySuperAdmins, sendUserNotification } from '@/services/api/communications';
import { canTransferFromWallet, isWalletTransferAllowed } from '@/services/api/walletPolicies';
import type {
  WalletAccount,
  WalletAccountType,
  WalletAuditLog,
  WalletApprovalWorkflow,
  WalletSettings,
  WalletTransaction,
  WalletWithdrawalMethod,
  WalletTransfer,
  WithdrawalRequest,
  WithdrawalRequestInput,
} from '@/types';

type SettingRow = {
  key: string;
  value: unknown;
};

type ProfileBalanceRow = {
  wallet_balance: number | null;
  full_name?: string | null;
  email?: string | null;
  level_tier?: number | null;
  level_label?: string | null;
};

type WalletAccountRow = {
  id: string;
  user_id: string;
  wallet_type: WalletAccountType;
  currency: string;
  available_balance: number | string;
  pending_balance: number | string;
  locked_balance: number | string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type WalletTransferRow = {
  id: string;
  user_id: string;
  from_wallet_account_id: string;
  to_wallet_account_id: string;
  amount: number | string;
  currency: string;
  status: WalletTransfer['status'];
  transfer_category: WalletTransfer['transferCategory'];
  note: string | null;
  reference_transaction_id: string | null;
  created_at: string;
  updated_at: string;
};

type WalletAuditRow = {
  id: string;
  user_id: string;
  entry_type: WalletAuditLog['entryType'];
  event_type: string;
  wallet_type: WalletAccountType | null;
  amount: number | string;
  currency: string;
  balance_after: number | string | null;
  status: string | null;
  note: string | null;
  reference_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type WithdrawalRequestRow = {
  id: string;
  user_id: string;
  wallet_transaction_id: string | null;
  method: WalletWithdrawalMethod;
  destination_label: string;
  destination_value: string | null;
  destination_currency: string | null;
  currency: string;
  amount: number | string;
  processing_fee: number | string;
  exchange_rate: number | string;
  net_amount: number | string;
  approval_workflow: WalletApprovalWorkflow;
  status: WithdrawalRequest['status'];
  scheduled_for: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

const SUCCESSFUL_WITHDRAWAL_STATUSES: WithdrawalRequest['status'][] = ['approved', 'completed'];

function getWithdrawalHoldThreshold(_levelTier: number): number {
  return 4;
}

function getMemberPlanLabel(levelTier: number, levelLabel?: string | null): string {
  if (levelLabel?.trim()) {
    return levelLabel.trim();
  }

  if (levelTier >= 3) {
    return 'Premium';
  }

  if (levelTier >= 2) {
    return 'Balanced';
  }

  return 'Starter';
}

async function countSuccessfulWithdrawals(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('status')
    .eq('user_id', userId)
    .in('status', SUCCESSFUL_WITHDRAWAL_STATUSES);

  if (error || !data) {
    return 0;
  }

  return data.length;
}

export async function releaseWithdrawalHolds(userId: string, levelTier: number): Promise<number> {
  if (Math.max(1, Math.floor(levelTier || 1)) < 2) {
    return 0;
  }

  const { data, error } = await supabase.rpc('release_user_withdrawal_holds', {
    p_user_id: userId,
  });

  if (error) throw error;

  const releasedCount = typeof data === 'number' ? data : Number((data as Record<string, unknown> | null)?.released_count ?? 0);

  if (releasedCount > 0) {
    void sendUserNotification(userId, {
      title: 'Withdrawal hold released',
      message: `Your upgraded member plan released ${releasedCount} held withdrawal request${releasedCount === 1 ? '' : 's'}. New withdrawals can now be submitted normally.`,
      type: 'success',
      category: 'transactional',
      metadata: {
        releasedCount,
        levelTier,
      },
    }).catch(() => undefined);
  }

  return releasedCount;
}

const DEFAULT_WALLET_SETTINGS: WalletSettings = {
  minWithdrawal: 25,
  maxWithdrawal: 5000,
  processingFeePercent: 1.5,
  currency: 'USD',
  approvalWorkflow: 'manual',
  exchangeRates: [
    { currency: 'USD', rate: 1, label: 'US Dollar' },
    { currency: 'EUR', rate: 0.92, label: 'Euro' },
    { currency: 'GBP', rate: 0.79, label: 'British Pound' },
    { currency: 'NGN', rate: 1500, label: 'Nigerian Naira' },
    { currency: 'USDT', rate: 1, label: 'Tether' },
  ],
  supportedMethods: ['bank_transfer', 'crypto', 'paypal', 'gift_cards', 'manual_payout'],
};

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }

  return fallback;
}

function toExchangeRates(value: unknown): WalletSettings['exchangeRates'] {
  if (!Array.isArray(value)) {
    return DEFAULT_WALLET_SETTINGS.exchangeRates;
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const candidate = item as Record<string, unknown>;
      const currency = typeof candidate.currency === 'string' ? candidate.currency : '';

      if (!currency) return null;

      return {
        currency,
        rate: toNumber(candidate.rate, 1),
        label: typeof candidate.label === 'string' ? candidate.label : undefined,
        updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined,
      };
    })
    .filter((item): item is WalletSettings['exchangeRates'][number] => item !== null);
}

function mergeWalletSettings(rows: SettingRow[]): WalletSettings {
  const lookup = new Map(rows.map((row) => [row.key, row.value]));

  return {
    minWithdrawal: toNumber(lookup.get('wallet_min_withdrawal'), DEFAULT_WALLET_SETTINGS.minWithdrawal),
    maxWithdrawal: toNumber(lookup.get('wallet_max_withdrawal'), DEFAULT_WALLET_SETTINGS.maxWithdrawal),
    processingFeePercent: toNumber(
      lookup.get('wallet_processing_fee_percent'),
      DEFAULT_WALLET_SETTINGS.processingFeePercent,
    ),
    currency: typeof lookup.get('wallet_currency') === 'string' ? String(lookup.get('wallet_currency')) : DEFAULT_WALLET_SETTINGS.currency,
    approvalWorkflow:
      lookup.get('wallet_approval_workflow') === 'automatic' ||
      lookup.get('wallet_approval_workflow') === 'manual' ||
      lookup.get('wallet_approval_workflow') === 'hybrid'
        ? (lookup.get('wallet_approval_workflow') as WalletApprovalWorkflow)
        : DEFAULT_WALLET_SETTINGS.approvalWorkflow,
    exchangeRates: toExchangeRates(lookup.get('wallet_exchange_rates')),
    supportedMethods: toStringArray(lookup.get('wallet_supported_methods'), DEFAULT_WALLET_SETTINGS.supportedMethods) as WalletWithdrawalMethod[],
  };
}

function mapWithdrawalRequest(row: WithdrawalRequestRow): WithdrawalRequest {
  return {
    id: row.id,
    userId: row.user_id,
    walletTransactionId: row.wallet_transaction_id,
    method: row.method,
    destinationLabel: row.destination_label,
    destinationValue: row.destination_value,
    destinationCurrency: row.destination_currency ?? row.currency,
    currency: row.currency,
    amount: Number(row.amount),
    processingFee: Number(row.processing_fee),
    exchangeRate: Number(row.exchange_rate),
    netAmount: Number(row.net_amount),
    approvalWorkflow: row.approval_workflow,
    status: row.status,
    scheduledFor: row.scheduled_for,
    adminNotes: row.admin_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWalletAccount(row: WalletAccountRow): WalletAccount {
  return {
    id: row.id,
    userId: row.user_id,
    walletType: row.wallet_type,
    currency: row.currency,
    availableBalance: Number(row.available_balance),
    pendingBalance: Number(row.pending_balance),
    lockedBalance: Number(row.locked_balance),
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWalletTransfer(row: WalletTransferRow): WalletTransfer {
  return {
    id: row.id,
    userId: row.user_id,
    fromWalletAccountId: row.from_wallet_account_id,
    toWalletAccountId: row.to_wallet_account_id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    transferCategory: row.transfer_category,
    note: row.note,
    referenceTransactionId: row.reference_transaction_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWalletAuditLog(row: WalletAuditRow): WalletAuditLog {
  return {
    id: row.id,
    userId: row.user_id,
    entryType: row.entry_type,
    eventType: row.event_type,
    walletType: row.wallet_type,
    amount: Number(row.amount),
    currency: row.currency,
    balanceAfter: row.balance_after === null ? null : Number(row.balance_after),
    status: row.status,
    note: row.note,
    referenceId: row.reference_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

function resolveExchangeRate(settings: WalletSettings, targetCurrency: string): number {
  const directRate = settings.exchangeRates.find((rate) => rate.currency.toUpperCase() === targetCurrency.toUpperCase());
  return directRate?.rate ?? 1;
}

export async function listWalletSettings(): Promise<WalletSettings> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key,value')
    .in('key', [
      'wallet_min_withdrawal',
      'wallet_max_withdrawal',
      'wallet_processing_fee_percent',
      'wallet_currency',
      'wallet_approval_workflow',
      'wallet_exchange_rates',
      'wallet_supported_methods',
    ]);

  if (error || !data) {
    return DEFAULT_WALLET_SETTINGS;
  }

  return mergeWalletSettings(data as SettingRow[]);
}

export async function listWalletAccounts(userId?: string): Promise<WalletAccount[]> {
  let query = supabase
    .from('wallet_accounts')
    .select('id,user_id,wallet_type,currency,available_balance,pending_balance,locked_balance,metadata,created_at,updated_at')
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => mapWalletAccount(row as WalletAccountRow));
}

export async function listWalletTransfers(userId?: string, limit = 20): Promise<WalletTransfer[]> {
  let query = supabase
    .from('wallet_transfers')
    .select('id,user_id,from_wallet_account_id,to_wallet_account_id,amount,currency,status,transfer_category,note,reference_transaction_id,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => mapWalletTransfer(row as WalletTransferRow));
}

export async function listWalletAuditLogs(userId?: string, limit = 30): Promise<WalletAuditLog[]> {
  let query = supabase
    .from('wallet_audit_logs')
    .select('id,user_id,entry_type,event_type,wallet_type,amount,currency,balance_after,status,note,reference_id,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => mapWalletAuditLog(row as WalletAuditRow));
}

export async function updateWalletSettings(settings: Partial<WalletSettings>): Promise<void> {
  const rows = [
    { key: 'wallet_min_withdrawal', value: settings.minWithdrawal, description: 'Minimum withdrawal amount' },
    { key: 'wallet_max_withdrawal', value: settings.maxWithdrawal, description: 'Maximum withdrawal amount' },
    {
      key: 'wallet_processing_fee_percent',
      value: settings.processingFeePercent,
      description: 'Processing fee percentage applied to withdrawals',
    },
    { key: 'wallet_currency', value: settings.currency, description: 'Base wallet currency' },
    { key: 'wallet_approval_workflow', value: settings.approvalWorkflow, description: 'Withdrawal approval workflow' },
    { key: 'wallet_exchange_rates', value: settings.exchangeRates, description: 'Configured conversion rates' },
    { key: 'wallet_supported_methods', value: settings.supportedMethods, description: 'Supported payout methods' },
  ].filter((row) => row.value !== undefined);

  const { error } = await supabase.from('platform_settings').upsert(rows, { onConflict: 'key' });
  if (error) throw error;
}

export async function applyWalletAdjustment(
  userId: string,
  walletType: WalletAccountType,
  amount: number,
  reason?: string,
  currency = 'USD',
): Promise<void> {
  const { error } = await supabase.rpc('record_wallet_adjustment', {
    p_user_id: userId,
    p_wallet_type: walletType,
    p_amount: amount,
    p_currency: currency,
    p_transaction_type: amount >= 0 ? 'deposit' : 'admin_adjustment',
    p_reason: reason ?? null,
    p_performed_by: null,
  });

  if (error) throw error;
}

export async function reconcileWalletBalances(userId?: string): Promise<{ reconciledCount: number; adjustedCount: number; userId: string | null }> {
  const { data, error } = await supabase.rpc('reconcile_wallet_accounts', {
    p_user_id: userId ?? null,
  });

  if (error) throw error;

  return {
    reconciledCount: Number((data as Record<string, unknown> | null)?.reconciled_count ?? 0),
    adjustedCount: Number((data as Record<string, unknown> | null)?.adjusted_count ?? 0),
    userId: (data as Record<string, unknown> | null)?.user_id ? String((data as Record<string, unknown>).user_id) : null,
  };
}

export async function transferWalletBalance(
  userId: string,
  fromWalletType: WalletAccountType,
  toWalletType: WalletAccountType,
  amount: number,
  note?: string,
  currency = 'USD',
): Promise<void> {
  if (!canTransferFromWallet(fromWalletType) || !isWalletTransferAllowed(fromWalletType, toWalletType)) {
    throw new Error('Transfers are only allowed from bonus, referral, cashback, or reward wallets into the main wallet.');
  }

  const { error } = await supabase.rpc('transfer_wallet_balance', {
    p_user_id: userId,
    p_from_wallet_type: fromWalletType,
    p_to_wallet_type: toWalletType,
    p_amount: amount,
    p_currency: currency,
    p_note: note ?? null,
  });

  if (error) throw error;
}

export async function listWalletTransactions(userId?: string, limit = 12): Promise<WalletTransaction[]> {
  let query = supabase
    .from('wallet_transactions')
    .select('id,user_id,transaction_type,amount,balance_after,currency,status,wallet_type,counterparty_wallet_type,transfer_id,method,reference_id,note,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    userId: row.user_id,
    transactionType: row.transaction_type,
    amount: Number(row.amount),
    balanceAfter: Number(row.balance_after),
    currency: row.currency,
    status: row.status,
    walletType: row.wallet_type ?? null,
    counterpartyWalletType: row.counterparty_wallet_type ?? null,
    transferId: row.transfer_id ?? null,
    method: row.method,
    referenceId: row.reference_id,
    note: row.note,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

export async function listWithdrawalRequests(userId?: string, limit = 12): Promise<WithdrawalRequest[]> {
  let query = supabase
    .from('withdrawal_requests')
    .select(
      'id,user_id,wallet_transaction_id,method,destination_label,destination_value,destination_currency,currency,amount,processing_fee,exchange_rate,net_amount,approval_workflow,status,scheduled_for,admin_notes,reviewed_by,reviewed_at,created_at,updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => mapWithdrawalRequest(row as WithdrawalRequestRow));
}

export async function listPendingWithdrawalRequests(limit = 12): Promise<WithdrawalRequest[]> {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select(
      'id,user_id,wallet_transaction_id,method,destination_label,destination_value,destination_currency,currency,amount,processing_fee,exchange_rate,net_amount,approval_workflow,status,scheduled_for,admin_notes,reviewed_by,reviewed_at,created_at,updated_at',
    )
    .in('status', ['pending', 'held'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => mapWithdrawalRequest(row as WithdrawalRequestRow));
}

export async function createWithdrawalRequest(userId: string, input: WithdrawalRequestInput): Promise<WithdrawalRequest> {
  const settings = await listWalletSettings();

  if (input.amount < settings.minWithdrawal) {
    throw new Error(`Minimum withdrawal is ${settings.minWithdrawal} ${settings.currency}`);
  }

  if (input.amount > settings.maxWithdrawal) {
    throw new Error(`Maximum withdrawal is ${settings.maxWithdrawal} ${settings.currency}`);
  }

  const scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;
  if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
    throw new Error('Withdrawal date must be valid.');
  }

  if (scheduledFor) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduledDay = new Date(scheduledFor);
    scheduledDay.setHours(0, 0, 0, 0);

    if (scheduledDay.getTime() < today.getTime()) {
      throw new Error('Withdrawal date must be today or later.');
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('wallet_balance,full_name,email,level_tier,level_label')
    .eq('id', userId)
    .single<ProfileBalanceRow>();

  if (profileError) throw profileError;

  const currentBalance = profile.wallet_balance ?? 0;
  const effectiveWithdrawalLimit = Math.min(settings.maxWithdrawal, currentBalance);
  const memberPlanTier = Math.max(1, Math.round(profile.level_tier ?? 1));
  const memberPlanLabel = getMemberPlanLabel(memberPlanTier, profile.level_label);
  const successfulWithdrawalCount = await countSuccessfulWithdrawals(userId);
  const holdThreshold = getWithdrawalHoldThreshold(memberPlanTier);
  const isAccountOnHold = memberPlanTier < 2 && successfulWithdrawalCount >= holdThreshold;

  if (input.amount > currentBalance) {
    throw new Error('Withdrawal amount exceeds your withdrawable balance.');
  }

  const processingFee = Number(((input.amount * settings.processingFeePercent) / 100).toFixed(2));
  const netAmount = Number((input.amount - processingFee).toFixed(2));
  const destinationCurrency = input.destinationCurrency || settings.currency;
  const exchangeRate = resolveExchangeRate(settings, destinationCurrency);
  const approvalWorkflow = settings.approvalWorkflow;
  const isAutoApproved = approvalWorkflow === 'automatic';
  const status: WithdrawalRequest['status'] = isAccountOnHold ? 'held' : isAutoApproved ? 'approved' : 'pending';
  const transactionStatus = isAccountOnHold ? 'reserved' : isAutoApproved ? 'completed' : 'pending';
  const nextBalance = Number((currentBalance - input.amount).toFixed(2));
  let transactionId: string | null = null;
  const withdrawalDate = scheduledFor ?? new Date();
  const withdrawalDateLabel = withdrawalDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const displayName = profile.full_name?.trim() || profile.email?.trim() || userId;

  const { error: balanceError } = await supabase.from('profiles').update({ wallet_balance: nextBalance }).eq('id', userId);
  if (balanceError) throw balanceError;

  try {
    const { data: transaction, error: transactionError } = await supabase
      .from('wallet_transactions')
      .insert({
        user_id: userId,
        transaction_type: 'withdrawal_request',
        amount: -input.amount,
        balance_after: nextBalance,
        currency: settings.currency,
        status: transactionStatus,
        method: input.method,
        note: input.note ?? input.destinationLabel,
        metadata: {
          destinationLabel: input.destinationLabel,
          destinationValue: input.destinationValue,
          destinationCurrency,
          processingFee,
          netAmount,
          approvalWorkflow,
          autoApproved: isAutoApproved,
        },
      })
      .select('id')
      .single<{ id: string }>();

    if (transactionError || !transaction) {
      throw transactionError ?? new Error('Unable to record withdrawal transaction.');
    }

    transactionId = transaction.id;

    const { data: request, error: requestError } = await supabase
      .from('withdrawal_requests')
      .insert({
        user_id: userId,
        wallet_transaction_id: transaction.id,
        method: input.method,
        destination_label: input.destinationLabel,
        destination_value: input.destinationValue,
        destination_currency: destinationCurrency,
        currency: settings.currency,
        amount: input.amount,
        processing_fee: processingFee,
        exchange_rate: exchangeRate,
        net_amount: netAmount,
        approval_workflow: approvalWorkflow,
        scheduled_for: scheduledFor ? scheduledFor.toISOString() : null,
        status,
        admin_notes: input.note ?? null,
        hold_reason: isAccountOnHold ? 'member_plan_limit_reached' : null,
        hold_metadata: isAccountOnHold
          ? {
              successfulWithdrawalCount,
              holdThreshold,
              memberPlanTier,
              memberPlanLabel,
              requiredLevelTier: 2,
            }
          : {},
        hold_released_at: null,
      })
      .select('id,user_id,wallet_transaction_id,method,destination_label,destination_value,destination_currency,currency,amount,processing_fee,exchange_rate,net_amount,approval_workflow,status,scheduled_for,admin_notes,reviewed_by,reviewed_at,created_at,updated_at')
      .single<WithdrawalRequestRow>();

    if (requestError || !request) {
      throw requestError ?? new Error('Unable to create withdrawal request.');
    }

    const requestLabel = isAccountOnHold ? 'held' : isAutoApproved ? 'approved' : 'pending';

    void Promise.all([
      notifySuperAdmins({
        title: isAccountOnHold ? 'Withdrawal placed on hold' : isAutoApproved ? 'Withdrawal auto-approved' : 'Withdrawal request submitted',
        message: isAccountOnHold
          ? `${displayName} reached ${successfulWithdrawalCount} successful withdrawals on the ${memberPlanLabel} plan, so the new withdrawal has been placed on hold for ${settings.currency} ${input.amount.toFixed(2)} until the user upgrades.`
          : `${displayName} ${isAutoApproved ? 'received an auto-approved withdrawal' : 'submitted a withdrawal request'} for ${settings.currency} ${input.amount.toFixed(2)} on ${withdrawalDateLabel}.`,
        type: 'info',
        category: 'transactional',
        metadata: {
          userId,
          userName: displayName,
          amount: input.amount,
          currency: settings.currency,
          effectiveWithdrawalLimit,
          scheduledFor: scheduledFor ? scheduledFor.toISOString() : null,
          withdrawalRequestId: request.id,
          successfulWithdrawalCount,
          holdThreshold,
          memberPlanTier,
          memberPlanLabel,
        },
      }),
      sendUserNotification(userId, {
        title: isAccountOnHold ? 'Withdrawal on hold' : `Withdrawal ${requestLabel}`,
        message: isAccountOnHold
          ? `Your ${memberPlanLabel} plan has reached the withdrawal limit of ${holdThreshold} successful withdrawal${holdThreshold === 1 ? '' : 's'}. This request is on hold until you upgrade your plan.`
          : isAutoApproved
          ? `Your ${settings.currency} ${input.amount.toFixed(2)} withdrawal is within your limit of ${settings.currency} ${effectiveWithdrawalLimit.toFixed(2)} and has been approved for ${withdrawalDateLabel}.`
          : `Withdrawals are not allowed until ${withdrawalDateLabel}. Your ${settings.currency} ${input.amount.toFixed(2)} request is within your limit of ${settings.currency} ${effectiveWithdrawalLimit.toFixed(2)} and will remain pending until that fixed date.`,
        type: isAccountOnHold ? 'warning' : isAutoApproved ? 'success' : 'info',
        category: 'transactional',
        metadata: {
          withdrawalRequestId: request.id,
          amount: input.amount,
          currency: settings.currency,
          effectiveWithdrawalLimit,
          scheduledFor: scheduledFor ? scheduledFor.toISOString() : null,
          successfulWithdrawalCount,
          holdThreshold,
          memberPlanTier,
          memberPlanLabel,
        },
      }),
    ]).catch(() => undefined);

    return mapWithdrawalRequest(request);
  } catch (error) {
    if (transactionId) {
      await supabase.from('wallet_transactions').delete().eq('id', transactionId);
    }

    await supabase.from('profiles').update({ wallet_balance: currentBalance }).eq('id', userId);
    throw error;
  }
}

export async function resolveWithdrawalRequest(
  requestId: string,
  status: 'approved' | 'rejected',
  reviewerId: string,
  adminNotes?: string,
): Promise<void> {
  const { data: request, error: requestError } = await supabase
    .from('withdrawal_requests')
    .select(
      'id,user_id,wallet_transaction_id,method,destination_label,destination_value,destination_currency,currency,amount,processing_fee,exchange_rate,net_amount,approval_workflow,status,scheduled_for,admin_notes,reviewed_by,reviewed_at,created_at,updated_at',
    )
    .eq('id', requestId)
    .single<WithdrawalRequestRow>();

  if (requestError) throw requestError;

  if (status === 'approved') {
    const { error } = await supabase
      .from('withdrawal_requests')
      .update({
        status: 'approved',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        admin_notes: adminNotes ?? request.admin_notes,
      })
      .eq('id', requestId);

    if (error) throw error;

    void sendUserNotification(request.user_id, {
      title: 'Withdrawal approved',
      message: `Your withdrawal request for ${request.currency} ${Number(request.amount).toFixed(2)} has been approved and is scheduled for ${request.scheduled_for ? new Date(request.scheduled_for).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'processing'}.`,
      type: 'success',
      category: 'transactional',
      metadata: {
        withdrawalRequestId: request.id,
        scheduledFor: request.scheduled_for,
        approvedBy: reviewerId,
      },
    }).catch(() => undefined);

    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('wallet_balance')
    .eq('id', request.user_id)
    .single<ProfileBalanceRow>();

  if (profileError) throw profileError;

  const restoredBalance = Number(((profile.wallet_balance ?? 0) + Number(request.amount)).toFixed(2));

  const { error: restoreError } = await supabase.from('profiles').update({ wallet_balance: restoredBalance }).eq('id', request.user_id);
  if (restoreError) throw restoreError;

  const { error: updateError } = await supabase
    .from('withdrawal_requests')
    .update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      admin_notes: adminNotes ?? request.admin_notes,
    })
    .eq('id', requestId);

  if (updateError) throw updateError;

  void sendUserNotification(request.user_id, {
    title: 'Withdrawal rejected',
    message: `Your withdrawal request for ${request.currency} ${Number(request.amount).toFixed(2)} was rejected and your balance was restored.`,
    type: 'error',
    category: 'transactional',
    metadata: {
      withdrawalRequestId: request.id,
      scheduledFor: request.scheduled_for,
      reviewedBy: reviewerId,
    },
  }).catch(() => undefined);

  await supabase.from('wallet_ledger').insert({
    user_id: request.user_id,
    amount: Number(request.amount),
    balance_after: restoredBalance,
    reason: adminNotes ?? 'Withdrawal request rejected and balance restored',
    note: 'Withdrawal reversal',
  });

  await supabase.from('wallet_transactions').insert({
    user_id: request.user_id,
    transaction_type: 'withdrawal_reversal',
    amount: Number(request.amount),
    balance_after: restoredBalance,
    currency: request.currency,
    status: 'available',
    method: request.method,
    reference_id: request.id,
    note: adminNotes ?? 'Withdrawal rejected',
    metadata: {
      destinationLabel: request.destination_label,
      destinationCurrency: request.destination_currency,
    },
  });
}