import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { useAppResume } from '@/hooks/use-app-resume';
import { useLocationChange } from '@/hooks/use-location-change';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Plus, UserPlus, Clock, DollarSign, CheckCircle, AlertCircle, FileText, Users, UserX, RotateCcw, History, Home } from 'lucide-react';
import { Link } from 'wouter';
import { Footer } from '@/components/Footer';
import defaultLogo from '@assets/Erwin-Mills-Logo_1767709452739.png';

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

const CC_FEE_RATE = 0.035;

interface TipEmployee {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean | null;
}

// Helper to treat null as active (true)
const isEmployeeActive = (emp: TipEmployee) => emp.is_active !== false;

interface WeeklyTipData {
  id?: string;
  tenant_id: string;
  week_key: string;
  cash_tips: number;
  cc_tips: number;
  cash_entries: number[];
  cc_entries: number[];
}

interface EmployeeHours {
  id?: string;
  tenant_id: string;
  employee_id: string;
  week_key: string;
  hours: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0);
};

const formatHoursMinutes = (decimalHours: number) => {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

const getMonday = (date: Date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  // Use local date formatting to avoid UTC timezone shift
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
};

const getWeekRange = (weekKey: string) => {
  const monday = new Date(weekKey + 'T00:00:00');
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
    end: sunday.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
  };
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TipPayout() {
  const { profile, tenant, branding, primaryTenant } = useAuth();
  const { toast } = useToast();
  
  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : (branding?.company_name || tenant?.name || 'Erwin Mills Coffee');
  const orgName = primaryTenant?.name || branding?.company_name || '';
  const logoUrl = branding?.logo_url || defaultLogo;
  
  const [employees, setEmployees] = useState<TipEmployee[]>([]);
  const [weekKey, setWeekKey] = useState(getMonday());
  const [weeklyData, setWeeklyData] = useState<WeeklyTipData | null>(null);
  const [employeeHours, setEmployeeHours] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [savingTips, setSavingTips] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [addingEmployee, setAddingEmployee] = useState(false);
  
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [cashEntries, setCashEntries] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [ccEntries, setCcEntries] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [hoursInput, setHoursInput] = useState('');
  const [minutesInput, setMinutesInput] = useState('');
  const [teamHoursCheck, setTeamHoursCheck] = useState('');
  const [teamMinutesCheck, setTeamMinutesCheck] = useState('');
  const [hoursVerifyResult, setHoursVerifyResult] = useState<{ match: boolean; message: string } | null>(null);
  
  // Employee management
  const [showEmployeeManagement, setShowEmployeeManagement] = useState(false);
  const [allEmployees, setAllEmployees] = useState<TipEmployee[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  
  // Historical export
  const [showHistoricalExport, setShowHistoricalExport] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyExportType, setHistoryExportType] = useState<'group' | 'individual'>('group');
  const [historySelectedEmployee, setHistorySelectedEmployee] = useState('');
  const [exportingHistory, setExportingHistory] = useState(false);

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
          : 'Employee will no longer appear in weekly hours entry. Historical data is preserved.'
      });
      
      loadEmployees();
      loadAllEmployees();
    } catch (error: any) {
      toast({ title: 'Error updating employee', description: error.message, variant: 'destructive' });
    }
  };

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
        setWeeklyData(weekData);
        setCashEntries(weekData.cash_entries || [0, 0, 0, 0, 0, 0, 0]);
        setCcEntries(weekData.cc_entries || [0, 0, 0, 0, 0, 0, 0]);
      } else {
        setWeeklyData(null);
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
      toast({
        title: 'Error loading data',
        description: error.message,
        variant: 'destructive'
      });
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

  // Refresh data when app resumes from background (iPad multitasking)
  useAppResume(() => {
    if (tenant?.id) {
      console.log('[TipPayout] Refreshing data after app resume');
      loadEmployees();
      loadAllEmployees();
      loadWeekData();
    }
  }, [tenant?.id, loadEmployees, loadAllEmployees, loadWeekData]);

  // Refresh data when location changes
  useLocationChange(() => {
    console.log('[TipPayout] Refreshing data after location change');
    loadEmployees();
    loadAllEmployees();
    loadWeekData();
  }, [loadEmployees, loadAllEmployees, loadWeekData]);

  const addEmployee = async () => {
    if (!tenant?.id || !newEmployeeName.trim()) {
      toast({ title: 'Please enter an employee name', variant: 'destructive' });
      return;
    }
    
    setAddingEmployee(true);
    try {
      const { error } = await supabase
        .from('tip_employees')
        .insert({
          tenant_id: tenant.id,
          name: newEmployeeName.trim()
        });
      
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
          updated_at: new Date().toISOString()
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
          .insert({
            tenant_id: tenant.id,
            employee_id: employee.id,
            week_key: weekKey,
            hours: totalHours
          });
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
        message: `Warning: Entered ${formatHoursMinutes(actual)} vs declared ${formatHoursMinutes(declared)} (diff ${diff.toFixed(2)}h)`
      });
    }
  };

  const cashTotal = cashEntries.reduce((a, b) => a + (parseFloat(String(b)) || 0), 0);
  const ccTotal = ccEntries.reduce((a, b) => a + (parseFloat(String(b)) || 0), 0);
  const ccAfterFee = ccTotal * (1 - CC_FEE_RATE);
  const totalPool = cashTotal + ccAfterFee;
  const totalTeamHours = Object.values(employeeHours).reduce((a, b) => a + b, 0);
  const hourlyRate = totalTeamHours > 0 ? totalPool / totalTeamHours : 0;

  const weekRange = getWeekRange(weekKey);

  const exportCSV = () => {
    let csv = `Week: ${weekRange.start} - ${weekRange.end}\n\n`;
    csv += "Employee,Hours,Hourly Rate,Payout\n";
    
    Object.entries(employeeHours)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([name, hours]) => {
        csv += `"${name}","${formatHoursMinutes(hours)}",${hourlyRate.toFixed(2)},${(hours * hourlyRate).toFixed(2)}\n`;
      });
    
    csv += `\nTotal Tip Pool,,,${totalPool.toFixed(2)}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const csvUrl = URL.createObjectURL(blob);
    
    const downloadPage = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tip Payout CSV Export</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 40px; 
            color: #2C2416; 
            max-width: 600px; 
            margin: 0 auto; 
            text-align: center;
          }
          .container { 
            border: 1px solid #D4A84B; 
            border-radius: 12px; 
            padding: 40px; 
            background: #FFFFFF; 
          }
          h1 { color: #2C2416; margin-bottom: 10px; }
          p { color: #666; margin: 10px 0; }
          .button { 
            display: inline-flex; 
            align-items: center;
            gap: 8px;
            padding: 8px 12px; 
            background-color: #D4A84B; 
            color: #2C2416; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: 600;
            margin: 8px;
            cursor: pointer;
            border: none;
            font-size: 14px;
          }
          .button:hover { background-color: #c49a42; }
          .button.secondary { 
            background-color: #f5f5f5; 
            border: 1px solid #ddd;
          }
          .button.secondary:hover { background-color: #e5e5e5; }
          .info { 
            background: #FDF8F0; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>CSV Export Ready</h1>
          <p>Weekly Tip Payout</p>
          
          <div class="info">
            <p><strong>Week:</strong> ${weekRange.start} - ${weekRange.end}</p>
            <p><strong>Total Pool:</strong> ${formatCurrency(totalPool)}</p>
          </div>
          
          <div style="margin: 30px 0;">
            <a href="${csvUrl}" download="tip-payout-weekly.csv" class="button">
              Download CSV File
            </a>
          </div>
          
          <div>
            <button class="button secondary" onclick="window.close()">
              Close & Return to App
            </button>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const downloadWindow = window.open('', '_blank');
    if (downloadWindow) {
      downloadWindow.document.write(downloadPage);
      downloadWindow.document.close();
    }
  };

  const exportPDF = () => {
    const sortedEmployees = Object.entries(employeeHours).sort(([a], [b]) => a.localeCompare(b));
    
    const individualPaystubs = sortedEmployees.map(([name, hours]) => {
      const payout = hours * hourlyRate;
      return `
        <div class="page-break"></div>
        <div class="container paystub">
          <div class="header">
            <h1>Erwin Mills Coffee Co.</h1>
            <h2>Employee Tip Paystub</h2>
            <div class="week">Week: ${weekRange.start} - ${weekRange.end}</div>
          </div>
          
          <div class="employee-name">${name}</div>
          
          <div class="summary">
            <div class="summary-item">Total Tip Pool: ${formatCurrency(totalPool)}</div>
            <div class="summary-item">Total Team Hours: ${formatHoursMinutes(totalTeamHours)} (${totalTeamHours.toFixed(2)}h)</div>
            <div class="summary-item gold-text">Hourly Rate: ${formatCurrency(hourlyRate)}/hr</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Hours Worked</td>
                <td>${formatHoursMinutes(hours)} (${hours.toFixed(2)}h)</td>
              </tr>
              <tr>
                <td>Hourly Tip Rate</td>
                <td>${formatCurrency(hourlyRate)}</td>
              </tr>
              <tr class="total-row">
                <td>TIP PAYOUT</td>
                <td>${formatCurrency(payout)}</td>
              </tr>
            </tbody>
          </table>
          
        </div>
      `;
    }).join('');

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Erwin Mills Coffee Co. - Weekly Tip Payout Summary</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 30px; 
            color: #4A3728;
            max-width: 700px;
            margin: 0 auto;
          }
          .container {
            border: 1px solid #C9A227;
            border-radius: 8px;
            padding: 25px;
            background: #FFFDF7;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            color: #4A3728;
          }
          .header h2 {
            margin: 5px 0 0 0;
            font-size: 16px;
            font-weight: normal;
            color: #6B5344;
          }
          .header .week {
            margin-top: 5px;
            font-size: 14px;
            color: #6B5344;
          }
          .summary {
            display: flex;
            flex-wrap: wrap;
            gap: 10px 40px;
            margin: 20px 0;
            padding: 15px 0;
            border-bottom: 1px solid #E5DDD0;
          }
          .summary-item {
            font-size: 13px;
          }
          .summary-item.highlight {
            background-color: #C9A227;
            padding: 3px 8px;
            border-radius: 3px;
          }
          .summary-item.gold-text {
            color: #C9A227;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          th {
            background-color: #C9A227;
            color: #4A3728;
            padding: 10px 12px;
            text-align: left;
            font-weight: bold;
            font-size: 13px;
          }
          td {
            padding: 8px 12px;
            border-bottom: 1px solid #E5DDD0;
            font-size: 13px;
          }
          .total-row {
            background-color: #C9A227;
            font-weight: bold;
          }
          .total-row td {
            border-bottom: none;
            padding: 10px 12px;
          }
          .page-break {
            page-break-before: always;
            margin-top: 40px;
          }
          .employee-name {
            text-align: center;
            font-size: 22px;
            font-weight: bold;
            color: #4A3728;
            margin: 15px 0;
            padding: 10px;
            background-color: #F5F0E6;
            border-radius: 5px;
          }
          .paystub table {
            margin-top: 20px;
          }
          .button-row { 
            display: flex; 
            gap: 10px; 
            justify-content: center; 
            margin-bottom: 20px; 
          }
          .button { 
            display: inline-flex; 
            align-items: center;
            gap: 8px;
            padding: 8px 12px; 
            background-color: #C9A227; 
            color: #4A3728; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: 600;
            cursor: pointer;
            border: none;
            font-size: 14px;
          }
          .button:hover { background-color: #b8911f; }
          .button.secondary { 
            background-color: #f5f5f5; 
            border: 1px solid #ddd;
          }
          .button.secondary:hover { background-color: #e5e5e5; }
          @media print { 
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .page-break { page-break-before: always; margin-top: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="button-row no-print">
          <button class="button secondary" onclick="window.close()">Close & Return to App</button>
          <button class="button" onclick="window.print()">Print / Save as PDF</button>
        </div>
        <div class="container">
          <div class="header">
            <h1>Erwin Mills Coffee Co.</h1>
            <h2>Weekly Tip Payout Summary</h2>
            <div class="week">Week: ${weekRange.start} - ${weekRange.end}</div>
          </div>
          
          <div class="summary">
            <div class="summary-item">Total Cash Tips: ${formatCurrency(cashTotal)}</div>
            <div class="summary-item">Total CC Tips: ${formatCurrency(ccTotal)}</div>
            <div class="summary-item">CC After 3.5% Fee: ${formatCurrency(ccAfterFee)}</div>
            <div class="summary-item highlight">Total Tip Pool: ${formatCurrency(totalPool)}</div>
            <div class="summary-item">Total Team Hours: ${formatHoursMinutes(totalTeamHours)} (${totalTeamHours.toFixed(2)}h)</div>
            <div class="summary-item gold-text">Hourly Rate: ${formatCurrency(hourlyRate)}/hr</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Hours</th>
                <th>Payout</th>
              </tr>
            </thead>
            <tbody>
              ${sortedEmployees
                .map(([name, hours]) => `
                  <tr>
                    <td>${name}</td>
                    <td>${formatHoursMinutes(hours)}</td>
                    <td>${formatCurrency(hours * hourlyRate)}</td>
                  </tr>
                `).join('')}
              <tr class="total-row">
                <td>TOTAL</td>
                <td>${formatHoursMinutes(totalTeamHours)}</td>
                <td>${formatCurrency(totalPool)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        ${individualPaystubs}
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  };

  const exportHistorical = async () => {
    if (!tenant?.id || !historyStartDate || !historyEndDate) {
      toast({ title: 'Please select start and end dates', variant: 'destructive' });
      return;
    }

    // Open window synchronously BEFORE async calls to prevent popup blocker
    const exportWindow = window.open('', '_blank');
    if (!exportWindow) {
      toast({ title: 'Please allow popups to export', variant: 'destructive' });
      return;
    }
    exportWindow.document.write(`
      <html>
      <body style="font-family: Arial; text-align: center; padding-top: 80px;">
        <h2 style="color: #2C2416;">Loading historical data...</h2>
        <p style="color: #666;">Please wait while we retrieve your tip payout history.</p>
        <button onclick="window.close()" style="margin-top: 30px; padding: 8px 16px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-size: 14px;">
          Cancel & Close
        </button>
      </body>
      </html>
    `);

    setExportingHistory(true);
    try {
      // Fetch all weekly data in range
      const { data: weeklyData, error: weeklyError } = await supabase
        .from('tip_weekly_data')
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('week_key', historyStartDate)
        .lte('week_key', historyEndDate)
        .order('week_key');

      if (weeklyError) throw weeklyError;

      // Fetch all employee hours in range
      const { data: hoursData, error: hoursError } = await supabase
        .from('tip_employee_hours')
        .select('*, tip_employees(id, name)')
        .eq('tenant_id', tenant.id)
        .gte('week_key', historyStartDate)
        .lte('week_key', historyEndDate)
        .order('week_key');

      if (hoursError) throw hoursError;

      if (!weeklyData?.length) {
        exportWindow.close();
        toast({ title: 'No data found in selected date range', variant: 'destructive' });
        setExportingHistory(false);
        return;
      }

      // Build export data
      const startRange = new Date(historyStartDate + 'T00:00:00').toLocaleDateString('en-US');
      const endRange = new Date(historyEndDate + 'T00:00:00').toLocaleDateString('en-US');

      const baseStyles = `
        <style>
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; margin: 0; }
            .container { border: none !important; box-shadow: none !important; }
          }
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            color: #2C2416; 
            max-width: 900px; 
            margin: 0 auto;
          }
          .container { 
            border: 1px solid #D4A84B; 
            border-radius: 12px; 
            padding: 30px; 
            background: #FFFFFF; 
          }
          h1 { color: #2C2416; margin-bottom: 5px; text-align: center; }
          h2 { color: #2C2416; margin-top: 0; text-align: center; font-size: 16px; font-weight: normal; }
          .date-range { text-align: center; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { 
            background: #D4A84B; 
            color: #2C2416; 
            padding: 10px; 
            text-align: left; 
            font-weight: bold;
          }
          td { 
            padding: 10px; 
            border-bottom: 1px solid #eee; 
          }
          tr:nth-child(even) { background: #FDF8F0; }
          .total-row { 
            background: #2C2416 !important; 
            color: white; 
            font-weight: bold;
          }
          .total-row td { border-bottom: none; }
          .button-row { 
            display: flex; 
            gap: 10px; 
            justify-content: center; 
            margin-bottom: 20px; 
          }
          .button { 
            display: inline-flex; 
            align-items: center;
            gap: 8px;
            padding: 8px 12px; 
            background-color: #D4A84B; 
            color: #2C2416; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: 600;
            cursor: pointer;
            border: none;
            font-size: 14px;
          }
          .button:hover { background-color: #c49a42; }
          .button.secondary { 
            background-color: #f5f5f5; 
            border: 1px solid #ddd;
          }
          .button.secondary:hover { background-color: #e5e5e5; }
          .summary-box {
            background: #FDF8F0;
            border: 1px solid #D4A84B;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
          }
          .summary-box h3 { margin: 0 0 10px 0; color: #2C2416; }
          .summary-value { font-size: 24px; font-weight: bold; color: #D4A84B; }
        </style>
      `;

      if (historyExportType === 'group') {
        // Group export - all employees, all weeks
        let grandTotalPayout = 0;
        let grandTotalHours = 0;
        let tableRows = '';
        
        // Track per-employee totals for summary page
        const employeeTotals: Record<string, { name: string; hours: number; payout: number; isActive: boolean }> = {};

        weeklyData.forEach((week: any) => {
          const weekHours = hoursData?.filter((h: any) => h.week_key === week.week_key) || [];
          const totalHours = weekHours.reduce((sum: number, h: any) => sum + (parseFloat(h.hours) || 0), 0);
          const ccAfter = week.cc_tips * (1 - CC_FEE_RATE);
          const pool = week.cash_tips + ccAfter;
          const rate = totalHours > 0 ? pool / totalHours : 0;
          const weekRange = getWeekRange(week.week_key);

          weekHours.forEach((h: any) => {
            const hours = parseFloat(h.hours) || 0;
            const payout = hours * rate;
            grandTotalPayout += payout;
            grandTotalHours += hours;
            
            // Track employee totals
            const empId = h.tip_employees?.id || 'unknown';
            const empName = h.tip_employees?.name || 'Unknown';
            const empRecord = allEmployees.find(e => e.id === empId);
            const isActive = empRecord?.is_active !== false;
            
            if (!employeeTotals[empId]) {
              employeeTotals[empId] = { name: empName, hours: 0, payout: 0, isActive };
            }
            employeeTotals[empId].hours += hours;
            employeeTotals[empId].payout += payout;
            
            tableRows += `
              <tr>
                <td>${weekRange.start} - ${weekRange.end}</td>
                <td>${h.tip_employees?.name || 'Unknown'}</td>
                <td>${hours.toFixed(2)}</td>
                <td>$${rate.toFixed(2)}</td>
                <td>$${payout.toFixed(2)}</td>
              </tr>
            `;
          });
        });

        // Build employee summary rows sorted by payout (highest first)
        const sortedEmployees = Object.values(employeeTotals).sort((a, b) => b.payout - a.payout);
        let employeeSummaryRows = '';
        sortedEmployees.forEach(emp => {
          const statusBadge = emp.isActive 
            ? '' 
            : '<span style="background: #f0f0f0; color: #666; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">Inactive</span>';
          employeeSummaryRows += `
            <tr>
              <td>${emp.name}${statusBadge}</td>
              <td>${emp.hours.toFixed(2)}</td>
              <td>$${emp.payout.toFixed(2)}</td>
            </tr>
          `;
        });

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Tip Payout History Report</title>
            ${baseStyles}
            <style>
              .page-break { page-break-after: always; }
              .summary-section { margin-bottom: 30px; }
              .section-title { 
                font-size: 18px; 
                font-weight: bold; 
                color: #2C2416; 
                margin: 30px 0 15px 0;
                border-bottom: 2px solid #D4A84B;
                padding-bottom: 5px;
              }
            </style>
          </head>
          <body>
            <div class="button-row no-print">
              <button class="button secondary" onclick="window.close()">Close & Return to App</button>
              <button class="button" onclick="window.print()">Print / Save as PDF</button>
            </div>
            
            <!-- SUMMARY PAGE -->
            <div class="container page-break">
              <h1>Tip Payout Summary</h1>
              <h2>All Employees</h2>
              <p class="date-range">${startRange} - ${endRange}</p>
              
              <div class="summary-box">
                <h3>Grand Total Payouts</h3>
                <div class="summary-value">$${grandTotalPayout.toFixed(2)}</div>
                <p style="margin: 10px 0 0 0; color: #666;">${grandTotalHours.toFixed(2)} total hours across ${weeklyData.length} weeks</p>
              </div>
              
              <div class="section-title">Payout by Employee</div>
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Total Hours</th>
                    <th>Total Payout</th>
                  </tr>
                </thead>
                <tbody>
                  ${employeeSummaryRows}
                  <tr class="total-row">
                    <td>GRAND TOTAL</td>
                    <td>${grandTotalHours.toFixed(2)}</td>
                    <td>$${grandTotalPayout.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- DETAILED BREAKDOWN PAGE -->
            <div class="container">
              <h1>Detailed Weekly Breakdown</h1>
              <p class="date-range">${startRange} - ${endRange}</p>
              
              <table>
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Employee</th>
                    <th>Hours</th>
                    <th>Rate</th>
                    <th>Payout</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                  <tr class="total-row">
                    <td colspan="2">GRAND TOTAL</td>
                    <td>${grandTotalHours.toFixed(2)}</td>
                    <td></td>
                    <td>$${grandTotalPayout.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </body>
          </html>
        `;

        exportWindow.document.open();
        exportWindow.document.write(html);
        exportWindow.document.close();
        toast({ title: 'Historical report ready!' });

      } else {
        // Individual export - single employee
        if (!historySelectedEmployee) {
          exportWindow.close();
          toast({ title: 'Please select an employee', variant: 'destructive' });
          setExportingHistory(false);
          return;
        }

        const employeeHoursFiltered = hoursData?.filter((h: any) => h.tip_employees?.id === historySelectedEmployee) || [];
        const employee = allEmployees.find(e => e.id === historySelectedEmployee);

        let totalEarnings = 0;
        let totalHoursWorked = 0;
        let tableRows = '';

        weeklyData.forEach((week: any) => {
          const empHour = employeeHoursFiltered.find((h: any) => h.week_key === week.week_key);
          if (!empHour) return;

          const weekHours = hoursData?.filter((h: any) => h.week_key === week.week_key) || [];
          const totalTeamHrs = weekHours.reduce((sum: number, h: any) => sum + (parseFloat(h.hours) || 0), 0);
          const ccAfter = week.cc_tips * (1 - CC_FEE_RATE);
          const pool = week.cash_tips + ccAfter;
          const rate = totalTeamHrs > 0 ? pool / totalTeamHrs : 0;
          const weekRange = getWeekRange(week.week_key);

          const hours = parseFloat(empHour.hours) || 0;
          const payout = hours * rate;
          totalEarnings += payout;
          totalHoursWorked += hours;

          tableRows += `
            <tr>
              <td>${weekRange.start} - ${weekRange.end}</td>
              <td>${hours.toFixed(2)}</td>
              <td>$${rate.toFixed(2)}</td>
              <td>$${payout.toFixed(2)}</td>
            </tr>
          `;
        });

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Tip Payout History - ${employee?.name || 'Employee'}</title>
            ${baseStyles}
          </head>
          <body>
            <div class="button-row no-print">
              <button class="button secondary" onclick="window.close()">Close & Return to App</button>
              <button class="button" onclick="window.print()">Print / Save as PDF</button>
            </div>
            <div class="container">
              <h1>Tip Payout History</h1>
              <h2>${employee?.name || 'Employee'}</h2>
              <p class="date-range">${startRange} - ${endRange}</p>
              
              <div class="summary-box">
                <h3>Total Earnings</h3>
                <div class="summary-value">$${totalEarnings.toFixed(2)}</div>
                <p style="margin: 10px 0 0 0; color: #666;">${totalHoursWorked.toFixed(2)} hours worked</p>
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Hours</th>
                    <th>Rate</th>
                    <th>Payout</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                  <tr class="total-row">
                    <td>TOTAL</td>
                    <td>${totalHoursWorked.toFixed(2)}</td>
                    <td></td>
                    <td>$${totalEarnings.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </body>
          </html>
        `;

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

  // Prevent iOS scroll jump on input focus
  const preventScrollJump = (e: React.FocusEvent<HTMLInputElement>) => {
    // Store current scroll position
    const scrollY = window.scrollY;
    // Restore after iOS tries to scroll
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <header className="px-6 py-6 relative">
        <Link
          href="/"
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm"
          style={{ backgroundColor: colors.gold, color: colors.white }}
          data-testid="link-dashboard"
        >
          <Home className="w-4 h-4" />
          Main Dashboard
        </Link>
        <div className="max-w-7xl mx-auto text-center pt-10">
          <img
            src={logoUrl}
            alt={displayName}
            className="h-20 mx-auto mb-3"
            data-testid="img-logo"
          />
          <h2 className="text-xl font-semibold" style={{ color: colors.brown }}>
            Tip Payout Calculator
          </h2>
          {isChildLocation && orgName && (
            <p className="text-sm" style={{ color: colors.brownLight }}>
              {displayName} • Part of {orgName}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <Card style={{ backgroundColor: colors.white, borderColor: colors.gold, borderWidth: 2 }}>
          <CardContent className="p-4">
            <div className="text-center space-y-2">
              <p className="font-semibold" style={{ color: colors.brown }}>
                Week: Monday {weekRange.start} – Sunday {weekRange.end}
              </p>
              <Input
                type="date"
                value={weekKey}
                onChange={(e) => setWeekKey(getMonday(new Date(e.target.value + 'T12:00:00')))}
                className="max-w-xs mx-auto"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                data-testid="input-week-picker"
              />
            </div>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
              <UserPlus className="w-5 h-5" />
              Employee Manager
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="New Employee Name"
              value={newEmployeeName}
              onChange={(e) => setNewEmployeeName(e.target.value)}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              data-testid="input-new-employee"
            />
            <Button
              onClick={addEmployee}
              disabled={addingEmployee || !newEmployeeName.trim()}
              className="w-full"
              style={{ backgroundColor: colors.gold, color: colors.brown }}
              data-testid="button-add-employee"
            >
              Add Employee
            </Button>
            
            <Button
              variant="outline"
              onClick={() => {
                setShowEmployeeManagement(!showEmployeeManagement);
                if (!showEmployeeManagement) loadAllEmployees();
              }}
              className="w-full"
              style={{ borderColor: colors.gold, color: colors.brown }}
              data-testid="button-manage-employees"
            >
              <Users className="w-4 h-4 mr-2" />
              {showEmployeeManagement ? 'Hide' : 'Manage'} Employees
            </Button>
            
            {showEmployeeManagement && (
              <div className="space-y-3 pt-2 border-t" style={{ borderColor: colors.creamDark }}>
                <div className="flex items-center justify-between">
                  <Label style={{ color: colors.brown }}>Employee List</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowInactive(!showInactive)}
                    style={{ color: colors.brownLight }}
                    data-testid="button-toggle-inactive"
                  >
                    {showInactive ? 'Hide Inactive' : 'Show Inactive'}
                  </Button>
                </div>
                
                {allEmployees
                  .filter(e => showInactive || isEmployeeActive(e))
                  .map(emp => {
                    const active = isEmployeeActive(emp);
                    return (
                      <div 
                        key={emp.id}
                        className="flex items-center justify-between p-2 rounded-md"
                        style={{ 
                          backgroundColor: active ? colors.inputBg : '#f0f0f0',
                          opacity: active ? 1 : 0.7
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {!active && <UserX className="w-4 h-4" style={{ color: colors.red }} />}
                          <span style={{ color: colors.brown }}>{emp.name}</span>
                          {!active && (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: colors.creamDark, color: colors.brownLight }}>
                              Inactive
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleEmployeeActive(emp.id, !active)}
                          style={{ color: active ? colors.red : colors.green }}
                          data-testid={`button-toggle-employee-${emp.id}`}
                        >
                          {active ? (
                            <>
                              <UserX className="w-4 h-4 mr-1" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-4 h-4 mr-1" />
                              Reactivate
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                
                {allEmployees.length === 0 && (
                  <p className="text-center text-sm py-2" style={{ color: colors.brownLight }}>
                    No employees yet
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
              <DollarSign className="w-5 h-5" />
              Daily Tips Entry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium" style={{ color: colors.brownLight }}>Cash Tips</Label>
              <div className="grid grid-cols-7 gap-1 mt-1">
                {DAYS.map((day, i) => (
                  <div key={`cash-${i}`} className="text-center">
                    <span className="text-xs block mb-1" style={{ color: colors.brownLight }}>{day}</span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      inputMode="decimal"
                      tabIndex={i * 2 + 1}
                      value={cashEntries[i] || ''}
                      onFocus={preventScrollJump}
                      onChange={(e) => {
                        const newEntries = [...cashEntries];
                        newEntries[i] = parseFloat(e.target.value) || 0;
                        setCashEntries(newEntries);
                      }}
                      className="text-center text-sm p-1"
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                      data-testid={`input-cash-${day.toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-right text-sm mt-1" style={{ color: colors.brown }}>
                Total: {formatCurrency(cashTotal)}
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium" style={{ color: colors.brownLight }}>Credit Card Tips</Label>
              <div className="grid grid-cols-7 gap-1 mt-1">
                {DAYS.map((day, i) => (
                  <div key={`cc-${i}`} className="text-center">
                    <span className="text-xs block mb-1" style={{ color: colors.brownLight }}>{day}</span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      inputMode="decimal"
                      tabIndex={i * 2 + 2}
                      value={ccEntries[i] || ''}
                      onFocus={preventScrollJump}
                      onChange={(e) => {
                        const newEntries = [...ccEntries];
                        newEntries[i] = parseFloat(e.target.value) || 0;
                        setCcEntries(newEntries);
                      }}
                      className="text-center text-sm p-1"
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                      data-testid={`input-cc-${day.toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-right text-sm mt-1" style={{ color: colors.brown }}>
                Total: {formatCurrency(ccTotal)} (after 3.5% fee: {formatCurrency(ccAfterFee)})
              </p>
            </div>

            <Button
              onClick={saveTips}
              disabled={savingTips}
              className="w-full"
              style={{ backgroundColor: colors.gold, color: colors.brown }}
              data-testid="button-save-tips"
            >
              Save Tips
            </Button>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
              <Clock className="w-5 h-5" />
              Enter Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} data-testid="select-employee">
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.name} data-testid={`option-employee-${emp.id}`}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm" style={{ color: colors.brownLight }}>Hours</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  inputMode="numeric"
                  value={hoursInput}
                  onFocus={preventScrollJump}
                  onChange={(e) => setHoursInput(e.target.value)}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  data-testid="input-hours"
                />
              </div>
              <div>
                <Label className="text-sm" style={{ color: colors.brownLight }}>Minutes (0-59)</Label>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="0"
                  inputMode="numeric"
                  value={minutesInput}
                  onFocus={preventScrollJump}
                  onChange={(e) => setMinutesInput(e.target.value)}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  data-testid="input-minutes"
                />
              </div>
            </div>
            
            <Button
              onClick={addHours}
              disabled={savingHours || !selectedEmployee}
              className="w-full"
              style={{ backgroundColor: colors.gold, color: colors.brown }}
              data-testid="button-add-hours"
            >
              Add Hours
            </Button>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
              <CheckCircle className="w-5 h-5" />
              Verify Total Team Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm" style={{ color: colors.brownLight }}>Total Hours</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  inputMode="numeric"
                  value={teamHoursCheck}
                  onFocus={preventScrollJump}
                  onChange={(e) => setTeamHoursCheck(e.target.value)}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  data-testid="input-team-hours"
                />
              </div>
              <div>
                <Label className="text-sm" style={{ color: colors.brownLight }}>Total Minutes</Label>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="0"
                  inputMode="numeric"
                  value={teamMinutesCheck}
                  onFocus={preventScrollJump}
                  onChange={(e) => setTeamMinutesCheck(e.target.value)}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  data-testid="input-team-minutes"
                />
              </div>
            </div>
            
            <Button
              onClick={verifyTeamHours}
              className="w-full"
              style={{ backgroundColor: colors.gold, color: colors.brown }}
              data-testid="button-verify-hours"
            >
              Verify
            </Button>
            
            {hoursVerifyResult && (
              <div
                className="text-center font-semibold p-2 rounded"
                style={{
                  color: hoursVerifyResult.match ? colors.green : colors.red,
                  backgroundColor: hoursVerifyResult.match ? '#dcfce7' : '#fef2f2'
                }}
                data-testid="text-hours-verify-result"
              >
                {hoursVerifyResult.message}
              </div>
            )}
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: colors.white, borderColor: colors.gold, borderWidth: 2 }}>
          <CardHeader className="pb-2">
            <CardTitle style={{ color: colors.brown }} className="text-center">
              Payout Summary
              <br />
              <span className="text-base font-normal">{weekRange.start} – {weekRange.end}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div 
              className="p-3 rounded-md space-y-1"
              style={{ backgroundColor: colors.inputBg, borderColor: colors.gold, borderWidth: 1 }}
            >
              <p style={{ color: colors.brown }}>
                <strong>Total Tips (After CC Fee):</strong> {formatCurrency(totalPool)}
              </p>
              <p style={{ color: colors.brown }}>
                <strong>Total Team Hours:</strong> {formatHoursMinutes(totalTeamHours)} ({totalTeamHours.toFixed(2)}h)
              </p>
              <p style={{ color: colors.gold, fontSize: '1.1em' }}>
                <strong>Calculated Hourly Rate:</strong> {formatCurrency(hourlyRate)}/hr
              </p>
            </div>

            {Object.keys(employeeHours).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: colors.inputBg }}>
                      <th className="text-left p-2 border-b" style={{ borderColor: colors.gold, color: colors.brown }}>Employee</th>
                      <th className="text-left p-2 border-b" style={{ borderColor: colors.gold, color: colors.brown }}>Hours</th>
                      <th className="text-right p-2 border-b" style={{ borderColor: colors.gold, color: colors.brown }}>Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(employeeHours)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([name, hours]) => (
                        <tr key={name} className="border-b" style={{ borderColor: colors.creamDark }}>
                          <td className="p-2" style={{ color: colors.brown }}>{name}</td>
                          <td className="p-2" style={{ color: colors.brown }}>{formatHoursMinutes(hours)}</td>
                          <td className="p-2 text-right font-medium" style={{ color: colors.brown }}>
                            {formatCurrency(hours * hourlyRate)}
                          </td>
                        </tr>
                      ))}
                    <tr style={{ backgroundColor: colors.gold }}>
                      <td colSpan={2} className="p-2 font-bold" style={{ color: colors.brown }}>Total Paid Out</td>
                      <td className="p-2 text-right font-bold" style={{ color: colors.brown }}>
                        {formatCurrency(totalPool)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-4" style={{ color: colors.brownLight }}>
                No hours entered yet. Add employee hours above.
              </p>
            )}
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-center" style={{ color: colors.brown }}>
              Export This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <Button
              onClick={exportCSV}
              disabled={Object.keys(employeeHours).length === 0}
              style={{ backgroundColor: colors.gold, color: colors.brown }}
              className="gap-2 w-48"
              data-testid="button-export-csv"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button
              onClick={exportPDF}
              disabled={Object.keys(employeeHours).length === 0}
              style={{ backgroundColor: colors.gold, color: colors.brown }}
              className="gap-2 w-48"
              data-testid="button-export-pdf"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </Button>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: colors.white, borderColor: colors.gold }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-center gap-2" style={{ color: colors.brown }}>
              <History className="w-5 h-5" />
              Historical Export
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center" style={{ color: colors.brownLight }}>
              Export tip payout history for payroll or audit purposes
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm" style={{ color: colors.brownLight }}>Start Date</Label>
                <Input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  data-testid="input-history-start"
                />
              </div>
              <div>
                <Label className="text-sm" style={{ color: colors.brownLight }}>End Date</Label>
                <Input
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => setHistoryEndDate(e.target.value)}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  data-testid="input-history-end"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm" style={{ color: colors.brownLight }}>Export Type</Label>
              <Select
                value={historyExportType}
                onValueChange={(value: 'group' | 'individual') => setHistoryExportType(value)}
              >
                <SelectTrigger 
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  data-testid="select-export-type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">All Employees (Group Report)</SelectItem>
                  <SelectItem value="individual">Individual Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {historyExportType === 'individual' && (
              <div>
                <Label className="text-sm" style={{ color: colors.brownLight }}>Select Employee</Label>
                <Select
                  value={historySelectedEmployee}
                  onValueChange={setHistorySelectedEmployee}
                >
                  <SelectTrigger 
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                    data-testid="select-history-employee"
                  >
                    <SelectValue placeholder="Select an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {(allEmployees.length > 0 ? allEmployees : employees).map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} {!isEmployeeActive(emp) && '(Inactive)'}
                      </SelectItem>
                    ))}
                    {allEmployees.length === 0 && employees.length === 0 && (
                      <div className="p-2 text-sm text-center" style={{ color: colors.brownLight }}>
                        No employees found. Add employees first.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={exportHistorical}
              disabled={exportingHistory || !historyStartDate || !historyEndDate}
              className="w-full gap-2"
              style={{ backgroundColor: colors.gold, color: colors.brown }}
              data-testid="button-export-history"
            >
              <Download className="w-4 h-4" />
              {exportingHistory ? 'Exporting...' : 'Export Historical Data'}
            </Button>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
