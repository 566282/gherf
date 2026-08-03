import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import { getTaskComplianceProfile, listSocialPlatformDefinitions, upsertTaskComplianceProfile } from '@/services/api/taskProfile';

export function TaskOnboardingPage(): JSX.Element {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [taskTypes, setTaskTypes] = useState('watch_videos,visit_websites,social_follow');
  const [socialProfilesText, setSocialProfilesText] = useState('{\n  "youtube": { "handle": "" },\n  "instagram": { "handle": "" }\n}');
  const [platforms, setPlatforms] = useState<Array<{ platformKey: string; displayName: string }>>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;

    void Promise.all([
      listSocialPlatformDefinitions(),
      getTaskComplianceProfile(profile.id),
    ])
      .then(([definitions, existing]) => {
        setPlatforms(definitions.map((item) => ({ platformKey: item.platformKey, displayName: item.displayName })));

        if (existing) {
          setTaskTypes(existing.preferredTaskTypes.join(','));
          setSocialProfilesText(JSON.stringify(existing.socialProfiles, null, 2));
        }
      })
      .catch(() => setStatusMessage('Unable to load onboarding profile defaults.'));
  }, [profile]);

  const taskTypeList = useMemo(
    () => taskTypes.split(',').map((item) => item.trim()).filter(Boolean),
    [taskTypes],
  );

  const handleSave = async () => {
    if (!profile) return;

    let socialProfiles: Record<string, unknown> = {};
    try {
      socialProfiles = JSON.parse(socialProfilesText) as Record<string, unknown>;
    } catch {
      setStatusMessage('Social profile JSON is invalid.');
      return;
    }

    setIsSaving(true);
    setStatusMessage('');

    try {
      await upsertTaskComplianceProfile({
        userId: profile.id,
        preferredTaskTypes: taskTypeList,
        socialProfiles,
        onboardingProgress: {
          taskPreferencesCompleted: true,
          socialProfilesCompleted: true,
          completedAt: new Date().toISOString(),
        },
        onboardingCompleted: true,
        metadata: {
          source: 'task_onboarding_page',
        },
      });

      setStatusMessage('Task profile onboarding saved.');
      navigate('/app/profile');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save onboarding profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) {
    return (
      <Card>
        <h1 className="text-2xl font-semibold text-white">Task onboarding</h1>
        <p className="mt-2 text-mist/80">Sign in to continue.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-white/10 bg-white/5">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Phase 7</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Task and social profile onboarding</h1>
        <p className="mt-2 text-sm text-mist/80">Configure preferred task categories and your platform handles used for compliance checks.</p>
      </Card>

      <Card className="space-y-4 border border-white/10 bg-white/5">
        <label className="grid gap-2">
          <span className="text-sm text-mist/80">Preferred task types (comma-separated)</span>
          <input className="input-base" value={taskTypes} onChange={(event) => setTaskTypes(event.target.value)} />
        </label>

        <div>
          <p className="text-sm text-mist/80">Active social platforms</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-mist/70">
            {platforms.map((platform) => (
              <span key={platform.platformKey} className="rounded-full border border-white/10 px-2 py-1">
                {platform.displayName}
              </span>
            ))}
            {!platforms.length ? <span>No platform definitions found.</span> : null}
          </div>
        </div>

        <label className="grid gap-2">
          <span className="text-sm text-mist/80">Social profile payload JSON</span>
          <textarea className="input-base min-h-64 font-mono text-xs" value={socialProfilesText} onChange={(event) => setSocialProfilesText(event.target.value)} />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save onboarding profile'}</Button>
          <Link to="/app/profile" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5">Cancel</Link>
        </div>

        {statusMessage ? <p className="text-sm text-mint">{statusMessage}</p> : null}
      </Card>
    </div>
  );
}
