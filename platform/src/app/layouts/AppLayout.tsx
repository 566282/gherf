import type { PropsWithChildren } from 'react';
import { useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import { useLogout } from '@/hooks/useLogout';
import { usePermissions } from '@/hooks/useAuth';

type NavItem = {
  label: string;
  path: string;
  description: string;
};

const appNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/app', description: 'Overview and status' },
  { label: 'Campaigns', path: '/app/campaigns', description: 'Browse available tasks' },
  { label: 'Tasks', path: '/app/tasks', description: 'Complete actions' },
  { label: 'Wallet', path: '/app/wallet', description: 'Rewards and history' },
  { label: 'Profile', path: '/app/profile', description: 'Account settings' },
];

const businessNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/business', description: 'Growth overview' },
  { label: 'Campaigns', path: '/business/campaigns', description: 'Manage launches' },
  { label: 'Analytics', path: '/business/analytics', description: 'Performance and ROI' },
  { label: 'Communications', path: '/business/communications', description: 'Messages and follow-up' },
  { label: 'Profile', path: '/app/profile', description: 'Account settings' },
];

function getInitials(name?: string | null): string {
  if (!name) {
    return 'G';
  }

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export function AppLayout({ children }: PropsWithChildren): JSX.Element {
  const { profile } = useAuth();
  const permissions = usePermissions();
  const { handleLogout, isLoggingOut } = useLogout();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isBusinessShell = location.pathname.startsWith('/business');
  const shellBase = isBusinessShell ? '/business' : '/app';
  const navItems = isBusinessShell ? businessNavItems : appNavItems;
  const primaryAction = isBusinessShell
    ? { label: 'New campaign', path: '/business/campaigns/new' }
    : { label: 'Continue tasks', path: '/app/tasks' };

  const activeNavItems = useMemo(
    () =>
      navItems.map((item) => ({
        ...item,
        active: location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
      })),
    [location.pathname, navItems],
  );

  const unreadNotifications = profile?.unreadNotificationsCount ?? 0;
  const roleLabel = profile?.levelLabel ?? profile?.role ?? 'Guest';
  const profileName = profile?.fullName ?? 'Guest';
  const initial = getInitials(profile?.fullName);

  const submitSearch = () => {
    const query = searchQuery.trim();
    const target = query.length ? `${shellBase}/campaigns?q=${encodeURIComponent(query)}` : `${shellBase}/campaigns`;
    navigate(target);
    setMobileDrawerOpen(false);
  };

  const bottomNavItems = [
    { label: 'Home', path: shellBase, emoji: '⌂' },
    { label: 'Campaigns', path: `${shellBase}/campaigns`, emoji: '⌁' },
    { label: isBusinessShell ? 'Analytics' : 'Wallet', path: isBusinessShell ? `${shellBase}/analytics` : `${shellBase}/wallet`, emoji: '◌' },
    { label: 'Profile', path: '/app/profile', emoji: '☺' },
  ];

  return (
    <div className="min-h-screen bg-hero text-foreground">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside
          className={clsx(
            'hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-border lg:bg-background/80 lg:backdrop-blur-xl lg:transition-all lg:duration-300',
            sidebarOpen ? 'lg:w-72' : 'lg:w-24',
          )}
          aria-label={isBusinessShell ? 'Business navigation' : 'App navigation'}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
            <Link to={shellBase} className="flex items-center gap-3 rounded-xl px-2 py-1 transition hover:bg-surface-elevated">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent text-sm font-bold text-accent-foreground">G</span>
              {sidebarOpen ? (
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Go4Wealth</p>
                  <p className="text-xs text-muted">{isBusinessShell ? 'Business shell' : 'User shell'}</p>
                </div>
              ) : null}
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              className="rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent"
            >
              {sidebarOpen ? '←' : '→'}
            </button>
          </div>

          {sidebarOpen ? (
            <div className="border-b border-border/60 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.28em] text-muted">Signed in as</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{profileName}</p>
              <p className="text-sm text-muted">{roleLabel}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border bg-surface-elevated p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Notifications</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{unreadNotifications}</p>
                </div>
                <div className="rounded-2xl border border-border bg-surface-elevated p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Level</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{profile?.levelTier ?? 0}</p>
                </div>
              </div>
            </div>
          ) : null}

          <nav aria-label="Primary" className="flex-1 space-y-1 px-3 py-4">
            {activeNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                aria-current={item.active ? 'page' : undefined}
                aria-label={!sidebarOpen ? item.label : undefined}
                className={clsx(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  item.active ? 'bg-accent-soft text-accent font-medium' : 'text-foreground hover:bg-surface-elevated hover:text-accent',
                )}
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface-elevated text-xs font-semibold text-foreground/80">{item.label.charAt(0)}</span>
                {sidebarOpen ? (
                  <span className="min-w-0">
                    <span className="block">{item.label}</span>
                    <span className="block text-xs text-muted">{item.description}</span>
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>

          {sidebarOpen ? (
            <div className="mt-auto border-t border-border/60 p-5">
              <div className="rounded-3xl border border-border bg-surface/80 p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-muted">Quick action</p>
                <Link
                  to={primaryAction.path}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent-strong"
                >
                  {primaryAction.label}
                </Link>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-3xl border border-border bg-surface-elevated p-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{initial}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{profileName}</p>
                  <p className="truncate text-xs text-muted">{profile?.email ?? 'No email on file'}</p>
                </div>
              </div>
            </div>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="rounded-full border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent lg:hidden"
                aria-label="Open navigation drawer"
              >
                ☰
              </button>

              <div className="min-w-0 flex-1">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitSearch();
                  }}
                  className="hidden md:flex"
                >
                  <label className="w-full max-w-2xl">
                    <span className="sr-only">Quick search</span>
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder={isBusinessShell ? 'Search campaigns, analytics, communications' : 'Search campaigns, tasks, rewards'}
                      className="input-base w-full bg-surface-elevated/80"
                    />
                  </label>
                </form>
              </div>

              <details className="relative">
                <summary className="list-none cursor-pointer rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  Notifications
                  {unreadNotifications > 0 ? <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">{unreadNotifications}</span> : null}
                </summary>
                <div className="absolute right-0 mt-2 w-80 rounded-3xl border border-border bg-surface p-4 shadow-2xl shadow-black/25">
                  <p className="text-xs uppercase tracking-[0.28em] text-muted">Notifications</p>
                  <p className="mt-2 text-sm text-foreground">{unreadNotifications > 0 ? `${unreadNotifications} unread updates` : 'No unread notifications'}</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-border bg-surface-elevated p-3 text-sm text-foreground/85">
                      New campaign approvals and payout events appear here.
                    </div>
                    <Link to="/help-center" className="block rounded-2xl border border-border px-3 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                      Open help center
                    </Link>
                  </div>
                </div>
              </details>

              <details className="relative">
                <summary className="list-none cursor-pointer rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                  <span className="inline-flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{initial}</span>
                    <span className="hidden sm:block">
                      {profileName}
                    </span>
                  </span>
                </summary>
                <div className="absolute right-0 mt-2 w-72 rounded-3xl border border-border bg-surface p-4 shadow-2xl shadow-black/25">
                  <p className="text-xs uppercase tracking-[0.28em] text-muted">Profile</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{profileName}</p>
                  <p className="text-sm text-muted">{roleLabel}</p>
                  <div className="mt-4 grid gap-2">
                    <Link to="/app/profile" className="rounded-2xl border border-border px-3 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                      View profile
                    </Link>
                    <Link to={primaryAction.path} className="rounded-2xl border border-border px-3 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                      {primaryAction.label}
                    </Link>
                    {profile ? (
                      <Button variant="ghost" disabled={isLoggingOut} onClick={() => void handleLogout()} className="justify-center">
                        {isLoggingOut ? 'Signing out…' : 'Sign out'}
                      </Button>
                    ) : (
                      <Link to="/login" className="rounded-2xl border border-border px-3 py-2 text-center text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
                        Sign in
                      </Link>
                    )}
                  </div>
                </div>
              </details>
            </div>
          </header>

          <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children ?? <Outlet />}
          </main>
        </div>
      </div>

      {mobileDrawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-background/70 backdrop-blur-sm" aria-label="Close navigation drawer" onClick={() => setMobileDrawerOpen(false)} />
          <aside className="relative flex h-full w-[85%] max-w-sm flex-col border-r border-border bg-background/96 p-4 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Go4Wealth</p>
                <p className="text-xs text-muted">{isBusinessShell ? 'Business shell' : 'User shell'}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="rounded-full border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground"
                aria-label="Close navigation drawer"
              >
                ✕
              </button>
            </div>

            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
            >
              <label className="block">
                <span className="sr-only">Quick search</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search campaigns or tasks"
                  className="input-base w-full"
                />
              </label>
            </form>

            <nav aria-label="Mobile navigation" className="mt-4 grid gap-2">
              {activeNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={clsx(
                    'rounded-2xl border px-4 py-3 text-sm transition',
                    item.active ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-foreground hover:border-accent/40 hover:text-accent',
                  )}
                >
                  <span className="block font-medium">{item.label}</span>
                  <span className="block text-xs text-muted">{item.description}</span>
                </Link>
              ))}
            </nav>

            <div className="mt-auto space-y-3 border-t border-border pt-4">
              <Link
                to={primaryAction.path}
                onClick={() => setMobileDrawerOpen(false)}
                className="block rounded-full bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-foreground"
              >
                {primaryAction.label}
              </Link>
              <Link
                to="/help-center"
                onClick={() => setMobileDrawerOpen(false)}
                className="block rounded-full border border-border bg-surface-elevated px-4 py-3 text-center text-sm text-foreground"
              >
                Help center
              </Link>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/92 px-3 py-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          {bottomNavItems.map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2 text-xs transition',
                  active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-elevated hover:text-foreground',
                )}
              >
                <span aria-hidden="true" className="text-base">{item.emoji}</span>
                <span className="mt-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <Link
        to={primaryAction.path}
        className="fixed bottom-20 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-accent text-base font-semibold text-accent-foreground shadow-2xl shadow-black/35 transition hover:bg-accent-strong lg:hidden"
        aria-label={primaryAction.label}
      >
        +
      </Link>
    </div>
  );
}
