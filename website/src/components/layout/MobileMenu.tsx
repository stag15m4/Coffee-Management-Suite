'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { APP_URL, NAV_LINKS } from '@/lib/constants';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const overlayVariants = {
  closed: { opacity: 0 },
  open: { opacity: 1 },
};

const panelVariants = {
  closed: { x: '100%' },
  open: { x: 0 },
};

const linkVariants = {
  closed: { opacity: 0, x: 20 },
  open: { opacity: 1, x: 0 },
};

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[var(--z-overlay)] lg:hidden"
          initial="closed"
          animate="open"
          exit="closed"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-espresso-950/60"
            variants={overlayVariants}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="absolute inset-y-0 right-0 flex w-full flex-col bg-espresso-900"
            variants={panelVariants}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Close button */}
            <div className="flex h-16 items-center justify-end px-4 sm:px-6">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md p-2 text-cream-50 transition-colors hover:text-caramel-400"
                onClick={onClose}
                aria-label="Close navigation menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
              {NAV_LINKS.map((link, i) => (
                <motion.div key={link.href} variants={linkVariants} transition={{ delay: i * 0.05, duration: 0.3 }}>
                  <Link
                    href={link.href}
                    className="font-clash text-2xl font-medium text-cream-50 transition-colors hover:text-caramel-400"
                    onClick={onClose}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </nav>

            {/* Bottom actions */}
            <motion.div
              className="flex flex-col gap-4 px-6 pb-12"
              variants={linkVariants}
              transition={{ delay: NAV_LINKS.length * 0.05, duration: 0.3 }}
            >
              <a
                href={APP_URL}
                className="text-center font-general text-base font-medium text-cream-50 transition-colors hover:text-caramel-400"
                onClick={onClose}
              >
                Sign In
              </a>
              <a
                href={`${APP_URL}/register`}
                className={cn(
                  'w-full rounded-full bg-caramel-400 px-6 py-3',
                  'text-center font-general font-semibold text-espresso-950',
                  'transition-all duration-200',
                  'hover:scale-[1.02] hover:bg-caramel-500'
                )}
                onClick={onClose}
              >
                Get Started
              </a>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
