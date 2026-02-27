import {
  TrendingUp, Users, Clock, CheckCircle2, AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { getModuleIcon, MODULE_REGISTRY, type ModuleId } from '@/lib/module-registry';
import { Badge } from '@/components/ui/badge';
import { colors } from '@/lib/colors';

// ─── Fake company: "Sunrise Roasters" ────────────────────────

function SampleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${colors.creamDark}` }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ backgroundColor: colors.cream }}>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold" style={{ color: colors.brown }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${colors.creamDark}` }}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2" style={{ color: colors.brownLight }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg p-3 text-center" style={{ backgroundColor: colors.cream }}>
      <p className="text-lg font-bold" style={{ color: color || colors.brown }}>{value}</p>
      <p className="text-xs" style={{ color: colors.brownLight }}>{label}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: colors.brownLight }}>{sub}</p>}
    </div>
  );
}

// ─── Recipe Costing Preview ──────────────────────────────────

function RecipeCostingPreview() {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: colors.brownLight }}>
        Track every ingredient cost and see exactly what each drink costs to make — with real-time margin calculations.
      </p>

      {/* Sample recipe */}
      <div className="rounded-lg p-3" style={{ backgroundColor: colors.cream }}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-sm" style={{ color: colors.brown }}>Vanilla Oat Latte</span>
          <Badge style={{ backgroundColor: colors.green, color: 'white' }}>68% margin</Badge>
        </div>
        <div className="space-y-1.5">
          {[
            { name: 'Espresso (double)', cost: '$0.42', qty: '2 shots' },
            { name: 'Oat Milk', cost: '$0.38', qty: '10 oz' },
            { name: 'Vanilla Syrup (house)', cost: '$0.12', qty: '1 oz' },
          ].map((ing, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span style={{ color: colors.brownLight }}>{ing.name}</span>
              <div className="flex items-center gap-3">
                <span style={{ color: colors.brownLight }}>{ing.qty}</span>
                <span className="font-mono" style={{ color: colors.brown }}>{ing.cost}</span>
              </div>
            </div>
          ))}
          <div className="border-t pt-1.5 mt-1.5 flex justify-between text-xs font-semibold" style={{ borderColor: colors.creamDark }}>
            <span style={{ color: colors.brown }}>Total Cost</span>
            <span style={{ color: colors.brown }}>$0.92</span>
          </div>
        </div>
      </div>

      {/* Pricing matrix preview */}
      <div>
        <p className="text-xs font-semibold mb-1.5" style={{ color: colors.brown }}>Pricing Matrix</p>
        <SampleTable
          headers={['Size', 'Cost', 'Price', 'Margin']}
          rows={[
            ['12oz Hot', '$0.92', '$4.75', '80.6%'],
            ['16oz Hot', '$1.18', '$5.50', '78.5%'],
            ['16oz Cold', '$1.24', '$5.75', '78.4%'],
            ['24oz Cold', '$1.56', '$6.50', '76.0%'],
          ]}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Recipes" value="24" />
        <StatCard label="Ingredients" value="47" />
        <StatCard label="Avg Margin" value="74%" color={colors.green} />
      </div>
    </div>
  );
}

// ─── Tip Payout Preview ──────────────────────────────────────

function TipPayoutPreview() {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: colors.brownLight }}>
        Automatically calculate fair tip distributions based on hours worked and role. Print payout slips instantly.
      </p>

      {/* Sample tip period */}
      <div className="rounded-lg p-3" style={{ backgroundColor: colors.cream }}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-sm" style={{ color: colors.brown }}>Week of Jan 13 – Jan 19</span>
          <span className="text-sm font-bold" style={{ color: colors.green }}>$842.50</span>
        </div>
        <p className="text-xs mb-2" style={{ color: colors.brownLight }}>Total tips collected</p>
      </div>

      <SampleTable
        headers={['Employee', 'Hours', 'Share', 'Payout']}
        rows={[
          ['Maria S.', '38.5h', '28.2%', '$237.59'],
          ['Jake T.', '32.0h', '23.4%', '$197.15'],
          ['Aiden P.', '28.0h', '20.5%', '$172.71'],
          ['Lily K.', '24.5h', '17.9%', '$150.81'],
          ['Sam R.', '13.5h', '9.9%', '$83.41'],
        ]}
      />

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="This Week" value="$842" color={colors.green} />
        <StatCard label="Per Hour Avg" value="$6.17" />
        <StatCard label="Team Members" value="5" />
      </div>
    </div>
  );
}

