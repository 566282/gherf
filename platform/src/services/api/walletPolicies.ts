import type { WalletAccountType } from '@/types';

export interface WalletOperationalRule {
  walletType: WalletAccountType;
  label: string;
  withdrawable: boolean;
  allowedTransferTargets: WalletAccountType[];
  description: string;
}

export const walletOperationalRules: Record<WalletAccountType, WalletOperationalRule> = {
  main: {
    walletType: 'main',
    label: 'Main Wallet',
    withdrawable: true,
    allowedTransferTargets: [],
    description: 'Primary withdrawable balance used for payouts and cash-outs.',
  },
  bonus: {
    walletType: 'bonus',
    label: 'Bonus Wallet',
    withdrawable: false,
    allowedTransferTargets: ['main'],
    description: 'Promotional credits that must be consolidated into the main wallet before withdrawal.',
  },
  referral: {
    walletType: 'referral',
    label: 'Referral Wallet',
    withdrawable: false,
    allowedTransferTargets: ['main'],
    description: 'Referral earnings that can be moved into the main wallet for payout.',
  },
  cashback: {
    walletType: 'cashback',
    label: 'Cashback Wallet',
    withdrawable: false,
    allowedTransferTargets: ['main'],
    description: 'Cashback rewards that settle into the main wallet.',
  },
  reward: {
    walletType: 'reward',
    label: 'Reward Wallet',
    withdrawable: false,
    allowedTransferTargets: ['main'],
    description: 'Task and achievement rewards that can be claimed into the main wallet.',
  },
};

export const walletTransferSources: WalletAccountType[] = ['bonus', 'referral', 'cashback', 'reward'];

export function canWithdrawFromWallet(walletType: WalletAccountType): boolean {
  return walletOperationalRules[walletType].withdrawable;
}

export function canTransferFromWallet(walletType: WalletAccountType): boolean {
  return walletTransferSources.includes(walletType);
}

export function getAllowedTransferTargets(walletType: WalletAccountType): WalletAccountType[] {
  return walletOperationalRules[walletType].allowedTransferTargets;
}

export function isWalletTransferAllowed(fromWalletType: WalletAccountType, toWalletType: WalletAccountType): boolean {
  return fromWalletType !== toWalletType && walletOperationalRules[fromWalletType].allowedTransferTargets.includes(toWalletType);
}
