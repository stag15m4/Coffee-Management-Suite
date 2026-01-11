import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Plus, UserPlus, Clock, DollarSign, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { Link } from 'wouter';
import logoUrl from '@assets/Erwin-Mills-Logo_1767709452739.png';

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
  is_active: boolean;
}

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
  return d.toISOString().split('T')[0];
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
  const { profile, tenant } = useAuth();
  const { toast } = useToast();
  
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

  const loadEmployees = useCallback(async () => {
    if (!tenant?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('tip_employees')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error('Error loading employees:', error);
    }
  }, [tenant?.id]);

  const loadWeekData = useCallback(async () => {
    if (!tenant?.id) return;
    
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
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData]);

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
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Tips_${weekKey}.csv`;
    link.click();
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
          
          <div class="signature-section">
            <div class="signature-line">
              <span>Employee Signature:</span>
              <div class="line"></div>
            </div>
            <div class="signature-line">
              <span>Date:</span>
              <div class="line short"></div>
            </div>
          </div>
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
          .signature-section {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #E5DDD0;
          }
          .signature-line {
            display: flex;
            align-items: flex-end;
            gap: 10px;
            margin-bottom: 20px;
          }
          .signature-line span {
            font-size: 13px;
            white-space: nowrap;
          }
          .signature-line .line {
            flex: 1;
            border-bottom: 1px solid #4A3728;
            min-width: 200px;
          }
          .signature-line .line.short {
            max-width: 150px;
          }
          @media print { 
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .page-break { page-break-before: always; margin-top: 0; }
          }
        </style>
      </head>
      <body>
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
      printWindow.print();
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <header 
        className="sticky top-0 z-50 border-b px-4 py-3"
        style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/" data-testid="link-back-dashboard">
              <Button variant="ghost" size="icon" style={{ color: colors.brown }}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <img src={logoUrl} alt="Erwin Mills" className="h-10 w-auto" />
            <div>
              <h1 className="font-bold text-lg" style={{ color: colors.brown }}>Tip Payout Calculator</h1>
              <p className="text-sm" style={{ color: colors.brownLight }}>
                Calculate and distribute tips
              </p>
            </div>
          </div>
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
                onChange={(e) => setWeekKey(getMonday(new Date(e.target.value)))}
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
              Add New Employee
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Employee name"
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
                      value={cashEntries[i] || ''}
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
                      value={ccEntries[i] || ''}
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
                  value={hoursInput}
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
                  value={minutesInput}
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
                  value={teamHoursCheck}
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
                  value={teamMinutesCheck}
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
              Export
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
      </main>
    </div>
  );
}
