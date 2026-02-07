import { CC_FEE_RATE, TipEmployee } from './types';
import { formatCurrency, formatHoursMinutes, getWeekRange } from './utils';

interface WeeklyPdfParams {
  companyName: string;
  weekRange: { start: string; end: string };
  cashTotal: number;
  ccTotal: number;
  ccAfterFee: number;
  totalPool: number;
  totalTeamHours: number;
  hourlyRate: number;
  employeeHours: Record<string, number>;
}

interface HistoricalGroupParams {
  startRange: string;
  endRange: string;
  weeklyData: any[];
  hoursData: any[];
  allEmployees: TipEmployee[];
}

interface HistoricalIndividualParams {
  employeeName: string;
  startRange: string;
  endRange: string;
  weeklyData: any[];
  hoursData: any[];
  employeeId: string;
}

export function buildCsvContent(params: {
  weekRange: { start: string; end: string };
  employeeHours: Record<string, number>;
  hourlyRate: number;
  totalPool: number;
}): string {
  const { weekRange, employeeHours, hourlyRate, totalPool } = params;
  let csv = `Week: ${weekRange.start} - ${weekRange.end}\n\n`;
  csv += "Employee,Hours,Hourly Rate,Payout\n";

  Object.entries(employeeHours)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, hours]) => {
      csv += `"${name}","${formatHoursMinutes(hours)}",${hourlyRate.toFixed(2)},${(hours * hourlyRate).toFixed(2)}\n`;
    });

  csv += `\nTotal Tip Pool,,,${totalPool.toFixed(2)}\n`;
  return csv;
}

const pdfBaseStyles = `
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
    background-color: #4A3728;
    color: #FFFFFF;
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
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page-break { page-break-before: always; margin-top: 0; }
    .no-print { display: none !important; }
  }
`;

