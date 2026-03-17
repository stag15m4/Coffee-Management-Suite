'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionItem {
  question: string;
  answer: string;
}

interface AccordionProps {
  items: AccordionItem[];
  className?: string;
  theme?: 'light' | 'dark';
}

export default function Accordion({ items, className, theme = 'light' }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isDark = theme === 'dark';

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className={cn('w-full', className)}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <div key={index} className={cn('border-b', isDark ? 'border-espresso-700' : 'border-cream-300')}>
            <button
              type="button"
              onClick={() => toggle(index)}
              className={cn(
                'flex w-full items-center justify-between py-5 text-left',
                'transition-colors duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-caramel-400 focus-visible:ring-offset-2 rounded-sm',
                isDark ? 'text-cream-50 hover:text-caramel-400' : 'text-espresso-900 hover:text-caramel-500'
              )}
              aria-expanded={isOpen}
            >
              <span className="text-h4 pr-4">{item.question}</span>
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="shrink-0"
              >
                <ChevronDown className={cn('h-5 w-5', isDark ? 'text-cream-400' : 'text-espresso-600')} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className={cn('text-body pb-5', isDark ? 'text-cream-400' : 'text-espresso-600')}>{item.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
