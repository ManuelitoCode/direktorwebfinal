import { supabase } from '../lib/supabase';

interface AuditLogEntry {
  action: string;
  details?: Record<string, any>;
}

export function useAuditLog() {
  const logAction = async ({ action, details = {} }: AuditLogEntry) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('Cannot log audit entry: user not authenticated');
        return;
      }

      const { error } = await supabase
        .from('audit_logs')
        .insert([{
          user_id: user.id,
          action,
          details,
          timestamp: new Date().toISOString()
        }]);

      if (error) {
        console.error('Failed to log audit entry:', error);
      }
    } catch (err) {
      console.error('Error logging audit entry:', err);
    }
  };

  const getAuditLogs = async (limit: number = 100) => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      return [];
    }
  };

  return { logAction, getAuditLogs };
}