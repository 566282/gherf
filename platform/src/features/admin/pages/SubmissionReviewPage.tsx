import { Card } from '@/components/ui/Card';
import { defaultFraudThresholds, describeFraudRiskChecks, explainFraudAssessment, evaluateFraudProfile, fraudRiskChecks, type FraudUserProfile } from '@/services/api/fraud';
import type { TaskVerificationCase, TaskVerificationStatus } from '@/types';

const verificationCases: TaskVerificationCase[] = [
  {
    id: 'ver-001',
    taskId: 'task-1001',
    taskTitle: 'Watch onboarding video',
    campaignTitle: 'New user activation',
    userId: 'user-208',
    verificationMethod: 'video_proof',
    status: 'pending_approval',
    evidence: ['video_proof', 'timer_verification'],
    riskFlags: [],
    verificationScore: 91,
    submittedAt: '2026-07-02T08:20:00.000Z',
    appealStatus: 'none',
  },
  {
    id: 'ver-002',
    taskId: 'task-1002',
    taskTitle: 'Complete referral signup',
    campaignTitle: 'Referral growth sprint',
    userId: 'user-411',
    verificationMethod: 'api_verification',
    status: 'approved',
    evidence: ['api_verification'],
    riskFlags: [],
    verificationScore: 98,
    reviewerId: 'admin-02',
    submittedAt: '2026-07-01T22:15:00.000Z',
    reviewedAt: '2026-07-01T22:24:00.000Z',
    appealStatus: 'none',
  },
  {
    id: 'ver-003',
    taskId: 'task-1003',
    taskTitle: 'Claim social proof bonus',
    campaignTitle: 'Influencer reach push',
    userId: 'user-622',
    verificationMethod: 'screenshot_upload',
    status: 'rejected',
    evidence: ['screenshot_upload'],
    riskFlags: ['duplicate_detection'],
    verificationScore: 38,
    reviewerId: 'admin-04',
    submittedAt: '2026-07-01T18:05:00.000Z',
    reviewedAt: '2026-07-01T18:17:00.000Z',
    appealStatus: 'open',
    appealNote: 'User submitted a second image after the deadline and requested reconsideration.',
    notes: 'Duplicate media detected across two submissions.',
  },
  {
    id: 'ver-004',
    taskId: 'task-1004',
    taskTitle: 'Location-based check-in',
    campaignTitle: 'Local launch campaign',
    userId: 'user-819',
    verificationMethod: 'random_audit',
    status: 'fraud_alert',
    evidence: ['link_validation', 'timer_verification'],
    riskFlags: ['vpn_detection', 'proxy_detection', 'bot_detection'],
    verificationScore: 12,
    duplicateOf: 'ver-003',
    reviewerId: 'moderator-01',
    submittedAt: '2026-07-02T07:52:00.000Z',
    reviewedAt: '2026-07-02T08:04:00.000Z',
    appealStatus: 'resolved',
    notes: 'Suspicious network pattern and repeated device fingerprint triggered fraud routing.',
  },
  {
    id: 'ver-005',
    taskId: 'task-1005',
    taskTitle: 'Wait for timer unlock',
    campaignTitle: 'Retention challenge',
    userId: 'user-512',
    verificationMethod: 'timer_verification',
    status: 'appeal_review',
    evidence: ['timer_verification'],
    riskFlags: ['fraud_detection'],
    verificationScore: 56,
    reviewerId: 'admin-07',
    submittedAt: '2026-07-02T06:30:00.000Z',
    reviewedAt: '2026-07-02T07:02:00.000Z',
    appealStatus: 'open',
    appealNote: 'User argues the local clock drift caused an invalid timer reading.',
  },
];

function statusTone(status: TaskVerificationStatus) {
  if (status === 'approved') return 'bg-emerald-500/15 text-emerald-300';
  if (status === 'rejected') return 'bg-rose-500/15 text-rose-300';
  if (status === 'fraud_alert') return 'bg-amber-500/15 text-amber-300';
  if (status === 'appeal_review') return 'bg-sky-500/15 text-sky-300';
  return 'bg-mint/15 text-mint';
}

