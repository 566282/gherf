import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pagination, Timeline } from '@/components/ui/DesignSystem';
import { useAuth } from '@/app/providers/AuthProvider';
import { listAdminModuleCatalog, updateAdminModuleCatalog } from '@/services/api/admin';
import type { EnterpriseModuleActivityItem, EnterpriseModuleBulkAction, EnterpriseModuleConfig, EnterpriseModuleRecord } from '../data/enterpriseModules';

type SortKey = 'name' | 'category' | 'status' | 'owner' | 'value' | 'updatedAt' | 'risk';
type ExportScope = 'filtered' | 'selected' | 'page';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusTone(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized.includes('active') || normalized.includes('live') || normalized.includes('published') || normalized.includes('approved') || normalized.includes('enabled') || normalized.includes('granted') || normalized.includes('healthy') || normalized.includes('delivered')) {
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  }

  if (normalized.includes('pause') || normalized.includes('review') || normalized.includes('pending') || normalized.includes('scheduled') || normalized.includes('assigned') || normalized.includes('staged') || normalized.includes('draft') || normalized.includes('flag')) {
    return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  }

  if (normalized.includes('reject') || normalized.includes('block') || normalized.includes('frozen') || normalized.includes('disabled') || normalized.includes('revoked') || normalized.includes('archived') || normalized.includes('quarantined')) {
    return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  }

  return 'border-white/10 bg-white/5 text-mist/80';
}

