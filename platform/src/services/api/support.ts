import { supabase } from '@/services/supabase/client';
import type { SupportTicket } from '@/types';

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