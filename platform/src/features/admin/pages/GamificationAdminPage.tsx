import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { buildDefaultGamificationConfig, gamificationModules, listGamificationConfig, updateGamificationConfig, type GamificationConfig } from '@/services/api/gamification';

function AnimatedCounter({ value, className }: { value: number; className?: string }): JSX.Element {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let frame = 0;
    const startValue = displayValue;
    const difference = value - startValue;
    const startTime = performance.now();

    const step = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startTime) / 320);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + difference * eased));

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
    ['left-[10%]', 'bg-ember', '[--confetti-x:-30px]'],
    ['left-[18%]', 'bg-success', '[--confetti-x:16px]'],
    ['left-[28%]', 'bg-warning', '[--confetti-x:-18px]'],
    ['left-[40%]', 'bg-info', '[--confetti-x:24px]'],
    ['left-[52%]', 'bg-ember', '[--confetti-x:-12px]'],
    ['left-[64%]', 'bg-success', '[--confetti-x:26px]'],
    ['left-[76%]', 'bg-warning', '[--confetti-x:-22px]'],
    ['left-[86%]', 'bg-info', '[--confetti-x:14px]'],
  ] as const;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map(([position, color, offset], index) => (
        <span key={`${position}-${index}`} className={`confetti-piece ${position} ${color} ${offset}`} style={{ top: `${8 + index * 2}%`, animationDelay: `${index * 80}ms` }} />
      ))}
    </div>
  );
}

