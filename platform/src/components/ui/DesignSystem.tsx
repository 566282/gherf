import type { HTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

export function Badge({ tone = 'neutral', children }: PropsWithChildren<{ tone?: BadgeTone }>): JSX.Element {
  const toneClasses: Record<BadgeTone, string> = {
    neutral: 'bg-surface-elevated text-muted',
    accent: 'bg-accent-soft text-accent',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    error: 'bg-error/15 text-error',
    info: 'bg-info/15 text-info',
  };

  return <span className={clsx('badge', toneClasses[tone])}>{children}</span>;
}

export function Avatar({ name, imageUrl, size = 'md' }: { name: string; imageUrl?: string; size?: 'sm' | 'md' | 'lg' }): JSX.Element {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
  };

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  return imageUrl ? (
    <img src={imageUrl} alt={name} className={clsx('rounded-full object-cover', sizeClasses[size])} />
  ) : (
    <div className={clsx('grid place-items-center rounded-full border border-border bg-accent-soft font-semibold text-accent', sizeClasses[size])}>
      {initials}
    </div>
  );
}

export function ProgressBar({ value, max = 100, label }: { value: number; max?: number; label?: string }): JSX.Element {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="grid gap-2">
      {label ? <div className="flex items-center justify-between text-sm text-muted"><span>{label}</span><span>{Math.round(percentage)}%</span></div> : null}
      <div className="h-2 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }): JSX.Element {
  return <div aria-hidden="true" className={clsx('animate-pulse rounded-xl bg-surface-elevated', className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="grid gap-3 rounded-2xl border border-dashed border-border bg-surface/70 p-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-accent-soft" />
      <div className="space-y-1">
        <p className="text-lg font-semibold text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; to?: string }> }): JSX.Element {
  return (
    <nav aria-label="Breadcrumbs" className="flex flex-wrap items-center gap-2 text-sm text-muted">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
          {item.to ? (
            <Link to={item.to} className="transition hover:text-accent">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
          {index < items.length - 1 ? <span aria-hidden="true">/</span> : null}
        </span>
      ))}
    </nav>
  );
}

export function Tabs<T extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; description?: string }>;
  activeTab: T;
  onChange: (tab: T) => void;
}): JSX.Element {
  return (
    <div role="tablist" aria-label="Tabs" className="flex flex-wrap gap-2 rounded-2xl border border-border bg-surface-elevated p-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'rounded-xl px-4 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            activeTab === tab.id ? 'bg-accent text-accent-foreground' : 'text-muted hover:bg-surface hover:text-foreground',
          )}
        >
          <span>{tab.label}</span>
          {tab.description ? <span className="sr-only">{tab.description}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (value: string) => void; placeholder?: string }): JSX.Element {
  return <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="input-base" />;
}

export function FilterChips({
  chips,
  activeChip,
  onChange,
}: {
  chips: string[];
  activeChip?: string;
  onChange: (chip: string) => void;
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onChange(chip)}
          className={clsx('rounded-full border px-3 py-1 text-sm transition', activeChip === chip ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-muted hover:text-foreground')}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}): JSX.Element {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-2">
      <button type="button" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-50" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
        Previous
      </button>
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onPageChange(page)}
          className={clsx('rounded-xl border px-3 py-2 text-sm transition', currentPage === page ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface text-foreground hover:border-accent/40')}
        >
          {page}
        </button>
      ))}
      <button type="button" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
        Next
      </button>
    </nav>
  );
}

export function DataGrid<RowType>({
  columns,
  rows,
  emptyMessage = 'No records available.',
}: {
  columns: Array<{ key: string; label: string }>;
  rows: RowType[];
  emptyMessage?: string;
}): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface-elevated text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 font-medium uppercase tracking-[0.2em]">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-foreground/85">
                    {String((row as Record<string, unknown>)[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-muted">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Timeline({ items }: { items: Array<{ title: string; description?: string; meta?: string }> }): JSX.Element {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="flex gap-4">
          <div className="mt-1 flex flex-col items-center">
            <span className="h-3 w-3 rounded-full bg-accent" />
            {index < items.length - 1 ? <span className="mt-2 min-h-8 w-px flex-1 bg-border" /> : null}
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="font-medium text-foreground">{item.title}</p>
            {item.meta ? <p className="text-xs uppercase tracking-[0.2em] text-muted">{item.meta}</p> : null}
            {item.description ? <p className="mt-2 text-sm text-muted">{item.description}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationBanner({ tone = 'neutral', title, description }: { tone?: BadgeTone; title: string; description?: string }): JSX.Element {
  return (
    <div className={clsx('rounded-2xl border p-4', tone === 'accent' && 'border-accent/30 bg-accent-soft', tone === 'success' && 'border-success/30 bg-success/15', tone === 'warning' && 'border-warning/30 bg-warning/15', tone === 'error' && 'border-error/30 bg-error/15', tone === 'info' && 'border-info/30 bg-info/15', tone === 'neutral' && 'border-border bg-surface-elevated')}>
      <p className="font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
    </div>
  );
}

export function Toast({ title, description }: { title: string; description?: string }): JSX.Element {
  return <NotificationBanner tone="accent" title={title} description={description} />;
}

export function Modal({ open, title, children, onClose }: PropsWithChildren<{ open: boolean; title: string; onClose: () => void }>): JSX.Element | null {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-surface p-6 shadow-depth">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-sm text-muted transition hover:text-foreground">
            Close
          </button>
        </div>
        <div className="text-foreground/90">{children}</div>
      </div>
    </div>
  );
}

export function Accordion({ items }: { items: Array<{ title: string; content: ReactNode }> }): JSX.Element {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <details key={item.title} className="rounded-2xl border border-border bg-surface">
          <summary className="cursor-pointer list-none px-4 py-3 font-medium text-foreground">{item.title}</summary>
          <div className="px-4 pb-4 text-sm text-muted">{item.content}</div>
        </details>
      ))}
    </div>
  );
}

function MetricCard({ title, value, description }: { title: string; value: string; description?: string }): JSX.Element {
  return (
    <Card className="border border-border bg-surface-elevated">
      <p className="text-sm text-muted">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
      {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
    </Card>
  );
}

export const WalletCard = MetricCard;
export const CampaignCard = MetricCard;
export const TaskCard = MetricCard;
export const ReferralCard = MetricCard;
export const AnalyticsCard = MetricCard;