function pretty(value: string) {
  return value.split('_').join(' ');
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildFraudProfile(item: TaskVerificationCase): FraudUserProfile {
  return {
    id: item.id,
    name: item.taskTitle,
    email: `${item.userId}@example.com`,
    campaign: item.campaignTitle,
    country: 'US',
    device: item.verificationMethod,
    ipGroup: 'review-queue',
    watchTimeMinutes: item.verificationScore / 10,
    clicksPerMinute: item.riskFlags.includes('rapid_clicking') ? 12 : 2,
    refreshesPerMinute: item.riskFlags.includes('auto_refresh') ? 5 : 0,
    automationConfidence: item.riskFlags.includes('bot_detection') ? 95 : 20,
    sharedIpAccounts: item.riskFlags.includes('duplicate_detection') ? 3 : 1,
    deviceReuseCount: item.riskFlags.includes('duplicate_detection') ? 2 : 1,
    linkedAccounts: item.riskFlags.includes('multiple_accounts') ? 4 : 1,
    referralLoopScore: item.riskFlags.includes('suspicious_referrals') ? 84 : 12,
    vpn: item.riskFlags.includes('vpn_detection'),
    proxy: item.riskFlags.includes('proxy_detection'),
    emulator: item.riskFlags.includes('device_fingerprint'),
    bot: item.riskFlags.includes('bot_detection'),
    suspiciousReferrals: item.riskFlags.includes('suspicious_referrals'),
    lastSeen: item.reviewedAt ?? item.submittedAt,
  };
}

function explainVerificationCase(item: TaskVerificationCase) {
  return explainFraudAssessment(evaluateFraudProfile(buildFraudProfile(item), defaultFraudThresholds), defaultFraudThresholds);
}

export function SubmissionReviewPage() {
  const pendingApprovals = verificationCases.filter((item) => item.status === 'pending_approval');
  const approvedTasks = verificationCases.filter((item) => item.status === 'approved');
  const rejectedTasks = verificationCases.filter((item) => item.status === 'rejected');
  const fraudAlerts = verificationCases.filter((item) => item.status === 'fraud_alert');
  const appeals = verificationCases.filter((item) => item.appealStatus === 'open');
  const explainedFraudCases = [...fraudAlerts, ...rejectedTasks].map((item) => ({ item, explanation: explainVerificationCase(item) }));

  return (
    <div className="space-y-6 p-6">
      <Card className="space-y-3 border border-white/5 bg-white/5">
        <p className="text-sm uppercase tracking-[0.3em] text-mint/80">Task verification system</p>
        <h1 className="text-3xl font-bold text-ember">Verification dashboard</h1>
        <p className="max-w-4xl text-mist">
          Route submissions through automatic verification, manual review, fraud scoring, random audits, and appeals.
          The control plane surfaces evidence quality, duplicate detection, VPN or proxy risk, and bot signals in one
          place.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist">Pending approvals</p>
          <p className="mt-2 text-3xl font-bold text-white">{pendingApprovals.length}</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist">Approved tasks</p>
          <p className="mt-2 text-3xl font-bold text-white">{approvedTasks.length}</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist">Rejected tasks</p>
          <p className="mt-2 text-3xl font-bold text-white">{rejectedTasks.length}</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist">Fraud alerts</p>
          <p className="mt-2 text-3xl font-bold text-white">{fraudAlerts.length}</p>
        </Card>
        <Card className="border border-white/5 bg-white/5">
          <p className="text-sm text-mist">Appeals open</p>
          <p className="mt-2 text-3xl font-bold text-white">{appeals.length}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Verification pipeline</h2>
            <p className="text-sm text-mist">Methods and checks available to campaign operators.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              'automatic verification',
              'manual review',
              'screenshot upload',
              'video proof',
              'link validation',
              'api verification',
              'timer verification',
              'random audit',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                {item}
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {fraudRiskChecks.map((item) => (
              <div key={item} className="rounded-2xl border border-ember/20 bg-ember/5 px-4 py-3 text-sm text-mist">
                {item.split('_').join(' ')}
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Appeal management</h2>
            <p className="text-sm text-mist">Escalations waiting on reviewer action.</p>
          </div>
          <div className="space-y-3">
            {appeals.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">{item.taskTitle}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>
                    {pretty(item.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-mist">{item.campaignTitle} · {formatDate(item.submittedAt)}</p>
                <p className="mt-2 text-sm text-mist/80">{item.appealNote ?? 'No appeal note recorded.'}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4 overflow-hidden">
          <div>
            <h2 className="text-2xl font-bold text-white">Pending approvals</h2>
            <p className="text-sm text-mist">Items ready for manual or automated review.</p>
          </div>
          <div className="space-y-3">
            {pendingApprovals.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{item.taskTitle}</p>
                    <p className="text-sm text-mist">{item.campaignTitle} · User {item.userId}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>
                    {pretty(item.status)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-mist">
                  <span className="rounded-full bg-white/10 px-3 py-1">Method: {pretty(item.verificationMethod)}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1">Score: {item.verificationScore}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1">Appeal: {pretty(item.appealStatus)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4 overflow-hidden">
          <div>
            <h2 className="text-2xl font-bold text-white">Risk queue</h2>
            <p className="text-sm text-mist">Rejected tasks and fraud alerts routed for review.</p>
          </div>
          <div className="space-y-3">
            {[...fraudAlerts, ...rejectedTasks].map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">{item.taskTitle}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>
                    {pretty(item.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-mist">{item.campaignTitle} · Reviewed by {item.reviewerId ?? 'pending'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-mist">
                  {item.riskFlags.map((flag) => (
                    <span key={flag} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
                      {pretty(flag)}
                    </span>
                  ))}
                  {item.evidence.map((proof) => (
                    <span key={proof} className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
                      {pretty(proof)}
                    </span>
                  ))}
                </div>
                {item.notes ? <p className="mt-3 text-sm text-mist/80">{item.notes}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="space-y-4 overflow-hidden">
        <div>
          <h2 className="text-2xl font-bold text-white">Decision explanations</h2>
          <p className="text-sm text-mist">Fraud alerts and rejections reuse the shared threshold logic so reviewers see the same reasons the engine uses.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {explainedFraudCases.map(({ item, explanation }) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-white">{item.taskTitle}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>{pretty(item.status)}</span>
              </div>
              <p className="mt-2 text-sm text-mist">{explanation.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-mist">
                {describeFraudRiskChecks(item.riskFlags).map((reason) => (
                  <span key={reason} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 overflow-hidden">
        <div>
          <h2 className="text-2xl font-bold text-white">Case ledger</h2>
          <p className="text-sm text-mist">Recent verification events, evidence, and reviewer actions.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-mist">
              <tr>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {verificationCases.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{item.taskTitle}</p>
                    <p className="text-xs text-mist">{item.campaignTitle} · {item.userId}</p>
                  </td>
                  <td className="px-4 py-4 text-mist">{pretty(item.verificationMethod)}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>
                      {pretty(item.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-mist">{item.riskFlags.length ? item.riskFlags.map(pretty).join(', ') : 'Clear'}</td>
                  <td className="px-4 py-4 text-white">{item.verificationScore}</td>
                  <td className="px-4 py-4 text-mist">{formatDate(item.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