function riskTone(risk: EnterpriseModuleRecord['risk']): string {
  if (risk === 'High') return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  if (risk === 'Medium') return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function getModuleKey(config: EnterpriseModuleConfig): string {
  return config.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function downloadCsv(filename: string, rows: EnterpriseModuleRecord[]): void {
  const headers = ['Name', 'Category', 'Status', 'Owner', 'Value', 'Updated', 'Risk', 'Notes'];
  const csv = [headers.join(','), ...rows.map((row) => [row.name, row.category, row.status, row.owner, row.value, formatDate(row.updatedAt), row.risk, row.notes].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function EnterpriseModulePage({ config }: { config: EnterpriseModuleConfig }): JSX.Element {
  const { profile } = useAuth();
  const [rows, setRows] = useState<EnterpriseModuleRecord[]>(config.records);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [exportScope, setExportScope] = useState<ExportScope>('filtered');
  const [activity, setActivity] = useState<EnterpriseModuleActivityItem[]>(config.activity);
  const [syncMessage, setSyncMessage] = useState('Loading Supabase-linked module state...');
  const moduleKey = useMemo(() => getModuleKey(config), [config]);

  useEffect(() => {
    let active = true;

    setRows(config.records);
    setActivity(config.activity);
    setSelectedIds([]);
    setCurrentPage(1);
    setSyncMessage('Loading Supabase-linked module state...');

    void listAdminModuleCatalog()
      .then((catalog) => {
        if (!active) return;

        const entry = catalog[moduleKey];

        if (entry?.records.length) {
          setRows(entry.records);
        }

        if (entry?.activity.length) {
          setActivity(entry.activity);
        }

        if (!entry) {
          void updateAdminModuleCatalog(moduleKey, { records: config.records, activity: config.activity }, profile?.id)
            .then(() => {
              if (!active) return;
              setSyncMessage('Seeded Supabase with the module defaults.');
            })
            .catch(() => {
              if (!active) return;
              setSyncMessage('Using seeded defaults until the Supabase catalog can be created.');
            });
          return;
        }

        setSyncMessage('Synced from Supabase.');
      })
      .catch(() => {
        if (!active) return;
        setSyncMessage('Using seeded defaults until Supabase data is available.');
      });

    return () => {
      active = false;
    };
  }, [config.activity, config.records, moduleKey]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(rows.map((row) => row.category))).sort((left, right) => left.localeCompare(right))], [rows]);
  const statuses = useMemo(() => ['all', ...Array.from(new Set(rows.map((row) => row.status))).sort((left, right) => left.localeCompare(right))], [rows]);
  const owners = useMemo(() => ['all', ...Array.from(new Set(rows.map((row) => row.owner))).sort((left, right) => left.localeCompare(right))], [rows]);

  const filteredRows = useMemo(() => {
    const search = normalizeText(query);

    return rows.filter((row) => {
      const matchesCategory = categoryFilter === 'all' || row.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchesOwner = ownerFilter === 'all' || row.owner === ownerFilter;
      const searchable = [row.name, row.category, row.status, row.owner, row.value, row.notes, row.risk].join(' ').toLowerCase();
      const matchesSearch = search.length === 0 || searchable.includes(search);

      return matchesCategory && matchesStatus && matchesOwner && matchesSearch;
    });
  }, [categoryFilter, ownerFilter, query, rows, statusFilter]);

  const sortedRows = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;

    return [...filteredRows].sort((left, right) => {
      if (sortKey === 'updatedAt') {
        return (new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()) * direction;
      }

      return String(left[sortKey]).localeCompare(String(right[sortKey])) * direction;
    });
  }, [filteredRows, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / 4));

  useEffect(() => {
    setCurrentPage((value) => Math.min(value, totalPages));
  }, [totalPages]);

  const visibleRows = useMemo(() => sortedRows.slice((currentPage - 1) * 4, currentPage * 4), [currentPage, sortedRows]);
  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.includes(row.id)), [rows, selectedIds]);
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id));
  const selectedCount = selectedRows.length;

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [categoryFilter, ownerFilter, query, sortDirection, sortKey, statusFilter]);

  const addActivity = (title: string, description: string, meta: string) => {
    setActivity((current) => [{ title, description, meta }, ...current].slice(0, 8));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  };

  const toggleVisibleSelection = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleRows.some((row) => row.id === id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...visibleRows.map((row) => row.id)])));
  };

  const applyBulkAction = async (action: EnterpriseModuleBulkAction) => {
    const targetIds = selectedIds.length ? selectedIds : visibleRows.map((row) => row.id);

    if (!targetIds.length) {
      return;
    }

    const timestamp = new Date().toISOString();
    const nextRows = rows.map((row) => (targetIds.includes(row.id) ? { ...row, status: action.targetStatus, updatedAt: timestamp } : row));
    const activityEntry: EnterpriseModuleActivityItem = {
      title: action.label,
      description: `${targetIds.length} ${config.entityLabel.toLowerCase()} records moved to ${action.targetStatus}.`,
      meta: 'Bulk action',
    };

    setRows(nextRows);
    setSelectedIds([]);
    addActivity(activityEntry.title, activityEntry.description, activityEntry.meta);

    try {
      await updateAdminModuleCatalog(moduleKey, { records: nextRows, activity: [activityEntry, ...activity].slice(0, 8) }, profile?.id);
      setSyncMessage(`Saved ${targetIds.length} changes to Supabase.`);
    } catch {
      setSyncMessage('Saved locally, but the Supabase write did not complete.');
    }
  };

  const exportRows = () => {
    const scopeRows = exportScope === 'selected' ? selectedRows : exportScope === 'page' ? visibleRows : sortedRows;
    downloadCsv(`${config.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`, scopeRows);
    addActivity('CSV export completed', `${scopeRows.length} ${config.entityLabel.toLowerCase()} rows exported as CSV.`, 'Export trail');
  };

  return (
    <div className="page-transition space-y-6 p-6">
      <Card className="relative overflow-hidden border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--chart-1)/0.16),transparent_34%),linear-gradient(135deg,hsl(var(--color-surface))_0%,hsl(var(--color-surface-elevated))_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,hsl(var(--color-foreground)/0.03),transparent)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-accent/70">{config.eyebrow}</p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">{config.title}</h1>
            <p className="text-base text-muted">{config.description}</p>
          </div>

          <div className="w-full space-y-3 rounded-2xl border border-border bg-surface-elevated p-4 xl:w-[30rem]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {config.summary.map((item) => (
                <div key={item.label} className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{item.value}</p>
                  <p className="mt-1 text-xs text-muted">{item.note}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">Search, filter, sort, bulk edit, export, and review activity from one control surface.</p>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div className="grid gap-3 xl:grid-cols-5">
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Search</span>
            <input className="input-base" placeholder={`Search ${config.entityLabel.toLowerCase()}s`} value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Category</span>
            <select className="input-base" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All categories' : category}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Status</span>
            <select className="input-base" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All statuses' : status}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Owner</span>
            <select className="input-base" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
              {owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner === 'all' ? 'All owners' : owner}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_auto] xl:items-end">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Sort by</span>
              <select className="input-base" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                <option value="updatedAt">Updated</option>
                <option value="name">Name</option>
                <option value="category">Category</option>
                <option value="status">Status</option>
                <option value="owner">Owner</option>
                <option value="value">Value</option>
                <option value="risk">Risk</option>
              </select>
            </label>

            <Button variant="ghost" onClick={() => setSortDirection((value) => (value === 'asc' ? 'desc' : 'asc'))}>
              Sort {sortDirection === 'asc' ? 'ascending' : 'descending'}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[auto_auto_auto]">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Export</span>
              <select className="input-base" value={exportScope} onChange={(event) => setExportScope(event.target.value as ExportScope)}>
                <option value="filtered">Filtered rows</option>
                <option value="selected">Selected rows</option>
                <option value="page">Current page</option>
              </select>
            </label>
            <Button onClick={exportRows}>CSV export</Button>
            <div className="flex items-center rounded-xl border border-border bg-background px-4 py-2 text-sm text-muted">{selectedCount} selected</div>
          </div>
        </div>

        <p className="text-xs text-muted">{syncMessage}</p>

        <div className="flex flex-wrap gap-2">
          {config.bulkActions.map((action) => (
            <Button key={action.label} variant={selectedCount ? 'primary' : 'ghost'} onClick={() => void applyBulkAction(action)} disabled={!selectedCount && !visibleRows.length}>
              {action.label}
            </Button>
          ))}
          <Button variant="ghost" onClick={toggleVisibleSelection} disabled={!visibleRows.length}>
            {allVisibleSelected ? 'Clear page selection' : 'Select page'}
          </Button>
        </div>
      </Card>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent/70">{config.title}</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Inventory table</h2>
            <p className="text-sm text-muted">{sortedRows.length} filtered rows visible across {totalPages} pages.</p>
          </div>
          <p className="text-sm text-muted">Showing {visibleRows.length} rows on this page.</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-elevated text-muted">
              <tr>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]"><span className="sr-only">Select</span></th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">{config.entityLabel}</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Category</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Status</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Owner</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Value</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Updated</th>
                <th className="px-4 py-3 font-medium uppercase tracking-[0.2em]">Risk</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? visibleRows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3 align-top">
                    <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} aria-label={`Select ${row.name}`} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-foreground">{row.name}</p>
                    <p className="mt-1 max-w-sm text-xs text-muted">{row.notes}</p>
                  </td>
                  <td className="px-4 py-3 align-top text-foreground/85">{row.category}</td>
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusTone(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-foreground/85">{row.owner}</td>
                  <td className="px-4 py-3 align-top text-foreground/85">{row.value}</td>
                  <td className="px-4 py-3 align-top text-foreground/85">{formatDate(row.updatedAt)}</td>
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${riskTone(row.risk)}`}>{row.risk}</span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">No records match the current search and filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <p className="text-sm text-muted">Bulk actions, export scope, and selection state update with each filtered view.</p>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </Card>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Activity logs</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Recent module activity</h2>
          <p className="text-sm text-muted">Every bulk change and CSV export is tracked here.</p>
        </div>
        <Timeline items={activity} />
      </Card>
    </div>
  );
}