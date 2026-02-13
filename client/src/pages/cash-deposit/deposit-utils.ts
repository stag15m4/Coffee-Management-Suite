export interface CashEntry {
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
  excluded_from_average: boolean;
}

export interface FormData {
  drawer_date: string;
  gross_revenue: string;
  starting_drawer: string;
  actual_deposit: string;
  cash_sales: string;
  tip_pool: string;
  owner_tips: string;
  pay_in: string;
  pay_out: string;
  cash_refund: string;
  notes: string;
  flagged: boolean;
}

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0);
};

export const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
};

export const formatDateDisplay = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const getWeekStart = (date: string) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
};

export const formatWeekRange = (weekStart: string) => {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}`;
};

export const getDefaultFormData = (today: string, drawerDefault: number): FormData => ({
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
  flagged: false,
});

export const groupEntriesByWeek = (entries: CashEntry[]) => {
  return entries.reduce((acc, entry) => {
    const weekStart = getWeekStart(entry.drawer_date);
    if (!acc[weekStart]) acc[weekStart] = [];
    acc[weekStart].push(entry);
    return acc;
  }, {} as Record<string, CashEntry[]>);
};
