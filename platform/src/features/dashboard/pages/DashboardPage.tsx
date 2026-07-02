import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';

export function DashboardPage(): JSX.Element {
  return (
    <div className="grid gap-6">
      <Card>
        <h1 className="text-2xl font-bold">Business Marketing Platform</h1>
        <p className="mt-2 text-mist/80">
          Launch configurable campaigns, review task submissions, and manage rewards from a unified control plane.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Engagement systems</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Daily login, XP, and streaks</h2>
          <p className="mt-2 text-sm text-mist/75">Keep users active with missions, rewards, lucky wheels, and seasonal events.</p>
          <Link to="/app/gamification" className="mt-4 inline-block text-sm text-ember hover:underline">
            Open gamification hub
          </Link>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Task routing</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Campaign completion flow</h2>
          <p className="mt-2 text-sm text-mist/75">Tasks feed into submissions, approvals, and reward issuance.</p>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Rewards</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Ledger and wallet history</h2>
          <p className="mt-2 text-sm text-mist/75">Track pending rewards, bonus claims, and withdrawal eligibility.</p>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-mint/70">Admin control</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Everything is configurable</h2>
          <p className="mt-2 text-sm text-mist/75">Admin can tune the full engagement loop from the control plane.</p>
        </Card>
      </div>
    </div>
  );
}
