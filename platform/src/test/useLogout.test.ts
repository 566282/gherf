import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useLogout } from '@/hooks/useLogout';

const navigateMock = vi.fn();
const signOutMock = vi.fn();
const clearSecuritySessionStateMock = vi.fn();
const logErrorMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/services/supabase', () => ({
  signOut: signOutMock,
}));

vi.mock('@/lib/security', () => ({
  clearSecuritySessionState: clearSecuritySessionStateMock,
}));

vi.mock('@/lib/logger', () => ({
  logError: logErrorMock,
}));

describe('useLogout', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signOutMock.mockReset();
    clearSecuritySessionStateMock.mockReset();
    logErrorMock.mockReset();
  });

  it('signs out, clears security state, and redirects home', async () => {
    signOutMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(clearSecuritySessionStateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/');
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it('logs failures without redirecting', async () => {
    signOutMock.mockRejectedValueOnce(new Error('logout failed'));

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(clearSecuritySessionStateMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});
