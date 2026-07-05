import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { defaultFraudThresholds, listFraudDetectionConfig } from '@/services/api/fraud';
import {
  claimRewardVideoSession,
  createRewardVideoSession,
  evaluateRewardVideoClaim,
  listRewardVideoSessions,
  updateRewardVideoSession,
  type RewardVideoCampaignInput,
  type RewardVideoSessionPatch,
  type RewardVideoSessionRow,
} from '@/services/api/rewardVideos';

type VideoProvider = 'self_hosted' | 'youtube' | 'vimeo';

type RewardSessionStatus = 'idle' | 'playing' | 'paused' | 'verified' | 'blocked' | 'claimed';

interface RewardVideoCampaign {
  id: string;
  title: string;
  provider: VideoProvider;
  videoUrl: string;
  description: string;
  durationSeconds: number;
  rewardDelaySeconds: number;
  thresholdPercent: number;
  payout: number;
  xpReward: number;
  frequencyMinutes: number;
  maxViewsPerDay: number;
  sourceLabel: string;
  verificationLabel: string;
  antiCheatLabel: string;
  embedHint: string;
}

interface RewardHistoryRecord {
  sessionId: string;
  campaignId: string;
  provider: VideoProvider;
  status: RewardSessionStatus;
  completedAt: string;
  watchSeconds: number;
  completionPercent: number;
  payout: number;
  xpReward: number;
  heartbeatCount: number;
  hiddenEvents: number;
  focusLossCount: number;
  seekViolations: number;
  antiCheatFlags: string[];
}

interface RewardSession {
  sessionId: string;
  campaignId: string;
  status: RewardSessionStatus;
  startedAt: string | null;
  verifiedAt: string | null;
  claimAvailableAt: string | null;
  watchSeconds: number;
  heartbeatCount: number;
  hiddenEvents: number;
  focusLossCount: number;
  seekViolations: number;
  completionPercent: number;
  antiCheatFlags: string[];
  claimMessage: string;
}

const videoCampaigns: RewardVideoCampaign[] = [
  {
    id: 'self-hosted-premium-spot',
    title: 'Self-hosted premium spot',
    provider: 'self_hosted',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    description: 'HTML5 video with skip locking, seek detection, tab-change enforcement, and heartbeat verification.',
    durationSeconds: 96,
    rewardDelaySeconds: 10,
    thresholdPercent: 90,
    payout: 1.8,
    xpReward: 42,
    frequencyMinutes: 60,
    maxViewsPerDay: 1,
    sourceLabel: 'Self-hosted MP4',
    verificationLabel: 'Playback lock + heartbeat + completion threshold',
    antiCheatLabel: 'Seek detection, tab switching, focus loss',
    embedHint: 'Direct video playback',
  },
  {
    id: 'youtube-creator-spot',
    title: 'YouTube creator spot',
    provider: 'youtube',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'Embedded YouTube ad flow with visibility monitoring, session tracking, and reward timer gating.',
    durationSeconds: 213,
    rewardDelaySeconds: 15,
    thresholdPercent: 85,
    payout: 2.25,
    xpReward: 56,
    frequencyMinutes: 120,
    maxViewsPerDay: 2,
    sourceLabel: 'YouTube embed',
    verificationLabel: 'Timer + heartbeat + watch percentage',
    antiCheatLabel: 'Focus detection and tab switch detection',
    embedHint: 'youtube-nocookie embed',
  },
  {
    id: 'vimeo-story-spot',
    title: 'Vimeo story spot',
    provider: 'vimeo',
    videoUrl: 'https://vimeo.com/76979871',
    description: 'Vimeo embed with reward payout controls, unique view verification, and analytics logging.',
    durationSeconds: 98,
    rewardDelaySeconds: 8,
    thresholdPercent: 88,
    payout: 2,
    xpReward: 50,
    frequencyMinutes: 90,
    maxViewsPerDay: 1,
    sourceLabel: 'Vimeo embed',
    verificationLabel: 'Completion verification + session heartbeat',
    antiCheatLabel: 'Visibility checks and duplicate-view blocking',
    embedHint: 'Vimeo player',
  },
];

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatDuration(seconds: number): string {
  const boundedSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(boundedSeconds / 60);
  const remainingSeconds = boundedSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatShortTime(value: string | null): string {
  if (!value) {
    return 'Not started';
  }

  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sameDay(first: string, second: string): boolean {
  const firstDate = new Date(first);
  const secondDate = new Date(second);

  return firstDate.toDateString() === secondDate.toDateString();
}

function parseYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
  return match?.[1] ?? null;
}

function parseVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match?.[1] ?? null;
}

