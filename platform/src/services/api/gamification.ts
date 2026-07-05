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

export const dailyTaskPlanModes = ['starter', 'balanced', 'premium', 'custom'] as const;

export type DailyTaskPlanMode = (typeof dailyTaskPlanModes)[number];

export interface DailyTaskPlanConfig {
  mode: DailyTaskPlanMode;
  title: string;
  description: string;
  rewardLabel: string;
  xpReward: number;
  completionTarget: number;
  cooldownHours: number;
  maxDailyClaims: number;
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
  dailyTaskPlan: DailyTaskPlanConfig;
  modules: Record<GamificationModuleId, GamificationModuleConfig>;
}

export interface GamificationQuestState {
  id: string;
  title: string;
  description: string;
  reward: string;
  xp: number;
  progress: number;
  target: number;
  completed: boolean;
}

export interface GamificationAchievementState {
  id: string;
  title: string;
  description: string;
  xp: number;
  unlocked: boolean;
  progress: number;
  target: number;
}

export interface GamificationPlayerState {
  xp: number;
  streak: number;
  dailyClaimed: boolean;
  spinTokens: number;
  mysteryTokens: number;
  quests: GamificationQuestState[];
  achievements: GamificationAchievementState[];
}

const GAMIFICATION_SETTING_KEY = 'gamification_config';
const GAMIFICATION_STATE_TABLE = 'user_gamification_state';

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

function isGamificationQuestState(value: unknown): value is GamificationQuestState {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.reward === 'string' &&
    typeof value.xp === 'number' &&
    typeof value.progress === 'number' &&
    typeof value.target === 'number' &&
    typeof value.completed === 'boolean'
  );
}

function isGamificationAchievementState(value: unknown): value is GamificationAchievementState {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.xp === 'number' &&
    typeof value.unlocked === 'boolean' &&
    typeof value.progress === 'number' &&
    typeof value.target === 'number'
  );
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

function buildDefaultDailyTaskPlan(): DailyTaskPlanConfig {
  return {
    mode: 'balanced',
    title: 'Daily quest',
    description: 'Give users one clear daily action that resets with the season window.',
    rewardLabel: 'Daily quest reward',
    xpReward: 30,
    completionTarget: 1,
    cooldownHours: 24,
    maxDailyClaims: 1,
  };
}

function getDailyTaskPlanTierLabel(levelTier: number): string {
  if (levelTier >= 3) {
    return 'premium';
  }

  if (levelTier >= 2) {
    return 'balanced';
  }

  return 'starter';
}

export function resolveDailyTaskPlanForLevel(plan: DailyTaskPlanConfig, levelTier: number): DailyTaskPlanConfig {
  const resolvedTier = Math.max(1, Math.floor(levelTier || 1));

  if (plan.mode === 'custom' || resolvedTier === 1) {
    return plan;
  }

  const xpMultiplier = resolvedTier >= 3 ? 1.5 : 1.2;
  const cooldownMultiplier = resolvedTier >= 3 ? 0.75 : 0.9;

  return {
    ...plan,
    title: `${plan.title} (${getDailyTaskPlanTierLabel(resolvedTier)})`,
    description: `${plan.description} Tailored for ${getDailyTaskPlanTierLabel(resolvedTier)} member plans.`,
    xpReward: Math.max(0, Math.round(plan.xpReward * xpMultiplier)),
    cooldownHours: Math.max(0, Math.round(plan.cooldownHours * cooldownMultiplier)),
    maxDailyClaims: Math.max(1, plan.maxDailyClaims + (resolvedTier >= 3 ? 1 : 0)),
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
    dailyTaskPlan: buildDefaultDailyTaskPlan(),
    modules: Object.fromEntries(gamificationModules.map((definition) => [definition.id, buildDefaultModuleConfig(definition)])) as Record<
      GamificationModuleId,
      GamificationModuleConfig
    >,
  };
}

