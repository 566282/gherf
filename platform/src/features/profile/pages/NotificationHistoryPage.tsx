import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/app/providers/AuthProvider';
import { listNotifications, markNotificationAsRead, markNotificationsAsRead } from '@/services/api/auth';
import type { NotificationItem } from '@/types/auth';

function formatTime(time: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(time));
}

export function NotificationHistoryPage(): JSX.Element {
  const { profile, refreshProfile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [hasMorePages, setHasMorePages] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const offset = (page - 1) * pageSize;

    void listNotifications(profile.id, pageSize + 1, offset)
      .then((items) => {
        setNotifications(items.slice(0, pageSize));
        setHasMorePages(items.length > pageSize);
      })
      .catch(() => {
        setNotifications([]);
        setHasMorePages(false);
      });
  }, [page, pageSize, profile]);

  const stats = useMemo(() => {
    const unread = notifications.filter((item) => !item.isRead).length;
    return { total: notifications.length, unread, read: notifications.length - unread };
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    const search = query.trim().toLowerCase();

    return notifications.filter((item) => {
      const matchesFilter = filter === 'all' || (filter === 'unread' ? !item.isRead : item.isRead);
      const matchesSearch = !search || item.title.toLowerCase().includes(search) || item.message.toLowerCase().includes(search);
      return matchesFilter && matchesSearch;
    });
  }, [filter, notifications, query]);

  const pageItems = filteredNotifications;
  const currentPage = page;

  const handleMarkAsRead = async (notificationId: string) => {
    if (!profile) return;

    try {
      await markNotificationAsRead(profile.id, notificationId);
      setNotifications((current) => current.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item)));
      await refreshProfile();
    } catch {
      // Keep the inbox usable even if the update is blocked by RLS or a transient error.
    }
  };

  const handleMarkPageAsRead = async () => {
    if (!profile) return;

    const unreadIds = pageItems.filter((item) => !item.isRead).map((item) => item.id);

    try {
      await markNotificationsAsRead(profile.id, unreadIds);
      setNotifications((current) => current.map((item) => (unreadIds.includes(item.id) ? { ...item, isRead: true } : item)));
      await refreshProfile();
    } catch {
      // Keep the inbox usable even if the bulk update is blocked by RLS or a transient error.
    }
  };

  if (!profile) {
    return (
      <div className="p-6">
        <Card>
          <h1 className="text-3xl font-bold text-white">Notifications</h1>
          <p className="mt-2 text-mist/80">Sign in to view your notification history.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="bg-[linear-gradient(135deg,rgba(12,16,22,0.98),rgba(19,24,32,0.96))]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-mint">Inbox</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Notification history</h1>
            <p className="mt-2 max-w-2xl text-mist/80">
              Review withdrawal notices, approval updates, wallet events, and other account messages from the app.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm text-mist/80">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Total</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Unread</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stats.unread}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-mint/70">Read</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stats.read}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-white/5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search notifications</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search notification titles or messages"
              className="input-base w-full bg-white/5"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setFilter('unread');
                setPage(1);
              }}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10"
            >
              Unread only
            </button>
          {(['all', 'unread', 'read'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setFilter(option);
                setPage(1);
              }}
              className={option === filter ? 'rounded-full bg-ember px-4 py-2 text-sm font-medium text-ink' : 'rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white'}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </button>
          ))}
          <Link to="/app/profile" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10">
            Back to profile
          </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleMarkPageAsRead()}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-mint/30 hover:bg-mint/10"
          >
            Mark page as read
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {pageItems.length ? pageItems.map((item) => (
            <article key={item.id} className={`rounded-2xl border p-4 ${item.isRead ? 'border-white/10 bg-white/[0.04]' : 'border-mint/30 bg-mint/5'}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-mist/80">{item.message}</p>
                </div>
                <div className="flex flex-col items-end gap-2 text-right text-xs uppercase tracking-[0.18em] text-mint/70">
                  <p>{item.isRead ? 'Read' : 'Unread'}</p>
                  <p className="normal-case tracking-normal text-mist/70">{formatTime(item.createdAt)}</p>
                  {!item.isRead ? (
                    <button
                      type="button"
                      onClick={() => void handleMarkAsRead(item.id)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white transition hover:border-mint/30 hover:bg-mint/10"
                    >
                      Mark as read
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          )) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-mist/80">No notifications match this filter.</p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-mist/70">
          <p>
            Showing {pageItems.length} of {filteredNotifications.length} notifications
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              Prev
            </button>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white">
              Page {currentPage}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={!hasMorePages}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}