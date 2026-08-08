import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import { listMembershipPlans, type MembershipPlanRecord } from '@/services/api/membershipAdmin';
import { updateMemberPlan } from '@/services/api/auth';
import { listMembershipUpgradeRequestsForUser } from '@/services/api/membershipUpgradeRequests';
import { getTaskComplianceProfile, upsertTaskComplianceProfile } from '@/services/api/taskProfile';

type UpgradeRequestStatusRow = Awaited<ReturnType<typeof listMembershipUpgradeRequestsForUser>>[number];

function formatUpgradeStatus(status: UpgradeRequestStatusRow['status']): string {
  if (status === 'settled') return 'Settled';
  if (status === 'failed') return 'Failed';
  if (status === 'cancelled') return 'Cancelled';
  return 'Pending settlement';
}

function formatUpgradeTime(value: string | null | undefined): string {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export function OnboardingMembershipPage(): JSX.Element {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<MembershipPlanRecord[]>([]);
  const [upgradeRequests, setUpgradeRequests] = useState<UpgradeRequestStatusRow[]>([]);
  const [statusMessage, setStatusMessage] = useState('Loading membership plans...');
  const [isSubmittingTier, setIsSubmittingTier] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;

    void Promise.all([
      listMembershipPlans(),
      listMembershipUpgradeRequestsForUser(profile.id, 6),
    ])
      .then(([rows, requests]) => {
        const paidPlans = rows.filter((plan) => plan.isActive && plan.level >= 1);
        setPlans(paidPlans);
        setUpgradeRequests(requests);
        setStatusMessage(paidPlans.length ? '' : 'No paid plans are available right now.');
      })
      .catch(() => setStatusMessage('Unable to load membership plans right now.'));
  }, [profile]);

  const handleSelectPlan = async (plan: MembershipPlanRecord) => {
    if (!profile) return;

    setIsSubmittingTier(plan.level);
    setStatusMessage('');

    try {
      await updateMemberPlan(profile.id, plan.level, plan.price, plan.currency);

      const existing = await getTaskComplianceProfile(profile.id);
      const currentProgress = existing?.onboardingProgress ?? {};

      await upsertTaskComplianceProfile({
        userId: profile.id,
        preferredTaskTypes: existing?.preferredTaskTypes ?? [],
        socialProfiles: existing?.socialProfiles ?? {},
        onboardingProgress: {
          ...currentProgress,
          membershipPlanSelected: true,
          selectedMembershipTier: plan.level,
          selectedMembershipLabel: plan.label,
          selectedMembershipAt: new Date().toISOString(),
        },
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
        onboardingBlockReason: null,
        metadata: {
          source: 'onboarding_membership_page',
        },
      });

      const refreshed = await listMembershipUpgradeRequestsForUser(profile.id, 6);
      setUpgradeRequests(refreshed);

      navigate('/app/orders?source=membership-onboarding');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to start membership upgrade request.');
    } finally {
      setIsSubmittingTier(null);
    }
  };

  if (!profile) {
    return (
      <Card>
        <h1 className="text-2xl font-semibold text-white">Choose membership plan</h1>
        <p className="mt-2 text-mist/80">Sign in to continue.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-white/10 bg-white/5">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Onboarding checklist</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Choose your membership plan</h1>
        <p className="mt-2 text-sm text-mist/80">
          New accounts start on Free. Select a paid plan to open P2P merchant payment details and continue onboarding.
        </p>
      </Card>

      <Card className="space-y-4 border border-white/10 bg-white/5">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-mint/75">Membership settlement status</p>
          {upgradeRequests.length ? (
            <ul className="mt-3 space-y-2 text-sm text-mist/85">
              {upgradeRequests.map((request) => (
                <li key={request.id} className="rounded-lg border border-white/10 bg-black/10 p-3">
                  <p className="font-medium text-white">{formatUpgradeStatus(request.status)} · Tier {request.target_tier}</p>
                  <p className="mt-1 text-xs text-mist/70">
                    Requested: {formatUpgradeTime(request.created_at ?? null)}
                    {request.settled_at ? ` · Settled: ${formatUpgradeTime(request.settled_at)}` : ''}
                    {request.failed_at ? ` · Failed: ${formatUpgradeTime(request.failed_at)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-mist/80">No membership upgrade requests yet.</p>
          )}

          <div className="mt-3 flex flex-wrap gap-3">
            <Link to="/app/orders?source=membership-onboarding" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5">
              Open payment details
            </Link>
          </div>
        </div>

        {plans.map((plan) => (
          <div key={plan.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-mint/75">Tier {plan.level}</p>
              <h2 className="mt-1 text-xl font-semibold text-white">{plan.label}</h2>
              <p className="mt-1 text-sm text-mist/80">
                {plan.currency} {plan.price.toLocaleString()} / {plan.durationDays} days
              </p>
            </div>
            <Button onClick={() => void handleSelectPlan(plan)} disabled={isSubmittingTier !== null}>
              {isSubmittingTier === plan.level ? 'Starting payment...' : 'Select plan'}
            </Button>
          </div>
        ))}

        {!plans.length ? <p className="text-sm text-mist/80">{statusMessage}</p> : null}

        <div className="flex flex-wrap gap-3">
          <Link to="/app/onboarding" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5">Back to onboarding</Link>
          <Link to="/app/profile" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5">Open profile</Link>
        </div>

        {statusMessage ? <p className="text-sm text-mint">{statusMessage}</p> : null}
      </Card>
    </div>
  );
}
