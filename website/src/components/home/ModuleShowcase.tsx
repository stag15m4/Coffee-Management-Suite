'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChefHat, DollarSign, Landmark, Package, Wrench, ClipboardList, Check, ArrowRight } from 'lucide-react';
import Section from '@/components/shared/Section';
import SectionHeading from '@/components/shared/SectionHeading';
import { MODULES } from '@/lib/constants';
import { cn } from '@/lib/utils';

const moduleIcons: Record<string, React.ElementType> = {
  'recipe-cost': ChefHat,
  'tip-payout': DollarSign,
  'cash-deposit': Landmark,
  'bulk-ordering': Package,
  'equipment-maintenance': Wrench,
  'admin-tasks': ClipboardList,
};

export function ModuleShowcase() {
  const [activeTab, setActiveTab] = useState('recipe-cost');
  const prefersReducedMotion = useReducedMotion();
  const activeModule = MODULES.find((m) => m.id === activeTab) ?? MODULES[0];

  return (
    <Section bg="dark" padding="lg" id="modules">
      <SectionHeading
        title="Everything Your Shop Needs"
        subtitle="Six specialized modules. Pick what you need, or get them all."
        theme="dark"
        align="center"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        {/* Tab list — horizontal scroll on mobile, vertical on desktop */}
        <div
          className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-none"
          role="tablist"
          aria-orientation="vertical"
        >
          {MODULES.map((mod) => {
            const isActive = activeTab === mod.id;
            const Icon = moduleIcons[mod.id];

            return (
              <button
                key={mod.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(mod.id)}
                className={cn(
                  'relative flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors duration-200 whitespace-nowrap',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-caramel-400 focus-visible:ring-offset-2 focus-visible:ring-offset-espresso-900',
                  'shrink-0 lg:shrink lg:w-full',
                  isActive ? 'bg-espresso-800 text-cream-50' : 'text-cream-400 hover:bg-espresso-800/50'
                )}
              >
                {/* Active indicator — desktop only */}
                {isActive && (
                  <motion.span
                    layoutId="module-tab-indicator"
                    className="hidden lg:block absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-caramel-400"
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}

                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span className="text-sm font-medium">{mod.name}</span>
                <span className="ml-auto text-xs text-cream-600 hidden lg:inline">${mod.price}/mo</span>
              </button>
            );
          })}
        </div>

        {/* Module content */}
        <div className="min-h-[320px]" role="tabpanel">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={prefersReducedMotion ? {} : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? {} : { opacity: 0, x: -12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="bg-espresso-800 border border-espresso-700 rounded-xl p-6 md:p-8"
            >
              <h3 className="text-h3 text-cream-50 mb-3">{activeModule.name}</h3>
              <p className="text-body text-cream-400 mb-2">{activeModule.description}</p>
              <p className="text-body-sm text-cream-600 mb-6">
                <span className="font-semibold text-cream-400">Ideal for:</span> {activeModule.ideal}
              </p>

              <ul className="space-y-3 mb-8">
                {activeModule.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-sage-400 shrink-0 mt-0.5" />
                    <span className="text-body-sm text-cream-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={`/features#${activeTab}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-caramel-400 hover:text-caramel-300 transition-colors duration-200 group"
              >
                Try it free
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </a>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Section>
  );
}
