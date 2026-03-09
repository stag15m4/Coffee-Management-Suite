export interface ChartOfAccount {
  id: string;
  tenant_id: string;
  account_number: string | null;
  name: string;
  account_type: AccountType;
  detail_type: string | null;
  parent_id: string | null;
  depth: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  children?: ChartOfAccount[];
}

export interface FiscalYear {
  id: string;
  tenant_id: string;
  year: number;
  start_month: number;
  status: 'draft' | 'approved' | 'locked';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetLineItem {
  id: string;
  tenant_id: string;
  fiscal_year_id: string;
  account_id: string;
  month: number;
  budget_amount: number;
  actual_amount: number | null;
  forecast_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportLog {
  id: string;
  tenant_id: string;
  import_type: 'chart_of_accounts' | 'actuals';
  file_name: string;
  rows_imported: number;
  rows_skipped: number;
  errors: Array<{ row: number; message: string }> | null;
  imported_by: string;
  created_at: string;
}

export type AccountType = 'Revenue' | 'COGS' | 'Expense' | 'Other';

export const ACCOUNT_TYPE_ORDER: AccountType[] = ['Revenue', 'COGS', 'Expense', 'Other'];

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function buildAccountTree(accounts: ChartOfAccount[]): ChartOfAccount[] {
  const map = new Map<string, ChartOfAccount>();
  const roots: ChartOfAccount[] = [];

  for (const acc of accounts) {
    map.set(acc.id, { ...acc, children: [] });
  }

  map.forEach((acc) => {
    if (acc.parent_id && map.has(acc.parent_id)) {
      map.get(acc.parent_id)!.children!.push(acc);
    } else {
      roots.push(acc);
    }
  });

  return roots;
}
