'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'horizontal' | 'vertical';
  theme?: 'light' | 'dark';
  className?: string;
}

export default function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = 'horizontal',
  theme = 'light',
  className,
}: TabsProps) {
  const isDark = theme === 'dark';
  const isVertical = variant === 'vertical';

  return (
    <div
      className={cn(
        isVertical ? 'flex flex-col gap-1' : 'flex items-center gap-1',
        isVertical ? '' : 'border-b',
        isVertical ? '' : isDark ? 'border-espresso-700' : 'border-cream-300',
        className
      )}
      role="tablist"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex items-center gap-2 transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-caramel-400 focus-visible:ring-offset-2 rounded-sm',
              'font-general font-medium',
              isVertical ? 'px-4 py-3 text-left w-full rounded-lg' : 'px-4 py-3',
              isActive
                ? isDark
                  ? 'text-caramel-400'
                  : 'text-espresso-900'
                : isDark
                  ? 'text-cream-400 hover:text-cream-50'
                  : 'text-espresso-600 hover:text-espresso-900',
              isVertical && isActive && (isDark ? 'bg-espresso-800' : 'bg-cream-100')
            )}
          >
            {/* Vertical active indicator */}
            {isVertical && isActive && (
              <motion.span
                layoutId="tab-indicator-vertical"
                className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-caramel-400"
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              />
            )}

            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>

            {/* Horizontal active underline */}
            {!isVertical && isActive && (
              <motion.span
                layoutId="tab-indicator-horizontal"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-caramel-400"
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
