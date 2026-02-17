import { colors } from '@/lib/colors';
import {
  supabase,
  type Equipment,
  type MaintenanceTask,
} from '@/lib/supabase-queries';

// ── Vehicle helpers ──────────────────────────────────────────────

export function isVehicle(category: string | null | undefined): boolean {
  const c = (category || '').toLowerCase().trim();
  return c === 'vehicle' || c === 'vehicles' || c.includes('vehicle');
}

// ── Task status helpers ──────────────────────────────────────────

export type TaskStatus = 'overdue' | 'due-soon' | 'good';

export function getTaskStatus(task: MaintenanceTask): TaskStatus {
  if (task.interval_type === 'time') {
    if (!task.next_due_at) return 'good';
    const now = new Date();
    const dueDate = new Date(task.next_due_at);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 7) return 'due-soon';
    return 'good';
  } else {
    if (!task.interval_units) return 'good';
    const remaining = task.interval_units - (task.current_usage || 0);
    const percentUsed = (task.current_usage || 0) / task.interval_units;

    if (remaining <= 0) return 'overdue';
    if (percentUsed >= 0.9) return 'due-soon';
    return 'good';
  }
}

export function getStatusColor(status: TaskStatus) {
  switch (status) {
    case 'overdue': return colors.red;
    case 'due-soon': return colors.yellow;
    case 'good': return colors.green;
  }
}

export function getStatusLabel(status: TaskStatus) {
  switch (status) {
    case 'overdue': return 'Overdue';
    case 'due-soon': return 'Due Soon';
    case 'good': return 'Good';
  }
}

export function formatDueInfo(task: MaintenanceTask): string {
  if (task.interval_type === 'time') {
    if (!task.next_due_at) return 'Not scheduled';
    const dueDate = new Date(task.next_due_at);
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} days overdue`;
    if (daysUntilDue === 0) return 'Due today';
    if (daysUntilDue === 1) return 'Due tomorrow';
    return `Due in ${daysUntilDue} days`;
  } else {
    if (!task.interval_units) return 'No interval set';
    const remaining = task.interval_units - (task.current_usage || 0);
    if (remaining <= 0) return `${Math.abs(remaining)} ${task.usage_unit_label || 'units'} overdue`;
    return `${remaining} ${task.usage_unit_label || 'units'} remaining`;
  }
}

// ── Date helpers ─────────────────────────────────────────────────

// Parse a date-only string (e.g. "2026-01-20") as local time instead of UTC.
// new Date("2026-01-20") treats it as midnight UTC, which rolls back a day in US timezones.
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr.replace(/-/g, '/'));
}

function formatDateForCalendar(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// ── Warranty helpers ─────────────────────────────────────────────

export type WarrantyStatus = 'covered' | 'expired' | 'none';

export function getWarrantyStatus(equipment: Equipment): WarrantyStatus {
  if (!equipment.has_warranty) return 'none';
  if (!equipment.purchase_date || !equipment.warranty_duration_months) return 'none';

  const purchaseDate = parseLocalDate(equipment.purchase_date);
  const expirationDate = new Date(purchaseDate);
  expirationDate.setMonth(expirationDate.getMonth() + equipment.warranty_duration_months);

  const now = new Date();
  return now <= expirationDate ? 'covered' : 'expired';
}

export function getWarrantyExpirationDate(equipment: Equipment): Date | null {
  if (!equipment.has_warranty || !equipment.purchase_date || !equipment.warranty_duration_months) return null;

  const purchaseDate = parseLocalDate(equipment.purchase_date);
  const expirationDate = new Date(purchaseDate);
  expirationDate.setMonth(expirationDate.getMonth() + equipment.warranty_duration_months);
  return expirationDate;
}

export function formatWarrantyInfo(equipment: Equipment): string {
  const status = getWarrantyStatus(equipment);
  if (status === 'none') return '';

  const expiration = getWarrantyExpirationDate(equipment);
  if (!expiration) return '';

  const now = new Date();
  if (status === 'covered') {
    const monthsRemaining = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return `Expires ${expiration.toLocaleDateString()} (~${monthsRemaining} mo)`;
  } else {
    return `Expired ${expiration.toLocaleDateString()}`;
  }
}

// ── Calendar helpers ─────────────────────────────────────────────

export function generateGoogleCalendarUrl(task: MaintenanceTask, equipmentName: string): string {
  if (!task.next_due_at) return '';

  const startDate = new Date(task.next_due_at);
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 1);

  const title = encodeURIComponent(`${task.name} - ${equipmentName}`);
  const details = encodeURIComponent(
    `Maintenance Task: ${task.name}\nEquipment: ${equipmentName}${task.description ? `\n\nDescription: ${task.description}` : ''}\n\nInterval: Every ${task.interval_days} days`
  );
  const dates = `${formatDateForCalendar(startDate)}/${formatDateForCalendar(endDate)}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
}

