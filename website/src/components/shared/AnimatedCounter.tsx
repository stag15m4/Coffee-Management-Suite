'use client';

import { useEffect, useRef } from 'react';
import { useMotionValue, useTransform, animate, useInView, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
  target: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

function formatWithCommas(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export default function AnimatedCounter({
  target,
  prefix = '',
  suffix = '',
  duration = 2000,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const prefersReducedMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const display = useTransform(motionValue, (v) => formatWithCommas(v));

  useEffect(() => {
    if (!isInView) return;

    if (prefersReducedMotion) {
      motionValue.set(target);
      return;
    }

    const controls = animate(motionValue, target, {
      duration: duration / 1000,
      ease: [0.16, 1, 0.3, 1],
    });

    return () => controls.stop();
  }, [isInView, target, duration, motionValue, prefersReducedMotion]);

  useEffect(() => {
    const unsubscribe = display.on('change', (v) => {
      if (ref.current) {
        ref.current.textContent = `${prefix}${v}${suffix}`;
      }
    });

    return () => unsubscribe();
  }, [display, prefix, suffix]);

  return (
    <span ref={ref} className={cn(className)}>
      {prefix}
      {formatWithCommas(target)}
      {suffix}
    </span>
  );
}
