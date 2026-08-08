import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runExternalAmlScreening } from '@/services/api/p2pCompliance';

const supabaseState = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: supabaseState.from,
    rpc: supabaseState.rpc,
  },
}));

describe('p2p compliance risk trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    supabaseState.rpc.mockResolvedValue({ data: { ok: true }, error: null });

    supabaseState.from.mockImplementation((table: string) => {
      if (table === 'platform_settings') {
        return {
          select: () => ({
            in: vi.fn().mockResolvedValue({
              data: [
                { key: 'p2p_aml_provider_enabled', value: true },
                { key: 'p2p_aml_provider_name', value: 'mock-sanctions-grid' },
                { key: 'p2p_aml_provider_url', value: null },
                { key: 'p2p_aml_provider_mock_mode', value: true },
              ],
              error: null,
            }),
          }),
        };
      }

      if (table === 'merchant_profiles') {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'merchant-1',
                      user_id: 'u-1',
                      legal_name: 'Merchant One',
                      display_name: 'Merchant One',
                      country_code: 'NG',
                      risk_score: 65,
                      status: 'active',
                      metadata: {},
                    },
                    {
                      id: 'merchant-2',
                      user_id: 'u-2',
                      legal_name: 'Merchant Two',
                      display_name: 'Merchant Two',
                      country_code: 'NG',
                      risk_score: 12,
                      status: 'active',
                      metadata: {},
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'p2p_risk_signals') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('re-evaluates merchant qualification after persisting AML risk signals', async () => {
    const result = await runExternalAmlScreening(20);

    expect(result.ok).toBe(true);
    expect(result.screened).toBe(2);

    const qualificationCalls = supabaseState.rpc.mock.calls.filter(([name]) => name === 'evaluate_merchant_qualification');
    expect(qualificationCalls).toHaveLength(2);
  });
});
