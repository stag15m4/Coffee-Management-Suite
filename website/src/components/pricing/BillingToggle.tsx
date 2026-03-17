'use client';

import { cn } from '@/lib/utils';

interface BillingToggleProps {
  annual: boolean;
  onChange: (annual: boolean) => void;
}

export function BillingToggle({ annual, onChange }: BillingToggleProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="bg-cream-200 rounded-full p-1 inline-flex">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            'px-5 py-2 text-sm font-general rounded-full transition-all duration-200',
            !annual ? 'bg-white shadow-sm text-espresso-900 font-semibold' : 'text-espresso-600'
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            'px-5 py-2 text-sm font-general rounded-full transition-all duration-200',
            annual ? 'bg-white shadow-sm text-espresso-900 font-semibold' : 'text-espresso-600'
          )}
        >
          Annual
        </button>
      </div>
      <span
        className={cn(
          'text-xs font-semibold transition-opacity duration-200',
          annual ? 'text-sage-400 opacity-100' : 'text-sage-400 opacity-0'
        )}
      >
        Save 20%
      </span>
    </div>
  );
}
