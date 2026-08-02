import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { listP2PFraudScores, listP2PRiskSignals } from '@/services/api/p2pCompliance';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export function P2PRiskConsolePage(): JSX.Element {
  const [signals, setSignals] = useState<Array<Record<string, unknown>>>([]);
  const [scores, setScores] = useState<Array<Record<string, unknown>>>([]);
  const [statusMessage, setStatusMessage] = useState('Loading risk console...');

  const refresh = async (): Promise<void> => {
    const [nextSignals, nextScores] = await Promise.all([
      listP2PRiskSignals(200),
      listP2PFraudScores(200),
    ]);

    setSignals(nextSignals);
    setScores(nextScores);
    setStatusMessage('Risk console synced from Supabase.');
  };

  useEffect(() => {
    void refresh().catch(() => setStatusMessage('Unable to load risk console.'));
  }, []);

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">P2P security</p>
        <h1 className="mt-2 text-4xl font-semibold text-foreground">Risk and fraud console</h1>
        <p className="mt-2 max-w-3xl text-muted">Monitor suspicious behavior, risk signals, and fraud verdicts from the P2P control layer.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => void refresh()}>Reload risk data</Button>
          <p className="rounded-xl border border-border bg-surface px-4 py-2 text-sm text-muted">{statusMessage}</p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Risk signals</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{signals.length}</p>
        </Card>
        <Card className="border border-border bg-surface-elevated">
          <p className="text-sm text-muted">Fraud score rows</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{scores.length}</p>
        </Card>
      </div>

      <Card className="border border-border bg-surface-elevated">
        <h2 className="text-2xl font-semibold text-foreground">Latest risk signals</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((signal) => (
                <tr key={String(signal.id)} className="border-b border-border/60 text-foreground last:border-0">
                  <td className="px-4 py-3">{String(signal.signal_type ?? 'unknown')}</td>
                  <td className="px-4 py-3">{String(signal.severity ?? 'low')}</td>
                  <td className="px-4 py-3">{Number(signal.signal_value ?? 0)}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(String(signal.created_at ?? new Date().toISOString()))}</td>
                </tr>
              ))}
              {!signals.length ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={4}>No risk signals found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border border-border bg-surface-elevated">
        <h2 className="text-2xl font-semibold text-foreground">Latest fraud scores</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Verdict</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((score) => (
                <tr key={String(score.id)} className="border-b border-border/60 text-foreground last:border-0">
                  <td className="px-4 py-3">{Number(score.score ?? 0)}</td>
                  <td className="px-4 py-3">{String(score.verdict ?? 'allow')}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(String(score.created_at ?? new Date().toISOString()))}</td>
                </tr>
              ))}
              {!scores.length ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={3}>No fraud scores found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
