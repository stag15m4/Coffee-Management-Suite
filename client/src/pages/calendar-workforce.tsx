import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearch, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useAppResume } from '@/hooks/use-app-resume';
import { useLocationChange } from '@/hooks/use-location-change';
import { queryClient } from '@/lib/queryClient';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  CalendarDays,
  Clock,
  Plane,
  Plus,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Users,
  Star,
  RefreshCw,
  MapPin,
  Link,
} from 'lucide-react';
import { useAllEmployees, useUpdateEmployeeColor, type UnifiedEmployee } from '@/hooks/use-all-employees';
import {
  useShifts,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  useAcceptShift,
  useDeclineShift,
  useBulkCreateShifts,
  useShiftTemplates,
  useCreateShiftTemplate,
  useDeleteShiftTemplate,
  type Shift,
  type InsertShift,
  type ShiftTemplate,
} from '@/hooks/use-shifts';
import {
  useTimeOffRequests,
  useMyTimeOffRequests,
  useCreateTimeOffRequest,
  useReviewTimeOffRequest,
  useCancelTimeOffRequest,
  type TimeOffRequest,
} from '@/hooks/use-time-off';
import { TimeClockTab } from '@/components/time-clock/TimeClockTab';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, EventClickArg, DateSelectArg, EventDropArg, EventContentArg } from '@fullcalendar/core';
import type FullCalendarType from '@fullcalendar/react';
import {
  useCalendarEvents,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  useICalSubscriptions,
  useCreateICalSubscription,
  useDeleteICalSubscription,
  useSyncICal,
  type CalendarEvent,
} from '@/hooks/use-calendar-events';

import { colors } from '@/lib/colors';
import { ModuleIntroNudge } from '@/components/onboarding/ModuleIntroNudge';

const EMPLOYEE_COLORS = [
  '#C9A227', '#8B4513', '#CD853F', '#6B5344', '#4A3728',
  '#D4A574', '#A0522D', '#DEB887', '#B8860B', '#8B6914',
  '#556B2F', '#6B8E23', '#808000', '#BDB76B', '#DAA520',
];

type TabType = 'schedule' | 'time-off' | 'time-clock';

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'pm' : 'am';
  const displayHour = hours % 12 || 12;
  return minutes > 0
    ? `${displayHour}:${minutes.toString().padStart(2, '0')}${suffix}`
    : `${displayHour}${suffix}`;
}

