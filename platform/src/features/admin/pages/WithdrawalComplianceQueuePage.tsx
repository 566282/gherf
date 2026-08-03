import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  listWithdrawalComplianceReviews,
  resolveWithdrawalComplianceReview,
  listWithdrawalComplianceReviewItems,
  type WithdrawalComplianceReview,
  type WithdrawalComplianceReviewItem,
} from '@/services/api/taskCompliance';

export function WithdrawalComplianceQueuePage(): JSX.Element {
  const { profile } = useAuth();
  const [reviews, setReviews] = useState<WithdrawalComplianceReview[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [items, setItems] = useState<WithdrawalComplianceReviewItem[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const reload = async () => {
    const nextReviews = await listWithdrawalComplianceReviews(100);
    setReviews(nextReviews);

    if (!selectedReviewId && nextReviews.length) {
      setSelectedReviewId(nextReviews[0].id);
    }
  };

  useEffect(() => {
    void reload().catch(() => setStatusMessage('Unable to load compliance queue.'));
  }, []);

  useEffect(() => {
    if (!selectedReviewId) {
      setItems([]);
      return;
    }

    void listWithdrawalComplianceReviewItems(selectedReviewId)
      .then(setItems)
      .catch(() => setItems([]));
  }, [selectedReviewId]);

  const selectedReview = useMemo(
    () => reviews.find((item) => item.id === selectedReviewId) ?? null,
    [reviews, selectedReviewId],
  );

  const resolveSelected = async (nextState: 'approved' | 'held_compliance' | 'rejected') => {
    if (!selectedReview || !profile) return;

    setIsSaving(true);
    setStatusMessage('');

    try {
      await resolveWithdrawalComplianceReview(
        selectedReview.id,
        nextState,
        nextState === 'approved' ? 'Manually approved by admin queue.' : nextState === 'held_compliance' ? 'Kept on hold after review.' : 'Rejected after review.',
        profile.id,
      );
      await reload();
      setStatusMessage(`Review updated to ${nextState}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to resolve compliance review.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Phase 2</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Withdrawal compliance queue</h1>
        <p className="mt-2 text-sm text-muted">Resolve held/pending compliance reviews before payout progression.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[18rem,1fr]">
        <Card>
          <h2 className="text-lg font-semibold text-foreground">Queue</h2>
          <div className="mt-3 space-y-2">
            {reviews.map((review) => (
              <button
                key={review.id}
                type="button"
                onClick={() => setSelectedReviewId(review.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${selectedReviewId === review.id ? 'border-accent bg-accent-soft text-foreground' : 'border-border text-muted hover:bg-surface'}`}
              >
                <p className="font-medium">{review.state}</p>
                <p>risk: {review.riskScore}</p>
              </button>
            ))}
            {!reviews.length ? <p className="text-sm text-muted">No compliance reviews found.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold text-foreground">Review detail</h2>
          {selectedReview ? (
            <>
              <p className="mt-2 text-sm text-muted">Policy {selectedReview.policyKey} @ {selectedReview.policyVersion}</p>
              <p className="mt-1 text-sm text-muted">State: {selectedReview.state} | Risk: {selectedReview.riskScore}</p>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="py-2 pr-4">Check</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-border/60">
                        <td className="py-2 pr-4">{item.checkKey}</td>
                        <td className="py-2 pr-4">{item.status}</td>
                        <td className="py-2 pr-4">{item.reason ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={() => void resolveSelected('approved')} disabled={isSaving}>Approve</Button>
                <Button variant="ghost" onClick={() => void resolveSelected('held_compliance')} disabled={isSaving}>Keep hold</Button>
                <Button variant="ghost" onClick={() => void resolveSelected('rejected')} disabled={isSaving}>Reject</Button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">Select a review to inspect checks and resolve.</p>
          )}

          {statusMessage ? <p className="mt-4 text-sm text-muted">{statusMessage}</p> : null}
        </Card>
      </div>
    </div>
  );
}
