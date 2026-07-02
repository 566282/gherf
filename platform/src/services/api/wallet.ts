import { supabase } from '@/services/supabase/client';
import type {
  WalletApprovalWorkflow,
  WalletSettings,
  WalletTransaction,
  WalletWithdrawalMethod,
  WithdrawalRequest,
  WithdrawalRequestInput,
} from '@/types';

type SettingRow = {
  key: string;
  value: unknown;
};

type ProfileBalanceRow = {
  wallet_balance: number | null;
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
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

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
    adminNotes: row.admin_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

export async function listWalletTransactions(userId?: string, limit = 12): Promise<WalletTransaction[]> {
  let query = supabase
    .from('wallet_transactions')
    .select('id,user_id,transaction_type,amount,balance_after,currency,status,method,reference_id,note,metadata,created_at')
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
      'id,user_id,wallet_transaction_id,method,destination_label,destination_value,destination_currency,currency,amount,processing_fee,exchange_rate,net_amount,approval_workflow,status,admin_notes,reviewed_by,reviewed_at,created_at,updated_at',
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
      'id,user_id,wallet_transaction_id,method,destination_label,destination_value,destination_currency,currency,amount,processing_fee,exchange_rate,net_amount,approval_workflow,status,admin_notes,reviewed_by,reviewed_at,created_at,updated_at',
    )
    .eq('status', 'pending')
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('wallet_balance')
    .eq('id', userId)
    .single<ProfileBalanceRow>();

  if (profileError) throw profileError;

  const currentBalance = profile.wallet_balance ?? 0;
  if (input.amount > currentBalance) {
    throw new Error('Withdrawal amount exceeds your withdrawable balance.');
  }

  const processingFee = Number(((input.amount * settings.processingFeePercent) / 100).toFixed(2));
  const netAmount = Number((input.amount - processingFee).toFixed(2));
  const destinationCurrency = input.destinationCurrency || settings.currency;
  const exchangeRate = resolveExchangeRate(settings, destinationCurrency);
  const approvalWorkflow = settings.approvalWorkflow;
  const isAutoApproved = approvalWorkflow === 'automatic';
  const status: WithdrawalRequest['status'] = isAutoApproved ? 'approved' : 'pending';
  const transactionStatus = isAutoApproved ? 'completed' : 'pending';
  const nextBalance = Number((currentBalance - input.amount).toFixed(2));
  let transactionId: string | null = null;

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
        status,
        admin_notes: input.note ?? null,
      })
      .select('id,user_id,wallet_transaction_id,method,destination_label,destination_value,destination_currency,currency,amount,processing_fee,exchange_rate,net_amount,approval_workflow,status,admin_notes,reviewed_by,reviewed_at,created_at,updated_at')
      .single<WithdrawalRequestRow>();

    if (requestError || !request) {
      throw requestError ?? new Error('Unable to create withdrawal request.');
    }

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
      'id,user_id,wallet_transaction_id,method,destination_label,destination_value,destination_currency,currency,amount,processing_fee,exchange_rate,net_amount,approval_workflow,status,admin_notes,reviewed_by,reviewed_at,created_at,updated_at',
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