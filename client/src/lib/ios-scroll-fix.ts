// iPadOS Safari scroll-jump prevention
//
// Safari automatically scrolls the nearest scrollable ancestor when an input
// is focused or when React re-renders while an input is focused. With the
// viewport locked (html/body overflow:hidden), <main> is that ancestor.
//
// Strategy: attach a persistent scroll-event guard on focus that immediately
// reverses any scroll not initiated by the user (wheel / touch). The guard
// stays active for the entire focus duration and cleans up on blur.

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
 * Attaches a scroll-event guard that persists for the entire focus
 * duration. Any scroll that isn't preceded by a user gesture (wheel
 * or touch) is immediately reversed. Cleans up on blur.
 */
export function preventScrollJump(el: HTMLElement): void {
  const sp = findScrollParent(el);
  if (!sp) return;

  // Only intervene if the element is visible within the scroll container.
  const cr = sp.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  if (er.top < cr.top || er.bottom > cr.bottom) return;

  let savedScrollTop = sp.scrollTop;
  let userScrolling = false;
  let wheelTimer: ReturnType<typeof setTimeout> | null = null;

  // --- Detect user-initiated scrolls (trackpad wheel / touch) ---

  const onWheel = () => {
    userScrolling = true;
    if (wheelTimer) clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      userScrolling = false;
      savedScrollTop = sp.scrollTop;
    }, 150);
  };

  const onTouchStart = () => { userScrolling = true; };
  const onTouchEnd = () => {
    setTimeout(() => {
      userScrolling = false;
      savedScrollTop = sp.scrollTop;
    }, 100);
  };

  // --- Scroll guard: reverse any non-user scroll immediately ---

  const onScroll = () => {
    if (userScrolling) return;
    sp.scrollTop = savedScrollTop;
  };

  sp.addEventListener('scroll', onScroll);
  sp.addEventListener('wheel', onWheel, { passive: true });
  sp.addEventListener('touchstart', onTouchStart, { passive: true });
  sp.addEventListener('touchend', onTouchEnd, { passive: true });

  // --- Clean up on blur ---

  const cleanup = () => {
    sp.removeEventListener('scroll', onScroll);
    sp.removeEventListener('wheel', onWheel);
    sp.removeEventListener('touchstart', onTouchStart);
    sp.removeEventListener('touchend', onTouchEnd);
    el.removeEventListener('blur', cleanup);
    if (wheelTimer) clearTimeout(wheelTimer);
  };
  el.addEventListener('blur', cleanup);
}
