'use client';

import { Check, X } from 'lucide-react';
import Section from '@/components/shared/Section';
import SectionHeading from '@/components/shared/SectionHeading';
import ScrollReveal from '@/components/shared/ScrollReveal';
import { cn } from '@/lib/utils';

const COMPARISONS = [
  {
    category: 'Recipe costing',
    manual: 'Manual spreadsheet',
    cms: 'Automated, real-time',
  },
  {
    category: 'Tip distribution',
    manual: 'Calculator + notebook',
    cms: 'One-click payouts',
  },
  {
    category: 'Cash reconciliation',
    manual: 'Paper deposit slips',
    cms: 'Digital audit trail',
  },
  {
    category: 'Equipment tracking',
    manual: 'Mental notes',
    cms: 'Scheduled reminders',
  },
  {
    category: 'Vendor ordering',
    manual: 'Email back-and-forth',
    cms: 'Built-in order forms',
  },
  {
    category: 'Task management',
    manual: 'Sticky notes',
    cms: 'Assigned & tracked',
  },
  {
    category: 'Multi-location',
    manual: 'Drive between shops',
    cms: 'One dashboard',
  },
  {
    category: 'Access control',
    manual: 'Shared passwords',
    cms: 'Role-based permissions',
  },
  {
    category: 'Monthly cost',
    manual: '$0 + your sanity',
    cms: 'From $0/mo',
  },
];

export function FeatureComparison() {
  return (
    <Section bg="light" padding="lg" id="comparison">
      <SectionHeading
        title="CMS vs. Doing It Yourself"
        subtitle="See how Coffee Management Suite compares to the way most shops operate today."
        align="center"
      />

      <ScrollReveal>
        {/* Desktop table */}
        <div className="hidden md:block max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-0 rounded-xl border border-cream-300 overflow-hidden">
            {/* Header row */}
            <div className="bg-cream-200 px-6 py-4 text-body-sm font-semibold text-espresso-900">Category</div>
            <div className="bg-rust-500/10 px-6 py-4 text-body-sm font-semibold text-espresso-900 text-center">
              Doing It Yourself
            </div>
            <div className="bg-sage-500/10 px-6 py-4 text-body-sm font-semibold text-espresso-900 text-center">
              Coffee Management Suite
            </div>

            {/* Data rows */}
            {COMPARISONS.map((row, index) => (
              <>
                <div
                  key={`cat-${index}`}
                  className={cn(
                    'px-6 py-4 text-body-sm font-medium text-espresso-900 border-t border-cream-300',
                    index % 2 === 0 ? 'bg-white' : 'bg-cream-50'
                  )}
                >
                  {row.category}
                </div>
                <div
                  key={`manual-${index}`}
                  className={cn(
                    'px-6 py-4 text-body-sm text-espresso-600 border-t border-cream-300 text-center',
                    'bg-rust-500/5'
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <X className="h-4 w-4 text-rust-500 shrink-0" />
                    {row.manual}
                  </span>
                </div>
                <div
                  key={`cms-${index}`}
                  className={cn(
                    'px-6 py-4 text-body-sm text-espresso-800 font-medium border-t border-cream-300 text-center',
                    'bg-sage-500/5'
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-sage-500 shrink-0" />
                    {row.cms}
                  </span>
                </div>
              </>
            ))}
          </div>
        </div>

        {/* Mobile stacked cards */}
        <div className="md:hidden space-y-4">
          {COMPARISONS.map((row, index) => (
            <div key={index} className="bg-white rounded-xl border border-cream-300 overflow-hidden">
              <div className="px-4 py-3 bg-cream-100 text-body-sm font-semibold text-espresso-900">{row.category}</div>
              <div className="divide-y divide-cream-300">
                <div className="px-4 py-3 bg-rust-500/5 flex items-center gap-2">
                  <X className="h-4 w-4 text-rust-500 shrink-0" />
                  <span className="text-body-sm text-espresso-600">{row.manual}</span>
                </div>
                <div className="px-4 py-3 bg-sage-500/5 flex items-center gap-2">
                  <Check className="h-4 w-4 text-sage-500 shrink-0" />
                  <span className="text-body-sm text-espresso-800 font-medium">{row.cms}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </Section>
  );
}
