import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
}

export function TimeClockTab({
  tenantId,
  canApproveEdits,
  canApproveTimesheets,
  canViewAll,
  canExport,
  currentUserId,
  employees,
}: TimeClockTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('today');

  return (
    <div className="space-y-4">
      {/* Sub-tab buttons */}
      <div className="flex gap-2">
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
      </div>

      {/* Sub-tab content */}
      {subTab === 'today' && (
        <TodayView
          tenantId={tenantId}
          canApprove={canApproveEdits}
          canViewAll={canViewAll}
          currentUserId={currentUserId}
          employees={employees}
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
