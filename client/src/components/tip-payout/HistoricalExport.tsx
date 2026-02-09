import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, History } from 'lucide-react';
import { TipEmployee, Colors, isEmployeeActive } from './types';

interface HistoricalExportProps {
  colors: Colors;
  allEmployees: TipEmployee[];
  employees: TipEmployee[];
  historyStartDate: string;
  historyEndDate: string;
  historyExportType: 'group' | 'individual';
  historySelectedEmployee: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onExportTypeChange: (value: 'group' | 'individual') => void;
  onSelectedEmployeeChange: (value: string) => void;
  onExportHistorical: () => void;
  exportingHistory: boolean;
}

export function HistoricalExport({
  colors,
  allEmployees,
  employees,
  historyStartDate,
  historyEndDate,
  historyExportType,
  historySelectedEmployee,
  onStartDateChange,
  onEndDateChange,
  onExportTypeChange,
  onSelectedEmployeeChange,
  onExportHistorical,
  exportingHistory,
}: HistoricalExportProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3" style={{ color: colors.brown }}>
        <History className="w-5 h-5" />
        <h3 className="font-semibold text-lg">Historical Export</h3>
      </div>
      <p className="text-sm mb-3" style={{ color: colors.brownLight }}>
        Export tip payout history for payroll or audit purposes
      </p>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="history-start-date" className="text-sm" style={{ color: colors.brownLight }}>Start Date</Label>
            <Input
              id="history-start-date"
              type="date"
              value={historyStartDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              data-testid="input-history-start"
            />
          </div>
          <div>
            <Label htmlFor="history-end-date" className="text-sm" style={{ color: colors.brownLight }}>End Date</Label>
            <Input
              id="history-end-date"
              type="date"
              value={historyEndDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              data-testid="input-history-end"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="export-type-select" className="text-sm" style={{ color: colors.brownLight }}>Export Type</Label>
          <Select
            value={historyExportType}
            onValueChange={(value: 'group' | 'individual') => onExportTypeChange(value)}
          >
            <SelectTrigger
              id="export-type-select"
              style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              data-testid="select-export-type"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="group">All Employees (Group Report)</SelectItem>
              <SelectItem value="individual">Individual Employee</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {historyExportType === 'individual' && (
          <div>
            <Label htmlFor="history-employee-select" className="text-sm" style={{ color: colors.brownLight }}>Select Employee</Label>
            <Select
              value={historySelectedEmployee}
              onValueChange={onSelectedEmployeeChange}
            >
              <SelectTrigger
                id="history-employee-select"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                data-testid="select-history-employee"
              >
                <SelectValue placeholder="Select an employee" />
              </SelectTrigger>
              <SelectContent>
                {(allEmployees.length > 0 ? allEmployees : employees).map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} {!isEmployeeActive(emp) && '(Inactive)'}
                  </SelectItem>
                ))}
                {allEmployees.length === 0 && employees.length === 0 && (
                  <div className="p-2 text-sm text-center" style={{ color: colors.brownLight }}>
                    No employees found. Add employees first.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={onExportHistorical}
            disabled={exportingHistory || !historyStartDate || !historyEndDate}
            className="gap-2"
            style={{ backgroundColor: colors.gold, color: colors.brown }}
            data-testid="button-export-history"
          >
            <Download className="w-4 h-4" />
            {exportingHistory ? 'Exporting...' : 'Export Historical Data'}
          </Button>
        </div>
      </div>
    </section>
  );
}
