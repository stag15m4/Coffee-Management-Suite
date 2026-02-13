import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, UserPlus, Users, UserX, RotateCcw } from 'lucide-react';
import { TipEmployee, Colors, isEmployeeActive } from './types';

interface TipPayoutHeaderProps {
  colors: Colors;
  displayName: string;
  orgName: string;
  isChildLocation: boolean;
  allEmployees: TipEmployee[];
  newEmployeeName: string;
  onNewEmployeeNameChange: (name: string) => void;
  onAddEmployee: () => void;
  addingEmployee: boolean;
  showInactive: boolean;
  onToggleShowInactive: () => void;
  onToggleEmployeeActive: (employeeId: string, newStatus: boolean) => void;
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
  onAddEmployee,
  addingEmployee,
  showInactive,
  onToggleShowInactive,
  onToggleEmployeeActive,
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
                  onSubmit={(e) => { e.preventDefault(); onAddEmployee(); }}
                  className="flex gap-2"
                >
                  <Input
                    id="new-employee-name"
                    placeholder="New Employee Name"
                    value={newEmployeeName}
                    onChange={(e) => onNewEmployeeNameChange(e.target.value)}
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                    aria-label="New employee name"
                    data-testid="input-new-employee"
                  />
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
                    .filter(e => showInactive || isEmployeeActive(e))
                    .map(emp => {
                      const active = isEmployeeActive(emp);
                      return (
                        <div
                          key={emp.id}
                          className="flex items-center justify-between p-2 rounded-md"
                          style={{
                            backgroundColor: active ? colors.inputBg : '#f0f0f0',
                            opacity: active ? 1 : 0.7,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {!active && <UserX className="w-4 h-4" style={{ color: colors.red }} />}
                            <span style={{ color: colors.brown }}>{emp.name}</span>
                            {!active && (
                              <span
                                className="text-xs px-2 py-0.5 rounded"
                                style={{ backgroundColor: colors.creamDark, color: colors.brownLight }}
                              >
                                Inactive
                              </span>
                            )}
                          </div>
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
