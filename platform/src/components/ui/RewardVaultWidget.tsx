import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  getRewardVaultStatus,
  listRewardVaultHistory,
  releasePromotionalReward,
  refreshPromotionalRequirements,
  type PromotionalEventItem,
  type RewardVaultReservationStatus,
} from '@/services/api/promotionalRewards';

function formatCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) {
    return 'Expired';
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function blockingStepLabel(step: RewardVaultReservationStatus['nextBlockingStep']): string {
  switch (step) {
    case 'registration_complete':
      return 'Complete account registration';
    case 'verification_complete':
      return 'Verify your email/account';
    case 'qualifying_referrals':
      return 'Hit required verified referrals';
    case 'membership_purchase':
      return 'Complete membership purchase';
    case 'not_expired':
      return 'Reward has expired';
    default:
      return 'All requirements complete';
  }
}

interface RewardVaultWidgetProps {
  userId: string;
}

export function RewardVaultWidget({ userId }: RewardVaultWidgetProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [syncMessage, setSyncMessage] = useState('Loading reward vault...');
  const [openPanel, setOpenPanel] = useState(false);
  const [reservations, setReservations] = useState<RewardVaultReservationStatus[]>([]);
  const [history, setHistory] = useState<PromotionalEventItem[]>([]);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      await refreshPromotionalRequirements(userId);
      const [status, timeline] = await Promise.all([getRewardVaultStatus(userId), listRewardVaultHistory()]);
      setReservations(status.reservations);
      setHistory(timeline);
      setSyncMessage('Reward vault synced.');
    } catch {
      setSyncMessage('Reward vault unavailable right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [userId]);

  const topReservation = useMemo(() => reservations[0], [reservations]);
  const pendingCount = useMemo(() => reservations.filter((entry) => entry.status === 'pending_unlock' || entry.status === 'reserved').length, [reservations]);
  const totalPending = useMemo(() => reservations.filter((entry) => entry.status === 'pending_unlock' || entry.status === 'reserved').reduce((sum, entry) => sum + entry.amount, 0), [reservations]);
  const isMobile = typeof window !== 'undefined' ? window.matchMedia('(max-width: 1024px)').matches : false;

  const release = async (reservationId: string) => {
    setReleasingId(reservationId);
    try {
      const result = await releasePromotionalReward(reservationId, userId);
      if (!result.ok) {
        setSyncMessage(result.error ? `Release blocked: ${result.error}` : 'Release blocked.');
      } else {
        setSyncMessage('Reward released to wallet.');
      }
      await refresh();
    } catch {
      setSyncMessage('Unable to release reward right now.');
    } finally {
      setReleasingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Reward vault</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Pending promotional rewards</h3>
          <p className="text-sm text-mist/75">{loading ? 'Loading...' : `${pendingCount} pending · $${totalPending.toFixed(2)} reserved`}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => void refresh()}>
            Refresh
          </Button>
          <Button type="button" onClick={() => setOpenPanel(true)}>
            Open vault
          </Button>
        </div>
      </div>

      {topReservation ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-sm text-amber-100">Next step: {blockingStepLabel(topReservation.nextBlockingStep)}</p>
          <p className="mt-1 text-xs text-amber-200/90">Countdown: {formatCountdown(topReservation.expiresAt)}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-mist/70">No active vault reservations.</p>
      )}

      <p className="mt-3 text-xs text-mist/60">{syncMessage}</p>

      {openPanel ? (
        <div className="fixed inset-0 z-50">
          <button type="button" onClick={() => setOpenPanel(false)} className="absolute inset-0 bg-black/50" aria-label="Close reward vault panel" />
          <aside className={`absolute ${isMobile ? 'bottom-0 left-0 right-0 max-h-[85vh] rounded-t-3xl' : 'right-0 top-0 h-full w-[32rem]'} overflow-y-auto border border-white/10 bg-slate-950 p-5 shadow-2xl`}>
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xl font-semibold text-white">Reward vault details</h4>
              <Button type="button" variant="ghost" onClick={() => setOpenPanel(false)}>
                Close
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              {reservations.length ? reservations.map((reservation) => (
                <article key={reservation.reservationId} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{reservation.currency} {reservation.amount.toFixed(2)}</p>
                      <p className="text-xs text-mist/70">Status: {reservation.status.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-mist/70">Expires in {formatCountdown(reservation.expiresAt)}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => void release(reservation.reservationId)}
                      disabled={releasingId === reservation.reservationId || reservation.status !== 'pending_unlock'}
                    >
                      {releasingId === reservation.reservationId ? 'Releasing...' : 'Release'}
                    </Button>
                  </div>

                  <ul className="mt-3 space-y-2 text-xs">
                    {reservation.requirements.map((requirement) => (
                      <li key={requirement.key} className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-1 text-mist/80">
                        <span>{blockingStepLabel(requirement.key)}</span>
                        <span>{requirement.completed}/{requirement.required} · {requirement.status}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              )) : (
                <p className="text-sm text-mist/70">No reservations yet.</p>
              )}
            </div>

            <div className="mt-6">
              <h5 className="text-sm uppercase tracking-[0.2em] text-mint/70">Event timeline</h5>
              <div className="mt-2 space-y-2">
                {history.length ? history.map((event) => (
                  <div key={event.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-xs font-semibold text-white">{event.event_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-mist/70">{new Date(event.created_at).toLocaleString()}</p>
                  </div>
                )) : (
                  <p className="text-sm text-mist/70">No vault events yet.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
