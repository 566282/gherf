import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/app/providers/AuthProvider';
import { enterpriseModuleConfigs } from '@/features/admin/data/enterpriseModules';
import { listSupportTickets, updateSupportTicketStatus } from '@/services/api/support';
import { supportTicketStatuses, type SupportTicket, type SupportTicketStatus } from '@/types';

const fallbackConfig = enterpriseModuleConfigs.supportTickets;

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function SupportTicketsPage(): JSX.Element {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | SupportTicketStatus>('all');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('Loading the live support queue...');

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextTickets = await listSupportTickets(undefined, 100);
      setTickets(nextTickets);
      setMessage(nextTickets.length ? 'Live support queue synced.' : 'No support tickets are available yet.');
    } catch {
      setMessage('Unable to load the support queue right now.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadTickets(); }, [loadTickets]);

  const filteredTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      const matchesQuery = !normalizedQuery || [ticket.subject, ticket.category, ticket.priority, ticket.userId].join(' ').toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [query, statusFilter, tickets]);

  const changeStatus = async (ticket: SupportTicket, status: SupportTicketStatus) => {
    if (!profile || status === ticket.status) return;
    setSavingId(ticket.id);
    setMessage('Saving ticket status...');
    try {
      await updateSupportTicketStatus(ticket.id, status, profile.id);
      setTickets((current) => current.map((entry) => entry.id === ticket.id ? { ...entry, status, updatedAt: new Date().toISOString() } : entry));
      setMessage('Ticket status saved and recorded in the audit trail.');
    } catch {
      setMessage('Ticket status could not be saved.');
    } finally {
      setSavingId(null);
    }
  };

  const counts = useMemo(() => ({
    open: tickets.filter((ticket) => ticket.status === 'open').length,
    waiting: tickets.filter((ticket) => ticket.status === 'waiting_on_you').length,
    resolved: tickets.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed').length,
  }), [tickets]);

  return (
    <div className="page-transition space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent/70">{fallbackConfig.eyebrow}</p>
            <h1 className="mt-2 text-4xl font-semibold text-foreground">{fallbackConfig.title}</h1>
            <p className="mt-2 max-w-3xl text-muted">{fallbackConfig.description}</p>
          </div>
          <Button variant="ghost" onClick={() => void loadTickets()} disabled={isLoading}>{isLoading ? 'Refreshing...' : 'Refresh queue'}</Button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Open</p><p className="mt-2 text-2xl font-bold text-foreground">{counts.open}</p></div>
          <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Waiting</p><p className="mt-2 text-2xl font-bold text-foreground">{counts.waiting}</p></div>
          <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Resolved</p><p className="mt-2 text-2xl font-bold text-foreground">{counts.resolved}</p></div>
        </div>
      </Card>

      <Card className="space-y-4 border border-border bg-surface-elevated">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="grid gap-2"><span className="text-xs uppercase tracking-[0.2em] text-muted">Search queue</span><input className="input-base" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Subject, category, priority, or user ID" /></label>
          <label className="grid gap-2"><span className="text-xs uppercase tracking-[0.2em] text-muted">Status</span><select className="input-base" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | SupportTicketStatus)}><option value="all">All statuses</option>{supportTicketStatuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></label>
        </div>
        <p className="text-sm text-muted" role="status">{message}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border text-xs uppercase tracking-[0.16em] text-muted"><th className="px-3 py-3">Ticket</th><th className="px-3 py-3">Priority</th><th className="px-3 py-3">Updated</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Save</th></tr></thead><tbody>
            {filteredTickets.map((ticket) => <tr key={ticket.id} className="border-b border-border/70"><td className="px-3 py-4"><p className="font-medium text-foreground">{ticket.subject}</p><p className="mt-1 text-xs text-muted">{ticket.category} · {ticket.userId}</p></td><td className="px-3 py-4 capitalize text-muted">{ticket.priority}</td><td className="px-3 py-4 text-muted">{formatDate(ticket.updatedAt)}</td><td className="px-3 py-4"><select className="input-base min-w-40" value={ticket.status} disabled={savingId === ticket.id} onChange={(event) => void changeStatus(ticket, event.target.value as SupportTicketStatus)}>{supportTicketStatuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></td><td className="px-3 py-4 text-xs text-muted">{savingId === ticket.id ? 'Saving...' : 'Auto-saves'}</td></tr>)}
          </tbody></table>
          {!filteredTickets.length && <p className="p-8 text-center text-sm text-muted">{isLoading ? 'Loading tickets...' : 'No tickets match the current filters.'}</p>}
        </div>
      </Card>
    </div>
  );
}
