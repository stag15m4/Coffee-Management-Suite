'use client';

import { ChefHat, DollarSign, Landmark, Package, Wrench, ClipboardList, Check, ArrowRight } from 'lucide-react';
import Section from '@/components/shared/Section';
import Container from '@/components/shared/Container';
import ScrollReveal from '@/components/shared/ScrollReveal';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import { MODULES, APP_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';

const moduleIcons: Record<string, React.ElementType> = {
  'recipe-cost': ChefHat,
  'tip-payout': DollarSign,
  'cash-deposit': Landmark,
  'bulk-ordering': Package,
  'equipment-maintenance': Wrench,
  'admin-tasks': ClipboardList,
};

function RecipeCostMockup() {
  return (
    <div className="rounded-xl border border-espresso-700 bg-espresso-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-espresso-700">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-espresso-900 rounded-md px-3 py-1 text-[10px] text-cream-600 text-center truncate">
            Recipe Cost Manager
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-cream-100">Vanilla Oat Latte</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-sage-400/10 text-sage-400">83.1% margin</span>
        </div>
        {[
          { name: 'Espresso (2oz)', cost: '$0.45' },
          { name: 'Oat Milk (8oz)', cost: '$0.22' },
          { name: 'Vanilla Syrup (1oz)', cost: '$0.18' },
          { name: 'Cup + Lid', cost: '$0.08' },
        ].map((row) => (
          <div key={row.name} className="flex justify-between items-center text-xs">
            <span className="text-cream-400">{row.name}</span>
            <span className="text-cream-300 font-medium tabular-nums">{row.cost}</span>
          </div>
        ))}
        <div className="pt-3 border-t border-espresso-700 flex justify-between">
          <span className="text-xs text-cream-400">
            Total: <span className="text-cream-100 font-semibold">$0.93</span>
          </span>
          <span className="text-xs text-cream-400">
            Sell: <span className="text-caramel-400 font-semibold">$5.50</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function TipPayoutMockup() {
  return (
    <div className="rounded-xl border border-espresso-700 bg-espresso-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-espresso-700">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-espresso-900 rounded-md px-3 py-1 text-[10px] text-cream-600 text-center truncate">
            Tip Payout Calculator
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-cream-100">Shift Summary &mdash; Mar 15</span>
          <span className="text-xs text-caramel-400 font-semibold">$342.50 total</span>
        </div>
        {[
          { name: 'Sarah M.', role: 'Lead', hours: '8h', payout: '$128.40' },
          { name: 'James R.', role: 'Barista', hours: '6h', payout: '$96.30' },
          { name: 'Priya K.', role: 'Barista', hours: '6h', payout: '$96.30' },
          { name: 'Alex T.', role: 'Support', hours: '4h', payout: '$21.50' },
        ].map((row) => (
          <div key={row.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-cream-100 font-medium">{row.name}</span>
              <span className="text-cream-600">{row.role}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-cream-600">{row.hours}</span>
              <span className="text-sage-400 font-semibold tabular-nums">{row.payout}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashDepositMockup() {
  return (
    <div className="rounded-xl border border-espresso-700 bg-espresso-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-espresso-700">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-espresso-900 rounded-md px-3 py-1 text-[10px] text-cream-600 text-center truncate">
            Cash Deposit Record
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-cream-100">Daily Reconciliation</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-sage-400/10 text-sage-400">Balanced</span>
        </div>
        {[
          { label: 'POS Reported', value: '$1,847.50' },
          { label: 'Cash Counted', value: '$1,845.25' },
          { label: 'Variance', value: '-$2.25', highlight: true },
        ].map((row) => (
          <div key={row.label} className="flex justify-between items-center text-xs">
            <span className="text-cream-400">{row.label}</span>
            <span className={cn('font-medium tabular-nums', row.highlight ? 'text-caramel-400' : 'text-cream-300')}>
              {row.value}
            </span>
          </div>
        ))}
        <div className="pt-3 border-t border-espresso-700 text-xs text-cream-600">Approved by Sarah M. at 10:32 PM</div>
      </div>
    </div>
  );
}

function BulkOrderingMockup() {
  return (
    <div className="rounded-xl border border-espresso-700 bg-espresso-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-espresso-700">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-espresso-900 rounded-md px-3 py-1 text-[10px] text-cream-600 text-center truncate">
            Bulk Ordering
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-cream-100">Acme Coffee Supply</span>
          <span className="text-xs text-cream-600">Order #1042</span>
        </div>
        {[
          { item: 'Ethiopian Yirgacheffe (5lb)', qty: '4', cost: '$120.00' },
          { item: 'Oat Milk (6-pack)', qty: '8', cost: '$47.60' },
          { item: 'Vanilla Syrup (750ml)', qty: '6', cost: '$54.00' },
        ].map((row) => (
          <div key={row.item} className="flex items-center justify-between text-xs">
            <span className="text-cream-400 flex-1">{row.item}</span>
            <span className="text-cream-600 mx-3">&times;{row.qty}</span>
            <span className="text-cream-300 font-medium tabular-nums">{row.cost}</span>
          </div>
        ))}
        <div className="pt-3 border-t border-espresso-700 flex justify-between text-xs">
          <span className="text-cream-400">Order Total</span>
          <span className="text-caramel-400 font-semibold">$221.60</span>
        </div>
      </div>
    </div>
  );
}

function EquipmentMockup() {
  return (
    <div className="rounded-xl border border-espresso-700 bg-espresso-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-espresso-700">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-espresso-900 rounded-md px-3 py-1 text-[10px] text-cream-600 text-center truncate">
            Equipment Maintenance
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <span className="text-sm font-semibold text-cream-100">Equipment Status</span>
        {[
          { name: 'La Marzocca Linea PB', status: 'Good', color: 'bg-[#28C840]' },
          { name: 'Mazzer Major V', status: 'Due Soon', color: 'bg-[#FEBC2E]' },
          { name: 'True T-49 Fridge', status: 'Overdue', color: 'bg-[#FF5F57]' },
          { name: 'Vitamix Quiet One', status: 'Good', color: 'bg-[#28C840]' },
        ].map((row) => (
          <div key={row.name} className="flex items-center justify-between text-xs">
            <span className="text-cream-400">{row.name}</span>
            <div className="flex items-center gap-2">
              <span className={cn('w-2 h-2 rounded-full', row.color)} />
              <span className="text-cream-300 font-medium">{row.status}</span>
            </div>
          </div>
        ))}
        <div className="pt-3 border-t border-espresso-700 text-xs text-caramel-400">
          1 overdue &middot; 1 due within 7 days
        </div>
      </div>
    </div>
  );
}

function AdminTasksMockup() {
  return (
    <div className="rounded-xl border border-espresso-700 bg-espresso-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-espresso-700">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-espresso-900 rounded-md px-3 py-1 text-[10px] text-cream-600 text-center truncate">
            Administrative Tasks
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <span className="text-sm font-semibold text-cream-100">Today&apos;s Tasks</span>
        {[
          { task: 'Restock pastry case', assignee: 'James R.', due: '9:00 AM', done: true },
          { task: 'Submit weekly inventory', assignee: 'Sarah M.', due: '2:00 PM', done: false },
          { task: 'Clean espresso group heads', assignee: 'Priya K.', due: '5:00 PM', done: false },
          { task: 'Update menu board pricing', assignee: 'Alex T.', due: '6:00 PM', done: false },
        ].map((row) => (
          <div key={row.task} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-3.5 h-3.5 rounded border flex items-center justify-center',
                  row.done ? 'bg-sage-400 border-sage-400' : 'border-espresso-600'
                )}
              >
                {row.done && <Check className="h-2.5 w-2.5 text-espresso-950" />}
              </div>
              <span className={cn('text-cream-300', row.done && 'line-through text-cream-600')}>{row.task}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-cream-600">{row.assignee}</span>
              <span className="text-cream-600">{row.due}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const moduleMockups: Record<string, React.ReactNode> = {
  'recipe-cost': <RecipeCostMockup />,
  'tip-payout': <TipPayoutMockup />,
  'cash-deposit': <CashDepositMockup />,
  'bulk-ordering': <BulkOrderingMockup />,
  'equipment-maintenance': <EquipmentMockup />,
  'admin-tasks': <AdminTasksMockup />,
};

export function ModuleDeepDive() {
  return (
    <>
      {MODULES.map((mod, index) => {
        const isOdd = index % 2 === 0;
        const isDark = !isOdd;
        const mockup = moduleMockups[mod.id];

        return (
          <section key={mod.id} id={mod.id} className={cn('py-24', isDark ? 'bg-espresso-900' : 'bg-cream-50')}>
            <Container>
              <ScrollReveal>
                <div
                  className={cn(
                    'grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center',
                    !isOdd && 'lg:[direction:rtl]'
                  )}
                >
                  <div className={cn(!isOdd && 'lg:[direction:ltr]')}>{mockup}</div>

                  <div className={cn(!isOdd && 'lg:[direction:ltr]')}>
                    <h2 className={cn('text-h2', isDark ? 'text-cream-50' : 'text-espresso-900')}>{mod.name}</h2>

                    <div className="mt-3 mb-4">
                      <Badge>{`$${mod.price}/mo per location`}</Badge>
                    </div>

                    <p className={cn('text-body-lg mb-6', isDark ? 'text-cream-400' : 'text-espresso-600')}>
                      {mod.description}
                    </p>

                    <ul className="space-y-3 mb-8">
                      {mod.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <Check className="h-4 w-4 text-sage-400 shrink-0 mt-0.5" />
                          <span className={cn('text-body-sm', isDark ? 'text-cream-300' : 'text-espresso-600')}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Button variant="ghost" href={`${APP_URL}/register`} icon={<ArrowRight className="h-4 w-4" />}>
                      Try {mod.name} Free
                    </Button>
                  </div>
                </div>
              </ScrollReveal>
            </Container>
          </section>
        );
      })}
    </>
  );
}
