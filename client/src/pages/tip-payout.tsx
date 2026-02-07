import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { useAppResume } from '@/hooks/use-app-resume';
import { useLocationChange } from '@/hooks/use-location-change';
import { useToast } from '@/hooks/use-toast';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { Footer } from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';

import { CC_FEE_RATE, TipEmployee } from '@/components/tip-payout/types';
import { formatHoursMinutes, getMonday, getWeekRange } from '@/components/tip-payout/utils';
import { buildCsvContent, buildWeeklyPdfHtml, buildHistoricalGroupHtml, buildHistoricalIndividualHtml, buildLoadingHtml } from '@/components/tip-payout/export-helpers';
import { TipPayoutHeader } from '@/components/tip-payout/TipPayoutHeader';
import { DailyTipsEntry } from '@/components/tip-payout/DailyTipsEntry';
import { EmployeeHoursEntry } from '@/components/tip-payout/EmployeeHoursEntry';
import { TeamHoursVerify } from '@/components/tip-payout/TeamHoursVerify';
import { PayoutSummary } from '@/components/tip-payout/PayoutSummary';
import { HistoricalExport } from '@/components/tip-payout/HistoricalExport';

const colors = {
  gold: '#C9A227',
  goldLight: '#D4B23A',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
  inputBg: '#FDF8E8',
  green: '#22c55e',
  red: '#ef4444',
};

