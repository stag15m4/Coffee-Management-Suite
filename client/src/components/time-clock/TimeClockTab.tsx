import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-queries';
import type { UnifiedEmployee } from '@/hooks/use-all-employees';
import { TodayView } from './TodayView';
import { TimesheetsView } from './TimesheetsView';
import { Clock, CalendarDays } from 'lucide-react';
import { colors } from '@/lib/colors';

type SubTab = 'today' | 'timesheets';

interface TimeClockTabProps {
  tenantId: string;
  canApproveEdits: boolean;
  canApproveTimesheets: boolean;
  canViewAll: boolean;
  canExport: boolean;
  currentUserId: string;
  employees: UnifiedEmployee[];
  isExempt?: boolean;
}

export function TimeClockTab({
  tenantId,
  canApproveEdits,
  canApproveTimesheets,
  canViewAll,
  canExport,
  currentUserId,
  employees,
  isExempt = false,
}: TimeClockTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('today');
  const [localExempt, setLocalExempt] = useState(isExempt);
  const { toast } = useToast();

  const handleToggleTimeClock = useCallback(async (enabled: boolean) => {
    const newExempt = !enabled;
    setLocalExempt(newExempt);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_exempt: newExempt, updated_at: new Date().toISOString() })
        .eq('id', currentUserId);
      if (error) throw error;
      toast({ title: enabled ? 'Time clock enabled' : 'Time clock disabled' });
    } catch {
      setLocalExempt(!newExempt);
      toast({ title: 'Error', description: 'Failed to update setting.', variant: 'destructive' });
    }
  }, [currentUserId, toast]);

  // Only show the self-service toggle for managers/owners
  const showToggle = canViewAll;

  return (
    <div className="space-y-4">
      {/* Sub-tab buttons + time clock toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={subTab === 'today' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSubTab('today')}
          style={
            subTab === 'today'
              ? { backgroundColor: colors.brown, color: colors.white }
              : { borderColor: colors.creamDark, color: colors.brown }
          }
        >
          <Clock className="w-4 h-4 mr-1" /> Today
        </Button>
        <Button
          variant={subTab === 'timesheets' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSubTab('timesheets')}
          style={
            subTab === 'timesheets'
              ? { backgroundColor: colors.brown, color: colors.white }
              : { borderColor: colors.creamDark, color: colors.brown }
          }
        >
          <CalendarDays className="w-4 h-4 mr-1" /> Timesheets
        </Button>

        {showToggle && (
          <div className="flex items-center gap-2 ml-auto">
            <Label className="text-xs" style={{ color: colors.brownLight }}>My time clock</Label>
            <Switch
              checked={!localExempt}
              onCheckedChange={handleToggleTimeClock}
            />
          </div>
        )}
      </div>

      {/* Sub-tab content */}
      {subTab === 'today' && (
        <TodayView
          tenantId={tenantId}
          canApprove={canApproveEdits}
          canViewAll={canViewAll}
          currentUserId={currentUserId}
          employees={employees}
          hideClockCard={localExempt}
        />
      )}
      {subTab === 'timesheets' && (
        <TimesheetsView
          tenantId={tenantId}
          canApprove={canApproveTimesheets}
          canExport={canExport}
          currentUserId={currentUserId}
          employees={employees}
        />
      )}
    </div>
  );
}