// ─── Cash Deposit Preview ────────────────────────────────────

function CashDepositPreview() {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: colors.brownLight }}>
        Log every cash deposit with denominations. Track discrepancies and keep a clean audit trail.
      </p>

      {/* Sample deposit */}
      <div className="rounded-lg p-3" style={{ backgroundColor: colors.cream }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="font-semibold text-sm" style={{ color: colors.brown }}>Monday, Jan 13</span>
            <p className="text-xs" style={{ color: colors.brownLight }}>Counted by Maria S. at 6:42 PM</p>
          </div>
          <CheckCircle2 className="w-5 h-5" style={{ color: colors.green }} />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
          {[
            ['$20 bills', '×12 = $240.00'],
            ['$10 bills', '×8 = $80.00'],
            ['$5 bills', '×15 = $75.00'],
            ['$1 bills', '×42 = $42.00'],
            ['Coins', '$18.75'],
          ].map(([label, val], i) => (
            <div key={i} className="flex justify-between" style={{ color: colors.brownLight }}>
              <span>{label}</span>
              <span className="font-mono">{val}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-1.5 mt-2 flex justify-between text-sm font-semibold" style={{ borderColor: colors.creamDark }}>
          <span style={{ color: colors.brown }}>Total Deposit</span>
          <span style={{ color: colors.green }}>$455.75</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="This Month" value="$9,847" color={colors.green} />
        <StatCard label="Deposits" value="22" />
        <StatCard label="Variance" value="$0.00" color={colors.green} />
      </div>
    </div>
  );
}

// ─── Bulk Ordering Preview ───────────────────────────────────

function BulkOrderingPreview() {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: colors.brownLight }}>
        Manage wholesale coffee orders, track vendor pricing, and calculate batch costs for house-made syrups and sauces.
      </p>

      <SampleTable
        headers={['Item', 'Vendor', 'Qty', 'Total']}
        rows={[
          ['Guatemala Huehue (5lb)', 'Atlas Coffee', '4 bags', '$156.00'],
          ['Ethiopia Yirgacheffe (5lb)', 'Atlas Coffee', '2 bags', '$92.00'],
          ['Oat Milk (6-pack)', 'Sysco', '3 cases', '$71.40'],
          ['Vanilla Extract (32oz)', 'WebstaurantStore', '2 btls', '$34.50'],
          ['Cup Lids 12/16oz (1000ct)', 'Sysco', '1 case', '$28.90'],
        ]}
      />

      {/* Batch recipe */}
      <div className="rounded-lg p-3" style={{ backgroundColor: colors.cream }}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-sm" style={{ color: colors.brown }}>House Vanilla Syrup</span>
          <span className="text-xs" style={{ color: colors.brownLight }}>Batch: 128 oz</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: colors.brownLight }}>Batch cost: $4.82</span>
          <span className="font-mono font-semibold" style={{ color: colors.gold }}>$0.04/oz</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Active Orders" value="3" />
        <StatCard label="Vendors" value="4" />
        <StatCard label="Batch Recipes" value="6" />
      </div>
    </div>
  );
}

// ─── Equipment Maintenance Preview ───────────────────────────

