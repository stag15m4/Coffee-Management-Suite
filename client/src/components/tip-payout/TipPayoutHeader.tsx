import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, UserPlus, Users, UserX, RotateCcw } from 'lucide-react';
import { TipEmployee, Colors, isEmployeeActive, isEmployeeTipEligible } from './types';

interface TipPayoutHeaderProps {
  colors: Colors;
  displayName: string;
  orgName: string;
  isChildLocation: boolean;
  allEmployees: TipEmployee[];
  newEmployeeName: string;
  onNewEmployeeNameChange: (name: string) => void;
  newEmployeeEmail: string;
  onNewEmployeeEmailChange: (email: string) => void;
  onAddEmployee: () => void;
  addingEmployee: boolean;
  showInactive: boolean;
  onToggleShowInactive: () => void;
  onToggleEmployeeActive: (employeeId: string, newStatus: boolean) => void;
  onToggleTipEligible: (employeeId: string, newStatus: boolean) => void;
  onUpdateEmployeeEmail: (employeeId: string, email: string) => void;
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
}

export function TipPayoutHeader({
  colors,
  displayName,
  orgName,
  isChildLocation,
  allEmployees,
  newEmployeeName,
  onNewEmployeeNameChange,
  newEmployeeEmail,
  onNewEmployeeEmailChange,
  onAddEmployee,
  addingEmployee,
  showInactive,
  onToggleShowInactive,
  onToggleEmployeeActive,
  onToggleTipEligible,
  onUpdateEmployeeEmail,
  dialogOpen,
  onDialogOpenChange,
}: TipPayoutHeaderProps) {
  return (
    <header className="px-6 py-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: colors.brown }}>
              Tip Payout Calculator
            </h2>
            {isChildLocation && orgName && (
              <p className="text-sm" style={{ color: colors.brownLight }}>
                {displayName} &bull; {orgName}
              </p>
            )}
          </div>
          <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                style={{ borderColor: colors.gold, color: colors.brown }}
                data-testid="button-manage-employees"
              >
                <Users className="w-4 h-4 mr-2" />
                Manage Employees
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
                  <UserPlus className="w-5 h-5" />
                  Employee Manager
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onAddEmployee();
                  }}
                  className="flex gap-2"
                >
                  <div className="flex-1 space-y-2">
                    <Input
                      id="new-employee-name"
                      placeholder="New Employee Name"
                      value={newEmployeeName}
                      onChange={(e) => onNewEmployeeNameChange(e.target.value)}
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                      aria-label="New employee name"
                      data-testid="input-new-employee"
                    />
                    <Input
                      id="new-employee-email"
                      type="email"
                      placeholder="Email (optional)"
                      value={newEmployeeEmail}
                      onChange={(e) => onNewEmployeeEmailChange(e.target.value)}
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                      aria-label="New employee email"
                      data-testid="input-new-employee-email"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={addingEmployee || !newEmployeeName.trim()}
                    style={{ backgroundColor: colors.gold, color: colors.white }}
                    data-testid="button-add-employee"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </form>

                <div className="space-y-3 pt-2 border-t" style={{ borderColor: colors.creamDark }}>
                  <div className="flex items-center justify-between">
                    <Label style={{ color: colors.brown }}>Employee List</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onToggleShowInactive}
                      style={{ color: colors.brownLight }}
                      data-testid="button-toggle-inactive"
                    >
                      {showInactive ? 'Hide Inactive' : 'Show Inactive'}
                    </Button>
                  </div>

                  {allEmployees
                    .filter((e) => showInactive || isEmployeeActive(e))
                    .map((emp) => {
                      const active = isEmployeeActive(emp);
                      const eligible = isEmployeeTipEligible(emp);
                      return (
                        <div
                          key={emp.id}
                          className="p-2 rounded-md space-y-1"
                          style={{
                            backgroundColor: active ? colors.inputBg : '#f0f0f0',
                            opacity: active ? 1 : 0.7,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              {!active && <UserX className="w-4 h-4 flex-shrink-0" style={{ color: colors.red }} />}
                              <span className="truncate" style={{ color: colors.brown }}>
                                {emp.name}
                              </span>
                              {!active && (
                                <span
                                  className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                                  style={{ backgroundColor: colors.creamDark, color: colors.brownLight }}
                                >
                                  Inactive
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {active && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onToggleTipEligible(emp.id, !eligible)}
                                  className="text-xs px-2"
                                  style={{
                                    color: eligible ? colors.green : colors.brownLight,
                                    backgroundColor: eligible ? undefined : colors.creamDark,
                                  }}
                                >
                                  {eligible ? 'Tips: Yes' : 'Tips: No'}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onToggleEmployeeActive(emp.id, !active)}
                                style={{ color: active ? colors.red : colors.green }}
                                data-testid={`button-toggle-employee-${emp.id}`}
                              >
                                {active ? (
                                  <>
                                    <UserX className="w-4 h-4 mr-1" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="w-4 h-4 mr-1" />
                                    Reactivate
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                          <Input
                            type="email"
                            placeholder="Email for tip statements"
                            defaultValue={emp.email || ''}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              if (value !== (emp.email || '')) onUpdateEmployeeEmail(emp.id, value);
                            }}
                            className="h-8 text-sm"
                            style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                            aria-label={`Email for ${emp.name}`}
                            data-testid={`input-employee-email-${emp.id}`}
                          />
                        </div>
                      );
                    })}

                  {allEmployees.length === 0 && (
                    <p className="text-center text-sm py-2" style={{ color: colors.brownLight }}>
                      No employees yet
                    </p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
