import { supabase } from '@/services/supabase/client';
import type { SupportTicket, SupportTicketStatus } from '@/types';

type SupportTicketRow = {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  priority: SupportTicket['priority'];
  status: SupportTicket['status'];
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listSupportTickets(userId?: string, limit = 8): Promise<SupportTicket[]> {
  let query = supabase
    .from('support_tickets')
    .select('id,user_id,subject,category,priority,status,last_message_at,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => {
    const typed = row as SupportTicketRow;
    return {
      id: typed.id,
      userId: typed.user_id,
      subject: typed.subject,
      category: typed.category,
      priority: typed.priority,
      status: typed.status,
      lastMessageAt: typed.last_message_at,
      updatedAt: typed.updated_at,
      createdAt: typed.created_at,
    } satisfies SupportTicket;
  });
}

export async function updateSupportTicketStatus(ticketId: string, status: SupportTicketStatus, adminId: string, reason?: string): Promise<void> {
  const { error } = await supabase.from('support_tickets').update({ status }).eq('id', ticketId);
  if (error) throw error;

  const { error: auditError } = await supabase.from('admin_action_audit').insert({
    admin_id: adminId,
    action: 'support_ticket_status_updated',
    resource_type: 'support_ticket',
    resource_id: ticketId,
    reason: reason ?? `Ticket status changed to ${status}`,
  });

  if (auditError) throw auditError;
}