export function GamificationAdminPage() {
  const [config, setConfig] = useState<GamificationConfig>(buildDefaultGamificationConfig());
  const [statusMessage, setStatusMessage] = useState('Loading gamification configuration...');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const lastSavedSnapshot = useRef('');

  useEffect(() => {
    void listGamificationConfig()
      .then((nextConfig) => {
        setConfig(nextConfig);
        lastSavedSnapshot.current = JSON.stringify(nextConfig);
        setIsLoadingConfig(false);
        setStatusMessage('Gamification settings loaded from platform settings.');
      })
      .catch(() => {
        setIsLoadingConfig(false);
        setStatusMessage('Using local defaults until gamification settings are available.');
      });
  }, []);

  const activeModules = useMemo(() => gamificationModules.filter((module) => config.modules[module.id]?.enabled).length, [config]);
  const moduleCoverage = Math.round((activeModules / gamificationModules.length) * 100);
  const daysRemaining = useMemo(() => {
    const endDate = new Date(config.seasonEndsOn).getTime();
    const difference = Number.isFinite(endDate) ? endDate - Date.now() : 0;
    return Math.max(0, Math.ceil(difference / (1000 * 60 * 60 * 24)));
  }, [config.seasonEndsOn]);

  const validationErrors = useMemo(() => {
    const nextErrors: string[] = [];

    if (!config.seasonName.trim()) {
      nextErrors.push('Season name is required.');
    }

    if (!config.seasonTheme.trim()) {
      nextErrors.push('Season theme is required.');
    }

    if (!config.seasonEndsOn.trim()) {
      nextErrors.push('Season end date is required.');
    }

    if (config.xpPerLevel < 50) {
      nextErrors.push('XP per level must be at least 50.');
    }

    return nextErrors;
  }, [config.seasonEndsOn, config.seasonName, config.seasonTheme, config.xpPerLevel]);

  const triggerConfetti = useCallback(() => {
    setShowConfetti(true);
    window.setTimeout(() => setShowConfetti(false), 1700);
  }, []);

  const updateModule = (moduleId: string, patch: Partial<GamificationConfig['modules'][keyof GamificationConfig['modules']]> ) => {
    setConfig((current) => ({
      ...current,
      modules: {
        ...current.modules,
        [moduleId]: {
          ...current.modules[moduleId as keyof typeof current.modules],
          ...patch,
        },
      },
    }));
  };

  const persistConfig = useCallback(async (nextConfig: GamificationConfig, successMessage: string) => {
    setIsSaving(true);
    setStatusMessage('Saving gamification controls...');

    try {
      await updateGamificationConfig(nextConfig);
      lastSavedSnapshot.current = JSON.stringify(nextConfig);
      setStatusMessage(successMessage);
      triggerConfetti();
    } catch {
      setStatusMessage('Unable to save gamification settings right now.');
    } finally {
      setIsSaving(false);
    }
  }, [triggerConfetti]);

  useEffect(() => {
    if (isLoadingConfig) {
      return;
    }

    const snapshot = JSON.stringify(config);
    if (snapshot === lastSavedSnapshot.current) {
      return;
    }

    setStatusMessage('Auto-saving gamification controls...');
    const timeout = window.setTimeout(() => {
      void persistConfig(config, 'Gamification controls auto-saved.');
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [config, isLoadingConfig, persistConfig]);

  const handleSave = async () => {
    await persistConfig(config, 'Gamification controls saved.');
  };

  const handleReset = () => {
    setConfig(buildDefaultGamificationConfig());
    setStatusMessage('Gamification controls reset to defaults.');
  };

  if (isLoadingConfig) {
    return (
      <div className="space-y-6 p-6">
        <Card className="space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-3/5" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </Card>
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Skeleton className="h-[42rem]" />
          <Skeleton className="h-[42rem]" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-transition space-y-6 p-6">
      <Card className="relative overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(51,196,255,0.16),transparent_32%),linear-gradient(135deg,rgba(12,16,22,0.96),rgba(22,27,36,0.98))]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        {showConfetti ? <ConfettiBurst /> : null}
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-mint/80">Admin controls</p>
            <h1 className="text-4xl font-bold text-white md:text-5xl">Gamification configuration</h1>
            <p className="text-base text-mist/80">
              Admin owns the daily login rules, streak tuning, XP growth, leaderboards, wheel bonuses, mystery rewards, missions, and seasonal event cadence.
            </p>
            {validationErrors.length ? <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{validationErrors.join(' ')}</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[28rem] xl:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Active modules</p>
              <div className="mt-2 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `conic-gradient(hsl(var(--color-success)) ${moduleCoverage}%, rgba(255,255,255,0.12) ${moduleCoverage}% 100%)` }}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-lg font-bold text-white">
                    <AnimatedCounter value={moduleCoverage} />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">
                    <AnimatedCounter value={activeModules} />
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-mist/50">of {gamificationModules.length}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">XP per level</p>
              <p className="mt-2 text-3xl font-bold text-white"><AnimatedCounter value={config.xpPerLevel} /></p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Wheel spins per day</p>
              <p className="mt-2 text-3xl font-bold text-white"><AnimatedCounter value={config.maxDailyWheelSpins} /></p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Season end</p>
              <p className="mt-2 text-3xl font-bold text-white">{daysRemaining}d</p>
              <p className="text-xs uppercase tracking-[0.2em] text-mist/50">Countdown to wrap-up</p>
            </div>
          </div>
        </div>
      </Card>

      {statusMessage ? <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-mist/80">{statusMessage}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Global tuning</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Season and reward controls</h2>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-mist/80">
              Reset hour {String(config.dailyResetHour).padStart(2, '0')}:00
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm text-mist/70">Season name</span>
              <input className="input-base" value={config.seasonName} onChange={(event) => setConfig((current) => ({ ...current, seasonName: event.target.value }))} />
              <p className="form-hint">Use a concise label users will see in the app and leaderboards.</p>
            </label>
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm text-mist/70">Season theme</span>
              <input className="input-base" value={config.seasonTheme} onChange={(event) => setConfig((current) => ({ ...current, seasonTheme: event.target.value }))} />
              <p className="form-hint">This frames missions, badges, and rewards for the current season.</p>
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-mist/70">Season ends on</span>
              <input className="input-base" type="date" value={config.seasonEndsOn} onChange={(event) => setConfig((current) => ({ ...current, seasonEndsOn: event.target.value }))} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-mist/70">XP per level</span>
              <input className="input-base" type="number" min="50" step="10" value={config.xpPerLevel} onChange={(event) => setConfig((current) => ({ ...current, xpPerLevel: Number(event.target.value) }))} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-mist/70">Daily reset hour</span>
              <input className="input-base" type="number" min="0" max="23" step="1" value={config.dailyResetHour} onChange={(event) => setConfig((current) => ({ ...current, dailyResetHour: Number(event.target.value) }))} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-mist/70">Max wheel spins</span>
              <input className="input-base" type="number" min="0" step="1" value={config.maxDailyWheelSpins} onChange={(event) => setConfig((current) => ({ ...current, maxDailyWheelSpins: Number(event.target.value) }))} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-mist/70">Daily login XP</span>
              <input className="input-base" type="number" min="0" step="1" value={config.dailyLoginBonus} onChange={(event) => setConfig((current) => ({ ...current, dailyLoginBonus: Number(event.target.value) }))} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-mist/70">Streak bonus per day</span>
              <input className="input-base" type="number" min="0" step="1" value={config.streakBonusPerDay} onChange={(event) => setConfig((current) => ({ ...current, streakBonusPerDay: Number(event.target.value) }))} />
            </label>
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm text-mist/70">Spin bonus XP</span>
              <input className="input-base" type="number" min="0" step="1" value={config.spinBonusXp} onChange={(event) => setConfig((current) => ({ ...current, spinBonusXp: Number(event.target.value) }))} />
            </label>
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm text-mist/70">Mystery reward pool</span>
              <textarea
                className="input-base min-h-28"
                value={config.mysteryRewardPool.join(', ')}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    mysteryRewardPool: event.target.value
                      .split(',')
                      .map((entry) => entry.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="25 XP, 1 wheel spin, streak shield, exclusive badge"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save gamification settings'}
            </Button>
            <Button variant="ghost" onClick={handleReset}>
              Reset defaults
            </Button>
          </div>
        </Card>

        <Card>
          <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Module controls</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Enable or tune each engagement system</h2>
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
                    <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-mist/80">
                      <input
                        type="checkbox"
                        checked={moduleConfig?.enabled ?? false}
                        onChange={(event) => updateModule(module.id, { enabled: event.target.checked })}
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm text-mist/70">Cadence</span>
                      <input className="input-base" value={moduleConfig?.cadence ?? ''} onChange={(event) => updateModule(module.id, { cadence: event.target.value })} />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm text-mist/70">Reward label</span>
                      <input className="input-base" value={moduleConfig?.rewardLabel ?? ''} onChange={(event) => updateModule(module.id, { rewardLabel: event.target.value })} />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm text-mist/70">XP reward</span>
                      <input className="input-base" type="number" min="0" step="1" value={moduleConfig?.xpReward ?? 0} onChange={(event) => updateModule(module.id, { xpReward: Number(event.target.value) })} />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm text-mist/70">Admin note</span>
                      <input className="input-base" value={moduleConfig?.note ?? ''} onChange={(event) => updateModule(module.id, { note: event.target.value })} />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
