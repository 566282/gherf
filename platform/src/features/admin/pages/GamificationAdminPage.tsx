import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { buildDefaultGamificationConfig, gamificationModules, listGamificationConfig, updateGamificationConfig, type GamificationConfig } from '@/services/api/gamification';

export function GamificationAdminPage() {
  const [config, setConfig] = useState<GamificationConfig>(buildDefaultGamificationConfig());
  const [statusMessage, setStatusMessage] = useState('Loading gamification configuration...');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void listGamificationConfig()
      .then((nextConfig) => {
        setConfig(nextConfig);
        setStatusMessage('Gamification settings loaded from platform settings.');
      })
      .catch(() => setStatusMessage('Using local defaults until gamification settings are available.'));
  }, []);

  const activeModules = useMemo(() => gamificationModules.filter((module) => config.modules[module.id]?.enabled).length, [config]);

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

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      await updateGamificationConfig(config);
      setStatusMessage('Gamification controls saved.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(buildDefaultGamificationConfig());
    setStatusMessage('Gamification controls reset to defaults.');
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="relative overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(51,196,255,0.16),transparent_32%),linear-gradient(135deg,rgba(12,16,22,0.96),rgba(22,27,36,0.98))]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-mint/80">Admin controls</p>
            <h1 className="text-4xl font-bold text-white md:text-5xl">Gamification configuration</h1>
            <p className="text-base text-mist/80">
              Admin owns the daily login rules, streak tuning, XP growth, leaderboards, wheel bonuses, mystery rewards, missions, and seasonal event cadence.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[28rem] xl:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Active modules</p>
              <p className="mt-2 text-3xl font-bold text-white">{activeModules}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">XP per level</p>
              <p className="mt-2 text-3xl font-bold text-white">{config.xpPerLevel}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Wheel spins per day</p>
              <p className="mt-2 text-3xl font-bold text-white">{config.maxDailyWheelSpins}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-mist/60">Season end</p>
              <p className="mt-2 text-3xl font-bold text-white">{config.seasonEndsOn}</p>
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
            </label>
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm text-mist/70">Season theme</span>
              <input className="input-base" value={config.seasonTheme} onChange={(event) => setConfig((current) => ({ ...current, seasonTheme: event.target.value }))} />
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
