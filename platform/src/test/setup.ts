import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Keep Supabase client construction deterministic in unit tests. Production and
// preview builds still receive the real values through Vite environment config.
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

afterEach(() => {
  cleanup();
});

expect.extend({});
