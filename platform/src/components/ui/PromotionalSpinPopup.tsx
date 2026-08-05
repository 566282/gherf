import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/DesignSystem';
import {
  buildPromotionalWheelSegments,
  claimPromotionalRewardReserve,
  listPromotionalSpinSettings,
  markPromotionalPopupShown,
  resolvePromotionalWheelSegmentId,
  shouldShowPromotionalPopup,
  startPromotionalSpin,
  type PromotionalSpinSettings,
  type PromotionalSurface,
  type PromotionalWheelSegment,
} from '@/services/api/promotionalRewards';
import { PromotionalSpinWheel } from '@/components/ui/PromotionalSpinWheel';

interface PromotionalSpinPopupProps {
  surface: PromotionalSurface;
}

export function PromotionalSpinPopup({ surface }: PromotionalSpinPopupProps): JSX.Element | null {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [reopenLabel, setReopenLabel] = useState('Open reward wheel');
  const [spinSettings, setSpinSettings] = useState<PromotionalSpinSettings | null>(null);

  const wheelSegments = useMemo(
    () => buildPromotionalWheelSegments(spinSettings?.wheelSegmentLabels),
    [spinSettings?.wheelSegmentLabels],
  );

  useEffect(() => {
    let active = true;

    void listPromotionalSpinSettings()
      .then((settings) => {
        if (!active) return;
        setSpinSettings(settings);
        setEnabled(settings.enabled);
        setReopenLabel(settings.reopenLabel);
        setShowReopen(settings.showReopenButton);

        if (shouldShowPromotionalPopup(settings, surface)) {
          setOpen(true);
          markPromotionalPopupShown(false);
        }
      })
      .catch(() => {
        if (!active) return;
        setEnabled(false);
      });

    return () => {
      active = false;
    };
  }, [surface]);

  const selectedSegment = useMemo(
      () => wheelSegments.find((segment: PromotionalWheelSegment) => segment.id === selectedSegmentId),
      [selectedSegmentId, wheelSegments],
  );

  const startSpin = async () => {
    setBusy(true);
    setResultMessage('');

    try {
      const spin = await startPromotionalSpin(surface);
      if (!spin.ok || !spin.attemptId) {
        setResultMessage(spin.error ? `Spin unavailable: ${spin.error}` : 'Spin unavailable right now.');
        return;
      }

      setAttemptId(spin.attemptId);

      setSelectedSegmentId(resolvePromotionalWheelSegmentId(spin.rewardAmount, wheelSegments));
      setIsSpinning(true);
    } catch (error) {
      setResultMessage(error instanceof Error ? error.message : 'Unable to start spin.');
    } finally {
      setBusy(false);
    }
  };

  const reserveReward = async () => {
    if (!attemptId) {
      return;
    }

    setBusy(true);
    try {
      const reservation = await claimPromotionalRewardReserve(attemptId);
      if (!reservation.ok) {
        setResultMessage(reservation.error ? `Reserve failed: ${reservation.error}` : 'Reserve failed.');
        return;
      }

      setResultMessage(`Reserved ${reservation.currency ?? 'USD'} ${reservation.amount ?? 0}. Finish signup and unlock steps before expiry.`);
    } catch (error) {
      setResultMessage(error instanceof Error ? error.message : 'Unable to reserve reward.');
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) {
    return null;
  }

  return (
    <>
      {showReopen && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-xl transition hover:bg-amber-300"
        >
          {reopenLabel}
        </button>
      ) : null}

      <Modal
        open={open}
        title="Unlock Your Reward Vault"
        onClose={() => {
          setOpen(false);
          markPromotionalPopupShown(true);
        }}
      >
        <div className="space-y-5">
          <p className="text-sm text-muted">
            Spin once to reserve a promotional reward. Outcomes are secured server-side and linked to your unlock milestones.
          </p>

          <PromotionalSpinWheel
            segments={wheelSegments}
            spinning={isSpinning}
            selectedSegmentId={selectedSegmentId}
            onSpinEnd={() => {
              setIsSpinning(false);
              if (selectedSegment) {
                setResultMessage(`Wheel stopped on ${selectedSegment.label}. Reserve now to move this reward into your vault.`);
              }
            }}
          />

          {resultMessage ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">{resultMessage}</p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => void startSpin()} disabled={busy || isSpinning}>
              {isSpinning ? 'Spinning...' : 'Spin now'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void reserveReward()} disabled={busy || !attemptId || isSpinning}>
              Reserve reward
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
