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

// --- PDF Export for single-day cash deposit ---

interface CashDepositPdfParams {
  companyName: string;
  locationName?: string;
  entry: CashEntry;
  ownerTipsEnabled: boolean;
  drawerDefault: number;
}

export function buildCashDepositDayPdfHtml(params: CashDepositPdfParams): string {
  const { companyName, locationName, entry, ownerTipsEnabled, drawerDefault } = params;

  const diff = (entry.actual_deposit || 0) - (entry.calculated_deposit || 0);
  const netCash = (entry.actual_deposit || 0) - (entry.pay_in || 0);

  const displayDate = new Date(entry.drawer_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // High-contrast colors for print readability
  const diffColor = Math.abs(diff) < 0.01 ? '#15803d' : diff > 0 ? '#b45309' : '#dc2626';

  const fmt = (v: number) => formatCurrency(v);

  // Match the exact categories from the deposit input form
  const adjustmentRows = [
    { label: 'Tip Pool', value: entry.tip_pool || 0 },
    { label: 'Cash Refund', value: entry.cash_refund || 0 },
    { label: 'Pay In', value: entry.pay_in || 0 },
    { label: 'Pay Out', value: entry.pay_out || 0 },
    ...(ownerTipsEnabled ? [{ label: 'Owner Tips', value: entry.owner_tips || 0 }] : []),
  ].filter(r => r.value !== 0);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cash Deposit - ${entry.drawer_date}</title>
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
      font-size: 22px;
      color: #4A3728;
    }
    .header h2 {
      margin: 5px 0 0 0;
      font-size: 15px;
      font-weight: normal;
      color: #6B5344;
    }
    .header .date {
      margin-top: 8px;
      font-size: 18px;
      font-weight: bold;
      color: #4A3728;
    }
    .flag-badge {
      display: inline-block;
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fca5a5;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 8px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin: 20px 0;
    }
    .summary-card {
      background: #F5F0E6;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }
    .summary-card .label {
      font-size: 11px;
      color: #6B5344;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .summary-card .value {
      font-size: 20px;
      font-weight: bold;
      color: #4A3728;
      margin-top: 4px;
    }
    .summary-card.gold .value {
      color: #C9A227;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th {
      background-color: #4A3728;
      color: #FFFFFF;
      padding: 10px 12px;
      text-align: left;
      font-weight: bold;
      font-size: 13px;
    }
    td {
      padding: 9px 12px;
      border-bottom: 1px solid #E5DDD0;
      font-size: 13px;
    }
    td.amount {
      text-align: right;
      font-family: 'Courier New', monospace;
      font-size: 14px;
    }
    .total-row {
      background-color: #C9A227;
      font-weight: bold;
    }
    .total-row td {
      border-bottom: none;
      padding: 10px 12px;
      color: #4A3728;
    }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      color: #4A3728;
      margin: 20px 0 8px 0;
      padding-bottom: 4px;
      border-bottom: 2px solid #C9A227;
    }
    .notes-section {
      margin-top: 20px;
      padding: 15px;
      background: #F5F0E6;
      border-radius: 6px;
      min-height: 40px;
    }
    .notes-section .label {
      font-size: 12px;
      font-weight: bold;
      color: #6B5344;
      margin-bottom: 6px;
    }
    .notes-section .content {
      font-size: 13px;
      white-space: pre-wrap;
      color: #4A3728;
    }
    .followup-section {
      margin-top: 20px;
    }
    .followup-section .label {
      font-size: 14px;
      font-weight: bold;
      color: #4A3728;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 2px solid #C9A227;
    }
    .write-lines {
      margin-top: 10px;
    }
    .write-lines .line {
      border-bottom: 1px solid #E5DDD0;
      height: 32px;
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
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; padding: 15px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="button-row no-print">
    <button class="button secondary" onclick="window.close()">Close &amp; Return to App</button>
    <button class="button" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="container">
    <div class="header">
      <h1>${companyName}</h1>
      ${locationName ? `<h2>${locationName}</h2>` : ''}
      <div class="date">${displayDate}</div>
      ${entry.flagged ? '<div class="flag-badge">&#9873; Flagged for Follow-up</div>' : ''}
    </div>

    <!-- Key Figures -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">Gross Revenue</div>
        <div class="value">${fmt(entry.gross_revenue || 0)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Actual Deposit</div>
        <div class="value">${fmt(entry.actual_deposit || 0)}</div>
      </div>
      <div class="summary-card gold">
        <div class="label">Net Cash</div>
        <div class="value">${fmt(netCash)}</div>
      </div>
    </div>

    <!-- Detailed Breakdown -->
    <div class="section-title">Cash Breakdown</div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Starting Drawer</td>
          <td class="amount">${fmt(entry.starting_drawer || drawerDefault)}</td>
        </tr>
        <tr>
          <td>Cash Sales</td>
          <td class="amount">${fmt(entry.cash_sales || 0)}</td>
        </tr>
        ${adjustmentRows.map((r, i) => `
        <tr style="background:${i % 2 === 0 ? '#F5F0E6' : '#FFFDF7'}">
          <td>${r.label}</td>
          <td class="amount">${r.value > 0 ? '+' : ''}${fmt(r.value)}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <!-- Deposit Comparison -->
    <div class="section-title">Deposit Comparison</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Calculated Deposit</td>
          <td class="amount">${fmt(entry.calculated_deposit || 0)}</td>
        </tr>
        <tr>
          <td>Actual Deposit</td>
          <td class="amount">${fmt(entry.actual_deposit || 0)}</td>
        </tr>
        <tr class="total-row">
          <td>Difference</td>
          <td class="amount" style="color:${diffColor}">${diff >= 0 ? '+' : ''}${fmt(diff)}</td>
        </tr>
      </tbody>
    </table>

    ${entry.notes ? `
    <!-- Existing Notes -->
    <div class="notes-section">
      <div class="label">Notes</div>
      <div class="content">${entry.notes.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>
    ` : ''}

    <!-- Handwritten Follow-up Area -->
    <div class="followup-section">
      <div class="label">Follow-up Notes</div>
      <div class="write-lines">
        ${Array(10).fill(0).map(() => '<div class="line"></div>').join('')}
      </div>
    </div>
  </div>

  <div style="text-align:center; margin-top:15px; font-size:11px; color:#6B5344;" class="no-print">
    Generated ${new Date().toLocaleString()}
  </div>
</body>
</html>`;
}

export function exportCashDepositDayPdf(params: CashDepositPdfParams): void {
  const html = buildCashDepositDayPdfHtml(params);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export PDF.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
}
