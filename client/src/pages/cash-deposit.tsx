import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { useAppResume } from '@/hooks/use-app-resume';
import { useLocationChange } from '@/hooks/use-location-change';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Upload, Flag, Pencil, Trash2, FileText, ChevronDown } from 'lucide-react';
import ExcelJS from 'exceljs';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { showDeleteUndoToast } from '@/hooks/use-delete-with-undo';
import { colors } from '@/lib/colors';

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
  cash_refund: number;
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
  const { profile, tenant, branding, primaryTenant } = useAuth();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : (branding?.company_name || tenant?.name || 'Erwin Mills Coffee');
  const orgName = primaryTenant?.name || branding?.company_name || '';
  const today = new Date().toISOString().split('T')[0];
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CashEntry | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [dateRange, setDateRange] = useState({ start: yearStart, end: today });
  
  const [formData, setFormData] = useState({
    drawer_date: today,
    gross_revenue: '0.00',
    starting_drawer: '200.00',
    actual_deposit: '0.00',
    cash_sales: '0.00',
    tip_pool: '0.00',
    owner_tips: '0.00',
    pay_in: '0.00',
    pay_out: '0.00',
    cash_refund: '0.00',
    notes: '',
    flagged: false
  });
  const [ownerTipsEnabled, setOwnerTipsEnabled] = useState(true);
  const [ownerTipsLoaded, setOwnerTipsLoaded] = useState(false);
  const [drawerDefault, setDrawerDefault] = useState(200);

  // Load owner_tips_enabled setting from overhead_settings (tenant-scoped)
  useEffect(() => {
    const loadOwnerTipsSetting = async () => {
      if (!tenant?.id) return;
      try {
        const { data, error } = await supabase
          .from('overhead_settings')
          .select('owner_tips_enabled')
          .eq('tenant_id', tenant.id)
          .limit(1)
          .maybeSingle();
        if (!error && data !== null) {
          setOwnerTipsEnabled(data.owner_tips_enabled !== false);
        }
        setOwnerTipsLoaded(true);
      } catch (err) {
        console.error('Error loading owner tips setting:', err);
        setOwnerTipsLoaded(true);
      }
    };
    loadOwnerTipsSetting();
  }, [tenant?.id]);

  // Load per-location starting drawer default
  useEffect(() => {
    const loadDrawerDefault = async () => {
      if (!tenant?.id) return;
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('starting_drawer_default')
          .eq('id', tenant.id)
          .maybeSingle();
        if (!error && data?.starting_drawer_default != null) {
          const val = parseFloat(data.starting_drawer_default);
          setDrawerDefault(val);
          // Update form if it still has the old hardcoded default
          setFormData(prev => {
            if (prev.starting_drawer === '200.00' && val !== 200) {
              return { ...prev, starting_drawer: val.toFixed(2) };
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Error loading drawer default:', err);
      }
    };
    loadDrawerDefault();
  }, [tenant?.id]);

  // Save owner_tips_enabled setting when toggled (tenant-scoped)
  const toggleOwnerTips = async () => {
    if (!tenant?.id || !ownerTipsLoaded) return;
    const newValue = !ownerTipsEnabled;
    setOwnerTipsEnabled(newValue);
    try {
      const { data: existing } = await supabase
        .from('overhead_settings')
        .select('id')
        .eq('tenant_id', tenant.id)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        await supabase
          .from('overhead_settings')
          .update({ owner_tips_enabled: newValue })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('overhead_settings')
          .insert({ tenant_id: tenant.id, owner_tips_enabled: newValue });
      }
    } catch (err) {
      console.error('Error saving owner tips setting:', err);
    }
  };

  const loadEntries = useCallback(async () => {
    if (!tenant?.id) {
      setLoading(false);
      return;
    }
    
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

  // Refresh data when app resumes from background (iPad multitasking)
  useAppResume(() => {
    if (tenant?.id) {
      console.log('[CashDeposit] Refreshing data after app resume');
      loadEntries();
    }
  }, [tenant?.id, loadEntries]);

  // Refresh data when location changes
  useLocationChange(() => {
    console.log('[CashDeposit] Refreshing data after location change');
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (editingEntry) {
      setFormData({
        drawer_date: editingEntry.drawer_date,
        gross_revenue: editingEntry.gross_revenue?.toString() || '0.00',
        starting_drawer: editingEntry.starting_drawer?.toString() || drawerDefault.toFixed(2),
        actual_deposit: editingEntry.actual_deposit?.toString() || '0.00',
        cash_sales: editingEntry.cash_sales?.toString() || '0.00',
        tip_pool: editingEntry.tip_pool?.toString() || '0.00',
        owner_tips: editingEntry.owner_tips?.toString() || '0.00',
        pay_in: editingEntry.pay_in?.toString() || '0.00',
        pay_out: editingEntry.pay_out?.toString() || '0.00',
        cash_refund: editingEntry.cash_refund?.toString() || '0.00',
        notes: editingEntry.notes || '',
        flagged: editingEntry.flagged || false
      });
      // Auto-expand adjustments if any adjustment field has a non-zero value
      const hasAdjustments = (editingEntry.tip_pool || 0) !== 0 ||
        (editingEntry.cash_refund || 0) !== 0 ||
        (editingEntry.pay_in || 0) !== 0 ||
        (editingEntry.pay_out || 0) !== 0 ||
        (editingEntry.owner_tips || 0) !== 0;
      if (hasAdjustments) setShowAdjustments(true);
    }
  }, [editingEntry]);

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculatedDeposit = () => {
    const cashSales = parseFloat(formData.cash_sales) || 0;
    const tipPool = parseFloat(formData.tip_pool) || 0;
    const ownerTips = (ownerTipsEnabled && ownerTipsLoaded) ? (parseFloat(formData.owner_tips) || 0) : 0;
    const payIn = parseFloat(formData.pay_in) || 0;
    const payOut = parseFloat(formData.pay_out) || 0;
    const cashRefund = parseFloat(formData.cash_refund) || 0;
    const startingDrawer = parseFloat(formData.starting_drawer) || drawerDefault;
    return cashSales - tipPool - ownerTips - payOut + payIn - cashRefund - (drawerDefault - startingDrawer);
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
    if (!tenant?.id || !ownerTipsLoaded) return;
    
    setSaving(true);

    const data = {
      tenant_id: tenant.id,
      drawer_date: formData.drawer_date,
      gross_revenue: parseFloat(formData.gross_revenue) || 0,
      starting_drawer: parseFloat(formData.starting_drawer) || 200,
      actual_deposit: parseFloat(formData.actual_deposit) || 0,
      cash_sales: parseFloat(formData.cash_sales) || 0,
      tip_pool: parseFloat(formData.tip_pool) || 0,
      owner_tips: (ownerTipsEnabled && ownerTipsLoaded) ? (parseFloat(formData.owner_tips) || 0) : 0,
      pay_in: parseFloat(formData.pay_in) || 0,
      pay_out: parseFloat(formData.pay_out) || 0,
      cash_refund: parseFloat(formData.cash_refund) || 0,
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
      gross_revenue: '0.00',
      starting_drawer: drawerDefault.toFixed(2),
      actual_deposit: '0.00',
      cash_sales: '0.00',
      tip_pool: '0.00',
      owner_tips: '0.00',
      pay_in: '0.00',
      pay_out: '0.00',
      cash_refund: '0.00',
      notes: '',
      flagged: false
    });
    setEditingEntry(null);
  };

  const handleDelete = async (entry: CashEntry) => {
    if (!await confirm({ title: `Delete entry for ${formatDate(entry.drawer_date)}?`, description: 'This cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' })) return;

    try {
      const { error } = await supabase
        .from('cash_activity')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;
      showDeleteUndoToast({
        itemName: `Entry for ${formatDate(entry.drawer_date)}`,
        undo: { type: 'reinsert', table: 'cash_activity', data: { ...entry } },
        onReload: loadEntries,
      });
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
      'Owner Tips', 'Pay In', 'Pay Out', 'Cash Refund', 'Actual Deposit', 'Calculated Deposit',
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
        e.cash_refund || 0,
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
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !tenant?.id) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.worksheets[0];
      
      const jsonData: any[][] = [];
      worksheet.eachRow((row, rowNumber) => {
        const rowData: any[] = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rowData[colNumber - 1] = cell.value;
        });
        jsonData[rowNumber - 1] = rowData;
      });

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
        if (dateValue instanceof Date) {
          parsedDate = dateValue.toISOString().split('T')[0];
        } else if (typeof dateValue === 'number') {
          const excelEpoch = new Date(1899, 11, 30);
          const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
          parsedDate = date.toISOString().split('T')[0];
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
    return <CoffeeLoader fullScreen text="Brewing..." />;
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
      <header className="px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-lg font-bold" style={{ color: colors.brown }} data-testid="text-page-title">
            Cash Activity Tracker
          </h2>
          {isChildLocation && orgName && (
            <p className="text-sm" style={{ color: colors.brownLight }}>
              {displayName} • {orgName}
            </p>
          )}
        </div>
      </header>

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">

        {/* Date Range Section */}
        <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span style={{ color: colors.brown }} className="font-medium">Date Range:</span>
              <div 
                className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer relative overflow-hidden"
                style={{ backgroundColor: colors.creamDark, color: colors.brown }}
              >
                {formatDateDisplay(dateRange.start)}
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  data-testid="input-date-start"
                />
              </div>
              <span style={{ color: colors.brown }}>to</span>
              <div 
                className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer relative overflow-hidden"
                style={{ backgroundColor: colors.creamDark, color: colors.brown }}
              >
                {formatDateDisplay(dateRange.end)}
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  data-testid="input-date-end"
                />
              </div>
              <label className="relative cursor-pointer" data-testid="button-import">
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
          </CardContent>
        </Card>

        {/* Archive Section */}
        <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span style={{ color: colors.brown }} className="font-medium">Archive:</span>
              {archiveYears.map(year => (
                <Button
                  key={year}
                  size="sm"
                  onClick={() => handleArchiveYear(year)}
                  className="text-white font-medium"
                  style={{ backgroundColor: colors.brownLight }}
                  data-testid={`button-archive-${year}`}
                >
                  Archive {year}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRestoreYear(currentYear - 1)}
                style={{ borderColor: colors.brownLight, color: colors.brown }}
                data-testid={`button-restore-${currentYear - 1}`}
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
          </CardContent>
        </Card>

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
                <div 
                  className="px-3 py-2 rounded-md text-sm cursor-pointer relative min-h-9 flex items-center border"
                  style={{ backgroundColor: colors.inputBg, borderColor: 'hsl(var(--input))' }}
                >
                  {formData.drawer_date ? formatDateDisplay(formData.drawer_date) : 'Select date'}
                  <input
                    type="date"
                    value={formData.drawer_date}
                    onChange={(e) => updateField('drawer_date', e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    data-testid="input-entry-date"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Gross Revenue</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
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
                    inputMode="decimal"
                    value={formData.starting_drawer}
                    onChange={(e) => updateField('starting_drawer', e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="pl-7"
                    style={{ backgroundColor: colors.inputBg }}
                    placeholder={drawerDefault.toFixed(2)}
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
                    inputMode="decimal"
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

            {/* Adjustments — collapsible for progressive disclosure */}
            <div>
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-medium py-1 transition-colors hover:opacity-80"
                style={{ color: colors.brownLight }}
                onClick={() => setShowAdjustments(!showAdjustments)}
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showAdjustments ? 'rotate-0' : '-rotate-90'}`}
                />
                Adjustments
                {!showAdjustments && (parseFloat(String(formData.tip_pool)) || parseFloat(String(formData.cash_refund)) || parseFloat(String(formData.pay_in)) || parseFloat(String(formData.pay_out)) || parseFloat(String(formData.owner_tips))) ? (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.cream, color: colors.brown }}>has values</span>
                ) : null}
              </button>
              {showAdjustments && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  <div className="space-y-2">
                    <Label style={{ color: colors.brown }}>Tip Pool</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
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
                    <Label style={{ color: colors.brown }}>Cash Refund</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={formData.cash_refund}
                        onChange={(e) => updateField('cash_refund', e.target.value)}
                        className="pl-7"
                        style={{ backgroundColor: colors.inputBg }}
                        placeholder="0.00"
                        data-testid="input-cash-refund"
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
                        inputMode="decimal"
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
                        inputMode="decimal"
                        value={formData.pay_out}
                        onChange={(e) => updateField('pay_out', e.target.value)}
                        className="pl-7"
                        style={{ backgroundColor: colors.inputBg }}
                        placeholder="0.00"
                        data-testid="input-pay-out"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label style={{ color: ownerTipsEnabled ? colors.brown : colors.brownLight }}>Owner Tips</Label>
                      <button
                        type="button"
                        onClick={toggleOwnerTips}
                        disabled={!ownerTipsLoaded}
                        className="text-xs px-2 py-1 rounded disabled:opacity-50"
                        style={{
                          backgroundColor: ownerTipsEnabled ? colors.gold : colors.creamDark,
                          color: ownerTipsEnabled ? colors.white : colors.brownLight
                        }}
                        data-testid="button-toggle-owner-tips"
                      >
                        {ownerTipsEnabled ? 'On' : 'Off'}
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={formData.owner_tips}
                        onChange={(e) => updateField('owner_tips', e.target.value)}
                        className="pl-7"
                        style={{ backgroundColor: ownerTipsEnabled && ownerTipsLoaded ? colors.inputBg : colors.creamDark }}
                        placeholder="0.00"
                        disabled={!ownerTipsEnabled || !ownerTipsLoaded}
                        data-testid="input-owner-tips"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Actual Deposit</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
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
                  className="h-9 px-3 py-1 rounded-md font-mono text-sm flex items-center border"
                  style={{ backgroundColor: colors.inputBg, borderColor: 'hsl(var(--input))', color: colors.brown }}
                >
                  {formatCurrency(calculatedDeposit())}
                </div>
              </div>
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Difference</Label>
                <div 
                  className="h-9 px-3 py-1 rounded-md font-mono text-sm font-bold flex items-center border"
                  style={{ 
                    backgroundColor: colors.inputBg, 
                    borderColor: 'hsl(var(--input))',
                    color: diff === 0 ? '#22c55e' : diff > 0 ? '#eab308' : '#dc2626'
                  }}
                >
                  {formatCurrency(diff)}
                </div>
              </div>
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Net Cash</Label>
                <div 
                  className="h-9 px-3 py-1 rounded-md font-mono text-sm font-bold flex items-center"
                  style={{ backgroundColor: colors.gold, color: colors.white }}
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

      <div>
        <h2 className="text-xl font-bold mb-4" style={{ color: colors.brown }}>Transaction History</h2>
        {entries.length === 0 ? (
          <div className="text-center py-8" style={{ color: colors.brownLight }}>
            No entries for this date range. Add your first entry above!
          </div>
        ) : (
          <div className="space-y-6">
            {sortedWeeks.map(weekStart => {
              const weekEntries = entriesByWeek[weekStart].sort((a, b) => b.drawer_date.localeCompare(a.drawer_date));
              const weekGross = weekEntries.reduce((sum, e) => sum + (e.gross_revenue || 0), 0);
              const weekDeposits = weekEntries.reduce((sum, e) => sum + (e.actual_deposit || 0), 0);

              return (
                <div key={weekStart} className="rounded-2xl overflow-hidden shadow-md" style={{ backgroundColor: colors.white }}>
                  <div className="px-4 py-3 font-semibold text-sm" style={{ backgroundColor: colors.brown, color: colors.cream }}>
                    Week: {formatWeekRange(weekStart)} | Gross: {formatCurrency(weekGross)} | Deposits: {formatCurrency(weekDeposits)}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: colors.brown }}>
                          <th className="px-4 py-3 text-left font-semibold text-white">Date</th>
                          <th className="px-4 py-3 text-right font-semibold text-white">Gross Rev</th>
                          <th className="px-4 py-3 text-right font-semibold text-white">Cash Sales</th>
                          <th className="px-4 py-3 text-right font-semibold text-white">Tip Pool</th>
                          <th className="px-4 py-3 text-right font-semibold text-white">Actual Dep</th>
                          <th className="px-4 py-3 text-right font-semibold text-white">Calc Dep</th>
                          <th className="px-4 py-3 text-right font-semibold text-white">Diff</th>
                          <th className="px-4 py-3 text-right font-semibold" style={{ color: colors.gold }}>Net Cash</th>
                          <th className="px-4 py-3 text-center font-semibold text-white">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weekEntries.map((entry, idx) => {
                          const entryDiff = (entry.actual_deposit || 0) - (entry.calculated_deposit || 0);
                          const entryNetCash = (entry.actual_deposit || 0) - (entry.pay_in || 0);

                          return (
                            <tr
                              key={entry.id}
                              style={{
                                backgroundColor: idx % 2 === 0 ? colors.white : colors.cream,
                                borderBottom: `1px solid ${colors.creamDark}`,
                              }}
                              data-testid={`row-entry-${entry.id}`}
                            >
                              <td className="px-4 py-3 font-medium" style={{ color: colors.brown }}>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleToggleFlag(entry)}
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: entry.flagged ? '#ef4444' : colors.creamDark }}
                                    data-testid={`button-flag-${entry.id}`}
                                  />
                                  {formatDate(entry.drawer_date)}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right" style={{ color: colors.brown }}>{formatCurrency(entry.gross_revenue)}</td>
                              <td className="px-4 py-3 text-right" style={{ color: colors.brown }}>{formatCurrency(entry.cash_sales)}</td>
                              <td className="px-4 py-3 text-right" style={{ color: colors.brown }}>{formatCurrency(entry.tip_pool)}</td>
                              <td className="px-4 py-3 text-right" style={{ color: colors.brown }}>{formatCurrency(entry.actual_deposit)}</td>
                              <td className="px-4 py-3 text-right" style={{ color: colors.brownLight }}>{formatCurrency(entry.calculated_deposit)}</td>
                              <td className="px-4 py-3 text-right font-medium" style={{
                                color: Math.abs(entryDiff) < 0.01 ? colors.green :
                                  entryDiff > 0 ? '#eab308' : '#ef4444'
                              }}>
                                {formatCurrency(entryDiff)}
                              </td>
                              <td className="px-4 py-3 text-right font-bold" style={{ color: colors.gold }}>
                                {formatCurrency(entryNetCash)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setEditingEntry(entry)}
                                    data-testid={`button-edit-${entry.id}`}
                                  >
                                    <Pencil className="h-4 w-4" style={{ color: colors.brownLight }} />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDelete(entry)}
                                    data-testid={`button-delete-${entry.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" style={{ color: colors.brownLight }} />
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
      </div>
      </div>
      {ConfirmDialog}
    </div>
  );
}
