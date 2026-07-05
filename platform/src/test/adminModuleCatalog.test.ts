import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateAdminModuleCatalog, type AdminModuleCatalogEntry } from '@/services/api/admin';

const supabaseState = vi.hoisted(() => ({
  upsert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: supabaseState.from,
  },
}));

describe('admin module catalog writes', () => {
  beforeEach(() => {
    const query = {
      select: supabaseState.select,
      eq: supabaseState.eq,
      single: supabaseState.single,
      upsert: supabaseState.upsert,
    };

    supabaseState.from.mockReturnValue(query);
    supabaseState.select.mockReturnValue(query);
    supabaseState.eq.mockReturnValue(query);
    supabaseState.single.mockResolvedValue({ data: null, error: null });
    supabaseState.upsert.mockResolvedValue({ error: null });
  });

  it('merges the updated module entry into the existing catalog payload', async () => {
    const entry: AdminModuleCatalogEntry = {
      records: [
        {
          id: 'ad-platform-1',
          name: 'Homepage hero takeover',
          category: 'Homepage',
          status: 'Live',
          owner: 'Media Ops',
          value: 'CTR 4.8%',
          updatedAt: '2026-07-04T12:00:00.000Z',
          risk: 'High',
          notes: 'Premium homepage unit with country, device, and age targeting.',
        },
      ],
      activity: [
        {
          title: 'Campaign optimization queued',
          description: 'Bid rules and audience splits were prepared for the next optimization cycle.',
          meta: 'Activity log',
        },
      ],
    };

    supabaseState.single.mockResolvedValueOnce({
      data: {
        value: {
          'dashboard-analytics': { records: [], activity: [] },
        },
      },
      error: null,
    });

    await updateAdminModuleCatalog('ad-platform', entry, 'admin-1');

    expect(supabaseState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'enterprise_admin_module_catalog',
        updated_by: 'admin-1',
        value: {
          'dashboard-analytics': { records: [], activity: [] },
          'ad-platform': entry,
        },
      }),
      { onConflict: 'key' },
    );
  });
});