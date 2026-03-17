import { closeWindowScript } from '@/components/tip-payout/export-helpers';
import { ACCOUNT_TYPE_ORDER, MONTH_LABELS } from './types';
import type { ChartOfAccount, AccountType } from './types';

interface BudgetExportParams {
  title: string;
  year: number;
  locationName?: string;
  accounts: ChartOfAccount[];
  cellMap: Map<string, number>;
}

interface ActualsExportParams {
  title: string;
  year: number;
  locationName?: string;
  accounts: ChartOfAccount[];
  budgetMap: Map<string, number>;
  actualMap: Map<string, number>;
}

const fmt = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getGrouped(accounts: ChartOfAccount[]) {
  return ACCOUNT_TYPE_ORDER.map((type) => ({
    type,
    accounts: accounts.filter((a) => a.account_type === type && !a.parent_id),
  })).filter((g) => g.accounts.length > 0);
}

function getColumnTotal(
  accounts: ChartOfAccount[],
  type: AccountType,
  month: number,
  cellMap: Map<string, number>
): number {
  return accounts
    .filter((a) => a.account_type === type)
    .reduce((sum, acc) => sum + (cellMap.get(`${acc.id}-${month}`) || 0), 0);
}

function getTypeAnnualTotal(accounts: ChartOfAccount[], type: AccountType, cellMap: Map<string, number>): number {
  let total = 0;
  for (let m = 1; m <= 12; m++) total += getColumnTotal(accounts, type, m, cellMap);
  return total;
}

function getRowTotal(accountId: string, cellMap: Map<string, number>): number {
  let total = 0;
  for (let m = 1; m <= 12; m++) total += cellMap.get(`${accountId}-${m}`) || 0;
  return total;
}

