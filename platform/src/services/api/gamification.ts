import { supabase } from '@/services/supabase/client';

export const gamificationModuleIds = [
  'dailyLogin',
  'streaks',
  'achievements',
  'xpLevels',
  'leaderboards',
  'luckyWheel',
  'mysteryRewards',
  'spinBonuses',
  'missions',
  'seasonalEvents',
  'dailyQuests',
] as const;

export type GamificationModuleId = (typeof gamificationModuleIds)[number];

export interface GamificationModuleDefinition {
  id: GamificationModuleId;
  title: string;
  description: string;
  defaultCadence: string;
  defaultRewardLabel: string;
  defaultXpReward: number;
}

export interface GamificationModuleConfig {
  enabled: boolean;
  cadence: string;
  rewardLabel: string;
  xpReward: number;
  note: string;
}

export interface GamificationConfig {
  seasonName: string;
  seasonTheme: string;
  seasonEndsOn: string;
  xpPerLevel: number;
  dailyResetHour: number;
  maxDailyWheelSpins: number;
  dailyLoginBonus: number;
  streakBonusPerDay: number;
  spinBonusXp: number;
  mysteryRewardPool: string[];
  modules: Record<GamificationModuleId, GamificationModuleConfig>;
}

const GAMIFICATION_SETTING_KEY = 'gamification_config';

export const gamificationModules: GamificationModuleDefinition[] = [
  {
    id: 'dailyLogin',
    title: 'Daily login',
    description: 'Reward the first app open of the day and keep sessions returning consistently.',
    defaultCadence: 'Daily',
    defaultRewardLabel: 'Daily bonus',
    defaultXpReward: 20,
  },
  {
    id: 'streaks',
    title: 'Streaks',
    description: 'Increase rewards and protection when users keep their streak alive.',
    defaultCadence: 'Rolling week',
    defaultRewardLabel: 'Streak bonus',
    defaultXpReward: 12,
  },
  {
    id: 'achievements',
    title: 'Achievements',
    description: 'Unlock milestones for behavior depth, consistency, and referral quality.',
    defaultCadence: 'Event driven',
    defaultRewardLabel: 'Milestone reward',
    defaultXpReward: 80,
  },
  {
    id: 'xpLevels',
    title: 'XP and levels',
    description: 'Convert every engagement action into a measurable progression track.',
    defaultCadence: 'Always on',
    defaultRewardLabel: 'Progress XP',
    defaultXpReward: 25,
  },
  {
    id: 'leaderboards',
    title: 'Leaderboards',
    description: 'Show top users by XP, streak, mission completion, and seasonal points.',
    defaultCadence: 'Weekly reset',
    defaultRewardLabel: 'Ranking boost',
    defaultXpReward: 30,
  },
  {
    id: 'luckyWheel',
    title: 'Lucky wheel',
    description: 'Offer chance-based bonuses with capped daily spins and controlled odds.',
    defaultCadence: 'Daily spins',
    defaultRewardLabel: 'Wheel spin',
    defaultXpReward: 10,
  },
  {
    id: 'mysteryRewards',
    title: 'Mystery rewards',
    description: 'Drop surprise rewards for surprise-and-delight loops and retention nudges.',
    defaultCadence: 'Triggered',
    defaultRewardLabel: 'Mystery gift',
    defaultXpReward: 45,
  },
  {
    id: 'spinBonuses',
    title: 'Spin bonuses',
    description: 'Award extra spins after achievements, referrals, and mission streaks.',
    defaultCadence: 'Triggered',
    defaultRewardLabel: 'Bonus spin',
    defaultXpReward: 18,
  },
  {
    id: 'missions',
    title: 'Missions',
    description: 'Bundle multi-step objectives around app usage, referrals, and campaign actions.',
    defaultCadence: 'Weekly',
    defaultRewardLabel: 'Mission reward',
    defaultXpReward: 60,
  },
  {
    id: 'seasonalEvents',
    title: 'Seasonal events',
    description: 'Run themed campaigns with countdown windows, boosted XP, and event prizes.',
    defaultCadence: 'Seasonal',
    defaultRewardLabel: 'Event prize',
    defaultXpReward: 100,
  },
  {
    id: 'dailyQuests',
    title: 'Daily quests',
    description: 'Give short, repeatable tasks that reset every day and keep engagement active.',
    defaultCadence: 'Daily reset',
    defaultRewardLabel: 'Quest reward',
    defaultXpReward: 15,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function buildDefaultModuleConfig(definition: GamificationModuleDefinition): GamificationModuleConfig {
  return {
    enabled: true,
    cadence: definition.defaultCadence,
    rewardLabel: definition.defaultRewardLabel,
    xpReward: definition.defaultXpReward,
    note: `${definition.title} is active and ready to tune.`,
  };
}

export function buildDefaultGamificationConfig(): GamificationConfig {
  return {
    seasonName: 'Season of Momentum',
    seasonTheme: 'Daily wins and long-term progression',
    seasonEndsOn: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21).toISOString().slice(0, 10),
    xpPerLevel: 250,
    dailyResetHour: 0,
    maxDailyWheelSpins: 3,
    dailyLoginBonus: 20,
    streakBonusPerDay: 8,
    spinBonusXp: 40,
    mysteryRewardPool: ['25 XP', '1 wheel spin', 'streak shield', 'exclusive badge'],
    modules: Object.fromEntries(gamificationModules.map((definition) => [definition.id, buildDefaultModuleConfig(definition)])) as Record<
      GamificationModuleId,
      GamificationModuleConfig
    >,
  };
}

function mergeModuleConfig(definition: GamificationModuleDefinition, value: unknown): GamificationModuleConfig {
  const fallback = buildDefaultModuleConfig(definition);

  if (!isRecord(value)) {
    return fallback;
  }

  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled,
    cadence: typeof value.cadence === 'string' && value.cadence.trim() ? value.cadence.trim() : fallback.cadence,
    rewardLabel: typeof value.rewardLabel === 'string' && value.rewardLabel.trim() ? value.rewardLabel.trim() : fallback.rewardLabel,
    xpReward: typeof value.xpReward === 'number' && Number.isFinite(value.xpReward) ? value.xpReward : fallback.xpReward,
    note: typeof value.note === 'string' && value.note.trim() ? value.note.trim() : fallback.note,
  };
}

