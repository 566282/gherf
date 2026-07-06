import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  buildDefaultGamificationConfig,
  buildDefaultGamificationState,
  gamificationModules,
  listGamificationConfig,
  listGamificationPlayerState,
  resolveDailyTaskPlanForLevel,
  upsertGamificationPlayerState,
  type GamificationConfig,
  type GamificationPlayerState,
} from '@/services/api/gamification';

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

const baseLeaderboard: LeaderboardEntry[] = [
  { name: 'Ava Stone', xp: 2680, streak: 28, level: 11, badge: 'Momentum' },
  { name: 'Noah Reed', xp: 2435, streak: 21, level: 10, badge: 'Streak Keeper' },
  { name: 'Mia Chen', xp: 2290, streak: 19, level: 10, badge: 'Lucky Run' },
  { name: 'Ethan Cruz', xp: 2155, streak: 16, level: 9, badge: 'Mission Pro' },
];

function progressValue(value: number, target: number) {
  if (target <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (value / target) * 100));
}

function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let frame = 0;
    const duration = 420;
    const startTime = performance.now();
    const startValue = displayValue;
    const delta = value - startValue;

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const nextValue = startValue + delta * progress;
      setDisplayValue(Math.round(nextValue));

      if (progress < 1) {
        frame = window.requestAnimationFrame(step);
      }
    };

    frame = window.requestAnimationFrame(step);

    return () => window.cancelAnimationFrame(frame);
  }, [displayValue, value]);

  return <span className={className}>{displayValue}</span>;
}

function ConfettiBurst(): JSX.Element {
  const pieces = [
    ['left-[12%]', 'bg-ember', '[--confetti-x:-26px]'],
    ['left-[22%]', 'bg-success', '[--confetti-x:16px]'],
    ['left-[34%]', 'bg-warning', '[--confetti-x:-20px]'],
    ['left-[46%]', 'bg-info', '[--confetti-x:24px]'],
    ['left-[58%]', 'bg-ember', '[--confetti-x:-14px]'],
    ['left-[70%]', 'bg-success', '[--confetti-x:22px]'],
    ['left-[82%]', 'bg-warning', '[--confetti-x:-18px]'],
  ] as const;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map(([position, color, offset], index) => (
        <span key={`${position}-${index}`} className={`confetti-piece ${position} ${color} ${offset}`} style={{ top: `${12 + index * 2}%`, animationDelay: `${index * 80}ms` }} />
      ))}
    </div>
  );
}

