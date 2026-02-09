import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { TipEmployee, Colors } from './types';
import { formatCurrency, formatHoursMinutes } from './utils';

interface EmployeeHoursEntryProps {
  colors: Colors;
  employees: TipEmployee[];
  employeeHours: Record<string, number>;
  hourlyRate: number;
  selectedEmployee: string;
  onSelectedEmployeeChange: (name: string) => void;
  hoursInput: string;
  minutesInput: string;
  onHoursInputChange: (value: string) => void;
  onMinutesInputChange: (value: string) => void;
  onAddHours: () => void;
  savingHours: boolean;
  onEditEmployee: (name: string, hours: number) => void;
  onDeleteEmployee: (name: string) => void;
  onAddNewEmployee: () => void;
}

const ADD_NEW_VALUE = '__add_new__';

export function EmployeeHoursEntry({
  colors,
  employees,
  employeeHours,
  hourlyRate,
  selectedEmployee,
  onSelectedEmployeeChange,
  hoursInput,
  minutesInput,
  onHoursInputChange,
  onMinutesInputChange,
  onAddHours,
  savingHours,
  onEditEmployee,
  onDeleteEmployee,
  onAddNewEmployee,
}: EmployeeHoursEntryProps) {
  const availableEmployees = employees.filter(e => !employeeHours[e.name] || e.name === selectedEmployee);

  const handleSelectChange = (value: string) => {
    if (value === ADD_NEW_VALUE) {
      onAddNewEmployee();
      return;
    }
    onSelectedEmployeeChange(value);
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-3" style={{ color: colors.brown }}>
        <Clock className="w-5 h-5" />
        <h3 className="font-semibold text-lg">Employee Hours</h3>
      </div>

      <Table>
        <TableCaption className="sr-only">Employee hours for the week</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead className="text-right">Payout</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(employeeHours)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, hours]) => (
              <TableRow key={name} className="border-b" style={{ borderColor: colors.creamDark }}>
                <TableCell style={{ color: colors.brown }}>{name}</TableCell>
                <TableCell style={{ color: colors.brown }}>{formatHoursMinutes(hours)}</TableCell>
                <TableCell className="text-right font-medium" style={{ color: colors.brown }}>
                  {formatCurrency(hours * hourlyRate)}
                </TableCell>
                <TableCell className="text-right p-1">
                  <div className="flex justify-end gap-1">
                    <button
                      tabIndex={-1}
                      onClick={() => onEditEmployee(name, hours)}
                      className="p-1 rounded hover:bg-black/5"
                      aria-label={`Edit hours for ${name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />
                    </button>
                    <button
                      tabIndex={-1}
                      onClick={() => onDeleteEmployee(name)}
                      className="p-1 rounded hover:bg-red-50"
                      aria-label={`Delete hours for ${name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" style={{ color: colors.red }} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          <TableRow className="border-b" style={{ borderColor: colors.creamDark }}>
            <TableCell style={{ color: colors.brown }}>
              <Label htmlFor="employee-select" className="sr-only">Select Employee</Label>
              <Select value={selectedEmployee} onValueChange={handleSelectChange}>
                <SelectTrigger
                  id="employee-select"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  data-testid="select-employee"
                >
                  <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent>
                  {availableEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.name} data-testid={`option-employee-${emp.id}`}>
                      {emp.name}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={ADD_NEW_VALUE}>
                    <span className="flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" />
                      Add Employee
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Input
                  id="hours-input"
                  type="number"
                  min="0"
                  placeholder="Hrs"
                  inputMode="numeric"
                  value={hoursInput}
                  onChange={(e) => onHoursInputChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddHours(); } }}
                  className="w-16"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  aria-label="Hours"
                  data-testid="input-hours"
                />
                <Input
                  id="minutes-input"
                  type="number"
                  min="0"
                  max="59"
                  placeholder="Min"
                  inputMode="numeric"
                  value={minutesInput}
                  onChange={(e) => onMinutesInputChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddHours(); } }}
                  className="w-16"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  aria-label="Minutes (0-59)"
                  data-testid="input-minutes"
                />
              </div>
            </TableCell>
            <TableCell className="text-right">
              <Button
                onClick={onAddHours}
                disabled={savingHours || !selectedEmployee}
                size="sm"
                style={{ backgroundColor: colors.gold, color: colors.brown }}
                data-testid="button-add-hours"
              >
                Add
              </Button>
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </section>
  );
}
