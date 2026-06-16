import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase-queries';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/utils';
import { getMonday, getWeekRange } from './utils';
import { Colors } from './types';

interface MoveWeekDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  currentWeekKey: string;
  onMoveComplete: (newWeekKey: string) => void;
  colors: Colors;
}

export function MoveWeekDialog({
  open,
  onOpenChange,
  tenantId,
  currentWeekKey,
  onMoveComplete,
  colors,
}: MoveWeekDialogProps) {
  const { toast } = useToast();
  const [targetWeekKey, setTargetWeekKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [conflictData, setConflictData] = useState<{
    hasTips: boolean;
    hasHours: boolean;
    targetRange: { start: string; end: string };
  } | null>(null);
  const [showConflictAlert, setShowConflictAlert] = useState(false);

  const currentRange = getWeekRange(currentWeekKey);
  const targetRange = targetWeekKey ? getWeekRange(targetWeekKey) : null;

  const resetState = () => {
    setTargetWeekKey('');
    setConflictData(null);
    setShowConflictAlert(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetState();
    onOpenChange(newOpen);
  };

  const checkTargetWeek = async () => {
    if (!targetWeekKey || targetWeekKey === currentWeekKey) {
      toast({ title: 'Please select a different week', variant: 'destructive' });
      return;
    }

    setChecking(true);
    try {
      const [tipsResult, hoursResult] = await Promise.all([
        supabase
          .from('tip_weekly_data')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('week_key', targetWeekKey)
          .maybeSingle(),
        supabase
          .from('tip_employee_hours')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('week_key', targetWeekKey)
          .limit(1),
      ]);

      const hasTips = !!tipsResult.data;
      const hasHours = (hoursResult.data?.length || 0) > 0;

      if (hasTips || hasHours) {
        setConflictData({
          hasTips,
          hasHours,
          targetRange: getWeekRange(targetWeekKey),
        });
        setShowConflictAlert(true);
      } else {
        await performMove();
      }
    } catch (error) {
      toast({ title: 'Error checking target week', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setChecking(false);
    }
  };

  const performMove = async (overwrite = false) => {
    setLoading(true);
    setShowConflictAlert(false);

    try {
      if (overwrite && conflictData) {
        if (conflictData.hasTips) {
          await supabase
            .from('tip_weekly_data')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('week_key', targetWeekKey);
        }
        if (conflictData.hasHours) {
          await supabase
            .from('tip_employee_hours')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('week_key', targetWeekKey);
        }
      }

      const [tipsUpdate, hoursUpdate] = await Promise.all([
        supabase
          .from('tip_weekly_data')
          .update({ week_key: targetWeekKey, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('week_key', currentWeekKey),
        supabase
          .from('tip_employee_hours')
          .update({ week_key: targetWeekKey, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('week_key', currentWeekKey),
      ]);

      if (tipsUpdate.error) throw tipsUpdate.error;
      if (hoursUpdate.error) throw hoursUpdate.error;

      toast({
        title: 'Week moved successfully',
        description: `Tips and hours moved to week of ${getWeekRange(targetWeekKey).start}`,
      });

      onMoveComplete(targetWeekKey);
      handleOpenChange(false);
    } catch (error) {
      toast({ title: 'Error moving week', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open && !showConflictAlert} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: colors.brown }}>Move Tips to Different Week</DialogTitle>
            <DialogDescription>
              Move all tip entries and employee hours from one week to another.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-xs" style={{ color: colors.brownLight }}>
                  From Week
                </Label>
                <div
                  className="p-2 rounded border text-sm font-medium"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}
                >
                  {currentRange.start} – {currentRange.end}
                </div>
              </div>

              <ArrowRight className="w-5 h-5 mt-5" style={{ color: colors.brownLight }} />

              <div className="flex-1">
                <Label className="text-xs" style={{ color: colors.brownLight }}>
                  To Week
                </Label>
                <Input
                  type="date"
                  value={targetWeekKey}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value + 'T12:00:00');
                    setTargetWeekKey(getMonday(newDate));
                    setConflictData(null);
                  }}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                />
              </div>
            </div>

            {targetRange && targetWeekKey !== currentWeekKey && (
              <p className="text-sm" style={{ color: colors.brownLight }}>
                Target: {targetRange.start} – {targetRange.end}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading || checking}>
              Cancel
            </Button>
            <Button
              onClick={checkTargetWeek}
              disabled={!targetWeekKey || targetWeekKey === currentWeekKey || loading || checking}
              style={{ backgroundColor: colors.gold, color: colors.white }}
            >
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                'Move Week'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConflictAlert} onOpenChange={setShowConflictAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Data Already Exists
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  The week of {conflictData?.targetRange.start} already has:
                </p>
                <ul className="list-disc list-inside text-sm">
                  {conflictData?.hasTips && <li>Tip entries</li>}
                  {conflictData?.hasHours && <li>Employee hours</li>}
                </ul>
                <p className="font-medium text-amber-600">
                  Moving will overwrite the existing data. This cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => performMove(true)}
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Moving...
                </>
              ) : (
                'Overwrite & Move'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
