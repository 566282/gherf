import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/app/providers/AuthProvider';
import { buildDefaultGamificationConfig, gamificationModules, listGamificationConfig, type GamificationConfig } from '@/services/api/gamification';

type QuestState = {
  id: string;
  title: string;
  description: string;
  reward: string;
  xp: number;
  progress: number;
  target: number;
  completed: boolean;
};

type AchievementState = {
  id: string;
  title: string;
  description: string;
  xp: number;
  unlocked: boolean;
  progress: number;
  target: number;
};

type LeaderboardEntry = {
  name: string;
  xp: number;
  streak: number;
  level: number;
  badge: string;
};

const storageKey = 'investpro.gamification.demo-state';

const baseQuests: QuestState[] = [
  { id: 'open-app', title: 'Open the app', description: 'Visit the platform and check your feed.', reward: '1 wheel spin', xp: 20, progress: 0, target: 1, completed: false },
  { id: 'complete-task', title: 'Complete a task', description: 'Finish one task or campaign action.', reward: 'Bonus XP', xp: 35, progress: 0, target: 1, completed: false },
  { id: 'visit-profile', title: 'Review your profile', description: 'Update a profile field or review your level.', reward: 'Mystery reward', xp: 25, progress: 0, target: 1, completed: false },
];

const baseAchievements: AchievementState[] = [
  { id: 'first-win', title: 'First win', description: 'Claim your first reward.', xp: 50, unlocked: true, progress: 1, target: 1 },
  { id: 'streak-seven', title: 'Seven-day streak', description: 'Maintain a seven-day login streak.', xp: 120, unlocked: false, progress: 4, target: 7 },
  { id: 'mission-master', title: 'Mission master', description: 'Finish five missions in a season.', xp: 150, unlocked: false, progress: 2, target: 5 },
  { id: 'wheel-winner', title: 'Wheel winner', description: 'Trigger a high-value lucky wheel prize.', xp: 90, unlocked: false, progress: 0, target: 1 },
];

const baseLeaderboard: LeaderboardEntry[] = [
  { name: 'Ava Stone', xp: 2680, streak: 28, level: 11, badge: 'Momentum' },
  { name: 'Noah Reed', xp: 2435, streak: 21, level: 10, badge: 'Streak Keeper' },
  { name: 'Mia Chen', xp: 2290, streak: 19, level: 10, badge: 'Lucky Run' },
  { name: 'Ethan Cruz', xp: 2155, streak: 16, level: 9, badge: 'Mission Pro' },
];

function loadDemoState() {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as {
      xp: number;
      streak: number;
      dailyClaimed: boolean;
      spinTokens: number;
      mysteryTokens: number;
      quests: QuestState[];
      achievements: AchievementState[];
    };
  } catch {
    return null;
  }
}

function saveDemoState(state: ReturnType<typeof createDemoState>) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

function createDemoState(seed?: { xp: number; streak: number }) {
  return {
    xp: seed?.xp ?? 860,
    streak: seed?.streak ?? 6,
    dailyClaimed: false,
    spinTokens: 2,
    mysteryTokens: 1,
    quests: baseQuests.map((quest) => ({ ...quest })),
    achievements: baseAchievements.map((achievement) => ({ ...achievement })),
  };
}

