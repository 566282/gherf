import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultCampaignForm, saveCampaign } from '@/services/api/campaigns';

const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/services/supabase/client';

const mockedSupabase = vi.mocked(supabase, true);

describe('campaign save validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ select: mockSelect });

    mockedSupabase.from.mockImplementation((table: string) => {
      if (table === 'campaigns') {
        return {
          insert: mockInsert,
          update: mockUpdate,
        };
      }

      return {} as never;
    });

    mockSingle.mockResolvedValue({
      data: {
        id: 'campaign-1',
        business_id: '11111111-2222-3333-4444-555555555555',
        title: 'Test campaign',
        description: null,
        banner_url: null,
        campaign_image_url: null,
        video_url: null,
        landing_url: null,
        campaign_type: 'custom_tasks',
        instructions: 'Do the work',
        engine_config: {},
        status: 'draft',
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        budget: 100,
        budget_currency: 'USD',
        total_rewards_allocated: 100,
        max_participants: 10,
        age_restriction_min: null,
        age_restriction_max: null,
        campaign_categories: [],
        recurring_config: null,
        current_participants: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });
  });

  it('normalizes and persists a UUID-based business selection', async () => {
    const form = createDefaultCampaignForm('custom_tasks');
    form.businessId = ' 11111111-2222-3333-4444-555555555555 ';

    await saveCampaign(form);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: '11111111-2222-3333-4444-555555555555',
      }),
    );
  });

  it('rejects an invalid business selection before writing', async () => {
    const form = createDefaultCampaignForm('custom_tasks');
    form.businessId = 'not-a-uuid';

    await expect(saveCampaign(form)).rejects.toThrow('A valid business selection is required.');
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