function buildEmbedUrl(campaign: RewardVideoCampaign): string {
  if (campaign.provider === 'youtube') {
    const youtubeId = parseYouTubeId(campaign.videoUrl) ?? 'dQw4w9WgXcQ';
    return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1&controls=0`;
  }

  if (campaign.provider === 'vimeo') {
    const vimeoId = parseVimeoId(campaign.videoUrl) ?? '76979871';
    return `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0&controls=0`;
  }

  return campaign.videoUrl;
}

function campaignLabel(campaign: RewardVideoCampaign): string {
  switch (campaign.provider) {
    case 'self_hosted':
      return 'Self-hosted';
    case 'youtube':
      return 'YouTube';
    case 'vimeo':
      return 'Vimeo';
  }
}

function addUniqueFlag(flags: string[], flag: string): string[] {
  return flags.includes(flag) ? flags : [...flags, flag];
}

function createIdleSession(campaign: RewardVideoCampaign, claimed: boolean): RewardSession {
  return {
    sessionId: createId('session'),
    campaignId: campaign.id,
    status: claimed ? 'claimed' : 'idle',
    startedAt: null,
    verifiedAt: null,
    claimAvailableAt: null,
    watchSeconds: 0,
    heartbeatCount: 0,
    hiddenEvents: 0,
    focusLossCount: 0,
    seekViolations: 0,
    completionPercent: 0,
    antiCheatFlags: [],
    claimMessage: claimed ? 'Unique view already rewarded for this campaign.' : 'Ready to start a verified watch session.',
  };
}

function nextEligibleTime(history: RewardHistoryRecord[], campaign: RewardVideoCampaign): string | null {
  const latestRecord = [...history].reverse().find((record) => record.campaignId === campaign.id && record.status === 'claimed');

  if (!latestRecord) {
    return null;
  }

  const nextEligible = new Date(latestRecord.completedAt);
  nextEligible.setMinutes(nextEligible.getMinutes() + campaign.frequencyMinutes);
  return nextEligible.toISOString();
}

function mapServerSessionToHistoryRecord(session: RewardVideoSessionRow): RewardHistoryRecord {
  return {
    sessionId: session.id,
    campaignId: session.campaign_key,
    provider: session.provider,
    status: session.status,
    completedAt: session.claimed_at ?? session.updated_at,
    watchSeconds: session.watch_seconds,
    completionPercent: session.completion_percent,
    payout: session.reward_amount,
    xpReward: session.xp_reward,
    heartbeatCount: session.heartbeat_count,
    hiddenEvents: session.hidden_events,
    focusLossCount: session.focus_loss_count,
    seekViolations: session.seek_violations,
    antiCheatFlags: session.anti_cheat_flags,
  };
}

export function UserTasksPage() {
  const { user, loading: authLoading } = useAuth();
  const [selectedCampaignId, setSelectedCampaignId] = useState(videoCampaigns[0].id);
  const [history, setHistory] = useState<RewardHistoryRecord[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(() => user?.walletBalance ?? 0);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [pageVisible, setPageVisible] = useState(true);
  const [windowFocused, setWindowFocused] = useState(true);
  const [session, setSession] = useState<RewardSession>(() => createIdleSession(videoCampaigns[0], false));
  const [serverSessionId, setServerSessionId] = useState<string | null>(null);
  const [serverHistoryLoading, setServerHistoryLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [claimDenialMessage, setClaimDenialMessage] = useState<string | null>(null);
  const [fraudWatchTimeMinutes, setFraudWatchTimeMinutes] = useState(defaultFraudThresholds.watchTimeMinutes);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const selectedCampaign = useMemo(
    () => videoCampaigns.find((campaign) => campaign.id === selectedCampaignId) ?? videoCampaigns[0],
    [selectedCampaignId],
  );

  useEffect(() => {
    if (typeof user?.walletBalance === 'number') {
      setWalletBalance(user.walletBalance);
    }
  }, [user?.walletBalance]);

  useEffect(() => {
    let cancelled = false;

    void listFraudDetectionConfig()
      .then((config) => {
        if (cancelled) {
          return;
        }

        setFraudWatchTimeMinutes(config.thresholds.watchTimeMinutes);
      })
      .catch(() => {
        if (!cancelled) {
          setFraudWatchTimeMinutes(defaultFraudThresholds.watchTimeMinutes);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCampaign.rewardDelaySeconds]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    setServerHistoryLoading(true);
    setSyncError(null);

    void listRewardVideoSessions(user.id)
      .then((rows) => {
        if (cancelled) {
          return;
        }

        const nextHistory = rows.map(mapServerSessionToHistoryRecord);
        setHistory(nextHistory);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setHistory([]);
        setSyncError('Unable to load rewarded video history from Supabase.');
      })
      .finally(() => {
        if (!cancelled) {
          setServerHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (session.campaignId === selectedCampaign.id && (session.status === 'playing' || session.status === 'paused' || session.status === 'verified' || session.status === 'blocked')) {
      return;
    }

    setSession(createIdleSession(selectedCampaign, history.some((record) => record.campaignId === selectedCampaign.id && record.status === 'claimed')));
    setServerSessionId(null);
  }, [history, selectedCampaign, session.campaignId, session.status]);

  const persistSessionPatch = async (patch: RewardVideoSessionPatch) => {
    if (!serverSessionId) {
      return;
    }

    try {
      setSyncError(null);
      await updateRewardVideoSession(serverSessionId, patch);
    } catch {
      setSyncError('Reward session sync failed. Your browser state is still visible, but the server copy may be stale.');
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setPageVisible(visible);

      if (!visible) {
        setSession((current) => {
          if (current.status !== 'playing' && current.status !== 'verified') {
            return current;
          }

          const nextSession = {
            ...current,
            status: 'blocked',
            hiddenEvents: current.hiddenEvents + 1,
            antiCheatFlags: addUniqueFlag(current.antiCheatFlags, 'tab_switch_detected'),
            claimMessage: 'Tab switch detected. Reward verification has been blocked.',
          };

          void persistSessionPatch({
            status: 'blocked',
            hiddenEvents: nextSession.hiddenEvents,
            antiCheatFlags: nextSession.antiCheatFlags,
          });

          return nextSession;
        });

        if (selectedCampaign.provider === 'self_hosted') {
          videoRef.current?.pause();
        }
      }
    };

    const handleWindowBlur = () => {
      setWindowFocused(false);

      setSession((current) => {
        if (current.status !== 'playing' && current.status !== 'verified') {
          return current;
        }

        const nextSession = {
          ...current,
          status: 'blocked',
          focusLossCount: current.focusLossCount + 1,
          antiCheatFlags: addUniqueFlag(current.antiCheatFlags, 'focus_lost'),
          claimMessage: 'Focus loss detected. Reward verification has been blocked.',
        };

        void persistSessionPatch({
          status: 'blocked',
          focusLossCount: nextSession.focusLossCount,
          antiCheatFlags: nextSession.antiCheatFlags,
        });

        return nextSession;
      });

      if (selectedCampaign.provider === 'self_hosted') {
        videoRef.current?.pause();
      }
    };

    const handleWindowFocus = () => {
      setWindowFocused(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [selectedCampaign.provider]);

  useEffect(() => {
    if (session.status !== 'playing') {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSession((current) => {
        if (current.status !== 'playing') {
          return current;
        }

        if (!pageVisible || !windowFocused) {
          return current;
        }

        const nextWatchSeconds = current.watchSeconds + 1;
        const requiredSeconds = Math.max(1, Math.ceil((selectedCampaign.durationSeconds * selectedCampaign.thresholdPercent) / 100));
        const expectedHeartbeats = Math.max(2, Math.floor(requiredSeconds / 15));
        const heartbeatCount = nextWatchSeconds > 0 && nextWatchSeconds % 15 === 0 ? current.heartbeatCount + 1 : current.heartbeatCount;
        const completionPercent = Math.min(100, Math.round((nextWatchSeconds / selectedCampaign.durationSeconds) * 100));
        const verified = nextWatchSeconds >= requiredSeconds && heartbeatCount >= expectedHeartbeats && current.antiCheatFlags.length === 0;
        const shouldSync = nextWatchSeconds % 15 === 0 || verified;
        const verifiedAt = verified && !current.verifiedAt ? new Date().toISOString() : current.verifiedAt;
        const claimableAt = verified && !current.claimAvailableAt ? new Date(Date.now() + selectedCampaign.rewardDelaySeconds * 1000).toISOString() : current.claimAvailableAt;

        if (shouldSync) {
          void persistSessionPatch({
            status: verified ? 'verified' : 'playing',
            watchSeconds: nextWatchSeconds,
            heartbeatCount,
            completionPercent,
            verifiedAt,
            claimableAt,
          });
        }

        return {
          ...current,
          watchSeconds: nextWatchSeconds,
          heartbeatCount,
          completionPercent,
          verifiedAt,
          claimAvailableAt,
          status: verified ? 'verified' : current.status,
          claimMessage: verified ? `Verification passed. Reward unlocks in ${selectedCampaign.rewardDelaySeconds} seconds.` : current.claimMessage,
        };
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [pageVisible, session.status, selectedCampaign.durationSeconds, selectedCampaign.rewardDelaySeconds, selectedCampaign.thresholdPercent, windowFocused]);

  const claimedCampaignIds = useMemo(() => new Set(history.filter((record) => record.status === 'claimed').map((record) => record.campaignId)), [history]);
  const alreadyClaimed = claimedCampaignIds.has(selectedCampaign.id);
  const frequencyLockUntil = useMemo(() => nextEligibleTime(history, selectedCampaign), [history, selectedCampaign]);
  const frequencyLockRemaining = frequencyLockUntil ? Math.max(0, Math.ceil((new Date(frequencyLockUntil).getTime() - clockTick) / 1000)) : 0;
  const rewardCountdown = session.claimAvailableAt ? Math.max(0, Math.ceil((new Date(session.claimAvailableAt).getTime() - clockTick) / 1000)) : 0;
  const canStartSession = !alreadyClaimed && frequencyLockRemaining === 0;
  const activeCampaignViewsToday = history.filter((record) => record.campaignId === selectedCampaign.id && record.status === 'claimed' && sameDay(record.completedAt, new Date().toISOString())).length;

  const analytics = useMemo(() => {
    const completedSessions = history.filter((record) => record.status === 'claimed');
    const suspiciousSessions = history.filter((record) => record.antiCheatFlags.length > 0);
    const totalWatchSeconds = history.reduce((sum, record) => sum + record.watchSeconds, 0);
    const totalHeartbeats = history.reduce((sum, record) => sum + record.heartbeatCount, 0);
    const averageCompletion = history.length ? Math.round(history.reduce((sum, record) => sum + record.completionPercent, 0) / history.length) : 0;
    const uniqueCampaignCount = new Set(history.map((record) => record.campaignId)).size;

    return {
      completedViews: completedSessions.length,
      uniqueCampaignCount,
      suspiciousSessions: suspiciousSessions.length,
      totalWatchSeconds,
      totalHeartbeats,
      totalPayout: completedSessions.reduce((sum, record) => sum + record.payout, 0),
      averageCompletion,
    };
  }, [history]);

  const handleStartSession = async () => {
    setClaimDenialMessage(null);

    if (!canStartSession) {
      setSession((current) => ({
        ...current,
        status: 'blocked',
        claimMessage: alreadyClaimed
          ? 'This campaign already has a unique rewarded view for your account.'
          : `Frequency lock active. Try again in ${formatDuration(frequencyLockRemaining)}.`,
      }));
      return;
    }

    if (!user?.id) {
      setSyncError('You must be signed in to start a rewarded video session.');
      return;
    }

    setSyncError(null);

    const campaignPayload: RewardVideoCampaignInput = {
      campaignKey: selectedCampaign.id,
      campaignTitle: selectedCampaign.title,
      provider: selectedCampaign.provider,
      videoUrl: selectedCampaign.videoUrl,
      rewardAmount: selectedCampaign.payout,
      currency: 'USD',
      xpReward: selectedCampaign.xpReward,
      rewardDelaySeconds: selectedCampaign.rewardDelaySeconds,
      thresholdPercent: selectedCampaign.thresholdPercent,
      frequencyMinutes: selectedCampaign.frequencyMinutes,
      maxViewsPerDay: selectedCampaign.maxViewsPerDay,
    };

    const startedAt = new Date().toISOString();

    try {
      const createdSession = await createRewardVideoSession(user.id, campaignPayload, createId('session'));
      setServerSessionId(createdSession.id);
      setSession({
        sessionId: createdSession.id,
        campaignId: selectedCampaign.id,
        status: 'playing',
        startedAt: createdSession.started_at ?? startedAt,
        verifiedAt: null,
        claimAvailableAt: null,
        watchSeconds: 0,
        heartbeatCount: 0,
        hiddenEvents: 0,
        focusLossCount: 0,
        seekViolations: 0,
        completionPercent: 0,
        antiCheatFlags: [],
        claimMessage: 'Session started. Keep the player active and in focus to stay eligible.',
      });

      setPageVisible(true);
      setWindowFocused(true);

      if (selectedCampaign.provider === 'self_hosted') {
        void videoRef.current?.play();
      }
    } catch {
      setSyncError('Unable to create the server-backed rewarded video session.');
    }
  };

  const handlePauseSession = () => {
    setSession((current) => {
      if (current.status !== 'playing') {
        return current;
      }

      const nextSession = {
        ...current,
        status: 'paused',
        claimMessage: 'Session paused. Resume playback before the verification timer can continue.',
      };

      void persistSessionPatch({
        status: 'paused',
      });

      return nextSession;
    });

    if (selectedCampaign.provider === 'self_hosted') {
      videoRef.current?.pause();
    }
  };

  const handleResumeSession = () => {
    setSession((current) => {
      if (current.status !== 'paused') {
        return current;
      }

      const nextSession = {
        ...current,
        status: 'playing',
        claimMessage: 'Session resumed. Verification is still in progress.',
      };

      void persistSessionPatch({
        status: 'playing',
      });

      return nextSession;
    });

    if (selectedCampaign.provider === 'self_hosted') {
      void videoRef.current?.play();
    }
  };

  const handleResetSession = () => {
    if (selectedCampaign.provider === 'self_hosted') {
      const videoElement = videoRef.current;

      if (videoElement) {
        videoElement.pause();
        videoElement.currentTime = 0;
      }
    }

    if (serverSessionId) {
      void persistSessionPatch({
        status: 'blocked',
      });
    }

    setServerSessionId(null);
    setClaimDenialMessage(null);
    setSession(createIdleSession(selectedCampaign, alreadyClaimed));
  };

  const handleSelfHostedTimeUpdate = () => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    setSession((current) => {
      if (current.status !== 'playing' && current.status !== 'verified') {
        return current;
      }

      const nextWatchSeconds = Math.max(current.watchSeconds, Math.floor(videoElement.currentTime));
      const completionPercent = Math.min(100, Math.round((nextWatchSeconds / selectedCampaign.durationSeconds) * 100));
      const requiredSeconds = Math.max(1, Math.ceil((selectedCampaign.durationSeconds * selectedCampaign.thresholdPercent) / 100));
      const expectedHeartbeats = Math.max(2, Math.floor(requiredSeconds / 15));
      const heartbeatCount = nextWatchSeconds > 0 && nextWatchSeconds % 15 === 0 && nextWatchSeconds !== current.watchSeconds ? current.heartbeatCount + 1 : current.heartbeatCount;
      const verified = nextWatchSeconds >= requiredSeconds && heartbeatCount >= expectedHeartbeats && current.antiCheatFlags.length === 0;
      const verifiedAt = verified && !current.verifiedAt ? new Date().toISOString() : current.verifiedAt;
      const claimableAt = verified && !current.claimAvailableAt ? new Date(Date.now() + selectedCampaign.rewardDelaySeconds * 1000).toISOString() : current.claimAvailableAt;

      if (nextWatchSeconds % 15 === 0 || verified) {
        void persistSessionPatch({
          status: verified ? 'verified' : 'playing',
          watchSeconds: nextWatchSeconds,
          heartbeatCount,
          completionPercent,
          verifiedAt,
          claimableAt,
        });
      }

      return {
        ...current,
        watchSeconds: nextWatchSeconds,
        heartbeatCount,
        completionPercent,
        verifiedAt,
        claimAvailableAt,
        status: verified ? 'verified' : current.status,
        claimMessage: verified ? `Verification passed. Reward unlocks in ${selectedCampaign.rewardDelaySeconds} seconds.` : current.claimMessage,
      };
    });
  };

  const handleSelfHostedSeeking = () => {
    setSession((current) => {
      if (current.status !== 'playing' && current.status !== 'verified') {
        return current;
      }

      const nextSession = {
        ...current,
        status: 'blocked',
        seekViolations: current.seekViolations + 1,
        antiCheatFlags: addUniqueFlag(current.antiCheatFlags, 'seek_attempt_detected'),
        claimMessage: 'Seek attempt detected. Reward verification has been blocked.',
      };

      void persistSessionPatch({
        status: 'blocked',
        seekViolations: nextSession.seekViolations,
        antiCheatFlags: nextSession.antiCheatFlags,
      });

      return nextSession;
    });

    if (selectedCampaign.provider === 'self_hosted') {
      videoRef.current?.pause();
    }
  };

  const handleSelfHostedEnded = () => {
    setSession((current) => {
      const requiredSeconds = Math.max(1, Math.ceil((selectedCampaign.durationSeconds * selectedCampaign.thresholdPercent) / 100));
      const expectedHeartbeats = Math.max(2, Math.floor(requiredSeconds / 15));
      const verified = current.watchSeconds >= requiredSeconds && current.heartbeatCount >= expectedHeartbeats && current.antiCheatFlags.length === 0;

      if (!verified) {
        const nextSession = {
          ...current,
          status: 'blocked',
          claimMessage: 'Video ended before the reward criteria were satisfied.',
        };

        void persistSessionPatch({
          status: 'blocked',
        });

        return nextSession;
      }

      const nextSession = {
        ...current,
        status: 'verified',
        verifiedAt: current.verifiedAt ?? new Date().toISOString(),
        claimAvailableAt:
          current.claimAvailableAt ?? new Date(Date.now() + selectedCampaign.rewardDelaySeconds * 1000).toISOString(),
        claimMessage: `Verification passed. Reward unlocks in ${selectedCampaign.rewardDelaySeconds} seconds.`,
      };

      void persistSessionPatch({
        status: 'verified',
        verifiedAt: nextSession.verifiedAt,
        claimableAt: nextSession.claimAvailableAt,
      });

      return nextSession;
    });
  };

  const handleClaimReward = async () => {
    setClaimDenialMessage(null);

    if (alreadyClaimed) {
      setClaimDenialMessage('This campaign has already been rewarded for your account.');
      return;
    }

    if (session.status !== 'verified') {
      setClaimDenialMessage('Reward claim is still pending verification.');
      return;
    }

    if (rewardCountdown > 0) {
      setClaimDenialMessage(`Reward claim unlocks in ${rewardCountdown}s.`);
      return;
    }

    if (session.antiCheatFlags.length > 0) {
      setClaimDenialMessage(`Reward claim is blocked by anti-cheat flags: ${session.antiCheatFlags.join(', ')}.`);
      return;
    }

    if (!serverSessionId) {
      setClaimDenialMessage('No server-backed reward session is available for claim.');
      return;
    }

    const claimGuard = evaluateRewardVideoClaim({
      session: {
        id: serverSessionId,
        user_id: user.id,
        campaign_key: selectedCampaign.id,
        campaign_title: selectedCampaign.title,
        provider: selectedCampaign.provider,
        video_url: selectedCampaign.videoUrl,
        session_token: serverSessionId,
        status: session.status,
        started_at: session.startedAt,
        verified_at: session.verifiedAt,
        claimable_at: session.claimAvailableAt,
        claimed_at: null,
        watch_seconds: session.watchSeconds,
        heartbeat_count: session.heartbeatCount,
        hidden_events: session.hiddenEvents,
        focus_loss_count: session.focusLossCount,
        seek_violations: session.seekViolations,
        completion_percent: session.completionPercent,
        anti_cheat_flags: session.antiCheatFlags,
        reward_amount: selectedCampaign.payout,
        currency: 'USD',
        xp_reward: selectedCampaign.xpReward,
        reward_delay_seconds: selectedCampaign.rewardDelaySeconds,
        threshold_percent: selectedCampaign.thresholdPercent,
        frequency_minutes: selectedCampaign.frequencyMinutes,
        created_at: session.startedAt ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      policy: {
        fraudThresholds: {
          ...defaultFraudThresholds,
          watchTimeMinutes: fraudWatchTimeMinutes,
        },
        rewardDelaySeconds: selectedCampaign.rewardDelaySeconds,
      },
    });

    if (!claimGuard.allowed) {
      setClaimDenialMessage(claimGuard.reason);
      return;
    }

    try {
      const claimResult = await claimRewardVideoSession(serverSessionId);
      setWalletBalance(claimResult.walletBalance);
      setSession((current) => ({
        ...current,
        status: 'claimed',
        claimMessage: `Reward paid: ${formatCurrency(claimResult.rewardAmount)} and ${selectedCampaign.xpReward} XP credited.`,
      }));

      if (user?.id) {
        const nextHistory = (await listRewardVideoSessions(user.id)).map(mapServerSessionToHistoryRecord);
        setHistory(nextHistory);
      }
    } catch {
      setClaimDenialMessage('Unable to claim the rewarded video payout from the server.');
    }
  };

  const providerBadge = campaignLabel(selectedCampaign);
  const completedToday = history.filter((record) => record.campaignId === selectedCampaign.id && record.status === 'claimed' && sameDay(record.completedAt, new Date().toISOString())).length;

  if (authLoading) {
    return (
      <div className="p-6">
        <Card className="border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Tasks</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Loading rewarded video sessions</h1>
          <p className="mt-2 text-mist/80">Fetching your profile before wiring the rewarded video system.</p>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <Card className="border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Tasks</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Sign in to view rewarded videos</h1>
          <p className="mt-2 text-mist/80">The advanced rewarded video flow is available to authenticated users only.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="overflow-hidden border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-0 shadow-2xl shadow-black/40">
        <div className="grid gap-6 border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.24),_transparent_36%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.18),_transparent_30%)] p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.34em] text-amber-200/80">Advanced rewarded video system</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Embedded video rewards with verification, anti-cheat checks, and analytics</h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              This flow supports self-hosted video, YouTube, and Vimeo playback. It tracks watch percentage, heartbeats, focus loss, tab switching, reward frequency,
              and unique-view payout history in the browser so the full verification path is visible.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-slate-200">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Session tracking: {session.sessionId}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Wallet balance: {formatCurrency(walletBalance)}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Unique views: {history.length}</span>
            </div>
            {claimDenialMessage ? <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{claimDenialMessage}</p> : null}
            {syncError ? <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{syncError}</p> : null}
            {serverHistoryLoading ? <p className="text-sm text-slate-400">Syncing rewarded video history from the server...</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-sm uppercase tracking-[0.24em] text-emerald-200/80">Live analytics</p>
              <p className="mt-3 text-3xl font-semibold text-white">{formatCompactNumber(analytics.completedViews)}</p>
              <p className="mt-2 text-sm text-slate-300">Completed rewarded views</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-sm uppercase tracking-[0.24em] text-sky-200/80">Risk signals</p>
              <p className="mt-3 text-3xl font-semibold text-white">{analytics.suspiciousSessions}</p>
              <p className="mt-2 text-sm text-slate-300">Flagged sessions and anti-cheat events</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-b border-white/10 bg-white/[0.02] p-4 md:grid-cols-3">
          <Link to="/app/wallet" className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-amber-300/50 hover:bg-amber-500/10">
            <p className="text-xs uppercase tracking-[0.24em] text-amber-200/80">Wallet</p>
            <p className="mt-2 text-lg font-semibold text-white">Review earnings</p>
            <p className="mt-1 text-sm text-slate-300">Check your payout balance before you claim or transfer.</p>
          </Link>
          <Link to="/app/profile" className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-emerald-300/50 hover:bg-emerald-500/10">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Profile</p>
            <p className="mt-2 text-lg font-semibold text-white">Open account</p>
            <p className="mt-1 text-sm text-slate-300">Review referrals, notifications, and security settings.</p>
          </Link>
          <Link to="/app/gamification" className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-sky-300/50 hover:bg-sky-500/10">
            <p className="text-xs uppercase tracking-[0.24em] text-sky-200/80">Leaderboard</p>
            <p className="mt-2 text-lg font-semibold text-white">View ranking</p>
            <p className="mt-1 text-sm text-slate-300">See the seasonal progression system and active modules.</p>
          </Link>
        </div>

        <div className="grid gap-3 border-b border-white/10 bg-white/[0.02] p-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-sky-200/80">Session state</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{selectedCampaign.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{session.claimMessage}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
                <p className="mt-2 text-lg font-semibold text-white">{session.status}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Countdown</p>
                <p className="mt-2 text-lg font-semibold text-white">{session.status === 'verified' ? `${rewardCountdown}s` : 'Locked'}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Focus</p>
                <p className="mt-2 text-lg font-semibold text-white">{pageVisible && windowFocused ? 'Active' : 'Inactive'}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Claim</p>
                <p className="mt-2 text-lg font-semibold text-white">{alreadyClaimed ? 'Done' : 'Pending'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Quick actions</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Resume the flow</h2>
            <p className="mt-2 text-sm text-slate-300">Use the primary session actions, or jump back to wallet and profile for follow-up work.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleStartSession}
                disabled={!canStartSession}
                className="rounded-full bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start
              </button>
              <button
                type="button"
                onClick={handlePauseSession}
                disabled={session.status !== 'playing'}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={handleResumeSession}
                disabled={session.status !== 'paused'}
                className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={handleClaimReward}
                disabled={alreadyClaimed || session.status !== 'verified' || rewardCountdown > 0 || session.antiCheatFlags.length > 0}
                className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Claim reward
              </button>
              <button
                type="button"
                onClick={handleResetSession}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
              >
                Reset
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link to="/app/wallet" className="text-emerald-200/90 hover:text-emerald-100">Open wallet →</Link>
              <Link to="/app/profile" className="text-emerald-200/90 hover:text-emerald-100">Open profile →</Link>
              <Link to="/app/gamification" className="text-emerald-200/90 hover:text-emerald-100">View leaderboard →</Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-b border-white/10 bg-white/[0.02] p-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Wallet payout</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(analytics.totalPayout)}</p>
            <p className="mt-1 text-sm text-slate-400">Issued across {analytics.completedViews} paid sessions</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Watch time</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatDuration(analytics.totalWatchSeconds)}</p>
            <p className="mt-1 text-sm text-slate-400">Tracked across all rewarded sessions</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Heartbeats</p>
            <p className="mt-2 text-2xl font-semibold text-white">{analytics.totalHeartbeats}</p>
            <p className="mt-1 text-sm text-slate-400">Verification beacons captured during playback</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Average completion</p>
            <p className="mt-2 text-2xl font-semibold text-white">{analytics.averageCompletion}%</p>
            <p className="mt-1 text-sm text-slate-400">Measured across recorded video sessions</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <Card className="border border-white/10 bg-white/5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-amber-200/80">Campaign queue</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Rewarded video inventory</h2>
                <p className="mt-2 text-sm text-slate-300">Pick a video to inspect provider support, reward rules, and anti-cheat coverage.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">{selectedCampaign.maxViewsPerDay} view/day cap</span>
            </div>

            <div className="mt-5 space-y-3">
              {videoCampaigns.map((campaign) => {
                const isSelected = campaign.id === selectedCampaign.id;
                const campaignClaimed = claimedCampaignIds.has(campaign.id);

                return (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => setSelectedCampaignId(campaign.id)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      isSelected ? 'border-amber-300/60 bg-amber-500/10 shadow-lg shadow-amber-500/10' : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{campaignLabel(campaign)}</p>
                        <h3 className="mt-2 text-lg font-semibold text-white">{campaign.title}</h3>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs ${campaignClaimed ? 'bg-emerald-500/15 text-emerald-200' : 'bg-sky-500/15 text-sky-200'}`}>
                        {campaignClaimed ? 'Unique view rewarded' : 'Available'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{campaign.description}</p>
                    <div className="mt-4 grid gap-2 text-sm text-slate-200 sm:grid-cols-3">
                      <span>Reward: {formatCurrency(campaign.payout)}</span>
                      <span>Delay: {campaign.rewardDelaySeconds}s</span>
                      <span>Threshold: {campaign.thresholdPercent}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-sky-200/80">Session controls</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Reward timer and claim flow</h2>
            <p className="mt-2 text-sm text-slate-300">The timer starts only while the session is active, focused, and visible.</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Watch percentage</p>
                <p className="mt-2 text-3xl font-semibold text-white">{session.completionPercent}%</p>
                <p className="mt-1 text-sm text-slate-400">{formatDuration(session.watchSeconds)} of {formatDuration(selectedCampaign.durationSeconds)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Reward timer</p>
                <p className="mt-2 text-3xl font-semibold text-white">{session.status === 'verified' ? `${rewardCountdown}s` : 'Locked'}</p>
                <p className="mt-1 text-sm text-slate-400">Payout unlocks after verification passes</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleStartSession}
                disabled={!canStartSession}
                className="rounded-full bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start session
              </button>
              <button
                type="button"
                onClick={handlePauseSession}
                disabled={session.status !== 'playing'}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={handleResumeSession}
                disabled={session.status !== 'paused'}
                className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={handleResetSession}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
              >
                Reset
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              <p className="font-medium text-white">Session status: {session.status}</p>
              <p className="mt-2">{session.claimMessage}</p>
              <p className="mt-2 text-slate-400">Claim availability: {session.claimAvailableAt ? formatShortTime(session.claimAvailableAt) : 'Waiting for verification'}</p>
              <p className="mt-2 text-slate-400">Focus state: {pageVisible && windowFocused ? 'active' : 'inactive'}</p>
              {claimDenialMessage ? <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-amber-100">{claimDenialMessage}</p> : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">Today: {completedToday} completed view{completedToday === 1 ? '' : 's'}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">Frequency: every {selectedCampaign.frequencyMinutes} minutes</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">Provider: {providerBadge}</span>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden border border-white/10 bg-white/5 p-0">
            <div className="border-b border-white/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-200/80">Player</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{selectedCampaign.title}</h2>
                  <p className="mt-2 text-sm text-slate-300">{selectedCampaign.description}</p>
                </div>
                <div className="text-right text-sm text-slate-300">
                  <p>{selectedCampaign.sourceLabel}</p>
                  <p className="mt-1 text-slate-400">{selectedCampaign.embedHint}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-0 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="relative bg-black">
                <div className="aspect-video w-full">
                  {selectedCampaign.provider === 'self_hosted' ? (
                    <video
                      ref={videoRef}
                      src={selectedCampaign.videoUrl}
                      className="h-full w-full object-cover"
                      controls={false}
                      playsInline
                      preload="metadata"
                      onTimeUpdate={handleSelfHostedTimeUpdate}
                      onSeeking={handleSelfHostedSeeking}
                      onEnded={handleSelfHostedEnded}
                      onPlay={() => setSession((current) => (current.status === 'blocked' || current.status === 'claimed' ? current : { ...current, status: 'playing' }))}
                      onPause={() => setSession((current) => (current.status === 'playing' ? { ...current, status: 'paused', claimMessage: 'Playback paused from the HTML5 player.' } : current))}
                    />
                  ) : (
                    <iframe
                      title={selectedCampaign.title}
                      src={buildEmbedUrl(selectedCampaign)}
                      className="h-full w-full border-0"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>

                <div className="border-t border-white/10 bg-slate-950/80 p-4 text-sm text-slate-300">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>{selectedCampaign.verificationLabel}</span>
                    <span>{selectedCampaign.antiCheatLabel}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-l border-white/10 bg-slate-950/50 p-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Verification stack</p>
                  <div className="mt-3 space-y-3 text-sm text-slate-300">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Reward timer waits {selectedCampaign.rewardDelaySeconds} seconds after verification.</div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Heartbeat verification runs every 15 seconds while the session is active.</div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Unique view verification allows a single paid redemption per campaign.</div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Ad frequency limits repeat impressions before another eligible watch window opens.</div>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Anti-cheat telemetry</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-slate-400">Hidden events</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{session.hiddenEvents}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-slate-400">Focus losses</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{session.focusLossCount}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-slate-400">Seek violations</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{session.seekViolations}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-slate-400">Heartbeats</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{session.heartbeatCount}</p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClaimReward}
                  disabled={alreadyClaimed || session.status !== 'verified' || rewardCountdown > 0 || session.antiCheatFlags.length > 0}
                  className="w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {alreadyClaimed
                    ? 'Reward already claimed'
                    : session.status === 'verified'
                      ? rewardCountdown > 0
                        ? `Unlocks in ${rewardCountdown}s`
                        : 'Claim reward payout'
                      : 'Complete verification to claim'}
                </button>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Current session</p>
                  <dl className="mt-4 space-y-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <dt>Started</dt>
                      <dd className="text-white">{formatShortTime(session.startedAt)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>Verified</dt>
                      <dd className="text-white">{formatShortTime(session.verifiedAt)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>Watch percentage</dt>
                      <dd className="text-white">{session.completionPercent}%</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>Provider</dt>
                      <dd className="text-white">{providerBadge}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-amber-200/80">Audit trail</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Reward analytics and session history</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-slate-400">Total payouts</p>
                <p className="mt-2 text-2xl font-semibold text-white">{analytics.completedViews}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-slate-400">Unique campaigns</p>
                <p className="mt-2 text-2xl font-semibold text-white">{analytics.uniqueCampaignCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-slate-400">Frequency lock</p>
                <p className="mt-2 text-2xl font-semibold text-white">{frequencyLockRemaining ? formatDuration(frequencyLockRemaining) : 'Open'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-slate-400">Today’s views</p>
                <p className="mt-2 text-2xl font-semibold text-white">{activeCampaignViewsToday}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {history.length ? (
                history.map((record) => {
                  const campaign = videoCampaigns.find((entry) => entry.id === record.campaignId);

                  return (
                    <div key={record.sessionId} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{campaign ? campaignLabel(campaign) : record.provider}</p>
                          <h3 className="mt-1 text-lg font-semibold text-white">{campaign?.title ?? 'Reward session'}</h3>
                        </div>
                        <div className="text-right text-sm text-slate-300">
                          <p>{formatCurrency(record.payout)} payout</p>
                          <p className="mt-1 text-slate-400">{formatDateTime(record.completedAt)}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-slate-300 md:grid-cols-3">
                        <span>Completion: {record.completionPercent}%</span>
                        <span>Heartbeats: {record.heartbeatCount}</span>
                        <span>Anti-cheat flags: {record.antiCheatFlags.length}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-slate-300">
                  No rewarded video claims have been recorded yet. Start a session to generate a verifiable audit trail.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
