import { describe, expect, it } from 'vitest';
import { buildDefaultGamificationConfig, buildDefaultGamificationState, gamificationModules, resolveDailyTaskPlanForLevel } from '@/services/api/gamification';

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

  it('builds a deterministic player state seed', () => {
    const state = buildDefaultGamificationState({ xp: 1440, streak: 9 });

    expect(state.xp).toBe(1440);
    expect(state.streak).toBe(9);
    expect(state.dailyClaimed).toBe(false);
    expect(state.quests).toHaveLength(3);
    expect(state.achievements).toHaveLength(4);
  });

  it('tunes the daily task plan for upgraded member tiers', () => {
    const config = buildDefaultGamificationConfig();
    const resolved = resolveDailyTaskPlanForLevel(config.dailyTaskPlan, 2);

    expect(resolved.mode).toBe(config.dailyTaskPlan.mode);
    expect(resolved.xpReward).toBeGreaterThan(config.dailyTaskPlan.xpReward);
    expect(resolved.cooldownHours).toBeLessThanOrEqual(config.dailyTaskPlan.cooldownHours);
    expect(resolved.title).toContain('balanced');
  });
});