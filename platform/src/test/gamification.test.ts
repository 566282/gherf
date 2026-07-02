import { describe, expect, it } from 'vitest';
import { buildDefaultGamificationConfig, gamificationModules } from '@/services/api/gamification';

describe('gamification configuration', () => {
  it('includes every engagement module with safe defaults', () => {
    const config = buildDefaultGamificationConfig();

    expect(Object.keys(config.modules)).toHaveLength(gamificationModules.length);
    expect(config.xpPerLevel).toBeGreaterThanOrEqual(50);
    expect(config.maxDailyWheelSpins).toBeGreaterThanOrEqual(0);
    expect(config.dailyLoginBonus).toBeGreaterThanOrEqual(0);
    expect(config.streakBonusPerDay).toBeGreaterThanOrEqual(0);
    expect(config.spinBonusXp).toBeGreaterThanOrEqual(0);

    for (const module of gamificationModules) {
      expect(config.modules[module.id]).toBeDefined();
      expect(config.modules[module.id].rewardLabel).toBeTruthy();
      expect(config.modules[module.id].cadence).toBeTruthy();
    }
  });
});