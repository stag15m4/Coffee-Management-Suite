'use client';

import { useState, useEffect } from 'react';

export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let rafId: number | null = null;

    function handleScroll() {
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
        setProgress(scrolled);
        rafId = null;
      });
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return progress;
}
