import { useState, useRef, useCallback } from 'react';
import { colors } from '@/lib/colors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useChartOfAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useImportChartOfAccounts,
  useQboStatus,
  useQboConnect,
  useQboDisconnect,
  useQboSyncCoa,
} from '@/hooks/use-budget';
import { buildAccountTree, ACCOUNT_TYPE_ORDER } from './types';
import type { ChartOfAccount, AccountType } from './types';
import {
  Upload,
  Plus,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  Check,
  RefreshCw,
  Link,
  Unlink,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  tenantId: string;
}

export default function ChartOfAccountsTab({ tenantId }: Props) {
  const { toast } = useToast();
  const { data: accounts = [], isLoading } = useChartOfAccounts(tenantId);
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const importCoa = useImportChartOfAccounts();

  // QBO integration
  const { data: qboStatus } = useQboStatus(tenantId);
  const qboConnect = useQboConnect();
  const qboDisconnect = useQboDisconnect();
  const qboSyncCoa = useQboSyncCoa();

  // Check for QBO OAuth callback params
  const params = new URLSearchParams(window.location.search);
  const qboConnected = params.get('qbo_connected');
  const qboError = params.get('qbo_error');
  if (qboConnected === 'true' || qboError) {
    // Clean URL params after reading
    const url = new URL(window.location.href);
    url.searchParams.delete('qbo_connected');
    url.searchParams.delete('qbo_error');
    window.history.replaceState({}, '', url.toString());
    if (qboConnected === 'true') {
      toast({ title: 'QuickBooks connected successfully' });
    } else if (qboError) {
      toast({ title: 'QuickBooks connection failed', description: qboError, variant: 'destructive' });
    }
  }

  const handleQboSync = async () => {
    try {
      const result = await qboSyncCoa.mutateAsync(tenantId);
      toast({
        title: 'Chart of Accounts synced',
        description: `${result.imported} new, ${result.updated} updated, ${result.skipped} skipped`,
      });
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleQboDisconnect = async () => {
    if (!confirm('Disconnect QuickBooks? You can reconnect anytime.')) return;
    try {
      await qboDisconnect.mutateAsync(tenantId);
      toast({ title: 'QuickBooks disconnected' });
    } catch (err: any) {
      toast({ title: 'Disconnect failed', description: err.message, variant: 'destructive' });
    }
  };

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(ACCOUNT_TYPE_ORDER));
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add form state
  const [newAccount, setNewAccount] = useState({
    name: '',
    account_number: '',
    account_type: 'Expense' as AccountType,
    detail_type: '',
    parent_id: '',
  });

  // Edit form state
  const [editValues, setEditValues] = useState({
    name: '',
    account_number: '',
    account_type: '' as AccountType,
    detail_type: '',
  });

  const tree = buildAccountTree(accounts);

  // Group by type
  const grouped = ACCOUNT_TYPE_ORDER.map((type) => ({
    type,
    accounts: tree.filter((a) => a.account_type === type),
  })).filter((g) => g.accounts.length > 0);

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleAccount = (id: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (!newAccount.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    try {
      await createAccount.mutateAsync({
        tenant_id: tenantId,
        name: newAccount.name.trim(),
        account_number: newAccount.account_number.trim() || null,
        account_type: newAccount.account_type,
        detail_type: newAccount.detail_type.trim() || null,
        parent_id: newAccount.parent_id || null,
        depth: newAccount.parent_id ? 1 : 0,
      });
      setShowAddDialog(false);
      setNewAccount({ name: '', account_number: '', account_type: 'Expense', detail_type: '', parent_id: '' });
      toast({ title: 'Account added' });
    } catch (err: any) {
      toast({ title: 'Failed to add account', description: err.message, variant: 'destructive' });
    }
  };

  const startEdit = (acc: ChartOfAccount) => {
    setEditingId(acc.id);
    setEditValues({
      name: acc.name,
      account_number: acc.account_number || '',
      account_type: acc.account_type,
      detail_type: acc.detail_type || '',
    });
  };

  const saveEdit = async (acc: ChartOfAccount) => {
    try {
      await updateAccount.mutateAsync({
        id: acc.id,
        tenant_id: tenantId,
        name: editValues.name.trim(),
        account_number: editValues.account_number.trim() || null,
        account_type: editValues.account_type,
        detail_type: editValues.detail_type.trim() || null,
      });
      setEditingId(null);
      toast({ title: 'Account updated' });
    } catch (err: any) {
      toast({ title: 'Failed to update', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (acc: ChartOfAccount) => {
    if (!confirm(`Delete "${acc.name}"? This will also remove any sub-accounts.`)) return;
    try {
      await deleteAccount.mutateAsync({ id: acc.id, tenant_id: tenantId });
      toast({ title: 'Account deleted' });
    } catch (err: any) {
      toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
    }
  };

  // CSV import state — two-step: file → mapping → import
  const [csvData, setCsvData] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [colMapping, setColMapping] = useState<{
    name: string; type: string; detailType: string; number: string;
  }>({ name: '', type: '', detailType: '', number: '' });
  const [importStep, setImportStep] = useState<'file' | 'mapping'>('file');
  const [replaceExisting, setReplaceExisting] = useState(false);

  const parseCSVLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const csv = ev.target?.result as string;
        const allLines = csv.split(/\r?\n/).filter((l) => l.trim());
        if (allLines.length < 2) {
          toast({ title: 'Invalid CSV', description: 'File must have a header row and at least one data row', variant: 'destructive' });
          return;
        }

        // QBO exports have title rows before the real headers (e.g. "Account List,,,,,").
        // Find the header row: first line where at least 3 fields have non-empty values.
        let headerIdx = 0;
        for (let i = 0; i < Math.min(allLines.length, 10); i++) {
          const fields = parseCSVLine(allLines[i]);
          const nonEmpty = fields.filter((f) => f.length > 0).length;
          if (nonEmpty >= 3) {
            headerIdx = i;
            break;
          }
        }

        const lines = allLines.slice(headerIdx);
        const headers = parseCSVLine(lines[0]);
        const preview = lines.slice(1, 4).map((l) => parseCSVLine(l));

        // Store only from the real header row onward
        setCsvData(lines.join('\n'));
        setCsvFileName(file.name);
        setCsvHeaders(headers);
        setCsvPreview(preview);

        // Auto-detect mappings — QBO uses "Account #", "Full name", "Type", "Detail type"
        const normalized = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
        const autoNumber = normalized.findIndex((h) =>
          h === 'account' || h === 'number' || h === 'accountnumber' || h === 'acctnum'
        );
        const autoName = normalized.findIndex((h, idx) =>
          idx !== autoNumber && (
            h === 'fullname' || h === 'accountname' || h === 'name' || h === 'account'
          )
        );
        const autoType = normalized.findIndex((h) => h === 'type' || h === 'accounttype');
        const autoDetail = normalized.findIndex((h) => h === 'detailtype' || h === 'detail');

        setColMapping({
          name: autoName >= 0 ? String(autoName) : '',
          type: autoType >= 0 ? String(autoType) : '',
          detailType: autoDetail >= 0 ? String(autoDetail) : '',
          number: autoNumber >= 0 ? String(autoNumber) : '',
        });

        setImportStep('mapping');
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [toast]
  );

  const handleImportWithMapping = async () => {
    if (!colMapping.name) {
      toast({ title: 'Account Name column is required', variant: 'destructive' });
      return;
    }
    const mapping: { name: number; type?: number; detailType?: number; number?: number } = {
      name: parseInt(colMapping.name),
    };
    if (colMapping.type) mapping.type = parseInt(colMapping.type);
    if (colMapping.detailType) mapping.detailType = parseInt(colMapping.detailType);
    if (colMapping.number) mapping.number = parseInt(colMapping.number);

    try {
      const result = await importCoa.mutateAsync({
        csv: csvData,
        tenantId,
        fileName: csvFileName,
        columnMapping: mapping,
        replaceExisting,
      });
      toast({
        title: 'Import complete',
        description: `${result.imported} accounts imported, ${result.skipped} skipped${result.errors?.length ? `, ${result.errors.length} errors` : ''}`,
      });
      setShowImportDialog(false);
      setImportStep('file');
      setCsvData('');
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    }
  };

  const renderAccountRow = (acc: ChartOfAccount, depth: number = 0) => {
    const hasChildren = acc.children && acc.children.length > 0;
    const isExpanded = expandedAccounts.has(acc.id);
    const isEditing = editingId === acc.id;
    const isParent = hasChildren || depth === 0;

    return (
      <div key={acc.id}>
        <div
          className="flex items-center gap-2 py-2 px-3 hover:bg-black/5 transition-colors group"
          style={{
            paddingLeft: `${12 + depth * 24}px`,
            ...(isParent && hasChildren ? { fontWeight: 600 } : {}),
          }}
        >
          {/* Expand toggle */}
          <button
            onClick={() => hasChildren && toggleAccount(acc.id)}
            className="w-5 h-5 flex items-center justify-center shrink-0"
            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" style={{ color: colors.brownLight }} />
            ) : (
              <ChevronRight className="w-4 h-4" style={{ color: colors.brownLight }} />
            )}
          </button>

          {isEditing ? (
            <>
              <Input
                value={editValues.account_number}
                onChange={(e) => setEditValues((p) => ({ ...p, account_number: e.target.value }))}
                placeholder="#"
                className="w-20 h-8 text-sm"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
              <Input
                value={editValues.name}
                onChange={(e) => setEditValues((p) => ({ ...p, name: e.target.value }))}
                className="flex-1 h-8 text-sm"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
              <Button size="sm" variant="ghost" onClick={() => saveEdit(acc)}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              {/* Account number + name inline, like QBO: "800 Cost of Labor" */}
              <span className="flex-1 text-sm" style={{ color: colors.brown }}>
                {acc.account_number && (
                  <span className="font-mono mr-1.5" style={{ color: colors.brownLight }}>
                    {acc.account_number}
                  </span>
                )}
                {acc.name}
              </span>

              {/* Detail type */}
              {acc.detail_type && (
                <span className="text-xs" style={{ color: colors.brownLight }}>
                  {acc.detail_type}
                </span>
              )}

              {/* Actions */}
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                <button onClick={() => startEdit(acc)} className="p-1 rounded hover:bg-black/10">
                  <Edit2 className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />
                </button>
                <button onClick={() => handleDelete(acc)} className="p-1 rounded hover:bg-black/10">
                  <Trash2 className="w-3.5 h-3.5" style={{ color: colors.red }} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Children — auto-expanded for parents with children */}
        {hasChildren && isExpanded && acc.children!.map((child) => renderAccountRow(child, depth + 1))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: colors.gold }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* QBO Connection Card */}
      <div
        className="rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
        style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: qboStatus?.connected ? colors.green + '20' : colors.cream }}>
            {qboStatus?.connected ? (
              <CheckCircle2 className="w-4 h-4" style={{ color: colors.green }} />
            ) : (
              <Link className="w-4 h-4" style={{ color: colors.brownLight }} />
            )}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: colors.brown }}>
              QuickBooks Online {qboStatus?.connected ? '— Connected' : '— Not Connected'}
            </p>
            {qboStatus?.connected && qboStatus.realmId && (
              <p className="text-xs" style={{ color: colors.brownLight }}>Company ID: {qboStatus.realmId}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {qboStatus?.connected ? (
            <>
              <Button
                onClick={handleQboSync}
                disabled={qboSyncCoa.isPending}
                size="sm"
                style={{ backgroundColor: colors.gold, color: '#fff' }}
              >
                {qboSyncCoa.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                Sync Accounts
              </Button>
              <Button
                onClick={handleQboDisconnect}
                disabled={qboDisconnect.isPending}
                size="sm"
                variant="outline"
                style={{ borderColor: colors.red, color: colors.red }}
              >
                <Unlink className="w-4 h-4 mr-1" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              onClick={() => qboConnect.mutate(tenantId)}
              disabled={qboConnect.isPending}
              size="sm"
              style={{ backgroundColor: colors.gold, color: '#fff' }}
            >
              {qboConnect.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Link className="w-4 h-4 mr-1" />}
              Connect to QuickBooks
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setShowImportDialog(true)} style={{ backgroundColor: colors.gold, color: '#fff' }}>
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </Button>
        <Button variant="outline" onClick={() => setShowAddDialog(true)} style={{ borderColor: colors.gold, color: colors.brown }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Account count */}
      <p className="text-sm" style={{ color: colors.brownLight }}>
        {accounts.length} account{accounts.length !== 1 ? 's' : ''}
      </p>

      {/* Account groups */}
      {grouped.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
        >
          <FileSpreadsheet className="w-10 h-10 mx-auto mb-3" style={{ color: colors.creamDark }} />
          <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>
            No accounts yet
          </h3>
          <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
            Import your Chart of Accounts from QuickBooks Online or add accounts manually.
          </p>
          <Button onClick={() => setShowImportDialog(true)} style={{ backgroundColor: colors.gold, color: '#fff' }}>
            <Upload className="w-4 h-4 mr-2" />
            Import from QBO
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ type, accounts: typeAccounts }) => (
            <div
              key={type}
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
            >
              <button
                onClick={() => toggleType(type)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedTypes.has(type) ? (
                    <ChevronDown className="w-4 h-4" style={{ color: colors.gold }} />
                  ) : (
                    <ChevronRight className="w-4 h-4" style={{ color: colors.gold }} />
                  )}
                  <span className="font-semibold text-sm" style={{ color: colors.brown }}>
                    {type}
                  </span>
                </div>
                <span className="text-xs" style={{ color: colors.brownLight }}>
                  {typeAccounts.length} account{typeAccounts.length !== 1 ? 's' : ''}
                </span>
              </button>

              {expandedTypes.has(type) && (
                <div className="pb-2">
                  {typeAccounts.map((acc) => renderAccountRow(acc))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Import Dialog — two-step: file select → column mapping */}
      <Dialog open={showImportDialog} onOpenChange={(open) => {
        setShowImportDialog(open);
        if (!open) { setImportStep('file'); setCsvData(''); setReplaceExisting(false); }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {importStep === 'file' ? 'Import Chart of Accounts' : 'Map CSV Columns'}
            </DialogTitle>
          </DialogHeader>

          {importStep === 'file' ? (
            <div className="space-y-4 py-2">
              <p className="text-sm" style={{ color: colors.brownLight }}>
                Export your Chart of Accounts from QuickBooks Online as a CSV file, then upload it here.
              </p>
              <ol className="text-sm space-y-1 list-decimal list-inside" style={{ color: colors.brownLight }}>
                <li>In QBO, go to <strong>Settings → Chart of Accounts</strong></li>
                <li>Click the <strong>Export to Excel</strong> button (top right)</li>
                <li>Save as CSV if needed</li>
                <li>Upload the file below</li>
              </ol>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ backgroundColor: colors.gold, color: '#fff' }}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose CSV File
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm" style={{ color: colors.brownLight }}>
                Match your CSV columns to the expected fields. Only <strong>Account Name</strong> is required.
              </p>

              {/* Column mapping selectors */}
              <div className="space-y-3">
                {([
                  { key: 'name' as const, label: 'Account Name *', required: true },
                  { key: 'type' as const, label: 'Account Type', required: false },
                  { key: 'detailType' as const, label: 'Detail Type', required: false },
                  { key: 'number' as const, label: 'Account Number', required: false },
                ]).map(({ key, label, required }) => (
                  <div key={key} className="flex items-center gap-3">
                    <Label className="text-sm w-32 shrink-0" style={{ color: colors.brown }}>
                      {label}
                    </Label>
                    <Select
                      value={colMapping[key] || '_skip'}
                      onValueChange={(v) => setColMapping((p) => ({ ...p, [key]: v === '_skip' ? '' : v }))}
                    >
                      <SelectTrigger className="flex-1" style={{ backgroundColor: colors.inputBg, borderColor: required && !colMapping[key] ? colors.red : colors.gold }}>
                        <SelectValue placeholder="Skip" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_skip">— Skip —</SelectItem>
                        {csvHeaders.map((h, i) => {
                          const samples = csvPreview
                            .map((row) => row[i])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join(', ');
                          return (
                            <SelectItem key={i} value={String(i)}>
                              {h}{samples ? ` (${samples})` : ''}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Replace existing toggle */}
              {accounts.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm" style={{ color: colors.brown }}>
                    Replace existing accounts ({accounts.length} currently loaded)
                  </span>
                </label>
              )}

              {/* Preview table */}
              {csvPreview.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: colors.brownLight }}>Preview (first {csvPreview.length} rows):</p>
                  <div className="overflow-x-auto rounded border" style={{ borderColor: colors.creamDark }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ backgroundColor: colors.cream }}>
                          {csvHeaders.map((h, i) => (
                            <th key={i} className="text-left py-1 px-2 font-medium whitespace-nowrap" style={{ color: colors.brown }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row, ri) => (
                          <tr key={ri} style={{ borderTop: `1px solid ${colors.creamDark}` }}>
                            {csvHeaders.map((_, ci) => (
                              <td key={ci} className="py-1 px-2 whitespace-nowrap" style={{ color: colors.brownLight }}>
                                {row[ci] || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setImportStep('file'); setCsvData(''); }}
                  style={{ borderColor: colors.gold, color: colors.brown }}
                >
                  Back
                </Button>
                <Button
                  onClick={handleImportWithMapping}
                  disabled={importCoa.isPending || !colMapping.name}
                  style={{ backgroundColor: colors.gold, color: '#fff' }}
                >
                  {importCoa.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {importCoa.isPending ? 'Importing...' : 'Import'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Account Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Account Name *</Label>
              <Input
                value={newAccount.name}
                onChange={(e) => setNewAccount((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Coffee Beans"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
            <div>
              <Label>Account Number</Label>
              <Input
                value={newAccount.account_number}
                onChange={(e) => setNewAccount((p) => ({ ...p, account_number: e.target.value }))}
                placeholder="e.g. 5010"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
            <div>
              <Label>Account Type *</Label>
              <Select
                value={newAccount.account_type}
                onValueChange={(v) => setNewAccount((p) => ({ ...p, account_type: v as AccountType }))}
              >
                <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Detail Type</Label>
              <Input
                value={newAccount.detail_type}
                onChange={(e) => setNewAccount((p) => ({ ...p, detail_type: e.target.value }))}
                placeholder="e.g. Supplies & Materials"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
            <div>
              <Label>Parent Account</Label>
              <Select
                value={newAccount.parent_id}
                onValueChange={(v) => setNewAccount((p) => ({ ...p, parent_id: v === '_none' ? '' : v }))}
              >
                <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None (top-level)</SelectItem>
                  {accounts
                    .filter((a) => !a.parent_id)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} disabled={createAccount.isPending} style={{ backgroundColor: colors.gold, color: '#fff' }}>
              {createAccount.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