function EquipmentMaintenancePreview() {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: colors.brownLight }}>
        Track every piece of equipment with maintenance schedules, repair history, manuals, and warranty info.
      </p>

      {/* Equipment list */}
      <div className="space-y-2">
        {[
          { name: 'La Marzocco Linea Mini', status: 'Good', due: 'Backflush due tomorrow', urgent: true },
          { name: 'Mahlkönig EK43S Grinder', status: 'Good', due: 'Burr calibration in 12 days', urgent: false },
          { name: 'Vitamix Blender #2', status: 'Repair', due: 'Blade replacement ordered', urgent: true },
          { name: 'True Undercounter Fridge', status: 'Good', due: 'Filter change in 28 days', urgent: false },
        ].map((eq, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg p-2.5" style={{ backgroundColor: colors.cream }}>
            <div>
              <p className="text-sm font-medium" style={{ color: colors.brown }}>{eq.name}</p>
              <p className="text-xs flex items-center gap-1" style={{ color: eq.urgent ? '#d97706' : colors.brownLight }}>
                {eq.urgent && <AlertTriangle className="w-3 h-3" />}
                {eq.due}
              </p>
            </div>
            <Badge style={{
              backgroundColor: eq.status === 'Good' ? colors.green : colors.red,
              color: 'white',
            }}>
              {eq.status}
            </Badge>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Equipment" value="11" />
        <StatCard label="Due Soon" value="2" color="#d97706" />
        <StatCard label="Repairs" value="1" color={colors.red} />
      </div>
    </div>
  );
}

// ─── Admin Tasks Preview ─────────────────────────────────────

function AdminTasksPreview() {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: colors.brownLight }}>
        Delegate tasks to your team, set priorities and deadlines, and track completion across all locations.
      </p>

      {/* Task list */}
      <div className="space-y-2">
        {[
          { title: 'Order new paper cups (12oz)', assignee: 'Maria S.', priority: 'high', status: 'In Progress', category: 'Inventory' },
          { title: 'Update spring drink menu board', assignee: 'Jake T.', priority: 'medium', status: 'Pending', category: 'Marketing' },
          { title: 'Schedule health inspection prep', assignee: 'You', priority: 'high', status: 'Pending', category: 'Compliance' },
          { title: 'Train Lily on cold brew process', assignee: 'Aiden P.', priority: 'low', status: 'Completed', category: 'Training' },
        ].map((task, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg p-2.5" style={{ backgroundColor: colors.cream }}>
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
              task.status === 'Completed' ? 'bg-green-500' :
              task.priority === 'high' ? 'bg-red-500' :
              task.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-400'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{
                color: colors.brown,
                textDecoration: task.status === 'Completed' ? 'line-through' : 'none',
                opacity: task.status === 'Completed' ? 0.6 : 1,
              }}>
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs" style={{ color: colors.brownLight }}>{task.assignee}</span>
                <Badge className="text-[10px] px-1.5 py-0" variant="outline" style={{ borderColor: colors.creamDark, color: colors.brownLight }}>
                  {task.category}
                </Badge>
              </div>
            </div>
            <Badge className="text-[10px] shrink-0" style={{
              backgroundColor: task.status === 'Completed' ? colors.green :
                task.status === 'In Progress' ? '#60a5fa' : colors.creamDark,
              color: task.status === 'Completed' || task.status === 'In Progress' ? 'white' : colors.brownLight,
            }}>
              {task.status}
            </Badge>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Open Tasks" value="8" />
        <StatCard label="Completed" value="23" sub="this month" color={colors.green} />
        <StatCard label="Overdue" value="1" color={colors.red} />
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────

const MODULE_PREVIEW_COMPONENTS: Record<string, () => JSX.Element> = {
  'recipe-costing': RecipeCostingPreview,
  'tip-payout': TipPayoutPreview,
  'cash-deposit': CashDepositPreview,
  'bulk-ordering': BulkOrderingPreview,
  'equipment-maintenance': EquipmentMaintenancePreview,
  'admin-tasks': AdminTasksPreview,
};

// Derive icon and tagline from registry; keep preview components here
const MODULE_PREVIEWS: Record<string, { component: () => JSX.Element; icon: LucideIcon; tagline: string }> = Object.fromEntries(
  Object.entries(MODULE_PREVIEW_COMPONENTS).map(([id, component]) => {
    const def = MODULE_REGISTRY[id as ModuleId];
    return [id, {
      component,
      icon: getModuleIcon(id as ModuleId),
      tagline: def?.previewTagline || '',
    }];
  })
);

interface ModulePreviewProps {
  moduleId: string;
  moduleName: string;
}

export function ModulePreviewContent({ moduleId, moduleName }: ModulePreviewProps) {
  const preview = MODULE_PREVIEWS[moduleId];
  if (!preview) return null;

  const PreviewComponent = preview.component;
  const Icon = preview.icon;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: colors.gold }}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold" style={{ color: colors.brown }}>{moduleName}</h3>
          <p className="text-xs" style={{ color: colors.brownLight }}>{preview.tagline}</p>
        </div>
      </div>

      {/* Fake company banner */}
      <div className="rounded-lg px-3 py-1.5 mb-4 flex items-center gap-2" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
        <Coffee className="w-3.5 h-3.5" style={{ color: colors.green }} />
        <span className="text-xs" style={{ color: '#166534' }}>
          Sample data from <strong>Sunrise Roasters</strong> — a fictional coffee shop
        </span>
      </div>

      {/* Preview content */}
      <PreviewComponent />
    </div>
  );
}
