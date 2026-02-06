import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase-queries';

type UndoStrategy =
  | { type: 'soft-reactivate'; table: string; id: string }
  | { type: 'reinsert'; table: string; data: Record<string, unknown> }
  | { type: 'none' };

interface DeleteUndoOptions {
  itemName: string;
  undo: UndoStrategy;
  invalidateKeys?: readonly (readonly string[])[];
  onReload?: () => void;
  duration?: number;
}

export function showDeleteUndoToast({
  itemName,
  undo,
  invalidateKeys = [],
  onReload,
  duration = 5000,
}: DeleteUndoOptions): void {
  const canUndo = undo.type !== 'none';

  const handleUndo = async () => {
    try {
      if (undo.type === 'soft-reactivate') {
        const { error } = await supabase
          .from(undo.table)
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq('id', undo.id);
        if (error) throw error;
      } else if (undo.type === 'reinsert') {
        // Strip auto-generated timestamp columns that can conflict on re-insert
        const { created_at, updated_at, ...insertData } = undo.data as Record<string, unknown> & { created_at?: unknown; updated_at?: unknown };
        // Ensure tenant_id is present — view-sourced data (e.g. v_ingredients) may omit it
        if (!insertData.tenant_id) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('tenant_id')
              .eq('id', session.user.id)
              .single();
            if (profile?.tenant_id) {
              insertData.tenant_id = profile.tenant_id;
            }
          }
        }
        const { error } = await supabase
          .from(undo.table)
          .insert(insertData);
        if (error) throw error;
      }

      if (onReload) {
        onReload();
      } else {
        for (const key of invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: [...key] });
        }
      }

      toast({ title: `${itemName} restored` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message
        : (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message)
        : 'Unknown error';
      toast({
        title: 'Failed to undo',
        description: message,
        variant: 'destructive',
      });
    }
  };

  toast({
    title: `${itemName} deleted`,
    duration,
    action: canUndo
      ? <ToastAction altText="Undo delete" onClick={handleUndo}>Undo</ToastAction>
      : undefined,
  });
}
