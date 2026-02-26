// iPadOS Safari scroll-jump prevention
//
// Safari automatically scrolls the nearest scrollable ancestor when an input
// is focused or when React re-renders while an input is focused. With the
// viewport locked (html/body overflow:hidden), <main> is that ancestor.
//
// Strategy: set overflow-y:hidden on the scroll container for the entire
// focus duration so Safari literally cannot scroll it. User-initiated
// scrolling (trackpad wheel) is handled manually via the wheel event.

let lastTabTime = 0;

if (typeof document !== 'undefined') {
  document.addEventListener(
    'keydown',
    (e) => { if (e.key === 'Tab') lastTabTime = Date.now(); },
    { capture: true },
  );
}

/** Returns true when the most recent focus was initiated by pressing Tab. */
export function isTabFocus(): boolean {
  return Date.now() - lastTabTime < 200;
}

/**
 * Find the nearest ancestor that is actually scrollable
 * (has overflow-y auto/scroll AND content taller than its box).
 */
function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Prevent iPadOS Safari from scrolling the nearest scroll container
 * when an already-visible input is focused or typed into.
 *
 * Locks the scroll container (overflow-y:hidden) for the entire focus
 * duration so Safari's scroll-into-view is impossible. Trackpad/mouse
 * wheel scrolling is still supported via a manual wheel handler.
 * Cleans up on blur.
 */
export function preventScrollJump(el: HTMLElement): void {
  const sp = findScrollParent(el);
  if (!sp) return;

  // Only intervene if the element is visible within the scroll container.
  const cr = sp.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  if (er.top < cr.top || er.bottom > cr.bottom) return;

  // Lock: make the container non-scrollable so Safari can't touch it.
  sp.style.overflowY = 'hidden';

  // Allow user-initiated scrolling via trackpad / mouse wheel.
  // overflow:hidden prevents gesture scrolling, but programmatic
  // scrollTop changes still work.
  const onWheel = (e: WheelEvent) => {
    sp.scrollTop += e.deltaY;
  };
  sp.addEventListener('wheel', onWheel, { passive: true });

  // Restore on blur.
  const cleanup = () => {
    sp.style.overflowY = '';
    sp.removeEventListener('wheel', onWheel);
    el.removeEventListener('blur', cleanup);
  };
  el.addEventListener('blur', cleanup);
}