function mergeGamificationConfig(value: unknown): GamificationConfig {
  const fallback = buildDefaultGamificationConfig();

  if (!isRecord(value)) {
    return fallback;
  }

  const modules = gamificationModules.reduce<Record<GamificationModuleId, GamificationModuleConfig>>((accumulator, definition) => {
    accumulator[definition.id] = mergeModuleConfig(definition, value.modules?.[definition.id]);
    return accumulator;
  }, fallback.modules);

  return {
    seasonName: typeof value.seasonName === 'string' && value.seasonName.trim() ? value.seasonName.trim() : fallback.seasonName,
    seasonTheme: typeof value.seasonTheme === 'string' && value.seasonTheme.trim() ? value.seasonTheme.trim() : fallback.seasonTheme,
    seasonEndsOn: typeof value.seasonEndsOn === 'string' && value.seasonEndsOn.trim() ? value.seasonEndsOn.trim() : fallback.seasonEndsOn,
    xpPerLevel:
      typeof value.xpPerLevel === 'number' && Number.isFinite(value.xpPerLevel)
        ? Math.max(50, Math.round(value.xpPerLevel))
        : fallback.xpPerLevel,
    dailyResetHour:
      typeof value.dailyResetHour === 'number' && Number.isFinite(value.dailyResetHour)
        ? Math.min(23, Math.max(0, Math.round(value.dailyResetHour)))
        : fallback.dailyResetHour,
    maxDailyWheelSpins:
      typeof value.maxDailyWheelSpins === 'number' && Number.isFinite(value.maxDailyWheelSpins)
        ? Math.max(0, Math.round(value.maxDailyWheelSpins))
        : fallback.maxDailyWheelSpins,
    dailyLoginBonus:
      typeof value.dailyLoginBonus === 'number' && Number.isFinite(value.dailyLoginBonus)
        ? Math.max(0, Math.round(value.dailyLoginBonus))
        : fallback.dailyLoginBonus,
    streakBonusPerDay:
      typeof value.streakBonusPerDay === 'number' && Number.isFinite(value.streakBonusPerDay)
        ? Math.max(0, Math.round(value.streakBonusPerDay))
        : fallback.streakBonusPerDay,
    spinBonusXp:
      typeof value.spinBonusXp === 'number' && Number.isFinite(value.spinBonusXp)
        ? Math.max(0, Math.round(value.spinBonusXp))
        : fallback.spinBonusXp,
    mysteryRewardPool: isStringArray(value.mysteryRewardPool) && value.mysteryRewardPool.length ? value.mysteryRewardPool : fallback.mysteryRewardPool,
    modules,
  };
}

export async function listGamificationConfig(): Promise<GamificationConfig> {
  const { data, error } = await supabase.from('platform_settings').select('key,value').eq('key', GAMIFICATION_SETTING_KEY).single();

  if (error || !data) {
    return buildDefaultGamificationConfig();
  }

  return mergeGamificationConfig((data as { value: unknown }).value);
}

export async function updateGamificationConfig(config: GamificationConfig): Promise<void> {
  const { error } = await supabase.from('platform_settings').upsert(
    {
      key: GAMIFICATION_SETTING_KEY,
      value: config,
      description: 'Gamification controls for engagement, progression, and rewards',
    },
    { onConflict: 'key' },
  );

  if (error) throw error;
}
