import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import clsx from 'clsx';

export interface SpinWheelSegment {
  id: string;
  label: string;
  accentClass: string;
}

interface PromotionalSpinWheelProps {
  segments: SpinWheelSegment[];
  spinning: boolean;
  selectedSegmentId?: string | null;
  onSpinEnd?: () => void;
}

const VIEWBOX_SIZE = 500;
const CENTER = VIEWBOX_SIZE / 2;
const OUTER_RIM_RADIUS = 236;
const OUTER_RIM_WIDTH = 22;
const LED_RING_RADIUS = 220;
const FACE_RADIUS = 195;
const HUB_RADIUS = 28;
const LED_COUNT = 48;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function polar(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
  const angle = toRadians(angleDeg);
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function wedgePath(cx: number, cy: number, radius: number, startAngleDeg: number, endAngleDeg: number): string {
  const start = polar(cx, cy, radius, startAngleDeg);
  const end = polar(cx, cy, radius, endAngleDeg);
  const largeArc = endAngleDeg - startAngleDeg > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function resolveEasedProgress(progress: number): number {
  const split = 0.22;
  const accelerationPortion = 0.2;

  if (progress <= 0) {
    return 0;
  }

  if (progress >= 1) {
    return 1;
  }

  if (progress < split) {
    const phase = progress / split;
    return accelerationPortion * phase * phase;
  }

  const phase = (progress - split) / (1 - split);
  return accelerationPortion + (1 - accelerationPortion) * easeOutCubic(phase);
}

function getRandomTurns(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function resolveSelectedIndex(segments: SpinWheelSegment[], selectedSegmentId?: string | null): number {
  if (!selectedSegmentId) {
    return 0;
  }

  const index = segments.findIndex((segment) => segment.id === selectedSegmentId);
  return index >= 0 ? index : 0;
}

export function PromotionalSpinWheel({ segments, spinning, selectedSegmentId, onSpinEnd }: PromotionalSpinWheelProps): JSX.Element {
  const [landedSegmentId, setLandedSegmentId] = useState<string | null>(null);
  const [showWinBurst, setShowWinBurst] = useState(false);
  const idPrefix = useId().replace(/:/g, '');
  const wheelRef = useRef<SVGGElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const burstTimeoutRef = useRef<number | null>(null);
  const rotationRef = useRef(0);
  const animatingRef = useRef(false);

  const segmentAngle = 360 / Math.max(1, segments.length);
  const selectedIndex = useMemo(() => resolveSelectedIndex(segments, selectedSegmentId), [segments, selectedSegmentId]);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => ({
        id: `piece-${index}`,
        left: `${8 + index * 6.2}%`,
        offset: `${(index % 2 === 0 ? -1 : 1) * (18 + (index % 5) * 9)}px`,
        delay: `${index * 36}ms`,
      })),
    [],
  );

  const ringBulbs = useMemo(
    () =>
      Array.from({ length: LED_COUNT }, (_, index) => {
        const angle = -90 + (360 / LED_COUNT) * index;
        return {
          id: `led-${index}`,
          ...polar(CENTER, CENTER, LED_RING_RADIUS, angle),
          delay: `${(index % 8) * 90}ms`,
        };
      }),
    [],
  );

  useEffect(() => {
    if (!wheelRef.current) {
      return;
    }
    wheelRef.current.style.transform = `rotate(${rotationRef.current}deg)`;
  }, []);

  useEffect(() => {
    if (!spinning || animatingRef.current) {
      return;
    }

    const centerAngle = selectedIndex * segmentAngle + segmentAngle / 2;
    const normalizedTarget = ((360 - centerAngle) % 360 + 360) % 360;
    const currentRotation = rotationRef.current;
    const normalizedCurrent = ((currentRotation % 360) + 360) % 360;
    const deltaToTarget = (normalizedTarget - normalizedCurrent + 360) % 360;

    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduceMotion ? 260 : 5000 + Math.floor(Math.random() * 3001);
    const extraTurns = (reduceMotion ? 1 : getRandomTurns(6, 12)) * 360;
    const fromRotation = currentRotation;
    const toRotation = currentRotation + extraTurns + deltaToTarget;

    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    animatingRef.current = true;
    setLandedSegmentId(null);
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = reduceMotion ? progress : resolveEasedProgress(progress);
      const current = fromRotation + (toRotation - fromRotation) * eased;

      rotationRef.current = current;
      if (wheelRef.current) {
        wheelRef.current.style.transform = `rotate(${current}deg)`;
      }

      if (progress < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      animatingRef.current = false;
      rafRef.current = null;

      const finalSegmentId = segments[selectedIndex]?.id ?? null;
      setLandedSegmentId(finalSegmentId);
      setShowWinBurst(Boolean(finalSegmentId));
      if (burstTimeoutRef.current) {
        window.clearTimeout(burstTimeoutRef.current);
      }
      burstTimeoutRef.current = window.setTimeout(() => setShowWinBurst(false), 1400);

      onSpinEnd?.();
    };

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      animatingRef.current = false;
    };
  }, [onSpinEnd, segmentAngle, segments, selectedIndex, spinning]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
      if (burstTimeoutRef.current) {
        window.clearTimeout(burstTimeoutRef.current);
      }
    };
  }, []);

  const labelRadius = FACE_RADIUS * 0.64;

  return (
    <div className="promo-wheel-shell relative mx-auto aspect-square w-[300px] md:w-[380px] xl:w-[450px]">
      <div className="promo-wheel-pointer" aria-hidden="true" />

      <svg
        className={clsx('promo-wheel-svg h-full w-full', showWinBurst && 'promo-wheel-svg--winning')}
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        role="img"
        aria-label="Promotional spin wheel with twelve reward segments"
      >
        <defs>
          <radialGradient id={`${idPrefix}-outer-rim`} cx="35%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#FFE082" />
            <stop offset="28%" stopColor="#FFD54F" />
            <stop offset="52%" stopColor="#FBC02D" />
            <stop offset="72%" stopColor="#F9A825" />
            <stop offset="100%" stopColor="#B8860B" />
          </radialGradient>

          <radialGradient id={`${idPrefix}-hub-gradient`} cx="35%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#FFF8DC" />
            <stop offset="38%" stopColor="#FFD54F" />
            <stop offset="70%" stopColor="#C49000" />
            <stop offset="100%" stopColor="#8B6508" />
          </radialGradient>

          <radialGradient id={`${idPrefix}-bulb`} cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#FFFDE7" />
            <stop offset="45%" stopColor="#FFF9C4" />
            <stop offset="100%" stopColor="#FFD54F" />
          </radialGradient>

          <filter id={`${idPrefix}-wheel-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(255,215,0,0.92)" />
            <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="rgba(255,140,0,0.58)" />
            <feDropShadow dx="0" dy="0" stdDeviation="20" floodColor="rgba(255,215,0,0.36)" />
          </filter>

          <filter id={`${idPrefix}-rim-inner-shadow`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.42)" />
          </filter>

          {segments.map((segment, index) => {
            const isGold = index % 2 === 0;
            return (
              <linearGradient key={segment.id} id={`${idPrefix}-segment-${segment.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                {isGold ? (
                  <>
                    <stop offset="0%" stopColor="#FFD54F" />
                    <stop offset="52%" stopColor="#FFC107" />
                    <stop offset="100%" stopColor="#E0A800" />
                  </>
                ) : (
                  <>
                    <stop offset="0%" stopColor="#CF2B2B" />
                    <stop offset="48%" stopColor="#B71C1C" />
                    <stop offset="100%" stopColor="#7F1414" />
                  </>
                )}
              </linearGradient>
            );
          })}
        </defs>

        <g
          ref={wheelRef}
          className="promo-wheel-rotor"
          style={{ transformOrigin: '250px 250px', transformBox: 'fill-box' }}
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_RIM_RADIUS}
            fill="none"
            stroke={`url(#${idPrefix}-outer-rim)`}
            strokeWidth={OUTER_RIM_WIDTH}
            filter={`url(#${idPrefix}-rim-inner-shadow)`}
          />

          {ringBulbs.map((bulb) => (
            <circle
              key={bulb.id}
              cx={bulb.x}
              cy={bulb.y}
              r={4}
              fill={`url(#${idPrefix}-bulb)`}
              className={clsx('promo-wheel-led', showWinBurst && 'promo-wheel-led--win')}
              style={{ animationDelay: bulb.delay }}
            />
          ))}

          {segments.map((segment, index) => {
            const startAngle = -90 + index * segmentAngle;
            const endAngle = startAngle + segmentAngle;
            const midAngle = startAngle + segmentAngle / 2;
            const normalizedMid = ((midAngle % 360) + 360) % 360;
            const textPoint = polar(CENTER, CENTER, labelRadius, midAngle);
            const textRotation = normalizedMid > 90 && normalizedMid < 270 ? midAngle + 270 : midAngle + 90;
            const isGold = index % 2 === 0;
            const isWinner = landedSegmentId === segment.id;

            return (
              <g
                key={segment.id}
                className={clsx(isWinner && showWinBurst && 'promo-wheel-segment--winner')}
              >
                <path
                  d={wedgePath(CENTER, CENTER, FACE_RADIUS, startAngle, endAngle)}
                  fill={`url(#${idPrefix}-segment-${segment.id})`}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={1.1}
                />

                <text
                  x={textPoint.x}
                  y={textPoint.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${textRotation} ${textPoint.x} ${textPoint.y})`}
                  fill={isGold ? '#6F1010' : '#FFE082'}
                  fontSize="16"
                  fontWeight="700"
                  letterSpacing="1"
                >
                  {segment.label}
                </text>
              </g>
            );
          })}

          <circle
            cx={CENTER}
            cy={CENTER}
            r={HUB_RADIUS}
            fill={`url(#${idPrefix}-hub-gradient)`}
            stroke="rgba(255,248,220,0.85)"
            strokeWidth={2}
            className={clsx('promo-wheel-hub', showWinBurst && 'promo-wheel-hub--flash')}
          />

          <ellipse cx={CENTER - 8} cy={CENTER - 10} rx={9} ry={5} fill="rgba(255,255,255,0.42)" />
        </g>

        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_RIM_RADIUS + OUTER_RIM_WIDTH / 2}
          fill="none"
          filter={`url(#${idPrefix}-wheel-glow)`}
          stroke="rgba(255,215,0,0.55)"
          strokeWidth="1.2"
          pointerEvents="none"
        />
      </svg>

      {showWinBurst ? (
        <div className="promo-wheel-confetti" aria-hidden="true">
          {confettiPieces.map((piece, index) => {
            const style = {
              left: piece.left,
              animationDelay: piece.delay,
              '--promo-confetti-x': piece.offset,
            } as CSSProperties;

            return (
              <span
                key={piece.id}
                className={clsx(
                  'promo-wheel-confetti-piece',
                  index % 3 === 0 && 'bg-amber-300',
                  index % 3 === 1 && 'bg-orange-400',
                  index % 3 === 2 && 'bg-yellow-200',
                )}
                style={style}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
