import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Colors, ImportedHours, UnmatchedEntry } from './types';
import { formatHoursMinutes } from './utils';

interface TimeclockImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: ImportedHours[];
  unmatchedEntries: UnmatchedEntry[];
  skippedCount: number;
  loading: boolean;
  confirming: boolean;
  onConfirm: () => void;
  colors: Colors;
}

export function TimeclockImportDialog({
  open,
  onOpenChange,
  previewData,
  unmatchedEntries,
  skippedCount,
  loading,
  confirming,
  onConfirm,
  colors,
}: TimeclockImportDialogProps) {
  const matchedData = previewData.filter(d => d.matched);
  const totalHours = matchedData.reduce((sum, d) => sum + d.totalHours, 0);
  const totalEntries = matchedData.reduce((sum, d) => sum + d.entryCount, 0);
  const hasData = matchedData.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" style={{ backgroundColor: colors.cream, borderColor: colors.gold }}>
        <DialogHeader>
          <DialogTitle style={{ color: colors.brown }}>Import from Timeclock</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2" style={{ color: colors.brownLight }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading timeclock data...</span>
          </div>
        ) : !hasData && unmatchedEntries.length === 0 ? (
          <div className="py-8 text-center" style={{ color: colors.brownLight }}>
            <p>No timeclock entries found for this week.</p>
            <p className="text-sm mt-1">Employees can be entered manually.</p>
          </div>
        ) : (
          <>
            {hasData && (
              <Table>
                <TableCaption className="sr-only">Timeclock hours to import</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-center">Entries</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchedData
                    .sort((a, b) => a.tipEmployeeName.localeCompare(b.tipEmployeeName))
                    .map((item) => (
                      <TableRow key={item.tipEmployeeId} style={{ borderColor: colors.creamDark }}>
                        <TableCell style={{ color: colors.brown }}>
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: colors.green }} />
                            {item.tipEmployeeName}
                          </div>
                        </TableCell>
                        <TableCell className="text-center" style={{ color: colors.brown }}>
                          {item.entryCount}
                        </TableCell>
                        <TableCell className="text-right font-medium" style={{ color: colors.brown }}>
                          {formatHoursMinutes(item.totalHours)}
                        </TableCell>
                      </TableRow>
                    ))}
                  <TableRow style={{ borderColor: colors.gold }}>
                    <TableCell className="font-semibold" style={{ color: colors.brown }}>
                      Total
                    </TableCell>
                    <TableCell className="text-center font-semibold" style={{ color: colors.brown }}>
                      {totalEntries}
                    </TableCell>
                    <TableCell className="text-right font-semibold" style={{ color: colors.brown }}>
                      {formatHoursMinutes(totalHours)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}

            {(skippedCount > 0 || unmatchedEntries.length > 0) && (
              <div className="space-y-1.5 text-sm" style={{ color: colors.brownLight }}>
                {skippedCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: colors.gold }} />
                    <span>{skippedCount} {skippedCount === 1 ? 'entry' : 'entries'} skipped (still clocked in)</span>
                  </div>
                )}
                {unmatchedEntries.map((u) => (
                  <div key={u.employeeName} className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: colors.gold }} />
                    <span>"{u.employeeName}" ({formatHoursMinutes(u.totalHours)}) — not on tip roster</span>
                  </div>
                ))}
              </div>
            )}

            {hasData && (
              <p className="text-xs" style={{ color: colors.brownLight }}>
                This will replace any existing hours for these employees. Others can still be entered manually.
              </p>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                style={{ borderColor: colors.gold, color: colors.brown }}
              >
                Cancel
              </Button>
              {hasData && (
                <Button
                  size="sm"
                  disabled={confirming}
                  onClick={onConfirm}
                  style={{ backgroundColor: colors.gold, color: colors.white }}
                >
                  {confirming ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Importing...</>
                  ) : (
                    `Import ${matchedData.length} ${matchedData.length === 1 ? 'Employee' : 'Employees'}`
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
