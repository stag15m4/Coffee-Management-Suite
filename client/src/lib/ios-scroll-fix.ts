// iPadOS Safari scroll-jump prevention
//
// With the viewport locked (html/body overflow:hidden), Safari's focus-scroll
// targets the nearest scrollable ancestor (<main> in AppLayout). For pages
// where <main> has scroll content, Safari scrolls it when inputs are focused
// even when they're already visible.
//
// This module freezes the scroll container's scrollTop during focus by
// listening for scroll events and immediately restoring the position.

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
 * Find the nearest ancestor with overflow-y: auto or scroll.
 */
function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Prevent iPadOS Safari from scrolling the nearest scroll container
 * when an already-visible input is focused.
 */
export function preventScrollJump(el: HTMLElement): void {
  const sp = findScrollParent(el);
  if (!sp) return;

  // Only intervene if the element is visible within the scroll container.
  const cr = sp.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  if (er.top < cr.top || er.bottom > cr.bottom) return;

  const scrollTop = sp.scrollTop;
  let done = false;

  const restore = () => {
    if (done) return;
    if (Math.abs(sp.scrollTop - scrollTop) > 1) {
      sp.scrollTop = scrollTop;
    }
  };

  // Catch any scroll the browser attempts on the container.
  sp.addEventListener('scroll', restore);

  // Fallback checks at known intervals.
  requestAnimationFrame(restore);
  setTimeout(restore, 0);
  setTimeout(restore, 50);
  setTimeout(restore, 100);
  setTimeout(restore, 200);
  setTimeout(restore, 400);

  const cleanup = () => {
    done = true;
    sp.removeEventListener('scroll', restore);
  };

  setTimeout(cleanup, 600);
  el.addEventListener('blur', cleanup, { once: true });
}
