export function generateReferralCode(name: string, email: string): string {
  const base = `${name || email}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 8);

  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base || 'user'}-${suffix}`;
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getUserLevel(score: number): { label: string; tier: number } {
  if (score >= 1000) return { label: 'Elite', tier: 5 };
  if (score >= 500) return { label: 'Gold', tier: 4 };
  if (score >= 250) return { label: 'Silver', tier: 3 };
  if (score >= 100) return { label: 'Bronze', tier: 2 };
  return { label: 'Starter', tier: 1 };
}

