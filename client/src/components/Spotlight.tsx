import { useState, useEffect, useCallback } from 'react';
import { colors } from '@/lib/colors';
import { X } from 'lucide-react';

interface SpotlightTarget {
  selector: string; // data-spotlight attribute value
  hint: string;
}

let showSpotlightFn: ((target: SpotlightTarget) => void) | null = null;

/** Call from anywhere to show a spotlight on an element */
export function triggerSpotlight(selector: string, hint: string) {
  showSpotlightFn?.({ selector, hint });
}

export function Spotlight() {
  const [target, setTarget] = useState<SpotlightTarget | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);

  // Register the show function
  useEffect(() => {
    showSpotlightFn = (t) => {
      setTarget(t);
      setVisible(false);
      setRect(null);
    };
    return () => { showSpotlightFn = null; };
  }, []);

  // Find and highlight the target element
  useEffect(() => {
    if (!target) return;

    let attempts = 0;
    const maxAttempts = 20; // Try for up to 4 seconds

    const findElement = () => {
      const el = document.querySelector(`[data-spotlight="${target.selector}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect(r);
        setVisible(true);
        // Scroll element into view if needed
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return true;
      }
      return false;
    };

    if (findElement()) return;

    // Retry with interval for lazy-loaded content
    const interval = setInterval(() => {
      attempts++;
      if (findElement() || attempts >= maxAttempts) {
        clearInterval(interval);
        if (attempts >= maxAttempts && !rect) {
          // Element not found — just clear
          setTarget(null);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [target]);

  // Update rect on scroll/resize
  useEffect(() => {
    if (!target || !visible) return;

    const update = () => {
      const el = document.querySelector(`[data-spotlight="${target.selector}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };

    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [target, visible]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTarget(null);
    setRect(null);
  }, []);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(dismiss, 8000);
    return () => clearTimeout(timer);
  }, [visible, dismiss]);

  if (!visible || !rect || !target) return null;

  const padding = 6;
  const top = rect.top - padding;
  const left = rect.left - padding;
  const width = rect.width + padding * 2;
  const height = rect.height + padding * 2;

  // Position tooltip below or above depending on space
  const tooltipBelow = rect.bottom + 60 < window.innerHeight;

  return (
    <>
      {/* Backdrop overlay with cutout */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={dismiss}
        style={{
          background: `radial-gradient(circle at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px, transparent ${Math.max(width, height)}px, rgba(0,0,0,0.4) ${Math.max(width, height) + 40}px)`,
        }}
      />

      {/* Pulsing ring around target */}
      <div
        className="fixed z-[9999] pointer-events-none rounded-lg"
        style={{
          top,
          left,
          width,
          height,
          boxShadow: `0 0 0 3px ${colors.gold}, 0 0 0 6px ${colors.gold}40`,
          animation: 'spotlight-pulse 1.5s ease-in-out infinite',
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-[9999] max-w-xs rounded-lg shadow-lg border px-4 py-3 flex items-start gap-2"
        style={{
          top: tooltipBelow ? rect.bottom + padding + 12 : undefined,
          bottom: tooltipBelow ? undefined : window.innerHeight - rect.top + padding + 12,
          left: Math.max(12, Math.min(rect.left, window.innerWidth - 280)),
          backgroundColor: colors.white,
          borderColor: colors.gold,
        }}
      >
        <p className="text-sm flex-1" style={{ color: colors.brown }}>
          {target.hint}
        </p>
        <button
          onClick={dismiss}
          className="flex-shrink-0 p-0.5 rounded hover:bg-gray-100"
          style={{ color: colors.brownLight }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Keyframes for pulse animation */}
      <style>{`
        @keyframes spotlight-pulse {
          0%, 100% { box-shadow: 0 0 0 3px ${colors.gold}, 0 0 0 6px ${colors.gold}40; }
          50% { box-shadow: 0 0 0 4px ${colors.gold}, 0 0 0 12px ${colors.gold}20; }
        }
      `}</style>
    </>
  );
}
