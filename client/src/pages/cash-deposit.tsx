import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Upload, Flag, Pencil, Trash2, FileText } from 'lucide-react';
import { Link } from 'wouter';
import * as XLSX from 'xlsx';
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
};

interface CashEntry {
  id: string;
  tenant_id: string;
  drawer_date: string;
  gross_revenue: number;
  starting_drawer: number;
  cash_sales: number;
  tip_pool: number;
  owner_tips: number;
  pay_in: number;
  pay_out: number;
  actual_deposit: number;
  calculated_deposit: number;
  notes: string;
  flagged: boolean;
  archived: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0);
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
};

const getWeekStart = (date: string) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
};

const formatWeekRange = (weekStart: string) => {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}`;
};

export default function CashDeposit() {
  const { profile, tenant } = useAuth();
  const { toast } = useToast();
  
  const today = new Date().toISOString().split('T')[0];
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CashEntry | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [dateRange, setDateRange] = useState({ start: yearStart, end: today });
  
  const [formData, setFormData] = useState({
    drawer_date: today,
    gross_revenue: '',
    starting_drawer: '200.00',
    actual_deposit: '',
    cash_sales: '',
    tip_pool: '',
    owner_tips: '',
    pay_in: '',
    pay_out: '',
    notes: '',
    flagged: false
  });

  const loadEntries = useCallback(async () => {
    if (!tenant?.id) return;
    
    try {
      let query = supabase
        .from('cash_activity')
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('drawer_date', dateRange.start)
        .lte('drawer_date', dateRange.end);
      
      if (!showArchived) {
        query = query.or('archived.is.null,archived.eq.false');
      }
      
      const { data, error } = await query.order('drawer_date', { ascending: false });
      
      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      console.error('Error loading entries:', error);
      toast({
        title: 'Error loading entries',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, dateRange, showArchived, toast]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (editingEntry) {
      setFormData({
        drawer_date: editingEntry.drawer_date,
        gross_revenue: editingEntry.gross_revenue?.toString() || '',
        starting_drawer: editingEntry.starting_drawer?.toString() || '200.00',
        actual_deposit: editingEntry.actual_deposit?.toString() || '',
        cash_sales: editingEntry.cash_sales?.toString() || '',
        tip_pool: editingEntry.tip_pool?.toString() || '',
        owner_tips: editingEntry.owner_tips?.toString() || '',
        pay_in: editingEntry.pay_in?.toString() || '',
        pay_out: editingEntry.pay_out?.toString() || '',
        notes: editingEntry.notes || '',
        flagged: editingEntry.flagged || false
      });
    }
  }, [editingEntry]);

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculatedDeposit = () => {
    const cashSales = parseFloat(formData.cash_sales) || 0;
    const tipPool = parseFloat(formData.tip_pool) || 0;
    const ownerTips = parseFloat(formData.owner_tips) || 0;
    const payIn = parseFloat(formData.pay_in) || 0;
    const payOut = parseFloat(formData.pay_out) || 0;
    const startingDrawer = parseFloat(formData.starting_drawer) || 200;
    return cashSales - tipPool - ownerTips - payOut + payIn - (200 - startingDrawer);
  };

  const difference = () => {
    const actual = parseFloat(formData.actual_deposit) || 0;
    return actual - calculatedDeposit();
  };

  const netCash = () => {
    const actualDeposit = parseFloat(formData.actual_deposit) || 0;
    const payIn = parseFloat(formData.pay_in) || 0;
    return actualDeposit - payIn;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    
    setSaving(true);

    const data = {
      tenant_id: tenant.id,
      drawer_date: formData.drawer_date,
      gross_revenue: parseFloat(formData.gross_revenue) || 0,
      starting_drawer: parseFloat(formData.starting_drawer) || 200,
      actual_deposit: parseFloat(formData.actual_deposit) || 0,
      cash_sales: parseFloat(formData.cash_sales) || 0,
      tip_pool: parseFloat(formData.tip_pool) || 0,
      owner_tips: parseFloat(formData.owner_tips) || 0,
      pay_in: parseFloat(formData.pay_in) || 0,
      pay_out: parseFloat(formData.pay_out) || 0,
      notes: formData.notes,
      flagged: formData.flagged
    };

    try {
      if (editingEntry) {
        const { error } = await supabase
          .from('cash_activity')
          .update(data)
          .eq('id', editingEntry.id);
        if (error) throw error;
        toast({ title: 'Entry updated successfully' });
      } else {
        const { error } = await supabase
          .from('cash_activity')
          .upsert(data, { onConflict: 'tenant_id,drawer_date' });
        if (error) throw error;
        toast({ title: 'Entry saved successfully' });
      }

      resetForm();
      loadEntries();
    } catch (error: any) {
      toast({
        title: 'Error saving entry',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      drawer_date: today,
      gross_revenue: '',
      starting_drawer: '200.00',
      actual_deposit: '',
      cash_sales: '',
      tip_pool: '',
      owner_tips: '',
      pay_in: '',
      pay_out: '',
      notes: '',
      flagged: false
    });
    setEditingEntry(null);
  };

  const handleDelete = async (entry: CashEntry) => {
    if (!confirm(`Delete entry for ${formatDate(entry.drawer_date)}?`)) return;

    try {
      const { error } = await supabase
        .from('cash_activity')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;
      toast({ title: 'Entry deleted' });
      loadEntries();
    } catch (error: any) {
      toast({
        title: 'Error deleting entry',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleToggleFlag = async (entry: CashEntry) => {
    try {
      const { error } = await supabase
        .from('cash_activity')
        .update({ flagged: !entry.flagged })
        .eq('id', entry.id);

      if (error) throw error;
      loadEntries();
    } catch (error: any) {
      toast({
        title: 'Error updating flag',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Date', 'Gross Revenue', 'Starting Drawer', 'Cash Sales', 'Tip Pool',
      'Owner Tips', 'Pay In', 'Pay Out', 'Actual Deposit', 'Calculated Deposit',
      'Difference', 'Net Cash', 'Notes'
    ];

    const rows = entries
      .sort((a, b) => a.drawer_date.localeCompare(b.drawer_date))
      .map(e => [
        e.drawer_date,
        e.gross_revenue || 0,
        e.starting_drawer || 200,
        e.cash_sales || 0,
        e.tip_pool || 0,
        e.owner_tips || 0,
        e.pay_in || 0,
        e.pay_out || 0,
        e.actual_deposit || 0,
        e.calculated_deposit || 0,
        ((e.actual_deposit || 0) - (e.calculated_deposit || 0)).toFixed(2),
        ((e.actual_deposit || 0) - (e.pay_in || 0)).toFixed(2),
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ]);

    const csvContent = [
      `${tenant?.name || 'Cash Activity'} - Cash Activity Report`,
      `Date Range: ${dateRange.start} to ${dateRange.end}`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cash-activity-${dateRange.start}-to-${dateRange.end}.csv`;
    link.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !tenant?.id) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      const parsedEntries: any[] = [];
      
      let headerIndex = -1;
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i];
        if (!row) continue;
        const rowStr = row.map((c: any) => String(c || '').toLowerCase()).join(' ');
        if (rowStr.includes('date') && (rowStr.includes('gross') || rowStr.includes('cash') || rowStr.includes('deposit'))) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) {
        throw new Error('Could not find header row with Date column');
      }

      const headers = jsonData[headerIndex].map((h: any) => String(h || '').toLowerCase().trim());
      const columnIndexes: Record<string, number> = {};
      
      headers.forEach((header: string, idx: number) => {
        if (header.includes('date')) columnIndexes.drawer_date = idx;
        if (header.includes('gross')) columnIndexes.gross_revenue = idx;
        if (header.includes('starting') || header === 'drawer') columnIndexes.starting_drawer = idx;
        if (header.includes('cash') && header.includes('sale')) columnIndexes.cash_sales = idx;
        if (header.includes('tip') && header.includes('pool')) columnIndexes.tip_pool = idx;
        if (header.includes('owner') && header.includes('tip')) columnIndexes.owner_tips = idx;
        if (header === 'pay in' || header === 'payin') columnIndexes.pay_in = idx;
        if (header === 'pay out' || header === 'payout') columnIndexes.pay_out = idx;
        if (header.includes('actual') && header.includes('dep')) columnIndexes.actual_deposit = idx;
        if (header.includes('note')) columnIndexes.notes = idx;
      });

      if (columnIndexes.drawer_date === undefined) {
        throw new Error('Could not find Date column');
      }

      for (let i = headerIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        
        let dateValue = row[columnIndexes.drawer_date];
        if (!dateValue) continue;

        let parsedDate: string | undefined;
        if (typeof dateValue === 'number') {
          const excelDate = XLSX.SSF.parse_date_code(dateValue);
          if (excelDate) {
            parsedDate = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
          }
        } else {
          const dateObj = new Date(String(dateValue));
          if (!isNaN(dateObj.getTime())) {
            parsedDate = dateObj.toISOString().split('T')[0];
          }
        }

        if (!parsedDate) continue;

        const parseNumber = (idx: number | undefined) => {
          if (idx === undefined) return 0;
          const val = row[idx];
          if (typeof val === 'number') return val;
          const cleaned = String(val).replace(/[$",]/g, '').trim();
          return parseFloat(cleaned) || 0;
        };

        parsedEntries.push({
          tenant_id: tenant.id,
          drawer_date: parsedDate,
          gross_revenue: parseNumber(columnIndexes.gross_revenue),
          starting_drawer: parseNumber(columnIndexes.starting_drawer) || 200,
          cash_sales: parseNumber(columnIndexes.cash_sales),
          tip_pool: parseNumber(columnIndexes.tip_pool),
          owner_tips: parseNumber(columnIndexes.owner_tips),
          pay_in: parseNumber(columnIndexes.pay_in),
          pay_out: parseNumber(columnIndexes.pay_out),
          actual_deposit: parseNumber(columnIndexes.actual_deposit),
          notes: columnIndexes.notes !== undefined ? String(row[columnIndexes.notes] || '') : '',
          flagged: false
        });
      }

      if (parsedEntries.length === 0) {
        throw new Error('No valid entries found in file');
      }

      const { error } = await supabase
        .from('cash_activity')
        .upsert(parsedEntries, { onConflict: 'tenant_id,drawer_date' });

      if (error) throw error;

      toast({ title: `Imported ${parsedEntries.length} entries` });
      loadEntries();
    } catch (error: any) {
      toast({
        title: 'Import error',
        description: error.message,
        variant: 'destructive'
      });
    }
    
    event.target.value = '';
  };

  const entriesByWeek = entries.reduce((acc, entry) => {
    const weekStart = getWeekStart(entry.drawer_date);
    if (!acc[weekStart]) acc[weekStart] = [];
    acc[weekStart].push(entry);
    return acc;
  }, {} as Record<string, CashEntry[]>);

  const sortedWeeks = Object.keys(entriesByWeek).sort((a, b) => b.localeCompare(a));

  const totalGross = entries.reduce((sum, e) => sum + (e.gross_revenue || 0), 0);
  const totalDeposits = entries.reduce((sum, e) => sum + (e.actual_deposit || 0), 0);
  const totalVariance = entries.reduce((sum, e) => sum + ((e.actual_deposit || 0) - (e.calculated_deposit || 0)), 0);

  const diff = difference();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <div className="text-center">
          <div 
            className="w-12 h-12 rounded-full mx-auto mb-4 animate-pulse"
            style={{ backgroundColor: colors.gold }}
          />
          <p style={{ color: colors.brown }}>Loading...</p>
        </div>
      </div>
    );
  }

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const currentYear = new Date().getFullYear();
  const archiveYears = [currentYear, currentYear - 1];

  const handleArchiveYear = async (year: number) => {
    if (!tenant?.id) return;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    const { error } = await supabase
      .from('cash_activity')
      .update({ archived: true })
      .eq('tenant_id', tenant.id)
      .gte('drawer_date', startDate)
      .lte('drawer_date', endDate);
    
    if (error) {
      toast({ title: 'Error archiving entries', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Archived all ${year} entries` });
      loadEntries();
    }
  };

  const handleRestoreYear = async (year: number) => {
    if (!tenant?.id) return;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    const { error } = await supabase
      .from('cash_activity')
      .update({ archived: false })
      .eq('tenant_id', tenant.id)
      .gte('drawer_date', startDate)
      .lte('drawer_date', endDate);
    
    if (error) {
      toast({ title: 'Error restoring entries', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Restored all ${year} entries` });
      loadEntries();
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        {/* Header with logo and back button */}
        <div className="flex items-start gap-2">
          <Link href="/">
            <Button variant="ghost" size="icon" style={{ color: colors.brown }} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* Logo and Title */}
        <div className="flex flex-col items-center mb-4">
          <img src={logoUrl} alt="Erwin Mills" className="h-20 md:h-24 mb-2" />
          <h1 className="text-xl md:text-2xl font-semibold" style={{ color: colors.brown }} data-testid="text-page-title">
            Cash Activity Tracker
          </h1>
        </div>

        {/* Date Range and Actions */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span style={{ color: colors.brown }} className="font-medium">Date Range:</span>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-auto"
              style={{ backgroundColor: colors.creamDark, color: colors.brown, border: 'none' }}
              data-testid="input-date-start"
            />
            <span style={{ color: colors.brown }}>to</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-auto"
              style={{ backgroundColor: colors.creamDark, color: colors.brown, border: 'none' }}
              data-testid="input-date-end"
            />
            <label className="relative cursor-pointer">
              <Button 
                asChild
                className="text-white font-medium"
                style={{ backgroundColor: colors.gold }}
              >
                <span>Import</span>
              </Button>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.ods"
                onChange={handleImportFile}
                className="absolute inset-0 opacity-0 cursor-pointer"
                data-testid="input-import-file"
              />
            </label>
            <Button 
              onClick={exportToCSV} 
              disabled={entries.length === 0}
              className="text-white font-medium"
              style={{ backgroundColor: colors.gold }}
              data-testid="button-export-csv"
            >
              Export CSV
            </Button>
          </div>

          {/* Archive Controls */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span style={{ color: colors.brown }} className="font-medium">Archive:</span>
            {archiveYears.map(year => (
              <Button
                key={year}
                variant="secondary"
                size="sm"
                onClick={() => handleArchiveYear(year)}
                style={{ backgroundColor: colors.brownLight, color: colors.white }}
              >
                Archive {year}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRestoreYear(currentYear - 1)}
              style={{ borderColor: colors.brownLight, color: colors.brown }}
            >
              {currentYear - 1} (Archived) - Restore
            </Button>
            <label className="flex items-center gap-2 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded"
                data-testid="checkbox-show-archived"
              />
              <span className="text-sm" style={{ color: colors.brown }}>Show Archived</span>
            </label>
          </div>
        </div>

        {/* Daily Entry Form */}
        <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg" style={{ color: colors.brown }}>
              {editingEntry ? 'Edit Entry' : 'Daily Entry'}
            </CardTitle>
          </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Date</Label>
                <Input
                  type="date"
                  value={formData.drawer_date}
                  onChange={(e) => updateField('drawer_date', e.target.value)}
                  style={{ backgroundColor: colors.inputBg }}
                  data-testid="input-entry-date"
                />
              </div>
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Gross Revenue</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.gross_revenue}
                    onChange={(e) => updateField('gross_revenue', e.target.value)}
                    className="pl-7"
                    style={{ backgroundColor: colors.inputBg }}
                    placeholder="0.00"
                    data-testid="input-gross-revenue"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Starting Drawer</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.starting_drawer}
                    onChange={(e) => updateField('starting_drawer', e.target.value)}
                    className="pl-7"
                    style={{ backgroundColor: colors.inputBg }}
                    placeholder="200.00"
                    data-testid="input-starting-drawer"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Cash Sales</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.cash_sales}
                    onChange={(e) => updateField('cash_sales', e.target.value)}
                    className="pl-7"
                    style={{ backgroundColor: colors.inputBg }}
                    placeholder="0.00"
                    data-testid="input-cash-sales"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Tip Pool</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.tip_pool}
                    onChange={(e) => updateField('tip_pool', e.target.value)}
                    className="pl-7"
                    style={{ backgroundColor: colors.inputBg }}
                    placeholder="0.00"
                    data-testid="input-tip-pool"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Owner Tips</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.owner_tips}
                    onChange={(e) => updateField('owner_tips', e.target.value)}
                    className="pl-7"
                    style={{ backgroundColor: colors.inputBg }}
                    placeholder="0.00"
                    data-testid="input-owner-tips"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Pay In</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.pay_in}
                    onChange={(e) => updateField('pay_in', e.target.value)}
                    className="pl-7"
                    style={{ backgroundColor: colors.inputBg }}
                    placeholder="0.00"
                    data-testid="input-pay-in"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Pay Out</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.pay_out}
                    onChange={(e) => updateField('pay_out', e.target.value)}
                    className="pl-7"
                    style={{ backgroundColor: colors.inputBg }}
                    placeholder="0.00"
                    data-testid="input-pay-out"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Actual Deposit</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.actual_deposit}
                    onChange={(e) => updateField('actual_deposit', e.target.value)}
                    className="pl-7"
                    style={{ backgroundColor: colors.inputBg }}
                    placeholder="0.00"
                    data-testid="input-actual-deposit"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Calculated Deposit</Label>
                <div 
                  className="px-3 py-2 rounded-md font-mono font-medium min-h-9 flex items-center"
                  style={{ backgroundColor: colors.brownLight, color: colors.white }}
                >
                  {formatCurrency(calculatedDeposit())}
                </div>
              </div>
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Difference</Label>
                <div 
                  className="px-3 py-2 rounded-md font-mono font-bold min-h-9 flex items-center"
                  style={{ backgroundColor: colors.gold, color: colors.white }}
                >
                  {formatCurrency(diff)}
                </div>
              </div>
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Net Cash</Label>
                <div 
                  className="px-3 py-2 rounded-md font-mono font-bold min-h-9 flex items-center"
                  style={{ backgroundColor: colors.green, color: colors.white }}
                >
                  {formatCurrency(netCash())}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label style={{ color: colors.brown }}>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Optional notes..."
                rows={2}
                style={{ backgroundColor: colors.inputBg }}
                data-testid="input-notes"
              />
            </div>

            <div className="flex gap-3 items-center flex-wrap">
              <Button 
                type="submit" 
                disabled={saving}
                style={{ backgroundColor: colors.brown, color: colors.white }}
                data-testid="button-save-entry"
              >
                {saving ? 'Saving...' : editingEntry ? 'Update Entry' : 'Save Entry'}
              </Button>
              <Button
                type="button"
                variant={formData.flagged ? 'destructive' : 'outline'}
                onClick={() => updateField('flagged', !formData.flagged)}
                style={formData.flagged ? {} : { borderColor: colors.brown, color: colors.brown }}
                data-testid="button-toggle-flag"
              >
                <Flag className="h-4 w-4 mr-2" />
                Flag for Follow-up
              </Button>
              {editingEntry && (
                <Button type="button" variant="ghost" onClick={resetForm} data-testid="button-cancel-edit">
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Days Recorded</div>
            <div className="text-2xl font-bold" data-testid="text-days-recorded">{entries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Gross Revenue</div>
            <div className="text-2xl font-bold text-primary" data-testid="text-total-gross">{formatCurrency(totalGross)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Deposits</div>
            <div className="text-2xl font-bold" data-testid="text-total-deposits">{formatCurrency(totalDeposits)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Variance</div>
            <div className={`text-2xl font-bold ${Math.abs(totalVariance) < 1 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-total-variance">
              {formatCurrency(totalVariance)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No entries for this date range. Add your first entry above!
            </div>
          ) : (
            <div className="space-y-4">
              {sortedWeeks.map(weekStart => {
                const weekEntries = entriesByWeek[weekStart].sort((a, b) => b.drawer_date.localeCompare(a.drawer_date));
                const weekGross = weekEntries.reduce((sum, e) => sum + (e.gross_revenue || 0), 0);
                const weekDeposits = weekEntries.reduce((sum, e) => sum + (e.actual_deposit || 0), 0);

                return (
                  <div key={weekStart}>
                    <div className="bg-primary text-primary-foreground px-4 py-2 rounded-t-md font-medium text-sm">
                      Week: {formatWeekRange(weekStart)} | Gross: {formatCurrency(weekGross)} | Deposits: {formatCurrency(weekDeposits)}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted">
                            <th className="text-left p-2">Date</th>
                            <th className="text-right p-2">Gross Rev</th>
                            <th className="text-right p-2">Cash Sales</th>
                            <th className="text-right p-2">Tip Pool</th>
                            <th className="text-right p-2">Actual Dep</th>
                            <th className="text-right p-2">Calc Dep</th>
                            <th className="text-right p-2">Diff</th>
                            <th className="text-right p-2">Net Cash</th>
                            <th className="text-right p-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weekEntries.map(entry => {
                            const entryDiff = (entry.actual_deposit || 0) - (entry.calculated_deposit || 0);
                            const entryNetCash = (entry.actual_deposit || 0) - (entry.pay_in || 0);
                            
                            return (
                              <tr key={entry.id} className="border-b hover:bg-muted/50" data-testid={`row-entry-${entry.id}`}>
                                <td className="p-2 font-medium">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleToggleFlag(entry)}
                                      className={`w-3 h-3 rounded-full ${entry.flagged ? 'bg-red-500' : 'bg-gray-300'}`}
                                      data-testid={`button-flag-${entry.id}`}
                                    />
                                    {formatDate(entry.drawer_date)}
                                  </div>
                                </td>
                                <td className="p-2 text-right">{formatCurrency(entry.gross_revenue)}</td>
                                <td className="p-2 text-right">{formatCurrency(entry.cash_sales)}</td>
                                <td className="p-2 text-right">{formatCurrency(entry.tip_pool)}</td>
                                <td className="p-2 text-right">{formatCurrency(entry.actual_deposit)}</td>
                                <td className="p-2 text-right">{formatCurrency(entry.calculated_deposit)}</td>
                                <td className={`p-2 text-right font-medium ${
                                  Math.abs(entryDiff) < 0.01 ? 'text-green-600' :
                                  entryDiff > 0 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {formatCurrency(entryDiff)}
                                </td>
                                <td className="p-2 text-right font-bold text-primary">
                                  {formatCurrency(entryNetCash)}
                                </td>
                                <td className="p-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setEditingEntry(entry)}
                                      data-testid={`button-edit-${entry.id}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleDelete(entry)}
                                      data-testid={`button-delete-${entry.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