export default function TipPayout() {
  const { tenant, branding, primaryTenant } = useAuth();
  const { toast } = useToast();

  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : (branding?.company_name || tenant?.name || 'Erwin Mills Coffee');
  const orgName = primaryTenant?.name || branding?.company_name || '';
  const companyName = branding?.company_name || displayName || 'Coffee Co.';

  // Core data state
  const [employees, setEmployees] = useState<TipEmployee[]>([]);
  const [weekKey, setWeekKey] = useState(getMonday());
  const [employeeHours, setEmployeeHours] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Tips entry
  const [cashEntries, setCashEntries] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [ccEntries, setCcEntries] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [savingTips, setSavingTips] = useState(false);

  // Hours entry
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [hoursInput, setHoursInput] = useState('');
  const [minutesInput, setMinutesInput] = useState('');
  const [savingHours, setSavingHours] = useState(false);

  // Hours verification
  const [teamHoursCheck, setTeamHoursCheck] = useState('');
  const [teamMinutesCheck, setTeamMinutesCheck] = useState('');
  const [hoursVerifyResult, setHoursVerifyResult] = useState<{ match: boolean; message: string } | null>(null);

  // Employee management
  const [allEmployees, setAllEmployees] = useState<TipEmployee[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);

  // Historical export
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyExportType, setHistoryExportType] = useState<'group' | 'individual'>('group');
  const [historySelectedEmployee, setHistorySelectedEmployee] = useState('');
  const [exportingHistory, setExportingHistory] = useState(false);

  // --- Data loading ---

  const loadEmployees = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const { data, error } = await supabase
        .from('tip_employees')
        .select('*')
        .eq('tenant_id', tenant.id)
        .or('is_active.eq.true,is_active.is.null')
        .order('name');
      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error('Error loading employees:', error);
    }
  }, [tenant?.id]);

  const loadAllEmployees = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const { data, error } = await supabase
        .from('tip_employees')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('name');
      if (error) throw error;
      setAllEmployees(data || []);
    } catch (error: any) {
      console.error('Error loading all employees:', error);
    }
  }, [tenant?.id]);

  const loadWeekData = useCallback(async () => {
    if (!tenant?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: weekData, error: weekError } = await supabase
        .from('tip_weekly_data')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('week_key', weekKey)
        .maybeSingle();
      if (weekError) throw weekError;

      if (weekData) {
        setCashEntries(weekData.cash_entries || [0, 0, 0, 0, 0, 0, 0]);
        setCcEntries(weekData.cc_entries || [0, 0, 0, 0, 0, 0, 0]);
      } else {
        setCashEntries([0, 0, 0, 0, 0, 0, 0]);
        setCcEntries([0, 0, 0, 0, 0, 0, 0]);
      }

      const { data: hoursData, error: hoursError } = await supabase
        .from('tip_employee_hours')
        .select('*, tip_employees(name)')
        .eq('tenant_id', tenant.id)
        .eq('week_key', weekKey);
      if (hoursError) throw hoursError;

      const hoursMap: Record<string, number> = {};
      (hoursData || []).forEach((h: any) => {
        if (h.tip_employees?.name) {
          hoursMap[h.tip_employees.name] = parseFloat(h.hours) || 0;
        }
      });
      setEmployeeHours(hoursMap);
    } catch (error: any) {
      console.error('Error loading week data:', error);
      toast({ title: 'Error loading data', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, weekKey, toast]);

  useEffect(() => {
    if (tenant?.id) {
      loadEmployees();
      loadAllEmployees();
    }
  }, [tenant?.id, loadEmployees, loadAllEmployees]);

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData]);

  useAppResume(() => {
    if (tenant?.id) {
      loadEmployees();
      loadAllEmployees();
      loadWeekData();
    }
  }, [tenant?.id, loadEmployees, loadAllEmployees, loadWeekData]);

  useLocationChange(() => {
    loadEmployees();
    loadAllEmployees();
    loadWeekData();
  }, [loadEmployees, loadAllEmployees, loadWeekData]);

  // --- Mutations ---

  const addEmployee = async () => {
    if (!tenant?.id || !newEmployeeName.trim()) {
      toast({ title: 'Please enter an employee name', variant: 'destructive' });
      return;
    }
    setAddingEmployee(true);
    try {
      const { error } = await supabase
        .from('tip_employees')
        .insert({ tenant_id: tenant.id, name: newEmployeeName.trim() });
      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Employee already exists', variant: 'destructive' });
        } else {
          throw error;
        }
      } else {
        toast({ title: `${newEmployeeName.trim()} added!` });
        setNewEmployeeName('');
        loadEmployees();
      }
    } catch (error: any) {
      toast({ title: 'Error adding employee', description: error.message, variant: 'destructive' });
    } finally {
      setAddingEmployee(false);
    }
  };

  const toggleEmployeeActive = async (employeeId: string, newActiveStatus: boolean) => {
    if (!tenant?.id) return;
    try {
      const { error } = await supabase
        .from('tip_employees')
        .update({ is_active: newActiveStatus })
        .eq('id', employeeId)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      toast({
        title: newActiveStatus ? 'Employee reactivated' : 'Employee deactivated',
        description: newActiveStatus
          ? 'Employee can now receive tip hours.'
          : 'Employee will no longer appear in weekly hours entry. Historical data is preserved.',
      });
      loadEmployees();
      loadAllEmployees();
    } catch (error: any) {
      toast({ title: 'Error updating employee', description: error.message, variant: 'destructive' });
    }
  };

  const saveTips = async () => {
    if (!tenant?.id) return;
    const cashTotal = cashEntries.reduce((a, b) => a + (parseFloat(String(b)) || 0), 0);
    const ccTotal = ccEntries.reduce((a, b) => a + (parseFloat(String(b)) || 0), 0);
    if (cashTotal === 0 && ccTotal === 0) {
      toast({ title: 'Please enter tip amounts', variant: 'destructive' });
      return;
    }
    setSavingTips(true);
    try {
      const { error } = await supabase
        .from('tip_weekly_data')
        .upsert({
          tenant_id: tenant.id,
          week_key: weekKey,
          cash_tips: cashTotal,
          cc_tips: ccTotal,
          cash_entries: cashEntries,
          cc_entries: ccEntries,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,week_key' });
      if (error) throw error;
      toast({ title: 'Tips saved!' });
      loadWeekData();
    } catch (error: any) {
      toast({ title: 'Error saving tips', description: error.message, variant: 'destructive' });
    } finally {
      setSavingTips(false);
    }
  };

  const addHours = async () => {
    if (!tenant?.id || !selectedEmployee) {
      toast({ title: 'Please select an employee', variant: 'destructive' });
      return;
    }
    const h = parseInt(hoursInput) || 0;
    const m = Math.min(parseInt(minutesInput) || 0, 59);
    const totalHours = h + m / 60;
    if (totalHours === 0) {
      toast({ title: 'Please enter hours', variant: 'destructive' });
      return;
    }
    const employee = employees.find(e => e.name === selectedEmployee);
    if (!employee) return;

    setSavingHours(true);
    try {
      const { data: existing } = await supabase
        .from('tip_employee_hours')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('employee_id', employee.id)
        .eq('week_key', weekKey)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from('tip_employee_hours')
          .update({ hours: totalHours, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .eq('tenant_id', tenant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tip_employee_hours')
          .insert({ tenant_id: tenant.id, employee_id: employee.id, week_key: weekKey, hours: totalHours });
        if (error) throw error;
      }
      toast({ title: `${selectedEmployee}: ${formatHoursMinutes(totalHours)} saved` });
      setHoursInput('');
      setMinutesInput('');
      loadWeekData();
    } catch (error: any) {
      toast({ title: 'Error saving hours', description: error.message, variant: 'destructive' });
    } finally {
      setSavingHours(false);
    }
  };

  const deleteHours = async (employeeName: string) => {
    if (!tenant?.id) return;
    const employee = employees.find(e => e.name === employeeName);
    if (!employee) return;
    try {
      const { error } = await supabase
        .from('tip_employee_hours')
        .delete()
        .eq('tenant_id', tenant.id)
        .eq('employee_id', employee.id)
        .eq('week_key', weekKey);
      if (error) throw error;
      toast({ title: `${employeeName}'s hours removed` });
      loadWeekData();
    } catch (error: any) {
      toast({ title: 'Error deleting hours', description: error.message, variant: 'destructive' });
    }
  };

  const editEmployee = (name: string, hours: number) => {
    setSelectedEmployee(name);
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    setHoursInput(h.toString());
    setMinutesInput(m.toString());
  };

  const verifyTeamHours = () => {
    const h = parseInt(teamHoursCheck) || 0;
    const m = Math.min(parseInt(teamMinutesCheck) || 0, 59);
    const declared = h + m / 60;
    const actual = Object.values(employeeHours).reduce((a, b) => a + b, 0);
    const diff = Math.abs(actual - declared);
    if (diff < 0.1) {
      setHoursVerifyResult({ match: true, message: `Perfect! ${formatHoursMinutes(actual)}` });
    } else {
      setHoursVerifyResult({
        match: false,
        message: `Warning: Entered ${formatHoursMinutes(actual)} vs declared ${formatHoursMinutes(declared)} (diff ${diff.toFixed(2)}h)`,
      });
    }
  };

  // --- Exports ---

  const exportCSV = () => {
    const csvContent = buildCsvContent({ weekRange, employeeHours, hourlyRate, totalPool });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tip-payout-${weekKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const html = buildWeeklyPdfHtml({
      companyName,
      weekRange,
      cashTotal,
      ccTotal,
      ccAfterFee,
      totalPool,
      totalTeamHours,
      hourlyRate,
      employeeHours,
    });
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const exportHistorical = async () => {
    if (!tenant?.id || !historyStartDate || !historyEndDate) {
      toast({ title: 'Please select start and end dates', variant: 'destructive' });
      return;
    }
    const exportWindow = window.open('', '_blank');
    if (!exportWindow) {
      toast({ title: 'Please allow popups to export', variant: 'destructive' });
      return;
    }
    exportWindow.document.write(buildLoadingHtml());

    setExportingHistory(true);
    try {
      const QUERY_TIMEOUT = 15000;

      const weeklyPromise = supabase
        .from('tip_weekly_data')
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('week_key', historyStartDate)
        .lte('week_key', historyEndDate)
        .order('week_key');
      const { data: weeklyData, error: weeklyError } = await Promise.race([
        weeklyPromise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Query timeout - please try again')), QUERY_TIMEOUT)),
      ]);
      if (weeklyError) throw weeklyError;

      const hoursPromise = supabase
        .from('tip_employee_hours')
        .select('*, tip_employees(id, name)')
        .eq('tenant_id', tenant.id)
        .gte('week_key', historyStartDate)
        .lte('week_key', historyEndDate)
        .order('week_key');
      const { data: hoursData, error: hoursError } = await Promise.race([
        hoursPromise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Query timeout - please try again')), QUERY_TIMEOUT)),
      ]);
      if (hoursError) throw hoursError;

      if (!weeklyData?.length) {
        exportWindow.close();
        toast({ title: 'No data found in selected date range', variant: 'destructive' });
        setExportingHistory(false);
        return;
      }

      const startRange = new Date(historyStartDate + 'T00:00:00').toLocaleDateString('en-US');
      const endRange = new Date(historyEndDate + 'T00:00:00').toLocaleDateString('en-US');

      if (historyExportType === 'group') {
        const html = buildHistoricalGroupHtml({ startRange, endRange, weeklyData, hoursData, allEmployees });
        exportWindow.document.open();
        exportWindow.document.write(html);
        exportWindow.document.close();
        toast({ title: 'Historical report ready!' });
      } else {
        if (!historySelectedEmployee) {
          exportWindow.close();
          toast({ title: 'Please select an employee', variant: 'destructive' });
          setExportingHistory(false);
          return;
        }
        const employee = allEmployees.find(e => e.id === historySelectedEmployee);
        const html = buildHistoricalIndividualHtml({
          employeeName: employee?.name || 'Employee',
          startRange,
          endRange,
          weeklyData,
          hoursData,
          employeeId: historySelectedEmployee,
        });
        exportWindow.document.open();
        exportWindow.document.write(html);
        exportWindow.document.close();
        toast({ title: `${employee?.name}'s history ready!` });
      }
    } catch (error: any) {
      console.error('Export error:', error);
      exportWindow.close();
      toast({ title: 'Error exporting history', description: error.message, variant: 'destructive' });
    } finally {
      setExportingHistory(false);
    }
  };

  // --- Computed values ---

  const cashTotal = cashEntries.reduce((a, b) => a + (parseFloat(String(b)) || 0), 0);
  const ccTotal = ccEntries.reduce((a, b) => a + (parseFloat(String(b)) || 0), 0);
  const ccAfterFee = ccTotal * (1 - CC_FEE_RATE);
  const totalPool = cashTotal + ccAfterFee;
  const totalTeamHours = Object.values(employeeHours).reduce((a, b) => a + b, 0);
  const hourlyRate = totalTeamHours > 0 ? totalPool / totalTeamHours : 0;
  const weekRange = getWeekRange(weekKey);
  // --- Loading state ---

  if (loading) {
    return <CoffeeLoader fullScreen text="Loading tip data..." />;
  }

  // --- Render ---

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <TipPayoutHeader
        colors={colors}
        displayName={displayName || ''}
        orgName={orgName}
        isChildLocation={isChildLocation}
        allEmployees={allEmployees}
        newEmployeeName={newEmployeeName}
        onNewEmployeeNameChange={setNewEmployeeName}
        onAddEmployee={addEmployee}
        addingEmployee={addingEmployee}
        showInactive={showInactive}
        onToggleShowInactive={() => setShowInactive(!showInactive)}
        onToggleEmployeeActive={toggleEmployeeActive}
        dialogOpen={manageDialogOpen}
        onDialogOpenChange={(open) => {
          setManageDialogOpen(open);
          if (open) loadAllEmployees();
        }}
      />

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
          <CardContent className="p-5 space-y-0">
            <DailyTipsEntry
              colors={colors}
              weekKey={weekKey}
              onWeekKeyChange={setWeekKey}
              weekRange={weekRange}
              cashEntries={cashEntries}
              ccEntries={ccEntries}
              onCashEntryChange={(i, val) => {
                const newEntries = [...cashEntries];
                newEntries[i] = val;
                setCashEntries(newEntries);
              }}
              onCcEntryChange={(i, val) => {
                const newEntries = [...ccEntries];
                newEntries[i] = val;
                setCcEntries(newEntries);
              }}
              cashTotal={cashTotal}
              ccTotal={ccTotal}
              ccAfterFee={ccAfterFee}
              onSaveTips={saveTips}
              savingTips={savingTips}
            />

            <hr className="my-5" style={{ borderColor: colors.creamDark }} />

            <EmployeeHoursEntry
              colors={colors}
              employees={employees}
              employeeHours={employeeHours}
              hourlyRate={hourlyRate}
              selectedEmployee={selectedEmployee}
              onSelectedEmployeeChange={setSelectedEmployee}
              hoursInput={hoursInput}
              minutesInput={minutesInput}
              onHoursInputChange={setHoursInput}
              onMinutesInputChange={setMinutesInput}
              onAddHours={addHours}
              savingHours={savingHours}
              onEditEmployee={editEmployee}
              onDeleteEmployee={deleteHours}
              onAddNewEmployee={() => setManageDialogOpen(true)}
            />

            <hr className="my-5" style={{ borderColor: colors.creamDark }} />

            <PayoutSummary
              colors={colors}
              calculation={{ cashTotal, ccTotal, ccAfterFee, totalPool, totalTeamHours, hourlyRate, weekRange }}
              hasData={Object.keys(employeeHours).length > 0}
              onExportCSV={exportCSV}
              onExportPDF={exportPDF}
            />

            <hr className="my-5" style={{ borderColor: colors.creamDark }} />

            <TeamHoursVerify
              colors={colors}
              teamHoursCheck={teamHoursCheck}
              teamMinutesCheck={teamMinutesCheck}
              onTeamHoursChange={setTeamHoursCheck}
              onTeamMinutesChange={setTeamMinutesCheck}
              onVerify={verifyTeamHours}
              hoursVerifyResult={hoursVerifyResult}
            />
          </CardContent>
        </Card>

        <HistoricalExport
          colors={colors}
          allEmployees={allEmployees}
          employees={employees}
          historyStartDate={historyStartDate}
          historyEndDate={historyEndDate}
          historyExportType={historyExportType}
          historySelectedEmployee={historySelectedEmployee}
          onStartDateChange={setHistoryStartDate}
          onEndDateChange={setHistoryEndDate}
          onExportTypeChange={setHistoryExportType}
          onSelectedEmployeeChange={setHistorySelectedEmployee}
          onExportHistorical={exportHistorical}
          exportingHistory={exportingHistory}
        />
      </main>
      <Footer />
    </div>
  );
}
