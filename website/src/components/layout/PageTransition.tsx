'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } }}
        exit={{ opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