export function GamificationPage() {
  const { profile } = useAuth();
  const [config, setConfig] = useState<GamificationConfig>(buildDefaultGamificationConfig());
  const [statusMessage, setStatusMessage] = useState('Loading engagement systems...');
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [state, setState] = useState<GamificationPlayerState>(() => buildDefaultGamificationState({ xp: Math.max((profile?.levelTier ?? 1) * 120, 120), streak: Math.max(1, Math.min(14, profile?.rewardHistoryCount ?? 6)) }));
  const confettiTimer = useRef<number | null>(null);

  useEffect(() => {
    void listGamificationConfig()
      .then((nextConfig) => {
        setConfig(nextConfig);
        setIsLoadingConfig(false);
        setStatusMessage(`${nextConfig.seasonName} is live with ${nextConfig.maxDailyWheelSpins} daily wheel spins.`);
      })
      .catch(() => {
        setConfig(buildDefaultGamificationConfig());
        setIsLoadingConfig(false);
        setStatusMessage('Using local gamification defaults until admin settings are available.');
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!profile?.id) {
      setState(buildDefaultGamificationState({ xp: Math.max((profile?.levelTier ?? 1) * 120, 120), streak: Math.max(1, Math.min(14, profile?.rewardHistoryCount ?? 6)) }));
      setIsLoadingState(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoadingState(true);

    void listGamificationPlayerState(profile.id, buildDefaultGamificationState({ xp: Math.max((profile?.levelTier ?? 1) * 120, 120), streak: Math.max(1, Math.min(14, profile?.rewardHistoryCount ?? 6)) }))
      .then((nextState) => {
        if (cancelled) {
          return;
        }

        const resolvedState = nextState ?? buildDefaultGamificationState({ xp: Math.max((profile?.levelTier ?? 1) * 120, 120), streak: Math.max(1, Math.min(14, profile?.rewardHistoryCount ?? 6)) });
        setState(resolvedState);
        if (!nextState) {
          void upsertGamificationPlayerState(profile.id, resolvedState, profile.id).catch(() => {
            if (!cancelled) {
              setStatusMessage('Using local gamification defaults until Supabase state can be created.');
            }
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState(buildDefaultGamificationState({ xp: Math.max((profile?.levelTier ?? 1) * 120, 120), streak: Math.max(1, Math.min(14, profile?.rewardHistoryCount ?? 6)) }));
          setStatusMessage('Unable to load gamification progress from Supabase.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingState(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.levelTier, profile?.rewardHistoryCount]);

  useEffect(() => {
    if (!profile?.id || isLoadingState) {
      return;
    }

    void upsertGamificationPlayerState(profile.id, state, profile.id).catch(() => {
      setStatusMessage('Unable to save gamification progress to Supabase.');
    });
  }, [isLoadingState, profile?.id, state]);

  useEffect(() => {
    return () => {
      if (confettiTimer.current) {
        window.clearTimeout(confettiTimer.current);
      }
    };
  }, []);

  const currentLevel = Math.max(1, Math.floor(state.xp / config.xpPerLevel) + 1);
  const xpThreshold = Math.max(1, config.xpPerLevel);
  const xpIntoLevel = state.xp % xpThreshold;
  const xpProgress = progressValue(xpIntoLevel, xpThreshold);
  const effectiveDailyTaskPlan = useMemo(
    () => resolveDailyTaskPlanForLevel(config.dailyTaskPlan, profile?.levelTier ?? 1),
    [config.dailyTaskPlan, profile?.levelTier],
  );

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
  const moduleCoverage = Math.round((enabledModules / gamificationModules.length) * 100);
  const daysRemaining = Math.max(0, Math.ceil((new Date(config.seasonEndsOn).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const triggerConfetti = () => {
    setShowConfetti(true);
    if (confettiTimer.current) {
      window.clearTimeout(confettiTimer.current);
    }

    confettiTimer.current = window.setTimeout(() => setShowConfetti(false), 1600);
  };

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
    triggerConfetti();
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
    triggerConfetti();
  };

  const completeQuest = (questId: string) => {
    setState((current) => ({
      ...current,
      xp: current.xp + effectiveDailyTaskPlan.xpReward,
      quests: current.quests.map((quest) =>
        quest.id === questId ? { ...quest, progress: quest.target, completed: true } : quest,
      ),
    }));
    setStatusMessage(`${effectiveDailyTaskPlan.title} completed. +${effectiveDailyTaskPlan.xpReward} XP credited.`);
    triggerConfetti();
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
    triggerConfetti();
  };

  if (isLoadingConfig) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-56" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Skeleton className="h-[46rem]" />
          <Skeleton className="h-[46rem]" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6 p-6">
        <Card className="interactive-card">
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
    <div className="page-transition space-y-6 p-6">
      <Card className="relative overflow-hidden border border-white/10 bg-[linear-gradient(135deg,rgba(12,16,22,0.98),rgba(19,24,32,0.96))] interactive-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,140,61,0.12),transparent_32%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />
        {showConfetti ? <ConfettiBurst /> : null}
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
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
              <p className="text-sm text-mist/60">Current level</p>
              <p className="mt-2 text-3xl font-bold text-white"><AnimatedCounter value={currentLevel} /></p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
              <p className="text-sm text-mist/60">XP to next level</p>
              <p className="mt-2 text-3xl font-bold text-white"><AnimatedCounter value={config.xpPerLevel - xpIntoLevel} /></p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
              <p className="text-sm text-mist/60">Streak</p>
              <p className="mt-2 text-3xl font-bold text-white"><AnimatedCounter value={state.streak} /> days</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
              <p className="text-sm text-mist/60">Daily spins</p>
              <p className="mt-2 text-3xl font-bold text-white"><AnimatedCounter value={state.spinTokens} /></p>
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
        <Card className="interactive-card">
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">XP progress</p>
          <p className="mt-3 text-3xl font-bold text-white">{state.xp} XP</p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `conic-gradient(hsl(var(--color-ember)) ${xpProgress}%, rgba(255,255,255,0.12) ${xpProgress}% 100%)` }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-sm font-semibold text-white">
                {xpProgress}%
              </div>
            </div>
            <div className="flex-1">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${xpProgress}%` }} />
              </div>
              <p className="mt-2 text-sm text-mist/70">{xpProgress}% to level {currentLevel + 1}</p>
            </div>
          </div>
        </Card>
        <Card className="interactive-card">
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Achievements</p>
          <p className="mt-3 text-3xl font-bold text-white">{unlockedAchievements}/{state.achievements.length}</p>
          <p className="mt-2 text-sm text-mist/70">Milestones unlocked this season.</p>
        </Card>
        <Card className="interactive-card">
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Leaderboard rank</p>
          <p className="mt-3 text-3xl font-bold text-white">#{userRank}</p>
          <p className="mt-2 text-sm text-mist/70">Compared against active seasonal players.</p>
        </Card>
        <Card className="interactive-card">
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Live modules</p>
          <p className="mt-3 text-3xl font-bold text-white"><AnimatedCounter value={enabledModules} /></p>
          <p className="mt-2 text-sm text-mist/70">Admin-enabled systems currently active.</p>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-mist/50">Coverage {moduleCoverage}% | {daysRemaining} days left</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="interactive-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Engagement loop</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Daily login, streaks, and missions</h2>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-mist/80 shadow-soft">
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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2">
              <p className="text-sm text-mist/60">Daily task plan</p>
              <p className="mt-2 text-xl font-semibold text-white">{effectiveDailyTaskPlan.title}</p>
              <p className="mt-1 text-sm text-mist/70">{effectiveDailyTaskPlan.description}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-mint/70">Tailored for {profile?.levelLabel ?? 'Starter'} members</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-mist/80">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Mode: {effectiveDailyTaskPlan.mode}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Reward: {effectiveDailyTaskPlan.rewardLabel}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Target: {effectiveDailyTaskPlan.completionTarget}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Cooldown: {effectiveDailyTaskPlan.cooldownHours}h</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Max claims: {effectiveDailyTaskPlan.maxDailyClaims}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">XP: +{effectiveDailyTaskPlan.xpReward}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-lg font-semibold text-white">Missions</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {state.quests.map((quest) => (
                <div key={quest.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
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
                    <div className="h-2 rounded-full bg-mint transition-all duration-500" style={{ width: `${progressValue(quest.progress, quest.target)}%` }} />
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
                <div key={achievement.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
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
                    <div className="h-2 rounded-full bg-ember transition-all duration-500" style={{ width: `${progressValue(achievement.progress, achievement.target)}%` }} />
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
          <Card className="interactive-card">
            <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Lucky wheel and mystery rewards</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Chance-based bonuses</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
                <p className="text-sm text-mist/60">Daily spins</p>
                <p className="mt-2 text-xl font-semibold text-white">{state.spinTokens}</p>
                <p className="mt-1 text-sm text-mist/70">Capped by admin at {config.maxDailyWheelSpins} per day.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
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

          <Card className="interactive-card">
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

          <Card className="interactive-card">
            <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Leaderboard</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Top players this season</h2>
            <div className="mt-4 space-y-3">
              {highlightedLeaderboard.map((entry) => (
                <div key={`${entry.name}-${entry.xp}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-mist/80 shadow-soft">
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
                  <div key={module.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-soft">
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