const BASE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 9px; color: #0F172A; background: #fff; }
  @page { size: landscape; margin: 0.4in; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #334155; }
  .header h1 { font-size: 16px; font-weight: 700; color: #0F172A; }
  .header .meta { text-align: right; font-size: 10px; color: #64748B; }
  table { width: 100%; border-collapse: collapse; }
  th { font-weight: 600; }
  td, th { padding: 3px 6px; }
  .acct-col { text-align: left; min-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
  .num-col { text-align: right; font-variant-numeric: tabular-nums; }
  .type-header td { background: #F1F5F9; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: 8px; color: #64748B; padding: 5px 6px; }
  .subtotal td { border-top: 1px solid #CBD5E1; font-weight: 600; }
  .summary-row td { background: #F1F5F9; font-weight: 700; }
  .net-row td { background: #E2E8F0; font-weight: 700; font-size: 10px; }
  .green { color: #22c55e; }
  .red { color: #ef4444; }
  .acct-num { color: #64748B; font-family: monospace; margin-right: 4px; }
  .toolbar { text-align: center; margin-bottom: 16px; }
  .toolbar button { padding: 10px 28px; font-size: 14px; border: none; border-radius: 6px; cursor: pointer; background: #334155; color: #fff; margin: 0 6px; }
  .toolbar button.outline { background: transparent; border: 1px solid #334155; color: #334155; }
`;

function openPrintWindow(html: string) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Please allow popups to export PDF.');
    return;
  }
  w.document.write(html);
  w.document.close();
}

// ─── Budget Export ─────────────────────────────────────────────────

export function exportBudgetPdf({ title, year, locationName, accounts, cellMap }: BudgetExportParams) {
  const grouped = getGrouped(accounts);
  const hasRevenue = accounts.some((a) => a.account_type === 'Revenue');
  const hasCogs = accounts.some((a) => a.account_type === 'COGS');

  let rows = '';

  for (const { type, accounts: typeAccounts } of grouped) {
    rows += `<tr class="type-header"><td colspan="14">${type}</td></tr>`;

    for (const acc of typeAccounts) {
      const total = getRowTotal(acc.id, cellMap);
      rows += `<tr>`;
      rows += `<td class="acct-col">${acc.account_number ? `<span class="acct-num">${acc.account_number}</span>` : ''}${acc.name}</td>`;
      for (let m = 1; m <= 12; m++) {
        const val = cellMap.get(`${acc.id}-${m}`) || 0;
        rows += `<td class="num-col">${val ? fmt(val) : ''}</td>`;
      }
      rows += `<td class="num-col" style="font-weight:600">${fmt(total)}</td>`;
      rows += `</tr>`;
    }

    // Subtotal
    const annualTotal = getTypeAnnualTotal(accounts, type, cellMap);
    rows += `<tr class="subtotal"><td class="acct-col">Total ${type}</td>`;
    for (let m = 1; m <= 12; m++) {
      rows += `<td class="num-col">${fmt(getColumnTotal(accounts, type, m, cellMap))}</td>`;
    }
    rows += `<td class="num-col">${fmt(annualTotal)}</td></tr>`;
  }

  // Gross Profit
  if (hasRevenue && hasCogs) {
    rows += `<tr class="summary-row"><td class="acct-col">Gross Profit</td>`;
    for (let m = 1; m <= 12; m++) {
      const val = getColumnTotal(accounts, 'Revenue', m, cellMap) - getColumnTotal(accounts, 'COGS', m, cellMap);
      rows += `<td class="num-col ${val >= 0 ? 'green' : 'red'}">${fmt(val)}</td>`;
    }
    const gpTotal = getTypeAnnualTotal(accounts, 'Revenue', cellMap) - getTypeAnnualTotal(accounts, 'COGS', cellMap);
    rows += `<td class="num-col ${gpTotal >= 0 ? 'green' : 'red'}">${fmt(gpTotal)}</td></tr>`;
  }

  // Net Income
  rows += `<tr class="net-row"><td class="acct-col">Net Income</td>`;
  for (let m = 1; m <= 12; m++) {
    const net =
      getColumnTotal(accounts, 'Revenue', m, cellMap) -
      getColumnTotal(accounts, 'COGS', m, cellMap) -
      getColumnTotal(accounts, 'Expense', m, cellMap) -
      getColumnTotal(accounts, 'Other', m, cellMap);
    rows += `<td class="num-col ${net >= 0 ? 'green' : 'red'}">${fmt(net)}</td>`;
  }
  const netTotal =
    getTypeAnnualTotal(accounts, 'Revenue', cellMap) -
    getTypeAnnualTotal(accounts, 'COGS', cellMap) -
    getTypeAnnualTotal(accounts, 'Expense', cellMap) -
    getTypeAnnualTotal(accounts, 'Other', cellMap);
  rows += `<td class="num-col ${netTotal >= 0 ? 'green' : 'red'}">${fmt(netTotal)}</td></tr>`;

  const monthHeaders = MONTH_LABELS.map((m) => `<th class="num-col">${m}</th>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>${BASE_STYLES}</style>
<script>${closeWindowScript}</script>
</head><body>
<div class="toolbar no-print">
  <button onclick="window.print()">Print / Save as PDF</button>
  <button class="outline" onclick="closeAndReturn()">Close</button>
</div>
<div class="header">
  <h1>${title}</h1>
  <div class="meta">${locationName ? `${locationName}<br>` : ''}FY ${year}<br>${new Date().toLocaleDateString()}</div>
</div>
<table>
  <thead>
    <tr style="background:#334155;color:#fff;">
      <th class="acct-col" style="text-align:left">Account</th>
      ${monthHeaders}
      <th class="num-col">Total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

  openPrintWindow(html);
}

// ─── Actuals / Budget vs Actual Export ──────────────────────────────

export function exportActualsPdf({ title, year, locationName, accounts, budgetMap, actualMap }: ActualsExportParams) {
  const grouped = getGrouped(accounts);

  const fmtVar = (variance: number | null, isRevenue: boolean) => {
    if (variance === null) return '<span style="color:#CBD5E1">—</span>';
    const favorable = isRevenue ? variance <= 0 : variance >= 0;
    const cls = favorable ? 'green' : 'red';
    const display = variance >= 0 ? fmt(variance) : `(${fmt(Math.abs(variance))})`;
    return `<span class="${cls}">${display}</span>`;
  };

  let rows = '';

  for (const { type, accounts: typeAccounts } of grouped) {
    rows += `<tr class="type-header"><td colspan="${1 + 12 * 3}">${type}</td></tr>`;

    for (const acc of typeAccounts) {
      const isRevenue = acc.account_type === 'Revenue';
      rows += `<tr><td class="acct-col">${acc.account_number ? `<span class="acct-num">${acc.account_number}</span>` : ''}${acc.name}</td>`;
      for (let m = 1; m <= 12; m++) {
        const key = `${acc.id}-${m}`;
        const b = budgetMap.get(key) || 0;
        const a = actualMap.has(key) ? actualMap.get(key)! : null;
        const v = a !== null ? b - a : null;
        rows += `<td class="num-col">${b ? fmt(b) : ''}</td>`;
        rows += `<td class="num-col">${a !== null ? fmt(a) : '<span style="color:#CBD5E1">—</span>'}</td>`;
        rows += `<td class="num-col">${fmtVar(v, isRevenue)}</td>`;
      }
      rows += `</tr>`;
    }

    // Subtotal
    rows += `<tr class="subtotal"><td class="acct-col">Total ${type}</td>`;
    const isRevType = type === 'Revenue';
    for (let m = 1; m <= 12; m++) {
      let bTotal = 0,
        aTotal = 0,
        hasAny = false;
      for (const acc of accounts.filter((a) => a.account_type === type)) {
        const key = `${acc.id}-${m}`;
        bTotal += budgetMap.get(key) || 0;
        if (actualMap.has(key)) {
          aTotal += actualMap.get(key)!;
          hasAny = true;
        }
      }
      const v = hasAny ? bTotal - aTotal : null;
      rows += `<td class="num-col">${fmt(bTotal)}</td>`;
      rows += `<td class="num-col">${hasAny ? fmt(aTotal) : '<span style="color:#CBD5E1">—</span>'}</td>`;
      rows += `<td class="num-col">${fmtVar(v, isRevType)}</td>`;
    }
    rows += `</tr>`;
  }

  // Month sub-headers: B | A | V for each month
  const monthHeaders = MONTH_LABELS.map(
    (m) =>
      `<th colspan="3" class="num-col" style="text-align:center;border-left:1px solid rgba(255,255,255,0.2)">${m}</th>`
  ).join('');
  const subHeaders = MONTH_LABELS.map(
    () =>
      `<th class="num-col" style="font-size:7px;font-weight:400;opacity:0.8">Bud</th>` +
      `<th class="num-col" style="font-size:7px;font-weight:400;opacity:0.8">Act</th>` +
      `<th class="num-col" style="font-size:7px;font-weight:400;opacity:0.8">Var</th>`
  ).join('');

  const actualsStyles = `
    ${BASE_STYLES}
    body { font-size: 7px; }
    td, th { padding: 2px 4px; }
    .acct-col { min-width: 130px; max-width: 160px; }
  `;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>${actualsStyles}</style>
<script>${closeWindowScript}</script>
</head><body>
<div class="toolbar no-print">
  <button onclick="window.print()">Print / Save as PDF</button>
  <button class="outline" onclick="closeAndReturn()">Close</button>
</div>
<div class="header">
  <h1>${title}</h1>
  <div class="meta">${locationName ? `${locationName}<br>` : ''}FY ${year}<br>${new Date().toLocaleDateString()}</div>
</div>
<table>
  <thead>
    <tr style="background:#334155;color:#fff;">
      <th class="acct-col" style="text-align:left">Account</th>
      ${monthHeaders}
    </tr>
    <tr style="background:#1E293B;color:#fff;">
      <th></th>
      ${subHeaders}
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div style="margin-top:10px;font-size:8px;color:#64748B;display:flex;gap:16px;">
  <span><span class="green">&#9650;</span> Favorable (under budget)</span>
  <span><span class="red">&#9660;</span> Unfavorable (over budget)</span>
</div>
</body></html>`;

  openPrintWindow(html);
}