export function buildWeeklyPdfHtml(params: WeeklyPdfParams): string {
  const {
    companyName, weekRange, cashTotal, ccTotal, ccAfterFee,
    totalPool, totalTeamHours, hourlyRate, employeeHours,
  } = params;

  const sortedEmployees = Object.entries(employeeHours).sort(([a], [b]) => a.localeCompare(b));

  const individualPaystubs = sortedEmployees.map(([name, hours]) => {
    const payout = hours * hourlyRate;
    return `
      <div class="page-break"></div>
      <div class="container paystub">
        <div class="header">
          <h1>${companyName}</h1>
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

      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${companyName} - Weekly Tip Payout Summary</title>
      <style>${pdfBaseStyles}</style>
    </head>
    <body>
      <div class="button-row no-print">
        <button class="button secondary" onclick="window.close()">Close & Return to App</button>
        <button class="button" onclick="window.print()">Print / Save as PDF</button>
      </div>
      <div class="container">
        <div class="header">
          <h1>${companyName}</h1>
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
}

const historicalBaseStyles = `
  @media print {
    .no-print { display: none !important; }
    body { padding: 0; margin: 0; }
    .container { border: none !important; box-shadow: none !important; }
  }
  body {
    font-family: Arial, sans-serif;
    padding: 20px;
    color: #2C2416;
    max-width: 900px;
    margin: 0 auto;
  }
  .container {
    border: 1px solid #D4A84B;
    border-radius: 12px;
    padding: 30px;
    background: #FFFFFF;
  }
  h1 { color: #2C2416; margin-bottom: 5px; text-align: center; }
  h2 { color: #2C2416; margin-top: 0; text-align: center; font-size: 16px; font-weight: normal; }
  .date-range { text-align: center; color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th {
    background: #D4A84B;
    color: #2C2416;
    padding: 10px;
    text-align: left;
    font-weight: bold;
  }
  td {
    padding: 10px;
    border-bottom: 1px solid #eee;
  }
  tr:nth-child(even) { background: #FDF8F0; }
  .total-row {
    background: #2C2416 !important;
    color: white;
    font-weight: bold;
  }
  .total-row td { border-bottom: none; }
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
    background-color: #D4A84B;
    color: #2C2416;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    font-size: 14px;
  }
  .button:hover { background-color: #c49a42; }
  .button.secondary {
    background-color: #f5f5f5;
    border: 1px solid #ddd;
  }
  .button.secondary:hover { background-color: #e5e5e5; }
  .summary-box {
    background: #FDF8F0;
    border: 1px solid #D4A84B;
    border-radius: 8px;
    padding: 15px;
    margin: 20px 0;
    text-align: center;
  }
  .summary-box h3 { margin: 0 0 10px 0; color: #2C2416; }
  .summary-value { font-size: 24px; font-weight: bold; color: #D4A84B; }
`;

export function buildHistoricalGroupHtml(params: HistoricalGroupParams): string {
  const { startRange, endRange, weeklyData, hoursData, allEmployees } = params;

  let grandTotalPayout = 0;
  let grandTotalHours = 0;
  let tableRows = '';

  const employeeTotals: Record<string, { name: string; hours: number; payout: number; isActive: boolean }> = {};

  weeklyData.forEach((week: any) => {
    const weekHours = hoursData?.filter((h: any) => h.week_key === week.week_key) || [];
    const totalHours = weekHours.reduce((sum: number, h: any) => sum + (parseFloat(h.hours) || 0), 0);
    const ccAfter = week.cc_tips * (1 - CC_FEE_RATE);
    const pool = week.cash_tips + ccAfter;
    const rate = totalHours > 0 ? pool / totalHours : 0;
    const weekRange = getWeekRange(week.week_key);

    weekHours.forEach((h: any) => {
      const hours = parseFloat(h.hours) || 0;
      const payout = hours * rate;
      grandTotalPayout += payout;
      grandTotalHours += hours;

      const empId = h.tip_employees?.id || 'unknown';
      const empName = h.tip_employees?.name || 'Unknown';
      const empRecord = allEmployees.find(e => e.id === empId);
      const isActive = empRecord?.is_active !== false;

      if (!employeeTotals[empId]) {
        employeeTotals[empId] = { name: empName, hours: 0, payout: 0, isActive };
      }
      employeeTotals[empId].hours += hours;
      employeeTotals[empId].payout += payout;

      tableRows += `
        <tr>
          <td>${weekRange.start} - ${weekRange.end}</td>
          <td>${h.tip_employees?.name || 'Unknown'}</td>
          <td>${hours.toFixed(2)}</td>
          <td>$${rate.toFixed(2)}</td>
          <td>$${payout.toFixed(2)}</td>
        </tr>
      `;
    });
  });

  const sortedEmployees = Object.values(employeeTotals).sort((a, b) => b.payout - a.payout);
  let employeeSummaryRows = '';
  sortedEmployees.forEach(emp => {
    const statusBadge = emp.isActive
      ? ''
      : '<span style="background: #f0f0f0; color: #666; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">Inactive</span>';
    employeeSummaryRows += `
      <tr>
        <td>${emp.name}${statusBadge}</td>
        <td>${emp.hours.toFixed(2)}</td>
        <td>$${emp.payout.toFixed(2)}</td>
      </tr>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tip Payout History Report</title>
      <style>
        ${historicalBaseStyles}
        .page-break { page-break-after: always; }
        .summary-section { margin-bottom: 30px; }
        .section-title {
          font-size: 18px;
          font-weight: bold;
          color: #2C2416;
          margin: 30px 0 15px 0;
          border-bottom: 2px solid #D4A84B;
          padding-bottom: 5px;
        }
      </style>
    </head>
    <body>
      <div class="button-row no-print">
        <button class="button secondary" onclick="window.close()">Close & Return to App</button>
        <button class="button" onclick="window.print()">Print / Save as PDF</button>
      </div>

      <!-- SUMMARY PAGE -->
      <div class="container page-break">
        <h1>Tip Payout Summary</h1>
        <h2>All Employees</h2>
        <p class="date-range">${startRange} - ${endRange}</p>

        <div class="summary-box">
          <h3>Grand Total Payouts</h3>
          <div class="summary-value">$${grandTotalPayout.toFixed(2)}</div>
          <p style="margin: 10px 0 0 0; color: #666;">${grandTotalHours.toFixed(2)} total hours across ${weeklyData.length} weeks</p>
        </div>

        <div class="section-title">Payout by Employee</div>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Total Hours</th>
              <th>Total Payout</th>
            </tr>
          </thead>
          <tbody>
            ${employeeSummaryRows}
            <tr class="total-row">
              <td>GRAND TOTAL</td>
              <td>${grandTotalHours.toFixed(2)}</td>
              <td>$${grandTotalPayout.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- DETAILED BREAKDOWN PAGE -->
      <div class="container">
        <h1>Detailed Weekly Breakdown</h1>
        <p class="date-range">${startRange} - ${endRange}</p>

        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Employee</th>
              <th>Hours</th>
              <th>Rate</th>
              <th>Payout</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="total-row">
              <td colspan="2">GRAND TOTAL</td>
              <td>${grandTotalHours.toFixed(2)}</td>
              <td></td>
              <td>$${grandTotalPayout.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;
}

export function buildHistoricalIndividualHtml(params: HistoricalIndividualParams): string {
  const { employeeName, startRange, endRange, weeklyData, hoursData, employeeId } = params;

  const employeeHoursFiltered = hoursData?.filter((h: any) => h.tip_employees?.id === employeeId) || [];

  let totalEarnings = 0;
  let totalHoursWorked = 0;
  let tableRows = '';

  weeklyData.forEach((week: any) => {
    const empHour = employeeHoursFiltered.find((h: any) => h.week_key === week.week_key);
    if (!empHour) return;

    const weekHours = hoursData?.filter((h: any) => h.week_key === week.week_key) || [];
    const totalTeamHrs = weekHours.reduce((sum: number, h: any) => sum + (parseFloat(h.hours) || 0), 0);
    const ccAfter = week.cc_tips * (1 - CC_FEE_RATE);
    const pool = week.cash_tips + ccAfter;
    const rate = totalTeamHrs > 0 ? pool / totalTeamHrs : 0;
    const weekRange = getWeekRange(week.week_key);

    const hours = parseFloat(empHour.hours) || 0;
    const payout = hours * rate;
    totalEarnings += payout;
    totalHoursWorked += hours;

    tableRows += `
      <tr>
        <td>${weekRange.start} - ${weekRange.end}</td>
        <td>${hours.toFixed(2)}</td>
        <td>$${rate.toFixed(2)}</td>
        <td>$${payout.toFixed(2)}</td>
      </tr>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tip Payout History - ${employeeName}</title>
      <style>${historicalBaseStyles}</style>
    </head>
    <body>
      <div class="button-row no-print">
        <button class="button secondary" onclick="window.close()">Close & Return to App</button>
        <button class="button" onclick="window.print()">Print / Save as PDF</button>
      </div>
      <div class="container">
        <h1>Tip Payout History</h1>
        <h2>${employeeName}</h2>
        <p class="date-range">${startRange} - ${endRange}</p>

        <div class="summary-box">
          <h3>Total Earnings</h3>
          <div class="summary-value">$${totalEarnings.toFixed(2)}</div>
          <p style="margin: 10px 0 0 0; color: #666;">${totalHoursWorked.toFixed(2)} hours worked</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Hours</th>
              <th>Rate</th>
              <th>Payout</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="total-row">
              <td>TOTAL</td>
              <td>${totalHoursWorked.toFixed(2)}</td>
              <td></td>
              <td>$${totalEarnings.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;
}

export function buildLoadingHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Loading...</title>
      <style>
        @keyframes stir {
          0%, 100% { transform: rotate(-8deg); }
          50% { transform: rotate(8deg); }
        }
        @keyframes steam {
          0% { opacity: 0; transform: translateY(0); }
          50% { opacity: 0.6; }
          100% { opacity: 0; transform: translateY(-10px); }
        }
        body {
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #F5F0E1;
          font-family: Arial, sans-serif;
        }
        .loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .loader p {
          font-size: 14px;
          font-weight: 500;
          color: #4A3728;
          margin: 0;
        }
        .stir { animation: stir 1.4s ease-in-out infinite; transform-origin: 36px 31px; }
        .steam-1 { animation: steam 2s ease-out infinite; }
        .steam-2 { animation: steam 2s ease-out 0.5s infinite; }
        .steam-3 { animation: steam 2s ease-out 1s infinite; }
      </style>
    </head>
    <body>
      <div class="loader">
        <svg width="72" height="72" viewBox="0 0 80 80" fill="none">
          <ellipse cx="36" cy="68" rx="28" ry="5" fill="#E8E0CC" stroke="#D4C9A8" stroke-width="1"/>
          <path d="M 18 30 L 21 63 Q 36 68 51 63 L 54 30" fill="#FFFDF7" stroke="#D4C9A8" stroke-width="1.2" stroke-linejoin="round"/>
          <path d="M 54 36 C 64 36 67 48 67 48 C 67 48 64 60 54 58" fill="none" stroke="#D4C9A8" stroke-width="3" stroke-linecap="round"/>
          <ellipse cx="36" cy="30" rx="18" ry="6.5" fill="#FFFDF7" stroke="#D4C9A8" stroke-width="1.2"/>
          <ellipse cx="36" cy="31" rx="15.5" ry="5" fill="#5C3D2E"/>
          <ellipse cx="31" cy="30" rx="5" ry="2" fill="#7A5440" opacity="0.5"/>
          <g class="stir">
            <line x1="36" y1="31" x2="52" y2="15" stroke="#C9A227" stroke-width="2.2" stroke-linecap="round"/>
            <ellipse cx="53.5" cy="13.5" rx="3.2" ry="2" fill="#C9A227" stroke="#B8911F" stroke-width="0.6" transform="rotate(-45 53.5 13.5)"/>
          </g>
          <path class="steam-1" d="M 28 24 Q 26 18 28 12 Q 30 6 28 2" stroke="#C9A227" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0"/>
          <path class="steam-2" d="M 36 22 Q 38 16 36 10 Q 34 4 36 0" stroke="#C9A227" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0"/>
          <path class="steam-3" d="M 44 24 Q 46 18 44 12 Q 42 6 44 2" stroke="#C9A227" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0"/>
        </svg>
        <p>Loading historical data...</p>
      </div>
    </body>
    </html>
  `;
}