function progressValue(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

export function GamificationPage() {
  const { profile } = useAuth();
  const [config, setConfig] = useState<GamificationConfig>(buildDefaultGamificationConfig());
  const [statusMessage, setStatusMessage] = useState('Loading engagement systems...');
  const [state, setState] = useState(() => createDemoState({ xp: Math.max((profile?.levelTier ?? 1) * 120, 120), streak: Math.max(1, Math.min(14, profile?.rewardHistoryCount ?? 6)) }));

  useEffect(() => {
    const savedState = loadDemoState();
    if (savedState) {
      setState(savedState);
    }

    void listGamificationConfig()
      .then((nextConfig) => {
        setConfig(nextConfig);
        setStatusMessage(`${nextConfig.seasonName} is live with ${nextConfig.maxDailyWheelSpins} daily wheel spins.`);
      })
      .catch(() => {
        setConfig(buildDefaultGamificationConfig());
        setStatusMessage('Using local gamification defaults until admin settings are available.');
      });
  }, []);

  useEffect(() => {
    saveDemoState(state);
  }, [state]);

  const currentLevel = Math.max(1, Math.floor(state.xp / config.xpPerLevel) + 1);
  const xpThreshold = Math.max(1, config.xpPerLevel);
  const xpIntoLevel = state.xp % xpThreshold;
  const xpProgress = progressValue(xpIntoLevel, xpThreshold);

  const leaderboards = useMemo(() => {
    const userEntry: LeaderboardEntry = {
      name: profile?.fullName ?? 'You',
      xp: state.xp,
      streak: state.streak,
      level: currentLevel,
      badge: profile?.badges?.[0] ?? 'Rising Star',
    };

    return [...baseLeaderboard, userEntry]
      .sort((left, right) => right.xp - left.xp)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [currentLevel, profile?.badges, profile?.fullName, state.streak, state.xp]);

  const highlightedLeaderboard = leaderboards.slice(0, 4);
  const userRank = leaderboards.findIndex((entry) => entry.name === (profile?.fullName ?? 'You')) + 1;

  const enabledModules = gamificationModules.filter((module) => config.modules[module.id]?.enabled).length;
  const unlockedAchievements = state.achievements.filter((achievement) => achievement.unlocked).length;

  const handleClaimDailyLogin = () => {
    if (state.dailyClaimed) {
      setStatusMessage('Daily login already claimed today.');
      return;
    }

    setState((current) => ({
      ...current,
      xp: current.xp + config.dailyLoginBonus + config.streakBonusPerDay,
      streak: current.streak + 1,
      dailyClaimed: true,
      spinTokens: Math.min(config.maxDailyWheelSpins, current.spinTokens + 1),
      mysteryTokens: current.streak % 3 === 0 ? current.mysteryTokens + 1 : current.mysteryTokens,
    }));
    setStatusMessage(`Daily login claimed. +${config.dailyLoginBonus} XP and streak advanced.`);
  };

  const handleSpinWheel = () => {
    if (state.spinTokens <= 0) {
      setStatusMessage('No lucky wheel spins remaining today.');
      return;
    }

    const rewards = [
      { label: '35 XP', xp: 35 },
      { label: 'Bonus spin', xp: config.spinBonusXp, spins: 1 },
      { label: 'Mystery token', xp: 20, mystery: 1 },
      { label: 'Level boost', xp: 60 },
    ];
    const reward = rewards[Math.floor(Math.random() * rewards.length)];

    setState((current) => ({
      ...current,
      xp: current.xp + reward.xp,
      spinTokens: current.spinTokens - 1,
      mysteryTokens: current.mysteryTokens + (reward.mystery ?? 0),
    }));
    setStatusMessage(`Lucky wheel landed on ${reward.label}.`);
  };

  const handleOpenMysteryReward = () => {
    if (state.mysteryTokens <= 0) {
      setStatusMessage('No mystery rewards are available right now.');
      return;
    }

    const reward = config.mysteryRewardPool[Math.floor(Math.random() * config.mysteryRewardPool.length)] ?? '25 XP';

    setState((current) => ({
      ...current,
      xp: current.xp + 25,
      mysteryTokens: current.mysteryTokens - 1,
    }));
    setStatusMessage(`Mystery reward unlocked: ${reward}.`);
  };

  const completeQuest = (questId: string) => {
    setState((current) => ({
      ...current,
      xp: current.xp + 30,
      quests: current.quests.map((quest) =>
        quest.id === questId ? { ...quest, progress: quest.target, completed: true } : quest,
      ),
    }));
    setStatusMessage('Quest completed and XP credited.');
  };

  const unlockAchievement = (achievementId: string) => {
    setState((current) => ({
      ...current,
      xp: current.xp + 40,
      achievements: current.achievements.map((achievement) =>
        achievement.id === achievementId ? { ...achievement, unlocked: true, progress: achievement.target } : achievement,
      ),
    }));
    setStatusMessage('Achievement unlocked.');
  };

  if (!profile) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <p className="text-sm uppercase tracking-[0.24em] text-mint">Gamification</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Engagement systems</h1>
          <p className="mt-2 text-mist/80">Sign in to view daily login rewards, streaks, XP, and seasonal missions.</p>
          <div className="mt-4">
            <Link to="/login" className="text-sm text-ember hover:underline">
              Sign in to continue
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="relative overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,140,61,0.18),transparent_34%),linear-gradient(135deg,rgba(10,12,16,0.98),rgba(24,28,36,0.96))]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-ember/80">Gamification hub</p>
            <h1 className="text-4xl font-bold text-white md:text-5xl">Daily login, streaks, XP, and rewards</h1>
            <p className="text-base text-mist/80">
              {config.seasonName} is tuned around {config.seasonTheme.toLowerCase()}. Claim bonuses, climb levels, unlock achievements,
              and use your spins before the reset window.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[28rem] xl:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Current level</p>
              <p className="mt-2 text-3xl font-bold text-white">{currentLevel}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">XP to next level</p>
              <p className="mt-2 text-3xl font-bold text-white">{config.xpPerLevel - xpIntoLevel}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Streak</p>
              <p className="mt-2 text-3xl font-bold text-white">{state.streak} days</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Daily spins</p>
              <p className="mt-2 text-3xl font-bold text-white">{state.spinTokens}</p>
            </div>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-3">
          <Button onClick={handleClaimDailyLogin} disabled={state.dailyClaimed}>
            {state.dailyClaimed ? 'Claimed today' : 'Claim daily login'}
          </Button>
          <Button variant="ghost" onClick={handleSpinWheel}>
            Spin lucky wheel
          </Button>
          <Button variant="ghost" onClick={handleOpenMysteryReward}>
            Open mystery reward
          </Button>
        </div>
      </Card>

      {statusMessage ? <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-mist/80">{statusMessage}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">XP progress</p>
          <p className="mt-3 text-3xl font-bold text-white">{state.xp} XP</p>
          <div className="mt-4 h-2 rounded-full bg-white/10">
            <div className="h-2 rounded-full bg-gradient-to-r from-ember to-orange-300" style={{ width: `${xpProgress}%` }} />
          </div>
          <p className="mt-2 text-sm text-mist/70">{xpProgress}% to level {currentLevel + 1}</p>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Achievements</p>
          <p className="mt-3 text-3xl font-bold text-white">{unlockedAchievements}/{state.achievements.length}</p>
          <p className="mt-2 text-sm text-mist/70">Milestones unlocked this season.</p>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Leaderboard rank</p>
          <p className="mt-3 text-3xl font-bold text-white">#{userRank}</p>
          <p className="mt-2 text-sm text-mist/70">Compared against active seasonal players.</p>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Live modules</p>
          <p className="mt-3 text-3xl font-bold text-white">{enabledModules}</p>
          <p className="mt-2 text-sm text-mist/70">Admin-enabled systems currently active.</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Engagement loop</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Daily login, streaks, and missions</h2>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-mist/80">
              Reset at {String(config.dailyResetHour).padStart(2, '0')}:00
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Daily login</p>
              <p className="mt-2 text-xl font-semibold text-white">+{config.dailyLoginBonus} XP</p>
              <p className="mt-1 text-sm text-mist/70">First app open of the day earns a claimable reward.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Streak bonus</p>
              <p className="mt-2 text-xl font-semibold text-white">+{config.streakBonusPerDay} XP per day</p>
              <p className="mt-1 text-sm text-mist/70">Higher streaks keep compounding rewards active.</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-lg font-semibold text-white">Missions</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {state.quests.map((quest) => (
                <div key={quest.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{quest.title}</p>
                      <p className="mt-1 text-sm text-mist/70">{quest.description}</p>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-mist/70">
                      {quest.completed ? 'Done' : 'Open'}
                    </span>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-mint" style={{ width: `${progressValue(quest.progress, quest.target)}%` }} />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm text-mist/70">
                    <span>Reward: {quest.reward}</span>
                    <span>+{quest.xp} XP</span>
                  </div>
                  <div className="mt-4">
                    <Button variant="ghost" onClick={() => completeQuest(quest.id)} disabled={quest.completed}>
                      {quest.completed ? 'Completed' : 'Complete quest'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-lg font-semibold text-white">Achievements</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {state.achievements.map((achievement) => (
                <div key={achievement.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{achievement.title}</p>
                      <p className="mt-1 text-sm text-mist/70">{achievement.description}</p>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-mist/70">
                      {achievement.unlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-ember" style={{ width: `${progressValue(achievement.progress, achievement.target)}%` }} />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm text-mist/70">
                    <span>{achievement.progress}/{achievement.target}</span>
                    <span>+{achievement.xp} XP</span>
                  </div>
                  <div className="mt-4">
                    <Button variant="ghost" onClick={() => unlockAchievement(achievement.id)} disabled={achievement.unlocked}>
                      {achievement.unlocked ? 'Active' : 'Unlock'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Lucky wheel and mystery rewards</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Chance-based bonuses</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-mist/60">Daily spins</p>
                <p className="mt-2 text-xl font-semibold text-white">{state.spinTokens}</p>
                <p className="mt-1 text-sm text-mist/70">Capped by admin at {config.maxDailyWheelSpins} per day.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-mist/60">Mystery tokens</p>
                <p className="mt-2 text-xl font-semibold text-white">{state.mysteryTokens}</p>
                <p className="mt-1 text-sm text-mist/70">Random rewards from the seasonal pool.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-mist/60">Mystery reward pool</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {config.mysteryRewardPool.map((reward) => (
                    <span key={reward} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-mist/80">
                      {reward}
                    </span>
                  ))}
                </div>
              </div>
              <Button fullWidth onClick={handleSpinWheel} disabled={state.spinTokens <= 0}>
                Spin wheel for a bonus
              </Button>
              <Button fullWidth variant="ghost" onClick={handleOpenMysteryReward} disabled={state.mysteryTokens <= 0}>
                Reveal mystery reward
              </Button>
            </div>
          </Card>

          <Card>
            <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Seasonal event</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{config.seasonName}</h2>
            <p className="mt-2 text-sm text-mist/75">Theme: {config.seasonTheme}</p>
            <p className="mt-1 text-sm text-mist/75">Ends on: {config.seasonEndsOn}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-mist/60">Active modules</p>
                <p className="mt-2 text-2xl font-bold text-white">{enabledModules}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-mist/60">Seasonal rewards</p>
                <p className="mt-2 text-2xl font-bold text-white">XP + boosts</p>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Leaderboard</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Top players this season</h2>
            <div className="mt-4 space-y-3">
              {highlightedLeaderboard.map((entry) => (
                <div key={`${entry.name}-${entry.xp}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-mist/80">
                  <div>
                    <p className="font-medium text-white">#{entry.rank} {entry.name}</p>
                    <p className="mt-1">Level {entry.level} | {entry.streak} day streak | {entry.badge}</p>
                  </div>
                  <p className="font-semibold text-white">{entry.xp} XP</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Modules controlled by admin</p>
            <div className="mt-4 space-y-3">
              {gamificationModules.map((module) => {
                const moduleConfig = config.modules[module.id];

                return (
                  <div key={module.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{module.title}</p>
                        <p className="mt-1 text-sm text-mist/70">{module.description}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${moduleConfig?.enabled ? 'border border-mint/40 bg-mint/10 text-mint' : 'border border-white/10 bg-white/5 text-mist/60'}`}>
                        {moduleConfig?.enabled ? 'On' : 'Off'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-mist/70">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Cadence: {moduleConfig?.cadence}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Reward: {moduleConfig?.rewardLabel}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">XP: +{moduleConfig?.xpReward}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