function formatDateShort(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── SCHEDULE TAB ────────────────────────────────────────

function ScheduleTab({ tenantId, canEdit, canDelete, employees }: {
  tenantId: string;
  canEdit: boolean;
  canDelete: boolean;
  employees: UnifiedEmployee[];
}) {
  type CalView = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth';
  const [calendarView, setCalendarView] = useState<CalView>('timeGridWeek');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const calendarRef = useRef<FullCalendarType>(null);

  const { startDate, endDate } = useMemo(() => {
    if (calendarView === 'timeGridDay') {
      const d = formatDate(currentDate);
      return { startDate: d, endDate: d };
    }
    if (calendarView === 'dayGridMonth') {
      const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const last = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return { startDate: formatDate(first), endDate: formatDate(last) };
    }
    // week
    const monday = getMonday(currentDate);
    return { startDate: formatDate(monday), endDate: formatDate(new Date(monday.getTime() + 6 * 86_400_000)) };
  }, [calendarView, currentDate]);

  const { data: shifts, isLoading } = useShifts(startDate, endDate);
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();
  const bulkCreate = useBulkCreateShifts();
  const { data: templates } = useShiftTemplates();
  const createTemplate = useCreateShiftTemplate();
  const deleteTemplate = useDeleteShiftTemplate();
  const { data: timeOffRequests } = useTimeOffRequests('approved');
  const acceptShift = useAcceptShift();
  const declineShift = useDeclineShift();
  const { user } = useAuth();
  const { toast } = useToast();

  // Shift detail dialog state (employee accept/decline)
  const [viewingShiftDetail, setViewingShiftDetail] = useState<Shift | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  // Create shift dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  // selectedEmployeeKey stores the name from the unified list (used as Select value)
  const [selectedEmployeeKey, setSelectedEmployeeKey] = useState('');
  const [newShiftDate, setNewShiftDate] = useState(formatDate(new Date()));
  const [newShiftStart, setNewShiftStart] = useState('08:00');
  const [newShiftEnd, setNewShiftEnd] = useState('16:00');
  const [newShiftPosition, setNewShiftPosition] = useState('');
  const [newShiftNotes, setNewShiftNotes] = useState('');
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  // New template form
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDay, setNewTemplateDay] = useState(1);
  const [newTemplateStart, setNewTemplateStart] = useState('08:00');
  const [newTemplateEnd, setNewTemplateEnd] = useState('16:00');
  const [newTemplateEmployee, setNewTemplateEmployee] = useState('');
  const [newTemplatePosition, setNewTemplatePosition] = useState('');

  // Calendar events
  const { data: calendarEvents } = useCalendarEvents(startDate, endDate);
  const createCalendarEvent = useCreateCalendarEvent();
  const updateCalendarEvent = useUpdateCalendarEvent();
  const deleteCalendarEvent = useDeleteCalendarEvent();
  const { data: icalSubs } = useICalSubscriptions();
  const createICalSub = useCreateICalSubscription();
  const deleteICalSub = useDeleteICalSubscription();
  const syncICal = useSyncICal();

  // Sync FullCalendar when view or date changes
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    if (api.view.type !== calendarView) api.changeView(calendarView);
    api.gotoDate(startDate);
  }, [calendarView, startDate]);

  const [showEventsPanel, setShowEventsPanel] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [showCreateEventDialog, setShowCreateEventDialog] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventStartDate, setNewEventStartDate] = useState('');
  const [newEventEndDate, setNewEventEndDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventColor, setNewEventColor] = useState('#3b82f6');
  const [newICalName, setNewICalName] = useState('');
  const [newICalUrl, setNewICalUrl] = useState('');

  // Auto-sync stale iCal subscriptions on load
  const [didAutoSync, setDidAutoSync] = useState(false);
  useEffect(() => {
    if (didAutoSync || !icalSubs || icalSubs.length === 0) return;
    setDidAutoSync(true);
    const STALE_MS = 60 * 60 * 1000; // 1 hour
    const now = Date.now();
    icalSubs.forEach((sub) => {
      const lastSynced = sub.last_synced_at ? new Date(sub.last_synced_at).getTime() : 0;
      if (now - lastSynced > STALE_MS) {
        syncICal.mutate(sub.id);
      }
    });
  }, [icalSubs, didAutoSync]);

  // Conflict detection — match by employee_name (the common field across both sources)
  const checkConflicts = useCallback((employeeName: string, date: string, startTime: string, endTime: string, excludeShiftId?: string) => {
    if (!shifts || !employeeName) { setConflictWarning(null); return; }

    // Check overlapping shifts
    const overlapping = shifts.find((s) => {
      if (s.id === excludeShiftId) return false;
      if (s.employee_name !== employeeName || s.date !== date) return false;
      return s.start_time < endTime && s.end_time > startTime;
    });
    if (overlapping) {
      setConflictWarning(`Overlapping shift: ${overlapping.employee_name} already scheduled ${formatTimeDisplay(overlapping.start_time)}–${formatTimeDisplay(overlapping.end_time)}`);
      return;
    }

    // Check approved time-off (only for profile employees)
    if (timeOffRequests) {
      const emp = employees.find((e) => e.name === employeeName);
      if (emp?.user_profile_id) {
        const hasTimeOff = timeOffRequests.find((r) => r.employee_id === emp.user_profile_id && r.start_date <= date && r.end_date >= date);
        if (hasTimeOff) {
          setConflictWarning(`${employeeName} has approved ${hasTimeOff.category} time off on this date`);
          return;
        }
      }
    }

    setConflictWarning(null);
  }, [shifts, timeOffRequests, employees]);

  // Apply template to current week
  const handleApplyTemplate = useCallback(async () => {
    if (!templates || templates.length === 0) {
      toast({ title: 'No templates', description: 'Create templates first.', variant: 'destructive' });
      return;
    }
    const newShifts: InsertShift[] = templates
      .filter((t) => t.employee_name || t.employee_id || t.tip_employee_id)
      .map((t) => {
        const dayOffset = t.day_of_week === 0 ? 6 : t.day_of_week - 1;
        const monday = getMonday(currentDate);
        const shiftDate = new Date(monday.getTime() + dayOffset * 86_400_000);
        return {
          employee_id: t.employee_id ?? null,
          tip_employee_id: t.tip_employee_id ?? null,
          employee_name: t.employee_name || 'Unknown',
          date: formatDate(shiftDate),
          start_time: t.start_time.slice(0, 5),
          end_time: t.end_time.slice(0, 5),
          position: t.position,
          status: 'published',
        };
      });
    if (newShifts.length === 0) {
      toast({ title: 'No applicable templates', description: 'Templates need assigned employees.', variant: 'destructive' });
      return;
    }
    try {
      await bulkCreate.mutateAsync(newShifts);
      toast({ title: 'Template applied', description: `Created ${newShifts.length} shifts.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to apply template.', variant: 'destructive' });
    }
  }, [templates, currentDate, bulkCreate, toast]);

  const handleSaveTemplate = useCallback(async () => {
    if (!newTemplateName.trim()) {
      toast({ title: 'Enter a template name', variant: 'destructive' });
      return;
    }
    const emp = employees.find((e) => e.name === newTemplateEmployee);
    try {
      await createTemplate.mutateAsync({
        name: newTemplateName,
        day_of_week: newTemplateDay,
        start_time: newTemplateStart,
        end_time: newTemplateEnd,
        employee_id: emp?.user_profile_id ?? null,
        tip_employee_id: emp?.tip_employee_id ?? null,
        employee_name: emp?.name ?? null,
        position: newTemplatePosition || null,
      });
      toast({ title: 'Template saved' });
      setNewTemplateName('');
    } catch {
      toast({ title: 'Error', description: 'Failed to save template.', variant: 'destructive' });
    }
  }, [newTemplateName, newTemplateDay, newTemplateStart, newTemplateEnd, newTemplateEmployee, newTemplatePosition, employees, createTemplate, toast]);

  // Employee color mapping — use saved schedule_color or fall back to palette
  const updateEmployeeColor = useUpdateEmployeeColor();
  const employeeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((m, i) => {
      const key = m.user_profile_id ?? m.tip_employee_id ?? m.name;
      map.set(key, m.schedule_color || EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length]);
    });
    return map;
  }, [employees]);

  // Convert shifts + calendar events to FullCalendar events
  const events: EventInput[] = useMemo(() => {
    const shiftEvents: EventInput[] = (shifts || []).map((s) => {
      const colorKey = s.employee_id ?? s.tip_employee_id ?? s.employee_name ?? '';
      return {
        id: s.id,
        title: s.employee_name || 'Unassigned',
        start: `${s.date}T${s.start_time}`,
        end: `${s.date}T${s.end_time}`,
        backgroundColor: employeeColorMap.get(colorKey) ?? colors.gold,
        borderColor: employeeColorMap.get(colorKey) ?? colors.gold,
        textColor: '#fff',
        extendedProps: { type: 'shift', shift: s },
      };
    });

    const eventBanners: EventInput[] = (calendarEvents || []).map((e) => ({
      id: `event-${e.id}`,
      title: e.title,
      start: e.start_date,
      // FullCalendar all-day end is exclusive, so add 1 day
      end: new Date(new Date(e.end_date + 'T00:00:00').getTime() + 86_400_000)
        .toISOString().split('T')[0],
      allDay: true,
      backgroundColor: e.color || '#3b82f6',
      borderColor: e.color || '#3b82f6',
      textColor: '#fff',
      editable: false,
      extendedProps: { type: 'event', calendarEvent: e },
    }));

    return [...shiftEvents, ...eventBanners];
  }, [shifts, calendarEvents, employeeColorMap]);

  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    if (!canEdit) return;
    const startLocal = selectInfo.start;
    const endLocal = selectInfo.end;
    setSelectedEmployeeKey('');
    setNewShiftDate(formatDate(startLocal));
    setNewShiftStart(startLocal.toTimeString().slice(0, 5));
    setNewShiftEnd(endLocal.toTimeString().slice(0, 5));
    setNewShiftPosition('');
    setNewShiftNotes('');
    setEditingShift(null);
    setConflictWarning(null);
    setShowCreateDialog(true);
  }, [canEdit]);

  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const eventType = clickInfo.event.extendedProps.type;
    if (eventType === 'event') {
      setViewingEvent(clickInfo.event.extendedProps.calendarEvent as CalendarEvent);
      return;
    }
    const shift = clickInfo.event.extendedProps.shift as Shift;
    if (canEdit) {
      setEditingShift(shift);
      setSelectedEmployeeKey(shift.employee_name ?? '');
      setNewShiftDate(shift.date);
      setNewShiftStart(shift.start_time.slice(0, 5));
      setNewShiftEnd(shift.end_time.slice(0, 5));
      setNewShiftPosition(shift.position ?? '');
      setNewShiftNotes(shift.notes ?? '');
      setConflictWarning(null);
      setShowCreateDialog(true);
    } else if (shift.employee_id === user?.id && shift.status === 'published') {
      setViewingShiftDetail(shift);
      setDeclineReason('');
    }
  }, [canEdit, user?.id]);

  const handleEventDrop = useCallback(async (dropInfo: EventDropArg) => {
    if (!canEdit || dropInfo.event.extendedProps.type === 'event') {
      dropInfo.revert();
      return;
    }
    const shift = dropInfo.event.extendedProps.shift as Shift;
    const newStart = dropInfo.event.start;
    const newEnd = dropInfo.event.end;
    if (!newStart || !newEnd) { dropInfo.revert(); return; }
    try {
      await updateShift.mutateAsync({
        id: shift.id,
        date: formatDate(newStart),
        start_time: newStart.toTimeString().slice(0, 5),
        end_time: newEnd.toTimeString().slice(0, 5),
      });
      toast({ title: 'Shift moved', description: `${shift.employee_name}'s shift updated.` });
    } catch {
      dropInfo.revert();
      toast({ title: 'Error', description: 'Failed to move shift.', variant: 'destructive' });
    }
  }, [canEdit, updateShift, toast]);

  const handleEventResize = useCallback(async (resizeInfo: any) => {
    if (!canEdit || resizeInfo.event.extendedProps.type === 'event') { resizeInfo.revert(); return; }
    const shift = resizeInfo.event.extendedProps.shift as Shift;
    const newEnd = resizeInfo.event.end;
    if (!newEnd) { resizeInfo.revert(); return; }
    try {
      await updateShift.mutateAsync({
        id: shift.id,
        end_time: newEnd.toTimeString().slice(0, 5),
      });
    } catch {
      resizeInfo.revert();
      toast({ title: 'Error', description: 'Failed to resize shift.', variant: 'destructive' });
    }
  }, [canEdit, updateShift, toast]);

  const handleSaveShift = useCallback(async () => {
    if (!selectedEmployeeKey) {
      toast({ title: 'Select an employee', variant: 'destructive' });
      return;
    }
    const emp = employees.find((e) => e.name === selectedEmployeeKey);
    if (!emp) {
      toast({ title: 'Invalid employee', variant: 'destructive' });
      return;
    }
    try {
      if (editingShift) {
        // Reset acceptance if employee changed
        const employeeChanged = (emp.user_profile_id ?? null) !== editingShift.employee_id;
        await updateShift.mutateAsync({
          id: editingShift.id,
          employee_id: emp.user_profile_id ?? null,
          tip_employee_id: emp.tip_employee_id ?? null,
          employee_name: emp.name,
          date: newShiftDate,
          start_time: newShiftStart,
          end_time: newShiftEnd,
          position: newShiftPosition || null,
          notes: newShiftNotes || null,
          ...(employeeChanged ? { acceptance: null, accepted_at: null, decline_reason: null } : {}),
        });
        toast({ title: 'Shift updated' });
      } else {
        await createShift.mutateAsync({
          employee_id: emp.user_profile_id ?? null,
          tip_employee_id: emp.tip_employee_id ?? null,
          employee_name: emp.name,
          date: newShiftDate,
          start_time: newShiftStart,
          end_time: newShiftEnd,
          position: newShiftPosition || null,
          notes: newShiftNotes || null,
          status: 'published',
        });
        toast({ title: 'Shift created' });
      }
      setShowCreateDialog(false);
      setEditingShift(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to save shift.', variant: 'destructive' });
    }
  }, [selectedEmployeeKey, employees, newShiftDate, newShiftStart, newShiftEnd, newShiftPosition, newShiftNotes, editingShift, createShift, updateShift, toast]);

  const handleDeleteShift = useCallback(async () => {
    if (!editingShift) return;
    try {
      await deleteShift.mutateAsync(editingShift.id);
      toast({ title: 'Shift deleted' });
      setShowCreateDialog(false);
      setEditingShift(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to delete shift.', variant: 'destructive' });
    }
  }, [editingShift, deleteShift, toast]);

  const navigate = useCallback((direction: number) => {
    setCurrentDate((prev) => {
      if (calendarView === 'timeGridDay') {
        return new Date(prev.getTime() + direction * 86_400_000);
      }
      if (calendarView === 'dayGridMonth') {
        return new Date(prev.getFullYear(), prev.getMonth() + direction, 1);
      }
      return new Date(prev.getTime() + direction * 7 * 86_400_000);
    });
  }, [calendarView]);

  if (isLoading) {
    return <CoffeeLoader text="Loading schedule..." />;
  }

  return (
    <div className="space-y-4">
      <ModuleIntroNudge
        moduleId="calendar-workforce"
        icon={<CalendarDays className="w-5 h-5" />}
        message="Manage shifts, time-off requests, and your team's schedule. Employees can clock in/out and view their upcoming shifts."
      />
      {/* Navigation + view toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}
              style={{ borderColor: colors.creamDark, color: colors.brown }}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium text-center" style={{ color: colors.brown }}>
              {calendarView === 'timeGridDay'
                ? new Date(startDate + 'T00:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
                : calendarView === 'dayGridMonth'
                  ? new Date(startDate + 'T00:00:00').toLocaleDateString([], { month: 'long', year: 'numeric' })
                  : `${new Date(startDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${new Date(endDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
            </span>
            <Button variant="outline" size="icon" onClick={() => navigate(1)}
              style={{ borderColor: colors.creamDark, color: colors.brown }}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}
              style={{ borderColor: colors.creamDark, color: colors.brown }}>
              Today
            </Button>
          </div>
          <div className="flex rounded-md overflow-hidden border" style={{ borderColor: colors.creamDark }}>
            {([['timeGridDay', 'Day'], ['timeGridWeek', 'Week'], ['dayGridMonth', 'Month']] as const).map(([view, label]) => (
              <button key={view} onClick={() => setCalendarView(view)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={calendarView === view
                  ? { backgroundColor: colors.gold, color: colors.white }
                  : { backgroundColor: colors.white, color: colors.brown }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => { setEditingShift(null); setConflictWarning(null); setSelectedEmployeeKey(''); setNewShiftDate(formatDate(new Date())); setNewShiftStart('08:00'); setNewShiftEnd('16:00'); setNewShiftPosition(''); setNewShiftNotes(''); setShowCreateDialog(true); }}
              style={{ backgroundColor: colors.gold, color: colors.white }}
            >
              <Plus className="w-4 h-4 mr-1" /> Add Shift
            </Button>
            <Button variant="outline" onClick={() => setShowTemplatePanel(!showTemplatePanel)}
              style={{ borderColor: colors.creamDark, color: colors.brown }}>
              <CalendarDays className="w-4 h-4 mr-1" /> Templates
            </Button>
            {templates && templates.length > 0 && (
              <Button variant="outline" onClick={handleApplyTemplate}
                disabled={bulkCreate.isPending}
                style={{ borderColor: colors.gold, color: colors.brown }}>
                Apply Template
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowEventsPanel(!showEventsPanel)}
              style={{ borderColor: showEventsPanel ? colors.gold : colors.creamDark, color: colors.brown }}>
              <Star className="w-4 h-4 mr-1" /> Events
            </Button>
          </div>
        )}
      </div>

      {/* Events Panel */}
      {showEventsPanel && canEdit && (
        <Card style={{ backgroundColor: colors.cream, borderColor: colors.creamDark }}>
          <CardContent className="p-4 space-y-4">
            {/* Add Manual Event */}
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: colors.brown }}>Add Event</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="sm:col-span-2">
                  <Input placeholder="Event title" value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    style={{ borderColor: colors.creamDark }} />
                </div>
                <div>
                  <Label className="text-xs" style={{ color: colors.brown }}>Start Date</Label>
                  <Input type="date" value={newEventStartDate}
                    onChange={(e) => { setNewEventStartDate(e.target.value); if (!newEventEndDate) setNewEventEndDate(e.target.value); }}
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} />
                </div>
                <div>
                  <Label className="text-xs" style={{ color: colors.brown }}>End Date</Label>
                  <Input type="date" value={newEventEndDate}
                    onChange={(e) => setNewEventEndDate(e.target.value)}
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} />
                </div>
                <div>
                  <Input placeholder="Location (optional)" value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    style={{ borderColor: colors.creamDark }} />
                </div>
                <div>
                  <Label className="text-xs mb-1 block" style={{ color: colors.brown }}>Color</Label>
                  <div className="flex gap-1">
                    {['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'].map((c) => (
                      <button key={c} onClick={() => setNewEventColor(c)}
                        className="w-6 h-6 rounded-full border-2 transition-transform"
                        style={{ backgroundColor: c, borderColor: newEventColor === c ? colors.brown : 'transparent', transform: newEventColor === c ? 'scale(1.2)' : 'scale(1)' }} />
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Input placeholder="Description (optional)" value={newEventDescription}
                    onChange={(e) => setNewEventDescription(e.target.value)}
                    style={{ borderColor: colors.creamDark }} />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    disabled={!newEventTitle || !newEventStartDate || !newEventEndDate || createCalendarEvent.isPending}
                    onClick={async () => {
                      try {
                        await createCalendarEvent.mutateAsync({
                          title: newEventTitle,
                          start_date: newEventStartDate,
                          end_date: newEventEndDate,
                          location: newEventLocation || null,
                          description: newEventDescription || null,
                          color: newEventColor,
                        });
                        setNewEventTitle(''); setNewEventStartDate(''); setNewEventEndDate('');
                        setNewEventLocation(''); setNewEventDescription(''); setNewEventColor('#3b82f6');
                        toast({ title: 'Event created' });
                      } catch {
                        toast({ title: 'Error', description: 'Failed to create event.', variant: 'destructive' });
                      }
                    }}
                    style={{ backgroundColor: colors.gold, color: colors.white }}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Event
                  </Button>
                </div>
              </div>
            </div>

            {/* iCal Subscriptions */}
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: colors.brown }}>iCal Feeds</h3>
              {icalSubs && icalSubs.length > 0 && (
                <div className="space-y-2 mb-2">
                  {icalSubs.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 text-xs p-2 rounded" style={{ backgroundColor: colors.white }}>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" style={{ color: colors.brown }}>{sub.name}</div>
                        <div className="truncate opacity-60" style={{ color: colors.brown }}>{sub.url}</div>
                        {sub.last_synced_at && (
                          <div className="opacity-50" style={{ color: colors.brown }}>
                            Last synced: {new Date(sub.last_synced_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </div>
                        )}
                        {sub.sync_error && (
                          <div className="text-red-500">Error: {sub.sync_error}</div>
                        )}
                      </div>
                      <Button variant="outline" size="sm"
                        disabled={syncICal.isPending}
                        onClick={() => { syncICal.mutate(sub.id); toast({ title: 'Syncing...' }); }}
                        style={{ borderColor: colors.creamDark, color: colors.brown }}>
                        <RefreshCw className={`w-3 h-3 ${syncICal.isPending ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button variant="outline" size="sm"
                        onClick={() => { if (confirm('Remove this iCal feed? Its synced events will be deleted.')) deleteICalSub.mutate(sub.id); }}
                        style={{ borderColor: colors.creamDark, color: '#ef4444' }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input placeholder="Feed name" value={newICalName}
                  onChange={(e) => setNewICalName(e.target.value)}
                  className="flex-1" style={{ borderColor: colors.creamDark }} />
                <Input placeholder="iCal URL (.ics)" value={newICalUrl}
                  onChange={(e) => setNewICalUrl(e.target.value)}
                  className="flex-[2]" style={{ borderColor: colors.creamDark }} />
                <Button
                  disabled={!newICalName || !newICalUrl || createICalSub.isPending}
                  onClick={async () => {
                    try {
                      const sub = await createICalSub.mutateAsync({ name: newICalName, url: newICalUrl });
                      setNewICalName(''); setNewICalUrl('');
                      syncICal.mutate(sub.id);
                      toast({ title: 'Feed added, syncing...' });
                    } catch {
                      toast({ title: 'Error', description: 'Failed to add feed.', variant: 'destructive' });
                    }
                  }}
                  style={{ backgroundColor: colors.gold, color: colors.white }}>
                  <Link className="w-4 h-4 mr-1" /> Add Feed
                </Button>
              </div>
            </div>

            {/* Upcoming Events this week */}
            {calendarEvents && calendarEvents.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: colors.brown }}>This Week's Events</h3>
                <div className="space-y-1">
                  {calendarEvents.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-2 text-xs p-2 rounded" style={{ backgroundColor: colors.white }}>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium" style={{ color: colors.brown }}>{ev.title}</span>
                        <span className="opacity-60 ml-2" style={{ color: colors.brown }}>
                          {formatDateShort(ev.start_date)}{ev.end_date !== ev.start_date ? ` – ${formatDateShort(ev.end_date)}` : ''}
                        </span>
                        {ev.location && <span className="opacity-50 ml-1" style={{ color: colors.brown }}> · {ev.location}</span>}
                      </div>
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: colors.creamDark, color: colors.brown }}>
                        {ev.source}
                      </Badge>
                      {ev.source === 'manual' && (
                        <Button variant="outline" size="sm"
                          onClick={() => { if (confirm('Delete this event?')) deleteCalendarEvent.mutate(ev.id); }}
                          style={{ borderColor: colors.creamDark, color: '#ef4444' }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* FullCalendar */}
      <Card style={{ backgroundColor: colors.white }}>
        <CardContent className="p-2 sm:p-4">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={calendarView}
            initialDate={startDate}
            headerToolbar={false}
            events={events}
            editable={canEdit}
            selectable={canEdit}
            selectMirror
            dayMaxEvents
            slotMinTime="05:00:00"
            slotMaxTime="23:00:00"
            allDaySlot={true}
            allDayText=""
            height="auto"
            select={handleDateSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            slotLabelFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
            dayHeaderFormat={{ weekday: 'short', month: 'numeric', day: 'numeric' }}
            eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
            eventContent={(arg: EventContentArg) => {
              if (arg.event.extendedProps.type === 'event') {
                const calEvent = arg.event.extendedProps.calendarEvent as CalendarEvent;
                return (
                  <div className="flex items-center gap-1 px-1 py-0.5 text-xs font-medium truncate cursor-pointer">
                    <Star className="w-3 h-3 flex-shrink-0 fill-current" />
                    <span className="truncate">{calEvent.title}</span>
                  </div>
                );
              }
              const shift = arg.event.extendedProps.shift as Shift;
              const avatarUrl = shift.employee_avatar
                || employees.find((e) => e.name === shift.employee_name)?.avatar_url
                || null;
              // Acceptance status
              const isPublished = shift.status === 'published' && shift.employee_id;
              const isUnclaimed = isPublished && !shift.acceptance;
              const isAccepted = shift.acceptance === 'accepted';
              const isDeclined = shift.acceptance === 'declined';
              const borderLeft = isAccepted ? '3px solid #22c55e'
                : isDeclined ? '3px solid #ef4444'
                : isUnclaimed ? '3px solid #f59e0b'
                : 'none';

              // Month view: compact rendering
              if (arg.view.type === 'dayGridMonth') {
                return (
                  <div className="flex items-center gap-1 px-1 py-0.5 text-[10px] truncate w-full"
                    style={{ borderLeft, opacity: isDeclined ? 0.6 : 1 }}>
                    <span className="font-medium truncate">{shift.employee_name || 'Unassigned'}</span>
                    {isUnclaimed && <span style={{ color: '#f59e0b' }}>!</span>}
                  </div>
                );
              }

              // Day + Week view: full rendering
              return (
                <div className="flex items-center gap-1 overflow-hidden w-full px-0.5 py-0.5"
                  style={{ borderLeft, opacity: isDeclined ? 0.7 : 1 }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full flex-shrink-0 object-cover" style={{ border: '1px solid rgba(255,255,255,0.5)' }} />
                  ) : (
                    <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}>
                      {(shift.employee_name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="truncate text-xs leading-tight flex-1 min-w-0">
                    <div className="font-medium truncate">{shift.employee_name || 'Unassigned'}</div>
                    <div className="opacity-80">{arg.timeText}</div>
                    {isUnclaimed && (
                      <div className="text-[9px] font-semibold" style={{ color: '#fbbf24' }}>Unclaimed</div>
                    )}
                  </div>
                  {isAccepted && (
                    <span className="text-[9px] font-bold flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: '#22c55e', color: '#fff' }} title="Accepted">{'\u2713'}</span>
                  )}
                  {isDeclined && (
                    <span className="text-[9px] font-bold flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: '#ef4444', color: '#fff' }} title="Declined">{'\u2717'}</span>
                  )}
                  {isUnclaimed && (
                    <span className="text-[9px] font-bold flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center animate-pulse"
                      style={{ backgroundColor: '#f59e0b', color: '#fff' }} title="Unclaimed">!</span>
                  )}
                </div>
              );
            }}
          />
        </CardContent>
      </Card>

      {/* Employee legend */}
      {employees.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {employees.map((e) => {
            const key = e.user_profile_id ?? e.tip_employee_id ?? e.name;
            const currentColor = employeeColorMap.get(key) ?? colors.gold;
            return (
              <div key={e.name} className="flex items-center gap-1.5 text-xs" style={{ color: colors.brown }}>
                {canEdit ? (
                  <label className="relative cursor-pointer">
                    <div className="w-4 h-4 rounded-full border border-white/50 shadow-sm transition-transform hover:scale-125"
                      style={{ backgroundColor: currentColor }} />
                    <input type="color" value={currentColor}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(ev) => {
                        updateEmployeeColor.mutate({
                          user_profile_id: e.user_profile_id,
                          tip_employee_id: e.tip_employee_id,
                          color: ev.target.value,
                        });
                      }} />
                  </label>
                ) : (
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentColor }} />
                )}
                {e.name}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit shift dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateDialog(false)}>
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ backgroundColor: colors.white }} onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle style={{ color: colors.brown }}>
                {editingShift ? 'Edit Shift' : 'New Shift'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label style={{ color: colors.brown }}>Employee</Label>
                <Select value={selectedEmployeeKey} onValueChange={(v) => { setSelectedEmployeeKey(v); checkConflicts(v, newShiftDate, newShiftStart, newShiftEnd, editingShift?.id); }}>
                  <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.name} value={e.name}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label style={{ color: colors.brown }}>Date</Label>
                <Input
                  id="shift-date"
                  type="date"
                  value={newShiftDate}
                  onChange={(e) => { const d = e.target.value; setNewShiftDate(d); checkConflicts(selectedEmployeeKey, d, newShiftStart, newShiftEnd, editingShift?.id); }}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label style={{ color: colors.brown }}>Start Time</Label>
                  <Input
                    id="shift-start"
                    type="time"
                    value={newShiftStart}
                    onChange={(e) => { const t = e.target.value; setNewShiftStart(t); checkConflicts(selectedEmployeeKey, newShiftDate, t, newShiftEnd, editingShift?.id); }}
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label style={{ color: colors.brown }}>End Time</Label>
                  <Input
                    id="shift-end"
                    type="time"
                    value={newShiftEnd}
                    onChange={(e) => { const t = e.target.value; setNewShiftEnd(t); checkConflicts(selectedEmployeeKey, newShiftDate, newShiftStart, t, editingShift?.id); }}
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label style={{ color: colors.brown }}>Position (optional)</Label>
                <Input value={newShiftPosition} placeholder="e.g. Barista, Closer"
                  onChange={(e) => setNewShiftPosition(e.target.value)}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} />
              </div>
              <div className="space-y-1.5">
                <Label style={{ color: colors.brown }}>Notes (optional)</Label>
                <Textarea value={newShiftNotes} placeholder="Any notes..."
                  onChange={(e) => setNewShiftNotes(e.target.value)}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} rows={2} />
              </div>
              {conflictWarning && (
                <div className="flex items-start gap-2 p-2 rounded-lg text-sm"
                  style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                  <span className="text-base">&#9888;</span>
                  <span>{conflictWarning}</span>
                </div>
              )}
              {editingShift?.acceptance && (
                <div className="flex items-center gap-2 p-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: editingShift.acceptance === 'accepted' ? '#dcfce7' : '#fef2f2',
                    color: editingShift.acceptance === 'accepted' ? '#166534' : '#991b1b',
                    border: `1px solid ${editingShift.acceptance === 'accepted' ? '#bbf7d0' : '#fecaca'}`,
                  }}>
                  {editingShift.acceptance === 'accepted' ? (
                    <><Check className="w-4 h-4" /> Accepted by employee</>
                  ) : (
                    <><X className="w-4 h-4" /> Declined{editingShift.decline_reason ? `: "${editingShift.decline_reason}"` : ''}</>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveShift} disabled={createShift.isPending || updateShift.isPending}
                  style={{ backgroundColor: colors.gold, color: colors.white }} className="flex-1">
                  <Check className="w-4 h-4 mr-1" />
                  {editingShift ? 'Update' : 'Create'}
                </Button>
                {editingShift && canDelete && (
                  <Button variant="outline" onClick={handleDeleteShift} disabled={deleteShift.isPending}
                    style={{ borderColor: colors.red, color: colors.red }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingShift(null); }}
                  style={{ borderColor: colors.creamDark, color: colors.brown }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Event Detail Dialog */}
      {viewingEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingEvent(null)}>
          <Card className="w-full max-w-sm" style={{ backgroundColor: colors.white }} onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: viewingEvent.color }} />
                <CardTitle className="text-base" style={{ color: colors.brown }}>{viewingEvent.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm" style={{ color: colors.brown }}>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 opacity-60" />
                  {formatDateShort(viewingEvent.start_date)}
                  {viewingEvent.end_date !== viewingEvent.start_date && ` – ${formatDateShort(viewingEvent.end_date)}`}
                </div>
                {viewingEvent.location && (
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="w-4 h-4 opacity-60" />
                    {viewingEvent.location}
                  </div>
                )}
                {viewingEvent.description && (
                  <p className="mt-2 opacity-70">{viewingEvent.description}</p>
                )}
              </div>
              <div className="flex items-center justify-between pt-2">
                <Badge variant="outline" className="text-[10px]" style={{ borderColor: colors.creamDark, color: colors.brown }}>
                  {viewingEvent.source === 'ical' ? 'iCal' : 'Manual'}
                </Badge>
                <div className="flex gap-2">
                  {viewingEvent.source === 'manual' && canEdit && (
                    <Button variant="outline" size="sm"
                      onClick={() => {
                        if (confirm('Delete this event?')) {
                          deleteCalendarEvent.mutate(viewingEvent.id);
                          setViewingEvent(null);
                        }
                      }}
                      style={{ borderColor: colors.creamDark, color: '#ef4444' }}>
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setViewingEvent(null)}
                    style={{ borderColor: colors.creamDark, color: colors.brown }}>
                    Close
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Shift Detail / Accept-Decline Dialog (employee view) */}
      {viewingShiftDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingShiftDetail(null)}>
          <Card className="w-full max-w-sm" style={{ backgroundColor: colors.white }} onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base" style={{ color: colors.brown }}>Shift Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-1.5" style={{ color: colors.brown }}>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 opacity-60" />
                  <span>{formatDateShort(viewingShiftDetail.date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 opacity-60" />
                  <span>{formatTimeDisplay(viewingShiftDetail.start_time)} – {formatTimeDisplay(viewingShiftDetail.end_time)}</span>
                </div>
                {viewingShiftDetail.position && (
                  <Badge variant="secondary" className="text-xs">{viewingShiftDetail.position}</Badge>
                )}
                {viewingShiftDetail.notes && (
                  <p className="text-xs opacity-70 mt-1">{viewingShiftDetail.notes}</p>
                )}
              </div>

              {/* Current acceptance status */}
              {viewingShiftDetail.acceptance === 'accepted' && (
                <Badge className="bg-green-100 text-green-800">Accepted</Badge>
              )}
              {viewingShiftDetail.acceptance === 'declined' && (
                <Badge className="bg-red-100 text-red-800">Declined</Badge>
              )}
              {!viewingShiftDetail.acceptance && (
                <Badge className="bg-yellow-100 text-yellow-800">Pending Response</Badge>
              )}

              {/* Accept/Decline actions */}
              {viewingShiftDetail.status === 'published' && (
                <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${colors.creamDark}` }}>
                  {viewingShiftDetail.acceptance !== 'declined' && (
                    <Textarea
                      placeholder="Reason for declining (optional)"
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      rows={2}
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                    />
                  )}
                  <div className="flex gap-2">
                    {viewingShiftDetail.acceptance !== 'accepted' && (
                      <Button className="flex-1"
                        disabled={acceptShift.isPending}
                        onClick={async () => {
                          try {
                            await acceptShift.mutateAsync(viewingShiftDetail.id);
                            toast({ title: 'Shift accepted' });
                            setViewingShiftDetail(null);
                          } catch { toast({ title: 'Failed to accept shift', variant: 'destructive' }); }
                        }}
                        style={{ backgroundColor: '#22c55e', color: '#fff' }}>
                        <Check className="w-4 h-4 mr-1" /> Accept
                      </Button>
                    )}
                    {viewingShiftDetail.acceptance !== 'declined' && (
                      <Button className="flex-1" variant="outline"
                        disabled={declineShift.isPending}
                        onClick={async () => {
                          try {
                            await declineShift.mutateAsync({ shiftId: viewingShiftDetail.id, reason: declineReason || undefined });
                            toast({ title: 'Shift declined' });
                            setViewingShiftDetail(null);
                          } catch { toast({ title: 'Failed to decline shift', variant: 'destructive' }); }
                        }}
                        style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                        <X className="w-4 h-4 mr-1" /> Decline
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <Button variant="outline" size="sm" className="w-full mt-2"
                onClick={() => setViewingShiftDetail(null)}
                style={{ borderColor: colors.creamDark, color: colors.brown }}>
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Template Management Panel */}
      {showTemplatePanel && canEdit && (
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base" style={{ color: colors.brown }}>
              <CalendarDays className="w-5 h-5" style={{ color: colors.gold }} />
              Shift Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing templates */}
            {templates && templates.length > 0 && (
              <div className="space-y-2">
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-lg"
                    style={{ backgroundColor: colors.cream }}>
                    <div>
                      <span className="text-sm font-medium" style={{ color: colors.brown }}>{t.name}</span>
                      <span className="text-xs ml-2" style={{ color: colors.brownLight }}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.day_of_week]} {formatTimeDisplay(t.start_time)}–{formatTimeDisplay(t.end_time)}
                        {t.employee_name && ` · ${t.employee_name}`}
                        {t.position && ` · ${t.position}`}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteTemplate.mutate(t.id)}
                      style={{ color: colors.red }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new template */}
            <div className="space-y-3 pt-2" style={{ borderTop: `1px solid ${colors.creamDark}` }}>
              <p className="text-sm font-medium" style={{ color: colors.brown }}>Add Template Entry</p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Template name" value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }} />
                <Select value={String(newTemplateDay)} onValueChange={(v) => setNewTemplateDay(Number(v))}>
                  <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="time" value={newTemplateStart} onChange={(e) => setNewTemplateStart(e.target.value)}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} />
                <Input type="time" value={newTemplateEnd} onChange={(e) => setNewTemplateEnd(e.target.value)}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={newTemplateEmployee || '__unassigned__'} onValueChange={(v) => setNewTemplateEmployee(v === '__unassigned__' ? '' : v)}>
                  <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}>
                    <SelectValue placeholder="Employee (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__">Unassigned</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.name} value={e.name}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Position (optional)" value={newTemplatePosition}
                  onChange={(e) => setNewTemplatePosition(e.target.value)}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }} />
              </div>
              <Button onClick={handleSaveTemplate} disabled={createTemplate.isPending}
                style={{ backgroundColor: colors.gold, color: colors.white }}>
                <Plus className="w-4 h-4 mr-1" /> Save Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── TIME OFF TAB ────────────────────────────────────────

function TimeOffTab({ tenantId, canApprove, currentUserId }: {
  tenantId: string;
  canApprove: boolean;
  currentUserId: string;
}) {
  const { data: myRequests, isLoading: loadingMine } = useMyTimeOffRequests();
  const { data: allRequests, isLoading: loadingAll } = useTimeOffRequests();
  const createRequest = useCreateTimeOffRequest();
  const reviewRequest = useReviewTimeOffRequest();
  const cancelRequest = useCancelTimeOffRequest();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    category: 'personal' as TimeOffRequest['category'],
    reason: '',
  });
  const [reviewNotes, setReviewNotes] = useState('');

  const pendingTeamRequests = useMemo(() => {
    if (!allRequests || !canApprove) return [];
    return allRequests.filter((r) => {
      if (r.status !== 'pending') return false;
      // Manager routing: show direct reports + unassigned employees
      if (r.employee_manager_id === currentUserId) return true;
      if (!r.employee_manager_id) return true;
      return false;
    });
  }, [allRequests, canApprove, currentUserId]);

  const handleSubmitRequest = useCallback(async () => {
    if (!formData.start_date || !formData.end_date) {
      toast({ title: 'Select dates', variant: 'destructive' });
      return;
    }
    try {
      await createRequest.mutateAsync({
        start_date: formData.start_date,
        end_date: formData.end_date,
        category: formData.category,
        reason: formData.reason || null,
      });
      toast({ title: 'Request submitted' });
      setShowForm(false);
      setFormData({ start_date: '', end_date: '', category: 'personal', reason: '' });
    } catch {
      toast({ title: 'Error', description: 'Failed to submit request.', variant: 'destructive' });
    }
  }, [formData, createRequest, toast]);

  const handleReview = useCallback(async (id: string, status: 'approved' | 'denied') => {
    try {
      await reviewRequest.mutateAsync({ id, status, review_notes: reviewNotes || undefined });
      toast({ title: `Request ${status}` });
      setReviewNotes('');
    } catch {
      toast({ title: 'Error', description: 'Failed to review request.', variant: 'destructive' });
    }
  }, [reviewRequest, reviewNotes, toast]);

  const statusColor = (s: string) => {
    switch (s) {
      case 'approved': return colors.green;
      case 'denied': return colors.red;
      case 'pending': return colors.yellow;
      case 'cancelled': return colors.brownLight;
      default: return colors.brown;
    }
  };

  const categoryLabel = (c: string) => {
    switch (c) {
      case 'vacation': return 'Vacation';
      case 'sick': return 'Sick';
      case 'personal': return 'Personal';
      case 'bereavement': return 'Bereavement';
      default: return 'Other';
    }
  };

  if (loadingMine || loadingAll) return <CoffeeLoader text="Loading time off..." />;

  return (
    <div className="space-y-6">
      {/* My Requests */}
      <Card style={{ backgroundColor: colors.white }}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
            <Plane className="w-5 h-5" style={{ color: colors.gold }} />
            My Requests
          </CardTitle>
          <Button size="sm" onClick={() => setShowForm(!showForm)}
            style={{ backgroundColor: colors.gold, color: colors.white }}>
            <Plus className="w-4 h-4 mr-1" /> Request
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showForm && (
            <Card style={{ backgroundColor: colors.cream }}>
              <CardContent className="space-y-3 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label style={{ color: colors.brown }}>Start Date</Label>
                    <Input type="date" value={formData.start_date}
                      onChange={(e) => setFormData((f) => ({ ...f, start_date: e.target.value }))}
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label style={{ color: colors.brown }}>End Date</Label>
                    <Input type="date" value={formData.end_date}
                      onChange={(e) => setFormData((f) => ({ ...f, end_date: e.target.value }))}
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label style={{ color: colors.brown }}>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData((f) => ({ ...f, category: v as TimeOffRequest['category'] }))}>
                    <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacation">Vacation</SelectItem>
                      <SelectItem value="sick">Sick</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="bereavement">Bereavement</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label style={{ color: colors.brown }}>Reason (optional)</Label>
                  <Textarea value={formData.reason} placeholder="Why you need time off..."
                    onChange={(e) => setFormData((f) => ({ ...f, reason: e.target.value }))}
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }} rows={2} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSubmitRequest} disabled={createRequest.isPending}
                    style={{ backgroundColor: colors.gold, color: colors.white }}>
                    Submit Request
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)}
                    style={{ borderColor: colors.creamDark, color: colors.brown }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {(!myRequests || myRequests.length === 0) ? (
            <p className="text-sm py-4 text-center" style={{ color: colors.brownLight }}>
              No time-off requests yet.
            </p>
          ) : (
            myRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: colors.cream }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" style={{ borderColor: statusColor(r.status), color: statusColor(r.status) }}>
                      {r.status}
                    </Badge>
                    <Badge variant="outline" style={{ borderColor: colors.creamDark, color: colors.brown }}>
                      {categoryLabel(r.category)}
                    </Badge>
                  </div>
                  <p className="text-sm mt-1" style={{ color: colors.brown }}>
                    {formatDateShort(r.start_date)} – {formatDateShort(r.end_date)}
                  </p>
                  {r.reason && <p className="text-xs mt-0.5" style={{ color: colors.brownLight }}>{r.reason}</p>}
                  {r.review_notes && (
                    <p className="text-xs mt-0.5 italic" style={{ color: colors.brownLight }}>
                      Note: {r.review_notes}
                    </p>
                  )}
                </div>
                {r.status === 'pending' && (
                  <Button variant="ghost" size="sm" onClick={() => cancelRequest.mutate(r.id)}
                    style={{ color: colors.red }}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Team Requests (approvers) */}
      {canApprove && (
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
              <Users className="w-5 h-5" style={{ color: colors.gold }} />
              Pending Team Requests
              {pendingTeamRequests.length > 0 && (
                <Badge style={{ backgroundColor: colors.yellow, color: colors.brown }}>
                  {pendingTeamRequests.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingTeamRequests.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: colors.brownLight }}>
                No pending requests.
              </p>
            ) : (
              pendingTeamRequests.map((r) => (
                <div key={r.id} className="p-3 rounded-lg space-y-2" style={{ backgroundColor: colors.cream }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: colors.brown }}>
                        {r.employee_name || 'Unknown'}
                      </p>
                      <p className="text-xs" style={{ color: colors.brownLight }}>
                        {categoryLabel(r.category)} &middot; {formatDateShort(r.start_date)} – {formatDateShort(r.end_date)}
                      </p>
                      {r.reason && <p className="text-xs" style={{ color: colors.brownLight }}>{r.reason}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Review notes (optional)"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="text-xs h-8 flex-1"
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                    />
                    <Button size="sm" onClick={() => handleReview(r.id, 'approved')}
                      disabled={reviewRequest.isPending}
                      style={{ backgroundColor: colors.green, color: '#fff' }}>
                      <Check className="w-3 h-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleReview(r.id, 'denied')}
                      disabled={reviewRequest.isPending}
                      style={{ borderColor: colors.red, color: colors.red }}>
                      <X className="w-3 h-3 mr-1" /> Deny
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────

export default function CalendarWorkforce() {
  const { user, profile, tenant, branding, hasRole, hasPermission } = useAuth();
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const activeTab = (new URLSearchParams(searchString).get('tab') || 'schedule') as TabType;
  const setActiveTab = useCallback((tab: TabType) => {
    setLocation(`/calendar-workforce?tab=${tab}`);
  }, [setLocation]);

  const isManager = hasRole('manager');

  // Permission-based access
  const canManageShifts = hasPermission('manage_shifts');
  const canDeleteShifts = hasPermission('delete_shifts');
  const canApproveTimeOff = hasPermission('approve_time_off');
  const canApproveTimeEdits = hasPermission('approve_time_edits');
  const canApproveTimesheets = hasPermission('approve_timesheets');
  const canExportPayroll = hasPermission('export_payroll');
  const isExempt = profile?.is_exempt ?? false;

  const tenantId = tenant?.id ?? '';
  const { data: employees = [] } = useAllEmployees(tenantId || undefined);

  // Refresh on app resume and location change
  useAppResume(() => {
    queryClient.invalidateQueries({ queryKey: ['shifts'] });
    queryClient.invalidateQueries({ queryKey: ['shifts-today'] });
    queryClient.invalidateQueries({ queryKey: ['time-off'] });
    queryClient.invalidateQueries({ queryKey: ['time-off-mine'] });
    queryClient.invalidateQueries({ queryKey: ['time-clock'] });
    queryClient.invalidateQueries({ queryKey: ['time-clock-active'] });
    queryClient.invalidateQueries({ queryKey: ['time-clock-edits'] });
    queryClient.invalidateQueries({ queryKey: ['time-clock-edits-mine'] });
    queryClient.invalidateQueries({ queryKey: ['all-employees'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    queryClient.invalidateQueries({ queryKey: ['ical-subscriptions'] });
  }, []);

  useLocationChange(() => {
    queryClient.invalidateQueries({ queryKey: ['shifts'] });
    queryClient.invalidateQueries({ queryKey: ['shifts-today'] });
    queryClient.invalidateQueries({ queryKey: ['time-off'] });
    queryClient.invalidateQueries({ queryKey: ['time-off-mine'] });
    queryClient.invalidateQueries({ queryKey: ['time-clock'] });
    queryClient.invalidateQueries({ queryKey: ['time-clock-active'] });
    queryClient.invalidateQueries({ queryKey: ['time-clock-edits'] });
    queryClient.invalidateQueries({ queryKey: ['time-clock-edits-mine'] });
    queryClient.invalidateQueries({ queryKey: ['all-employees'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    queryClient.invalidateQueries({ queryKey: ['ical-subscriptions'] });
  }, []);

  if (!tenant) {
    return <CoffeeLoader fullScreen text="Loading..." />;
  }

  const tabs: { key: TabType; label: string; icon: typeof CalendarDays; show: boolean }[] = [
    { key: 'schedule', label: 'Schedule', icon: CalendarDays, show: true },
    { key: 'time-off', label: 'Time Off', icon: Plane, show: true },
    { key: 'time-clock', label: 'Time Clock', icon: Clock, show: !isExempt || isManager },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6" style={{ color: colors.gold }} />
          <div>
            <h1 className="text-xl font-bold" style={{ color: colors.brown }}>Personnel</h1>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              {tenant.parent_tenant_id ? tenant.name : (branding?.company_name || tenant.name)}
            </p>
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-2 flex-wrap">
          {tabs.filter((t) => t.show).map((t) => (
            <Button
              key={t.key}
              variant={activeTab === t.key ? 'default' : 'outline'}
              onClick={() => setActiveTab(t.key)}
              style={
                activeTab === t.key
                  ? { backgroundColor: colors.gold, color: colors.white }
                  : { borderColor: colors.gold, color: colors.brown }
              }
            >
              <t.icon className="w-4 h-4 mr-2" />
              {t.label}
            </Button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'schedule' && (
          <ScheduleTab
            tenantId={tenantId}
            canEdit={canManageShifts}
            canDelete={canDeleteShifts}
            employees={employees}
          />
        )}
        {activeTab === 'time-off' && (
          <TimeOffTab
            tenantId={tenantId}
            canApprove={canApproveTimeOff}
            currentUserId={user?.id ?? ''}
          />
        )}
        {activeTab === 'time-clock' && (!isExempt || isManager) && (
          <TimeClockTab
            tenantId={tenantId}
            canApproveEdits={canApproveTimeEdits}
            canApproveTimesheets={canApproveTimesheets}
            canViewAll={canExportPayroll || isManager}
            canExport={canExportPayroll}
            currentUserId={user?.id ?? ''}
            employees={employees}
            isExempt={isExempt}
          />
        )}
      </main>
    </div>
  );
}
