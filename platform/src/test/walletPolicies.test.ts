import { describe, expect, it } from 'vitest';
import {
  canTransferFromWallet,
  canWithdrawFromWallet,
  getAllowedTransferTargets,
  isWalletTransferAllowed,
  walletOperationalRules,
  walletTransferSources,
} from '@/services/api/walletPolicies';

describe('wallet policy rules', () => {
  it('keeps the main wallet as the only withdrawable wallet', () => {
    expect(canWithdrawFromWallet('main')).toBe(true);
    expect(canWithdrawFromWallet('bonus')).toBe(false);
    expect(canWithdrawFromWallet('referral')).toBe(false);
    expect(canWithdrawFromWallet('cashback')).toBe(false);
    expect(canWithdrawFromWallet('reward')).toBe(false);
  });

  it('allows only reward-style wallets to transfer into the main wallet', () => {
    expect(walletTransferSources).toEqual(['bonus', 'referral', 'cashback', 'reward']);

    expect(canTransferFromWallet('main')).toBe(false);
    expect(canTransferFromWallet('bonus')).toBe(true);
    expect(canTransferFromWallet('referral')).toBe(true);
    expect(canTransferFromWallet('cashback')).toBe(true);
    expect(canTransferFromWallet('reward')).toBe(true);

    expect(getAllowedTransferTargets('bonus')).toEqual(['main']);
    expect(getAllowedTransferTargets('reward')).toEqual(['main']);
    expect(isWalletTransferAllowed('bonus', 'main')).toBe(true);
    expect(isWalletTransferAllowed('main', 'reward')).toBe(false);
    expect(isWalletTransferAllowed('reward', 'cashback')).toBe(false);
  });

  it('documents each wallet bucket with a stable rule description', () => {
    expect(walletOperationalRules.main.withdrawable).toBe(true);
    expect(walletOperationalRules.reward.description).toContain('claimed into the main wallet');
    expect(walletOperationalRules.cashback.allowedTransferTargets).toEqual(['main']);
  });
});