export function buildDefaultGamificationState(seed?: { xp: number; streak: number }): GamificationPlayerState {
  return {
    xp: seed?.xp ?? 860,
    streak: seed?.streak ?? 6,
    dailyClaimed: false,
    spinTokens: 2,
    mysteryTokens: 1,
    quests: [
      { id: 'open-app', title: 'Open the app', description: 'Visit the platform and check your feed.', reward: '1 wheel spin', xp: 20, progress: 0, target: 1, completed: false },
      { id: 'complete-task', title: 'Complete a task', description: 'Finish one task or campaign action.', reward: 'Bonus XP', xp: 35, progress: 0, target: 1, completed: false },
      { id: 'visit-profile', title: 'Review your profile', description: 'Update a profile field or review your level.', reward: 'Mystery reward', xp: 25, progress: 0, target: 1, completed: false },
    ],
    achievements: [
      { id: 'first-win', title: 'First win', description: 'Claim your first reward.', xp: 50, unlocked: true, progress: 1, target: 1 },
      { id: 'streak-seven', title: 'Seven-day streak', description: 'Maintain a seven-day login streak.', xp: 120, unlocked: false, progress: 4, target: 7 },
      { id: 'mission-master', title: 'Mission master', description: 'Finish five missions in a season.', xp: 150, unlocked: false, progress: 2, target: 5 },
      { id: 'wheel-winner', title: 'Wheel winner', description: 'Trigger a high-value lucky wheel prize.', xp: 90, unlocked: false, progress: 0, target: 1 },
    ],
  };
}

function mergeGamificationPlayerState(value: unknown, fallback: GamificationPlayerState): GamificationPlayerState {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    xp: typeof value.xp === 'number' && Number.isFinite(value.xp) ? value.xp : fallback.xp,
    streak: typeof value.streak === 'number' && Number.isFinite(value.streak) ? value.streak : fallback.streak,
    dailyClaimed: typeof value.dailyClaimed === 'boolean' ? value.dailyClaimed : fallback.dailyClaimed,
    spinTokens: typeof value.spinTokens === 'number' && Number.isFinite(value.spinTokens) ? Math.max(0, Math.round(value.spinTokens)) : fallback.spinTokens,
    mysteryTokens: typeof value.mysteryTokens === 'number' && Number.isFinite(value.mysteryTokens) ? Math.max(0, Math.round(value.mysteryTokens)) : fallback.mysteryTokens,
    quests: Array.isArray(value.quests) ? value.quests.filter(isGamificationQuestState) : fallback.quests,
    achievements: Array.isArray(value.achievements) ? value.achievements.filter(isGamificationAchievementState) : fallback.achievements,
  };
}

export async function listGamificationPlayerState(userId: string, fallback?: GamificationPlayerState): Promise<GamificationPlayerState | null> {
  const { data, error } = await supabase
    .from(GAMIFICATION_STATE_TABLE)
    .select('state')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return mergeGamificationPlayerState((data as { state: unknown }).state, fallback ?? buildDefaultGamificationState());
}

export async function upsertGamificationPlayerState(userId: string, state: GamificationPlayerState, updatedBy?: string): Promise<void> {
  const { error } = await supabase.from(GAMIFICATION_STATE_TABLE).upsert(
    {
      user_id: userId,
      state,
      updated_by: updatedBy ?? null,
    },
    { onConflict: 'user_id' },
  );

  if (error) throw error;
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

function mergeDailyTaskPlan(value: unknown): DailyTaskPlanConfig {
  const fallback = buildDefaultDailyTaskPlan();

  if (!isRecord(value)) {
    return fallback;
  }

  return {
    mode: (typeof value.mode === 'string' && dailyTaskPlanModes.includes(value.mode as DailyTaskPlanMode) ? value.mode : fallback.mode) as DailyTaskPlanMode,
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : fallback.title,
    description: typeof value.description === 'string' && value.description.trim() ? value.description.trim() : fallback.description,
    rewardLabel: typeof value.rewardLabel === 'string' && value.rewardLabel.trim() ? value.rewardLabel.trim() : fallback.rewardLabel,
    xpReward: typeof value.xpReward === 'number' && Number.isFinite(value.xpReward) ? Math.max(0, Math.round(value.xpReward)) : fallback.xpReward,
    completionTarget: typeof value.completionTarget === 'number' && Number.isFinite(value.completionTarget) ? Math.max(1, Math.round(value.completionTarget)) : fallback.completionTarget,
    cooldownHours: typeof value.cooldownHours === 'number' && Number.isFinite(value.cooldownHours) ? Math.max(0, Math.round(value.cooldownHours)) : fallback.cooldownHours,
    maxDailyClaims: typeof value.maxDailyClaims === 'number' && Number.isFinite(value.maxDailyClaims) ? Math.max(1, Math.round(value.maxDailyClaims)) : fallback.maxDailyClaims,
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
    dailyTaskPlan: mergeDailyTaskPlan(value.dailyTaskPlan),
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
