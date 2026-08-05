import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPromotionalWheelSegments,
  clearPromotionalPopupDismissedState,
  defaultPromotionalSpinSettings,
  getOrCreateGuestSpinToken,
  markPromotionalPopupShown,
  promotionalWheelSegments,
  resolvePromotionalSurface,
  resolvePromotionalWheelSegmentId,
  shouldShowPromotionalPopup,
} from '@/services/api/promotionalRewards';

describe('promotional reward popup policy', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it('shows for eligible guest surface when enabled', () => {
    const settings = {
      ...defaultPromotionalSpinSettings,
      enabled: true,
      enabledStages: ['internal', 'beta', 'production'],
      rolloutStage: 'beta' as const,
      triggerSurfaces: ['home', 'signup'],
      showOncePerGuest: false,
      cooldownMinutes: 30,
    };

    expect(shouldShowPromotionalPopup(settings, 'home')).toBe(true);
    expect(shouldShowPromotionalPopup(settings, 'signup')).toBe(true);
    expect(shouldShowPromotionalPopup(settings, 'membership-plans')).toBe(false);
  });

  it('respects show-once and cooldown policy', () => {
    vi.setSystemTime(new Date('2026-08-04T08:00:00.000Z'));

    const settings = {
      ...defaultPromotionalSpinSettings,
      enabled: true,
      enabledStages: ['internal'],
      rolloutStage: 'internal' as const,
      triggerSurfaces: ['home'],
      showOncePerGuest: true,
      cooldownMinutes: 120,
    };

    expect(shouldShowPromotionalPopup(settings, 'home')).toBe(true);
    markPromotionalPopupShown(true);
    expect(shouldShowPromotionalPopup(settings, 'home')).toBe(false);

    clearPromotionalPopupDismissedState();
    expect(shouldShowPromotionalPopup(settings, 'home')).toBe(false);

    vi.setSystemTime(new Date('2026-08-04T10:10:00.000Z'));
    expect(shouldShowPromotionalPopup(settings, 'home')).toBe(true);
  });

  it('returns a stable guest token across calls', () => {
    const first = getOrCreateGuestSpinToken();
    const second = getOrCreateGuestSpinToken();

    expect(first).toBeTruthy();
    expect(first).toBe(second);
  });

  it('resolves supported promotional surfaces from public routes', () => {
    expect(resolvePromotionalSurface('/')).toBe('home');
    expect(resolvePromotionalSurface('/signup')).toBe('signup');
    expect(resolvePromotionalSurface('/membership-plans')).toBe('membership-plans');
    expect(resolvePromotionalSurface('/dashboard')).toBeNull();
  });

  it('maps server reward amounts to wheel segments consistently', () => {
    expect(resolvePromotionalWheelSegmentId(0)).toBe(promotionalWheelSegments[0].id);
    expect(resolvePromotionalWheelSegmentId(13)).toBe(promotionalWheelSegments[1].id);
    expect(resolvePromotionalWheelSegmentId('18')).toBe(promotionalWheelSegments[6].id);
    expect(resolvePromotionalWheelSegmentId(undefined)).toBe(promotionalWheelSegments[0].id);
  });

  it('builds wheel segments from admin-provided labels', () => {
    const custom = buildPromotionalWheelSegments(['USD 50', 'USD 20', 'USD 10']);

    expect(custom).toHaveLength(12);
    expect(custom[0].label).toBe('USD 50');
    expect(custom[1].label).toBe('USD 20');
    expect(custom[2].label).toBe('USD 10');
    expect(custom[11].label).toBe(promotionalWheelSegments[11].label);
  });

  it('maps reward amounts with custom wheel segment lists', () => {
    const custom = buildPromotionalWheelSegments(['A', 'B', 'C', 'D']);

    expect(resolvePromotionalWheelSegmentId(5, custom)).toBe(custom[5].id);
    expect(resolvePromotionalWheelSegmentId(15, custom)).toBe(custom[3].id);
  });
});