export function generateOutlookCalendarUrl(task: MaintenanceTask, equipmentName: string): string {
  if (!task.next_due_at) return '';

  const startDate = new Date(task.next_due_at);
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 1);

  const title = encodeURIComponent(`${task.name} - ${equipmentName}`);
  const body = encodeURIComponent(
    `Maintenance Task: ${task.name}\nEquipment: ${equipmentName}${task.description ? `\n\nDescription: ${task.description}` : ''}\n\nInterval: Every ${task.interval_days || 'N/A'} days`
  );

  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${body}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}`;
}

export function downloadICalFile(task: MaintenanceTask, equipmentName: string): void {
  if (!task.next_due_at) return;

  const startDate = new Date(task.next_due_at);
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 1);

  const title = `${task.name} - ${equipmentName}`;
  const description = `Maintenance Task: ${task.name}\\nEquipment: ${equipmentName}${task.description ? `\\n\\nDescription: ${task.description}` : ''}\\n\\nInterval: Every ${task.interval_days || 'N/A'} days`;

  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Erwin Mills CMS//Equipment Maintenance//EN',
    'BEGIN:VEVENT',
    `UID:${task.id}@erwinmills.cms`,
    `DTSTAMP:${formatDateForCalendar(new Date())}`,
    `DTSTART:${formatDateForCalendar(startDate)}`,
    `DTEND:${formatDateForCalendar(endDate)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${task.name.replace(/[^a-z0-9]/gi, '_')}_maintenance.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Equipment list CSV export (for accountant) ──────────────────

export function exportEquipmentListCSV(equipmentList: Equipment[]): void {
  const headers = [
    'Name',
    'Category',
    'Model',
    'Serial Number',
    'In Service Date',
    'Purchase Date',
    'Warranty (months)',
    'Warranty Expiration',
    'Warranty Status',
    'Warranty Notes',
    'Notes',
    'License Plate',
    'VIN',
    'Date Added',
  ];

  const rows = [...equipmentList]
    .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name))
    .map((eq) => {
      const wStatus = getWarrantyStatus(eq);
      const wExpiration = getWarrantyExpirationDate(eq);
      return [
        eq.name,
        eq.category || '',
        eq.model || '',
        eq.serial_number || '',
        eq.in_service_date ? parseLocalDate(eq.in_service_date).toLocaleDateString() : '',
        eq.purchase_date ? parseLocalDate(eq.purchase_date).toLocaleDateString() : '',
        eq.warranty_duration_months != null ? String(eq.warranty_duration_months) : '',
        wExpiration ? wExpiration.toLocaleDateString() : '',
        wStatus === 'covered' ? 'Active' : wStatus === 'expired' ? 'Expired' : '',
        eq.warranty_notes || '',
        eq.notes || '',
        eq.license_plate ? `${eq.license_state ? eq.license_state + ' ' : ''}${eq.license_plate}` : '',
        eq.vin || '',
        new Date(eq.created_at).toLocaleDateString(),
      ];
    });

  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `equipment-list-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Equipment list PDF/print export (for accountant) ─────────────

export function exportEquipmentListPDF(equipmentList: Equipment[], businessName?: string): void {
  const sorted = [...equipmentList].sort(
    (a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name),
  );

  // Group by category
  const grouped = new Map<string, Equipment[]>();
  for (const eq of sorted) {
    const cat = eq.category || 'Uncategorized';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(eq);
  }

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const buildCard = (eq: Equipment) => {
    const wStatus = getWarrantyStatus(eq);
    const wExpiration = getWarrantyExpirationDate(eq);
    const inService = eq.in_service_date ? parseLocalDate(eq.in_service_date).toLocaleDateString() : '—';
    const purchased = eq.purchase_date ? parseLocalDate(eq.purchase_date).toLocaleDateString() : '—';
    const warrantyCell =
      wStatus === 'covered'
        ? `<span class="warranty-covered">Active</span> (exp ${wExpiration!.toLocaleDateString()})`
        : wStatus === 'expired'
          ? `<span class="warranty-expired">Expired</span> ${wExpiration ? wExpiration.toLocaleDateString() : ''}`
          : '—';
    const vehicleInfo =
      isVehicle(eq.category) && (eq.license_plate || eq.vin)
        ? `<div class="detail-line">${eq.license_plate ? `Plate: ${eq.license_state ? eq.license_state + ' ' : ''}${esc(eq.license_plate)}` : ''}${eq.license_plate && eq.vin ? ' &nbsp;|&nbsp; ' : ''}${eq.vin ? `VIN: ${esc(eq.vin)}` : ''}</div>`
        : '';
    const modelSerial =
      !isVehicle(eq.category) && (eq.model || eq.serial_number)
        ? `<div class="detail-line">${eq.model ? `Model: ${esc(eq.model)}` : ''}${eq.model && eq.serial_number ? ' &nbsp;|&nbsp; ' : ''}${eq.serial_number ? `S/N: ${esc(eq.serial_number)}` : ''}</div>`
        : '';
    const notesLine = eq.notes ? `<div class="detail-line">${esc(eq.notes)}</div>` : '';
    const warrantyNotesLine = eq.warranty_notes ? `<div class="detail-line" style="font-style:italic;">${esc(eq.warranty_notes)}</div>` : '';

    return `
      <div class="eq-card">
        <div class="eq-name">
          <strong>${esc(eq.name)}</strong>
          ${modelSerial}${vehicleInfo}${notesLine}${warrantyNotesLine}
        </div>
        <div class="eq-fields">
          <span>In Service: ${inService}</span>
          <span>Purchased: ${purchased}</span>
          <span>Warranty: ${warrantyCell}</span>
        </div>
      </div>
    `;
  };

  let content = '';
  Array.from(grouped.entries()).forEach(([category, items]) => {
    content += `
      <div class="category-header">${esc(category)} (${items.length})</div>
      ${items.map(buildCard).join('')}
    `;
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Equipment List</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #4A3728; max-width: 900px; margin: 0 auto; }
        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background-color: #C9A227;
          color: #4A3728;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin-bottom: 20px;
          cursor: pointer;
          border: none;
          font-size: 14px;
        }
        .back-button:hover { background-color: #b8911f; }
        @media print { .back-button, .no-print { display: none !important; } }
        .page {
          border: 1px solid #C9A227;
          border-radius: 8px;
          padding: 25px;
          background: #FFFDF7;
          margin-bottom: 30px;
        }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 24px; color: #4A3728; }
        .header p { margin: 5px 0; font-size: 14px; color: #6B5344; }
        .category-header {
          background-color: #F5F0E1;
          font-weight: bold;
          font-size: 14px;
          color: #4A3728;
          padding: 10px 8px;
          border-bottom: 2px solid #C9A227;
          margin-top: 18px;
        }
        .category-header:first-child { margin-top: 0; }
        .eq-card {
          padding: 10px 8px;
          border-bottom: 1px solid #E8E0CC;
          page-break-inside: avoid;
          break-inside: avoid;
          -webkit-column-break-inside: avoid;
        }
        .eq-name { font-size: 13px; }
        .eq-fields {
          display: flex;
          gap: 20px;
          margin-top: 4px;
          font-size: 12px;
          color: #6B5344;
        }
        .detail-line { font-size: 11px; color: #6B5344; margin-top: 2px; }
        .warranty-covered {
          background: #22c55e; color: white;
          padding: 1px 6px; border-radius: 3px;
          font-size: 11px; font-weight: bold;
        }
        .warranty-expired {
          background: #ef4444; color: white;
          padding: 1px 6px; border-radius: 3px;
          font-size: 11px;
        }
        .summary-box {
          background: #F5F0E1;
          padding: 20px;
          border-radius: 8px;
          margin-top: 20px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .summary-box h2 { margin: 0 0 15px 0; font-size: 18px; color: #C9A227; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; }
        .summary-item { font-size: 14px; color: #6B5344; }
        .summary-item strong { display: block; font-size: 20px; color: #4A3728; margin-bottom: 5px; }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; padding: 0; }
          .page { border: none; box-shadow: none; margin-bottom: 0; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px;">
        <button class="back-button" onclick="window.close()">Close & Return to App</button>
        <button class="back-button" onclick="window.print()" style="margin-left: 10px;">Print / Save as PDF</button>
      </div>

      <div class="page">
        <div class="header">
          ${businessName ? `<h2 style="margin: 0 0 5px 0; font-size: 18px; color: #6B5344; font-weight: normal;">${esc(businessName)}</h2>` : ''}
          <h1>Equipment List</h1>
          <p>Exported: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
          <p>${sorted.length} items</p>
        </div>

        ${content}

        <div class="summary-box">
          <h2>Summary</h2>
          <div class="summary-grid">
            <div class="summary-item">
              <strong>${sorted.length}</strong>
              Total Equipment
            </div>
            <div class="summary-item">
              <strong>${sorted.filter((eq) => getWarrantyStatus(eq) === 'covered').length}</strong>
              Under Warranty
            </div>
            <div class="summary-item">
              <strong>${sorted.filter((eq) => getWarrantyStatus(eq) === 'expired').length}</strong>
              Warranty Expired
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to view the equipment list.');
    return;
  }
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

// ── Equipment record export ──────────────────────────────────────

export async function exportEquipmentRecords(
  equipment: Equipment,
  supabaseClient: typeof supabase
): Promise<void> {
  // Open the window FIRST before async calls to avoid popup blocker
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to download the equipment record.');
    return;
  }

  // Show loading state (hidden when printing)
  printWindow.document.write(`
    <html>
    <head>
      <title>Loading Equipment Record...</title>
      <style>@media print { .loading-state { display: none !important; } }</style>
    </head>
    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;" class="loading-state">
      <h2>Generating Maintenance Record</h2>
      <p>Loading all maintenance history for ${equipment.name}...</p>
      <p style="color: #6B5344; font-size: 14px;">Please wait...</p>
    </body>
    </html>
  `);

  // Fetch ALL maintenance tasks for this equipment (including inactive for complete history)
  const { data: equipmentTasks } = await supabaseClient
    .from('maintenance_tasks')
    .select('*')
    .eq('equipment_id', equipment.id)
    .order('created_at', { ascending: true });

  const allTasks = (equipmentTasks || []) as MaintenanceTask[];

  // Fetch all maintenance logs for all tasks of this equipment
  const taskLogs: { task: MaintenanceTask; logs: any[] }[] = [];
  for (const task of allTasks) {
    const { data: logs } = await supabaseClient
      .from('maintenance_logs')
      .select('*')
      .eq('task_id', task.id)
      .order('completed_at', { ascending: false });
    taskLogs.push({ task, logs: logs || [] });
  }

  // Calculate total maintenance costs
  let totalCost = 0;
  taskLogs.forEach(({ logs }) => {
    logs.forEach(log => {
      if (log.cost) totalCost += Number(log.cost);
    });
  });

  // Build PDF content
  const warrantyStatus = getWarrantyStatus(equipment);
  const warrantyExpiration = getWarrantyExpirationDate(equipment);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Equipment Maintenance Record - ${equipment.name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #4A3728; max-width: 800px; margin: 0 auto; }
        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background-color: #C9A227;
          color: #4A3728;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin-bottom: 20px;
          cursor: pointer;
          border: none;
          font-size: 14px;
        }
        .back-button:hover { background-color: #b8911f; }
        @media print { .back-button, .no-print { display: none !important; } }
        .page {
          border: 1px solid #C9A227;
          border-radius: 8px;
          padding: 25px;
          background: #FFFDF7;
          margin-bottom: 30px;
        }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 24px; color: #4A3728; }
        .header h2 { margin: 5px 0; font-size: 18px; font-weight: normal; color: #6B5344; }
        .header p { margin: 5px 0; font-size: 14px; color: #6B5344; }
        .section-title {
          font-size: 16px;
          font-weight: bold;
          color: #C9A227;
          margin: 25px 0 15px;
          padding-bottom: 5px;
          border-bottom: 1px solid #E8E0CC;
        }
        .info-grid { display: grid; grid-template-columns: 150px 1fr; gap: 8px; margin: 15px 0; }
        .info-label { font-weight: bold; color: #6B5344; font-size: 14px; }
        .info-value { color: #4A3728; font-size: 14px; }
        .warranty-covered { background: #C9A227; color: #4A3728; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .warranty-expired { background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .task-card { background: #F5F0E1; padding: 15px; margin: 15px 0; border-radius: 8px; }
        .task-card h3 { margin: 0 0 10px 0; color: #4A3728; font-size: 16px; }
        .no-logs { color: #6B5344; font-style: italic; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background-color: #C9A227; color: #4A3728; padding: 12px 10px; text-align: left; font-weight: bold; }
        td { padding: 10px; border-bottom: 1px solid #E8E0CC; }
        .summary-box {
          background: #F5F0E1;
          padding: 20px;
          border-radius: 8px;
          margin-top: 20px;
        }
        .summary-box h2 { margin: 0 0 15px 0; font-size: 18px; color: #C9A227; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; }
        .summary-item { font-size: 14px; color: #6B5344; }
        .summary-item strong { display: block; font-size: 20px; color: #4A3728; margin-bottom: 5px; }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; padding: 0; }
          .page { border: none; box-shadow: none; margin-bottom: 0; }
          .task-card { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px;">
        <button class="back-button" onclick="window.close()">
          Close & Return to App
        </button>
        <button class="back-button" onclick="window.print()" style="margin-left: 10px;">
          Print / Save as PDF
        </button>
      </div>

      <div class="page">
        <div class="header">
          <h1>Equipment Maintenance Record</h1>
          <h2>${equipment.name}</h2>
          <p>Exported: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
        </div>

      ${equipment.photo_url ? `
      <div style="margin-bottom: 15px;">
        <img src="${equipment.photo_url}" alt="${equipment.name}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; border: 2px solid #E8E0CC;" />
      </div>
      ` : ''}

      <div class="section-title">Equipment Information</div>
        <div class="info-grid">
          <span class="info-label">Name:</span>
          <span class="info-value">${equipment.name}</span>

          ${equipment.category ? `
          <span class="info-label">Category:</span>
          <span class="info-value">${equipment.category}</span>
          ` : ''}

          ${!isVehicle(equipment.category) && equipment.model ? `
          <span class="info-label">Model:</span>
          <span class="info-value">${equipment.model}</span>
          ` : ''}

          ${!isVehicle(equipment.category) && equipment.serial_number ? `
          <span class="info-label">Serial Number:</span>
          <span class="info-value">${equipment.serial_number}</span>
          ` : ''}

          ${equipment.notes ? `
          <span class="info-label">Notes:</span>
          <span class="info-value">${equipment.notes}</span>
          ` : ''}

          ${isVehicle(equipment.category) && equipment.license_plate ? `
          <span class="info-label">License Plate:</span>
          <span class="info-value">${equipment.license_state ? equipment.license_state + ' ' : ''}${equipment.license_plate}</span>
          ` : ''}

          ${isVehicle(equipment.category) && equipment.vin ? `
          <span class="info-label">VIN:</span>
          <span class="info-value">${equipment.vin}</span>
          ` : ''}

          <span class="info-label">Added:</span>
          <span class="info-value">${new Date(equipment.created_at).toLocaleDateString()}</span>

          ${equipment.in_service_date && !equipment.has_warranty ? `
          <span class="info-label">In Service:</span>
          <span class="info-value">${parseLocalDate(equipment.in_service_date).toLocaleDateString()}</span>
          ` : ''}
        </div>

        ${equipment.has_warranty ? `
        <div class="section-title">Warranty Information</div>
        <div class="info-grid">
          <span class="info-label">Status:</span>
          <span class="info-value">
            <span class="${warrantyStatus === 'covered' ? 'warranty-covered' : 'warranty-expired'}">
              ${warrantyStatus === 'covered' ? 'Under Warranty' : 'Warranty Expired'}
            </span>
          </span>

          <span class="info-label">Purchase Date:</span>
          <span class="info-value">${equipment.purchase_date ? parseLocalDate(equipment.purchase_date).toLocaleDateString() : 'N/A'}</span>

          <span class="info-label">In Service:</span>
          <span class="info-value">${parseLocalDate(equipment.in_service_date || equipment.purchase_date || '').toLocaleDateString()}</span>

          <span class="info-label">Duration:</span>
          <span class="info-value">${equipment.warranty_duration_months} months</span>

          <span class="info-label">Expiration:</span>
          <span class="info-value">${warrantyExpiration ? warrantyExpiration.toLocaleDateString() : 'N/A'}</span>

          ${equipment.warranty_notes ? `
          <span class="info-label">Warranty Notes:</span>
          <span class="info-value">${equipment.warranty_notes}</span>
          ` : ''}
        </div>
        ` : ''}

        <div class="section-title">Maintenance Tasks (${allTasks.length})</div>
        ${taskLogs.length === 0 ? '<p class="no-logs">No maintenance tasks configured.</p>' : ''}

        ${taskLogs.map(({ task, logs }) => `
          <div class="task-card">
            <h3>${task.name}</h3>
            ${task.description ? `<p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">${task.description}</p>` : ''}
            <div class="info-grid">
              <span class="info-label">Type:</span>
              <span class="info-value">${task.interval_type === 'time' ?
                `Every ${task.interval_days} days` :
                `Every ${task.interval_units} ${task.usage_unit_label || 'units'}`
              }</span>

              ${task.estimated_cost ? `
              <span class="info-label">Est. Cost:</span>
              <span class="info-value">$${Number(task.estimated_cost).toFixed(2)}</span>
              ` : ''}

              <span class="info-label">Last Serviced:</span>
              <span class="info-value">${task.last_completed_at ? new Date(task.last_completed_at).toLocaleDateString() : 'Never'}</span>
            </div>

            <div style="font-weight: bold; margin-top: 15px; color: #C9A227;">Service History (${logs.length} entries)</div>
            ${logs.length === 0 ? '<p class="no-logs">No service records yet.</p>' : `
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Completed By</th>
                  <th>Notes</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                ${logs.map(log => `
                  <tr>
                    <td>${new Date(log.completed_at).toLocaleDateString()}</td>
                    <td>${log.completed_by || '-'}</td>
                    <td>${log.notes || '-'}</td>
                    <td style="color: #C9A227; font-weight: bold;">${log.cost ? '$' + Number(log.cost).toFixed(2) : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
          </table>
          `}
        </div>
      `).join('')}

      <div class="summary-box">
          <h2>Maintenance Summary</h2>
          <div class="summary-grid">
            <div class="summary-item">
              <strong>${allTasks.length}</strong>
              Total Tasks
            </div>
            <div class="summary-item">
              <strong>${taskLogs.reduce((sum, { logs }) => sum + logs.length, 0)}</strong>
              Service Entries
            </div>
            <div class="summary-item">
              <strong style="color: #C9A227;">$${totalCost.toFixed(2)}</strong>
              Total Cost
            </div>
          </div>
        </div>
      </div>

    </body>
    </html>
  `;

  // Clear loading state and write final content
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
