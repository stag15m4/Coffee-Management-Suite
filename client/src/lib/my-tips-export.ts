import { escapeHtml } from '@/lib/escapeHtml';
import { closeWindowScript } from '@/components/tip-payout/export-helpers';

export interface MyTipPayout {
  week_key: string;
  approved_at: string;
  hours: string;
  payout: string;
  tenant_id: string;
}

export function buildMyTipsCsv(employeeName: string, payouts: MyTipPayout[]): string {
  let csv = `Tip Payouts: ${employeeName}\n\n`;
  csv += 'Week,Hours,Payout,Approved\n';
  for (const p of payouts) {
    csv += `"${p.week_key}",${Number(p.hours).toFixed(2)},${Number(p.payout).toFixed(2)},"${new Date(p.approved_at).toLocaleDateString()}"\n`;
  }
  const total = payouts.reduce((sum, p) => sum + Number(p.payout), 0);
  csv += `\nTotal,,${total.toFixed(2)},\n`;
  return csv;
}

export function buildMyTipsPrintHtml(employeeName: string, companyName: string, payouts: MyTipPayout[]): string {
  const total = payouts.reduce((sum, p) => sum + Number(p.payout), 0);
  const totalHours = payouts.reduce((sum, p) => sum + Number(p.hours), 0);
  const rows = payouts
    .map(
      (p) => `
      <tr>
        <td>${new Date(`${p.week_key}T00:00:00`).toLocaleDateString()}</td>
        <td>${Number(p.hours).toFixed(2)}</td>
        <td>$${Number(p.payout).toFixed(2)}</td>
        <td>${new Date(p.approved_at).toLocaleDateString()}</td>
      </tr>`
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tip Payouts - ${escapeHtml(employeeName)}</title>
      <script>${closeWindowScript}</script>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #333; }
        .button-row { display: flex; gap: 8px; margin-bottom: 20px; }
        .button { padding: 8px 16px; border-radius: 6px; border: none; background: #C9A962; color: white; cursor: pointer; font-size: 14px; }
        .button.secondary { background: #e5e5e5; color: #333; }
        h1 { font-size: 20px; margin: 0 0 2px 0; }
        h2 { font-size: 15px; color: #666; margin: 0 0 16px 0; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
        th { background: #f5f5f5; }
        tfoot td { font-weight: bold; border-top: 2px solid #ccc; border-bottom: none; }
        .note { font-size: 11px; color: #888; margin-top: 16px; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="button-row no-print">
        <button class="button secondary" onclick="closeAndReturn()">Close & Return to App</button>
        <button class="button" onclick="window.print()">Print / Save as PDF</button>
      </div>
      <h1>Tip Payouts</h1>
      <h2>${escapeHtml(employeeName)}${companyName ? ` · ${escapeHtml(companyName)}` : ''}</h2>
      <table>
        <thead><tr><th>Week</th><th>Hours</th><th>Payout</th><th>Approved</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td>Total</td><td>${totalHours.toFixed(2)}</td><td>$${total.toFixed(2)}</td><td></td></tr></tfoot>
      </table>
      <p class="note">Tip statement only. Payroll and taxes are handled in Gusto.</p>
    </body>
    </html>
  `;
}
