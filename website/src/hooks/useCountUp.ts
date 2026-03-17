'use client';

import { useState, useEffect, useRef } from 'react';

function easeOutQuad(t: number): number {
  return t * (2 - t);
}

export function useCountUp(target: number, duration: number = 2000, isInView: boolean): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isInView || hasAnimated.current) return;
    hasAnimated.current = true;

    function animate(timestamp: number) {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuad(progress);
      const currentValue = Math.round(easedProgress * target);

      setValue(currentValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isInView, target, duration]);

  return value;
}
