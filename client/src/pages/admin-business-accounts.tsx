import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/lib/colors';
import { useToast } from '@/hooks/use-toast';
import {
  useBusinessAccounts,
  useAddBusinessAccount,
  useUpdateBusinessAccount,
  useDeleteBusinessAccount,
  useAccountBusinesses,
  useAddAccountBusiness,
  useDeleteAccountBusiness,
  type BusinessAccount,
  type AccountBusiness,
} from '@/lib/supabase-queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  ArrowLeft,
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  AlertTriangle,
  TrendingUp,
  Building2,
  Calendar,
  DollarSign,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PALETTE = ['#6366f1', '#0ea5e9', '#8b5cf6', '#f97316', '#14b8a6', '#ec4899', '#f59e0b', '#10b981'];

const CATEGORIES = [
  'Hosting',
  'Email',
  'Development',
  'Marketing',
  'Domain',
  'Financial',
  'Communication',
  'Design',
  'Security',
  'Analytics',
  'Storage',
  'Other',
] as const;
const BILLING_CYCLES = ['Monthly', 'Annual', 'One-Time', 'Free'] as const;
const STATUSES = ['Active', 'Trial', 'Cancelled', 'Expired'] as const;

type SortField = 'service_name' | 'business' | 'category' | 'cost' | 'renewal_date' | 'status';
type SortDir = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  Active: '#22c55e',
  Trial: '#eab308',
  Cancelled: '#94a3b8',
  Expired: '#ef4444',
};

function toMonthly(cost: number | null, cycle: string): number {
  if (!cost) return 0;
  if (cycle === 'Annual') return cost / 12;
  if (cycle === 'One-Time' || cycle === 'Free') return 0;
  return cost;
}

function toAnnual(cost: number | null, cycle: string): number {
  if (!cost) return 0;
  if (cycle === 'Monthly') return cost * 12;
  if (cycle === 'Annual') return cost;
  return 0;
}

