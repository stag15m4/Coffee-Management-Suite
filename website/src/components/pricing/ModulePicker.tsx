'use client';

import { useState, useMemo } from 'react';
import { ChefHat, DollarSign, Landmark, Package, Wrench, ClipboardList, Check, ArrowRight } from 'lucide-react';
import Section from '@/components/shared/Section';
import SectionHeading from '@/components/shared/SectionHeading';
import Button from '@/components/shared/Button';
import { MODULES, APP_URL } from '@/lib/constants';
import { cn, formatCurrency } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

const moduleIcons: Record<string, React.ElementType> = {
  'recipe-cost': ChefHat,
  'tip-payout': DollarSign,
  'cash-deposit': Landmark,
  'bulk-ordering': Package,
  'equipment-maintenance': Wrench,
  'admin-tasks': ClipboardList,
};

export function ModulePicker() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locations, setLocations] = useState(1);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const moduleCount = selected.size;
  const perModuleCost = 29;
  const proMonthly = 99;

  const monthlyTotal = useMemo(() => moduleCount * perModuleCost * locations, [moduleCount, locations]);

  const proTotal = proMonthly * locations;
  const savings = monthlyTotal - proTotal;
  const showProSuggestion = moduleCount >= 3 && savings > 0;

  return (
    <Section bg="light" padding="md" id="build-your-plan">
      <SectionHeading
        title="Build Your Perfect Plan"
        subtitle="Select the modules you need and see your price instantly."
        align="center"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        {MODULES.map((mod) => {
          const Icon = moduleIcons[mod.id];
          const isSelected = selected.has(mod.id);

          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => toggle(mod.id)}
              className={cn(
                'relative bg-white border rounded-xl p-4 cursor-pointer text-left',
                'transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-caramel-400 focus-visible:ring-offset-2',
                isSelected ? 'border-caramel-400 bg-caramel-400/5' : 'border-cream-300 hover:border-cream-400'
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-caramel-400 flex items-center justify-center">
                  <Check className="h-3 w-3 text-espresso-950" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                {Icon && <Icon className={cn('h-5 w-5', isSelected ? 'text-caramel-400' : 'text-espresso-600')} />}
                <span className={cn('text-sm font-semibold', isSelected ? 'text-espresso-900' : 'text-espresso-800')}>
                  {mod.name}
                </span>
                <span className="text-xs text-espresso-600">${perModuleCost}/mo</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="max-w-lg mx-auto mt-10 space-y-6">
        <div className="flex items-center justify-center gap-4">
          <label htmlFor="location-count" className="text-body-sm text-espresso-600 font-medium">
            Locations:
          </label>
          <input
            id="location-count"
            type="number"
            min={1}
            max={20}
            value={locations}
            onChange={(e) => setLocations(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="w-20 px-3 py-2 border border-cream-300 rounded-lg text-center text-sm font-semibold text-espresso-900 focus:outline-none focus:ring-2 focus:ring-caramel-400 focus:ring-offset-2"
          />
        </div>

        {moduleCount > 0 && (
          <div className="text-center space-y-3">
            <p className="text-body-lg text-espresso-900 font-semibold">
              Your plan: {moduleCount} module{moduleCount !== 1 ? 's' : ''} &times; {locations} location
              {locations !== 1 ? 's' : ''} = <span className="text-caramel-400">{formatCurrency(monthlyTotal)}/mo</span>
            </p>

            {showProSuggestion && (
              <p className="text-body-sm text-sage-500 bg-sage-400/10 rounded-lg px-4 py-2 inline-block">
                Professional plan with all 6 modules would save you{' '}
                <span className="font-semibold">{formatCurrency(savings)}/mo</span>
              </p>
            )}

            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                href={`${APP_URL}/register`}
                icon={<ArrowRight className="h-5 w-5" />}
                onClick={() =>
                  trackEvent('module_picker_cta', {
                    modules: moduleCount,
                    locations,
                    total: monthlyTotal,
                  })
                }
              >
                Get Started
              </Button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
