export const CC_FEE_RATE = 0.035;

export interface TipEmployee {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean | null;
  tip_eligible: boolean | null;
}

// Helper to treat null as active (true)
export const isEmployeeActive = (emp: TipEmployee) => emp.is_active !== false;

// Helper to treat null as eligible (true) — backward compat for existing records
export const isEmployeeTipEligible = (emp: TipEmployee) => emp.tip_eligible !== false;

export interface WeeklyTipData {
  id?: string;
  tenant_id: string;
  week_key: string;
  cash_tips: number;
  cc_tips: number;
  cash_entries: number[];
  cc_entries: number[];
}

export interface EmployeeHours {
  id?: string;
  tenant_id: string;
  employee_id: string;
  week_key: string;
  hours: number;
}

export interface PayoutCalculation {
  cashTotal: number;
  ccTotal: number;
  ccAfterFee: number;
  totalPool: number;
  totalTeamHours: number;
  hourlyRate: number;
  weekRange: { start: string; end: string };
}

export interface ImportedHours {
  tipEmployeeId: string;
  tipEmployeeName: string;
  totalHours: number;
  entryCount: number;
  matched: boolean;
}

export interface UnmatchedEntry {
  employeeName: string;
  totalHours: number;
  entryCount: number;
}

export interface ServerCalculationResult {
  weekKey: string;
  cashTips: number;
  ccTips: number;
  ccAfterFee: number;
  totalPool: number;
  totalHours: number;
  hourlyRate: number;
  distributionMethod: 'hours' | 'equal' | 'points';
  employees: Array<{
    employee_id: string;
    employee_name: string;
    hours: number;
    payout: number;
  }>;
  calculatedAt: string;
  calculatedBy: string;
}

export interface PayoutApprovalResult {
  id: string;
  status: 'approved';
  approvedAt: string;
  approvedBy: string;
  weekKey: string;
  totalPool: number;
  employeeCount: number;
}

export interface Colors {
  gold: string;
  goldLight: string;
  brown: string;
  brownLight: string;
  cream: string;
  creamDark: string;
  white: string;
  inputBg: string;
  green: string;
  red: string;
}