function daysUntilRenewal(renewalDate: string | null): number | null {
  if (!renewalDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renewal = new Date(renewalDate + 'T00:00:00');
  return Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

// ---------------------------------------------------------------------------
// Empty form state
// ---------------------------------------------------------------------------

function emptyForm(): Omit<BusinessAccount, 'id' | 'created_at' | 'updated_at'> {
  return {
    service_name: '',
    service_url: null,
    business: 'Erwin Mills',
    category: 'Other',
    username_or_email: null,
    cost: null,
    billing_cycle: 'Monthly',
    renewal_date: null,
    auto_renew: true,
    status: 'Active',
    notes: null,
  };
}

// ---------------------------------------------------------------------------
// Account Form Dialog
// ---------------------------------------------------------------------------

interface AccountFormDialogProps {
  open: boolean;
  account: Omit<BusinessAccount, 'id' | 'created_at' | 'updated_at'>;
  businesses: AccountBusiness[];
  isEditing: boolean;
  saving: boolean;
  onChange: (field: string, value: string | number | boolean | null) => void;
  onSave: () => void;
  onClose: () => void;
}

function AccountFormDialog({
  open,
  account,
  businesses,
  isEditing,
  saving,
  onChange,
  onSave,
  onClose,
}: AccountFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ color: colors.brown }}>
            {isEditing ? 'Edit Account' : 'Add Account'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Service Name */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.brown }}>
              Service Name <span style={{ color: colors.red }}>*</span>
            </label>
            <Input
              placeholder="e.g. Cloudflare, GitHub, Fastmail"
              value={account.service_name}
              onChange={(e) => onChange('service_name', e.target.value)}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
            />
          </div>

          {/* Service URL */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.brown }}>
              Login URL
            </label>
            <Input
              placeholder="https://..."
              value={account.service_url ?? ''}
              onChange={(e) => onChange('service_url', e.target.value || null)}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
            />
          </div>

          {/* Business + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.brown }}>
                Business <span style={{ color: colors.red }}>*</span>
              </label>
              <Select value={account.business} onValueChange={(v) => onChange('business', v)}>
                <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.brown }}>
                Category <span style={{ color: colors.red }}>*</span>
              </label>
              <Select value={account.category} onValueChange={(v) => onChange('category', v)}>
                <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Username / Email */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.brown }}>
              Username or Email
            </label>
            <Input
              placeholder="login@example.com"
              value={account.username_or_email ?? ''}
              onChange={(e) => onChange('username_or_email', e.target.value || null)}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
            />
          </div>

          {/* Cost + Billing Cycle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.brown }}>
                Cost ($)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={account.cost ?? ''}
                onChange={(e) => onChange('cost', e.target.value ? parseFloat(e.target.value) : null)}
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.brown }}>
                Billing Cycle
              </label>
              <Select value={account.billing_cycle} onValueChange={(v) => onChange('billing_cycle', v)}>
                <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_CYCLES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Renewal Date + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.brown }}>
                Renewal Date
              </label>
              <Input
                type="date"
                value={account.renewal_date ?? ''}
                onChange={(e) => onChange('renewal_date', e.target.value || null)}
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.brown }}>
                Status
              </label>
              <Select value={account.status} onValueChange={(v) => onChange('status', v)}>
                <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Auto Renew */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto_renew"
              checked={account.auto_renew}
              onChange={(e) => onChange('auto_renew', e.target.checked)}
              className="h-4 w-4 rounded"
              style={{ accentColor: colors.gold }}
            />
            <label htmlFor="auto_renew" className="text-sm" style={{ color: colors.brown }}>
              Auto-renews
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.brown }}>
              Notes
              <span className="font-normal ml-1" style={{ color: colors.brownLight }}>
                (API keys, account numbers — no passwords)
              </span>
            </label>
            <textarea
              rows={3}
              placeholder="Account number, API key location, plan details..."
              value={account.notes ?? ''}
              onChange={(e) => onChange('notes', e.target.value || null)}
              className="w-full rounded-md border px-3 py-2 text-sm resize-none"
              style={{
                backgroundColor: colors.inputBg,
                borderColor: colors.gold,
                color: colors.brown,
                outline: 'none',
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || !account.service_name.trim()}
            style={{ backgroundColor: colors.gold, color: colors.white }}
          >
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sortable column header
// ---------------------------------------------------------------------------

interface SortHeaderProps {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}

function SortHeader({ label, field, sortField, sortDir, onSort }: SortHeaderProps) {
  const active = sortField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 font-semibold text-xs uppercase tracking-wide hover:opacity-70 transition-opacity"
      style={{ color: active ? colors.gold : colors.brownLight }}
    >
      {label}
      {active ? (
        sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3 opacity-30" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminBusinessAccounts() {
  const { isPlatformAdmin } = useAuth();
  const { toast } = useToast();

  const { data: accounts = [], isLoading } = useBusinessAccounts();
  const { data: businesses = [] } = useAccountBusinesses();
  const addAccount = useAddBusinessAccount();
  const updateAccount = useUpdateBusinessAccount();
  const deleteAccount = useDeleteBusinessAccount();
  const addBiz = useAddAccountBusiness();
  const deleteBiz = useDeleteAccountBusiness();

  // Business color lookup
  const bizColors = useMemo(() => {
    const map: Record<string, string> = {};
    businesses.forEach((b) => { map[b.name] = b.color; });
    return map;
  }, [businesses]);

  // Manage businesses dialog
  const [bizDialogOpen, setBizDialogOpen] = useState(false);
  const [newBizName, setNewBizName] = useState('');
  const [bizSaving, setBizSaving] = useState(false);
  const [bizDeleteId, setBizDeleteId] = useState<string | null>(null);

  // Filters & search
  const [search, setSearch] = useState('');
  const [filterBusiness, setFilterBusiness] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterCycle, setFilterCycle] = useState<string>('All');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('service_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Access guard
  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <div className="text-center">
          <p className="text-lg font-semibold" style={{ color: colors.brown }}>Access Denied</p>
          <p className="text-sm mt-1" style={{ color: colors.brownLight }}>
            This page is restricted to platform administrators.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Computed: filtered + sorted accounts
  // ---------------------------------------------------------------------------

  const filtered = useMemo(() => {
    let list = [...accounts];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.service_name.toLowerCase().includes(q) ||
          (a.username_or_email ?? '').toLowerCase().includes(q) ||
          (a.notes ?? '').toLowerCase().includes(q),
      );
    }
    if (filterBusiness !== 'All') list = list.filter((a) => a.business === filterBusiness);
    if (filterCategory !== 'All') list = list.filter((a) => a.category === filterCategory);
    if (filterStatus !== 'All') list = list.filter((a) => a.status === filterStatus);
    if (filterCycle !== 'All') list = list.filter((a) => a.billing_cycle === filterCycle);

    list.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sortField) {
        case 'service_name': av = a.service_name.toLowerCase(); bv = b.service_name.toLowerCase(); break;
        case 'business': av = a.business; bv = b.business; break;
        case 'category': av = a.category; bv = b.category; break;
        case 'cost': av = toMonthly(a.cost, a.billing_cycle); bv = toMonthly(b.cost, b.billing_cycle); break;
        case 'renewal_date': av = a.renewal_date ?? '9999-99-99'; bv = b.renewal_date ?? '9999-99-99'; break;
        case 'status': av = a.status; bv = b.status; break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [accounts, search, filterBusiness, filterCategory, filterStatus, filterCycle, sortField, sortDir]);

  // ---------------------------------------------------------------------------
  // Computed: summary stats
  // ---------------------------------------------------------------------------

  const activeAccounts = accounts.filter((a) => a.status === 'Active' || a.status === 'Trial');

  const totalMonthly = activeAccounts.reduce((sum, a) => sum + toMonthly(a.cost, a.billing_cycle), 0);
  const totalAnnual = activeAccounts.reduce((sum, a) => sum + toAnnual(a.cost, a.billing_cycle), 0);

  const upcomingRenewals = accounts.filter((a) => {
    const days = daysUntilRenewal(a.renewal_date);
    return days !== null && days >= 0 && days <= 30 && a.status === 'Active';
  }).sort((a, b) => (a.renewal_date ?? '') < (b.renewal_date ?? '') ? -1 : 1);

  const byBusiness = businesses.reduce<Record<string, number>>((acc, biz) => {
    acc[biz.name] = activeAccounts
      .filter((a) => a.business === biz.name)
      .reduce((s, a) => s + toMonthly(a.cost, a.billing_cycle), 0);
    return acc;
  }, {} as Record<string, number>);

  const byCategory = CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    const sum = activeAccounts
      .filter((a) => a.category === cat)
      .reduce((s, a) => s + toMonthly(a.cost, a.billing_cycle), 0);
    if (sum > 0) acc[cat] = sum;
    return acc;
  }, {} as Record<string, number>);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function openAdd() {
    setEditingId(null);
    setFormData(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(account: BusinessAccount) {
    setEditingId(account.id);
    setFormData({
      service_name: account.service_name,
      service_url: account.service_url,
      business: account.business,
      category: account.category,
      username_or_email: account.username_or_email,
      cost: account.cost,
      billing_cycle: account.billing_cycle,
      renewal_date: account.renewal_date,
      auto_renew: account.auto_renew,
      status: account.status,
      notes: account.notes,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
  }

  function handleFieldChange(field: string, value: string | number | boolean | null) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!formData.service_name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateAccount.mutateAsync({ id: editingId, updates: formData });
        toast({ title: 'Account updated' });
      } else {
        await addAccount.mutateAsync(formData);
        toast({ title: 'Account added' });
      }
      closeDialog();
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save account',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAccount.mutateAsync(id);
      toast({ title: 'Account deleted' });
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete account',
        variant: 'destructive',
      });
    } finally {
      setDeleteId(null);
    }
  }

  async function handleAddBusiness() {
    const trimmed = newBizName.trim();
    if (!trimmed) return;
    if (businesses.some((b) => b.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: 'Business already exists', variant: 'destructive' });
      return;
    }
    setBizSaving(true);
    try {
      const color = PALETTE[businesses.length % PALETTE.length];
      await addBiz.mutateAsync({ name: trimmed, color, display_order: businesses.length });
      setNewBizName('');
      toast({ title: `"${trimmed}" added` });
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to add business', variant: 'destructive' });
    } finally {
      setBizSaving(false);
    }
  }

  async function handleDeleteBusiness(id: string) {
    const biz = businesses.find((b) => b.id === id);
    const inUse = accounts.some((a) => a.business === biz?.name);
    if (inUse) {
      toast({ title: 'Cannot delete', description: `"${biz?.name}" is assigned to one or more accounts. Reassign them first.`, variant: 'destructive' });
      setBizDeleteId(null);
      return;
    }
    try {
      await deleteBiz.mutateAsync(id);
      toast({ title: `"${biz?.name}" removed` });
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete business', variant: 'destructive' });
    } finally {
      setBizDeleteId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b" style={{ borderColor: colors.creamDark, backgroundColor: colors.white }}>
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-lg hover:opacity-80"
            style={{ backgroundColor: colors.goldLight }}
          >
            <ArrowLeft className="h-4 w-4" style={{ color: colors.gold }} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: colors.brown }}>
              Business Accounts Tracker
            </h1>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              Internal admin tool — subscriptions, services &amp; renewals
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setBizDialogOpen(true)}
              className="flex items-center gap-2"
              style={{ borderColor: colors.gold, color: colors.gold }}
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Businesses</span>
            </Button>
            <Button
              onClick={openAdd}
              style={{ backgroundColor: colors.gold, color: colors.white }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Account
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card style={{ backgroundColor: colors.white }}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4" style={{ color: colors.gold }} />
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.brownLight }}>Monthly</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.brown }}>
                {formatCurrency(totalMonthly)}
              </p>
              <p className="text-xs mt-0.5" style={{ color: colors.brownLight }}>active subscriptions</p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: colors.white }}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4" style={{ color: colors.blue }} />
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.brownLight }}>Annual</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.brown }}>
                {formatCurrency(totalAnnual)}
              </p>
              <p className="text-xs mt-0.5" style={{ color: colors.brownLight }}>projected spend</p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: colors.white }}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4" style={{ color: colors.green }} />
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.brownLight }}>Accounts</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.brown }}>
                {accounts.filter((a) => a.status === 'Active').length}
              </p>
              <p className="text-xs mt-0.5" style={{ color: colors.brownLight }}>active of {accounts.length} total</p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: upcomingRenewals.length > 0 ? '#fff7ed' : colors.white }}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4" style={{ color: upcomingRenewals.length > 0 ? colors.orange : colors.brownLight }} />
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.brownLight }}>Renewals</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: upcomingRenewals.length > 0 ? colors.orange : colors.brown }}>
                {upcomingRenewals.length}
              </p>
              <p className="text-xs mt-0.5" style={{ color: colors.brownLight }}>due in 30 days</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Breakdown Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* By Business */}
          <Card style={{ backgroundColor: colors.white }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm" style={{ color: colors.brown }}>Monthly Spend by Business</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {businesses.map((biz) => {
                const amount = byBusiness[biz.name] ?? 0;
                const maxAmount = Math.max(...Object.values(byBusiness), 0.01);
                return (
                  <div key={biz.id} className="flex items-center gap-2">
                    <div className="w-24 text-xs truncate" style={{ color: colors.brownLight }}>{biz.name}</div>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.cream }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(amount / maxAmount) * 100}%`,
                          backgroundColor: biz.color,
                        }}
                      />
                    </div>
                    <div className="w-16 text-xs text-right font-medium" style={{ color: colors.brown }}>
                      {formatCurrency(amount)}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Upcoming Renewals */}
          <Card style={{ backgroundColor: colors.white }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm" style={{ color: colors.brown }}>Upcoming Renewals (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingRenewals.length === 0 ? (
                <p className="text-sm" style={{ color: colors.brownLight }}>No renewals due in the next 30 days.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingRenewals.map((a) => {
                    const days = daysUntilRenewal(a.renewal_date)!;
                    return (
                      <div key={a.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {days <= 7 && <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: colors.red }} />}
                          <span className="text-sm truncate" style={{ color: colors.brown }}>{a.service_name}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs" style={{ color: colors.brownLight }}>{formatDate(a.renewal_date)}</span>
                          <Badge
                            style={{
                              backgroundColor: days <= 7 ? '#fee2e2' : '#fef3c7',
                              color: days <= 7 ? colors.red : '#92400e',
                              fontSize: '0.65rem',
                            }}
                          >
                            {days === 0 ? 'Today' : `${days}d`}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Filters + Search ── */}
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: colors.brownLight }} />
                <Input
                  placeholder="Search accounts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                />
              </div>
              <Select value={filterBusiness} onValueChange={setFilterBusiness}>
                <SelectTrigger className="w-full sm:w-36" style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                  <SelectValue placeholder="Business" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Businesses</SelectItem>
                  {businesses.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full sm:w-36" style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Categories</SelectItem>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-32" style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterCycle} onValueChange={setFilterCycle}>
                <SelectTrigger className="w-full sm:w-32" style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                  <SelectValue placeholder="Cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Cycles</SelectItem>
                  {BILLING_CYCLES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ── Accounts Table ── */}
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm" style={{ color: colors.brown }}>
                {filtered.length === accounts.length
                  ? `${accounts.length} Account${accounts.length !== 1 ? 's' : ''}`
                  : `${filtered.length} of ${accounts.length} Accounts`}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-5 w-5 animate-spin" style={{ color: colors.gold }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" style={{ color: colors.brownLight }} />
                <p className="text-sm font-medium" style={{ color: colors.brown }}>
                  {accounts.length === 0 ? 'No accounts yet' : 'No accounts match your filters'}
                </p>
                {accounts.length === 0 && (
                  <Button
                    onClick={openAdd}
                    className="mt-3"
                    style={{ backgroundColor: colors.gold, color: colors.white }}
                  >
                    Add your first account
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${colors.creamDark}`, backgroundColor: colors.cream }}>
                      <th className="text-left px-4 py-3">
                        <SortHeader label="Service" field="service_name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="text-left px-3 py-3 hidden sm:table-cell">
                        <SortHeader label="Business" field="business" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="text-left px-3 py-3 hidden md:table-cell">
                        <SortHeader label="Category" field="category" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="text-left px-3 py-3 hidden lg:table-cell">
                        Login
                      </th>
                      <th className="text-right px-3 py-3">
                        <SortHeader label="Cost" field="cost" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="text-left px-3 py-3 hidden md:table-cell">
                        <SortHeader label="Renewal" field="renewal_date" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="text-left px-3 py-3">
                        <SortHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-3 py-3 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((account, idx) => {
                      const days = daysUntilRenewal(account.renewal_date);
                      const renewingSoon = days !== null && days >= 0 && days <= 30 && account.status === 'Active';
                      const renewingUrgent = days !== null && days >= 0 && days <= 7 && account.status === 'Active';
                      return (
                        <tr
                          key={account.id}
                          style={{
                            borderBottom: idx < filtered.length - 1 ? `1px solid ${colors.cream}` : 'none',
                            backgroundColor: renewingUrgent ? '#fff7ed' : renewingSoon ? '#fffbeb' : colors.white,
                          }}
                          className="hover:opacity-90 transition-opacity"
                        >
                          {/* Service */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {renewingUrgent && (
                                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: colors.red }} />
                              )}
                              <div>
                                <div className="font-medium" style={{ color: colors.brown }}>
                                  {account.service_name}
                                </div>
                                {account.service_url && (
                                  <a
                                    href={account.service_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs hover:underline"
                                    style={{ color: colors.gold }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-2.5 w-2.5" />
                                    Open
                                  </a>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Business */}
                          <td className="px-3 py-3 hidden sm:table-cell">
                            <Badge
                              style={{
                                backgroundColor: (bizColors[account.business] ?? '#94a3b8') + '22',
                                color: bizColors[account.business] ?? '#94a3b8',
                                border: `1px solid ${bizColors[account.business] ?? '#94a3b8'}44`,
                                fontSize: '0.7rem',
                              }}
                            >
                              {account.business}
                            </Badge>
                          </td>

                          {/* Category */}
                          <td className="px-3 py-3 hidden md:table-cell">
                            <span className="text-xs" style={{ color: colors.brownLight }}>
                              {account.category}
                            </span>
                          </td>

                          {/* Login */}
                          <td className="px-3 py-3 hidden lg:table-cell">
                            <span className="text-xs" style={{ color: colors.brownLight }}>
                              {account.username_or_email ?? '—'}
                            </span>
                          </td>

                          {/* Cost */}
                          <td className="px-3 py-3 text-right">
                            {account.billing_cycle === 'Free' ? (
                              <span className="text-xs font-medium" style={{ color: colors.green }}>Free</span>
                            ) : account.cost ? (
                              <div>
                                <div className="font-medium text-xs" style={{ color: colors.brown }}>
                                  {formatCurrency(account.cost)}
                                </div>
                                <div className="text-xs" style={{ color: colors.brownLight }}>
                                  /{account.billing_cycle === 'Monthly' ? 'mo' : account.billing_cycle === 'Annual' ? 'yr' : 'once'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs" style={{ color: colors.brownLight }}>—</span>
                            )}
                          </td>

                          {/* Renewal */}
                          <td className="px-3 py-3 hidden md:table-cell">
                            {account.renewal_date ? (
                              <div>
                                <div className="text-xs" style={{ color: colors.brown }}>{formatDate(account.renewal_date)}</div>
                                {days !== null && days >= 0 && (
                                  <div className="text-xs" style={{ color: renewingUrgent ? colors.red : renewingSoon ? colors.orange : colors.brownLight }}>
                                    {days === 0 ? 'Today' : `${days}d`}
                                  </div>
                                )}
                                {days !== null && days < 0 && (
                                  <div className="text-xs" style={{ color: colors.brownLight }}>Past</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs" style={{ color: colors.brownLight }}>—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3">
                            <Badge
                              style={{
                                backgroundColor: STATUS_COLORS[account.status] + '22',
                                color: STATUS_COLORS[account.status],
                                border: `1px solid ${STATUS_COLORS[account.status]}44`,
                                fontSize: '0.7rem',
                              }}
                            >
                              {account.status}
                            </Badge>
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => openEdit(account)}
                                className="p-1.5 rounded hover:opacity-70"
                                style={{ color: colors.gold }}
                                title="Edit"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteId(account.id)}
                                className="p-1.5 rounded hover:opacity-70"
                                style={{ color: colors.red }}
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Category breakdown ── */}
        {Object.keys(byCategory).length > 0 && (
          <Card style={{ backgroundColor: colors.white }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm" style={{ color: colors.brown }}>Monthly Spend by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Object.entries(byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amount]) => (
                    <div key={cat} className="flex flex-col gap-0.5 p-3 rounded-lg" style={{ backgroundColor: colors.cream }}>
                      <span className="text-xs font-medium" style={{ color: colors.brownLight }}>{cat}</span>
                      <span className="text-base font-bold" style={{ color: colors.brown }}>{formatCurrency(amount)}</span>
                      <span className="text-xs" style={{ color: colors.brownLight }}>/ mo</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Add/Edit Dialog ── */}
      <AccountFormDialog
        open={dialogOpen}
        account={formData}
        businesses={businesses}
        isEditing={editingId !== null}
        saving={saving}
        onChange={handleFieldChange}
        onSave={handleSave}
        onClose={closeDialog}
      />

      {/* ── Delete Account Confirm ── */}
      <AlertDialog open={deleteId !== null} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this account entry. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              style={{ backgroundColor: colors.red, color: colors.white }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Manage Businesses Dialog ── */}
      <Dialog open={bizDialogOpen} onOpenChange={setBizDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ color: colors.brown }}>Manage Businesses</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {businesses.map((biz) => {
              const count = accounts.filter((a) => a.business === biz.name).length;
              return (
                <div key={biz.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: colors.cream }}>
                  <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: biz.color }} />
                  <span className="flex-1 text-sm font-medium" style={{ color: colors.brown }}>{biz.name}</span>
                  <span className="text-xs" style={{ color: colors.brownLight }}>{count} acct{count !== 1 ? 's' : ''}</span>
                  <button
                    onClick={() => setBizDeleteId(biz.id)}
                    className="p-1 rounded hover:opacity-70"
                    style={{ color: colors.red }}
                    title="Remove business"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            <div className="flex items-center gap-2 pt-1">
              <Input
                placeholder="New business name"
                value={newBizName}
                onChange={(e) => setNewBizName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddBusiness(); }}
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                className="flex-1"
              />
              <Button
                onClick={handleAddBusiness}
                disabled={bizSaving || !newBizName.trim()}
                style={{ backgroundColor: colors.gold, color: colors.white }}
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Business Confirm ── */}
      <AlertDialog open={bizDeleteId !== null} onOpenChange={(v) => { if (!v) setBizDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Business?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const biz = businesses.find((b) => b.id === bizDeleteId);
                const count = accounts.filter((a) => a.business === biz?.name).length;
                if (count > 0) {
                  return `"${biz?.name}" has ${count} account${count !== 1 ? 's' : ''} assigned. Reassign them before removing.`;
                }
                return `Remove "${biz?.name}" from the business list?`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bizDeleteId && handleDeleteBusiness(bizDeleteId)}
              style={{ backgroundColor: colors.red, color: colors.white }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
