'use client';

import { useState, useEffect, type RefObject } from 'react';

interface MousePosition {
  x: number;
  y: number;
}

export function useMousePosition(ref: RefObject<HTMLElement | null>): MousePosition | null {
  const [position, setPosition] = useState<MousePosition | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    function handleMouseMove(e: MouseEvent) {
      const rect = element!.getBoundingClientRect();
      setPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    function handleMouseLeave() {
      setPosition(null);
    }

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [ref]);

  return position;
}
