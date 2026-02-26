// iPadOS Safari scroll-jump prevention
//
// With the viewport locked (html/body overflow:hidden), Safari's focus-scroll
// targets the nearest scrollable ancestor (<main> in AppLayout). We freeze
// that container briefly during focus so the scroll attempt is absorbed.

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
 * when an already-visible input is focused.
 *
 * Temporarily sets overflow-y:hidden on the scroll container so
 * Safari's focus-scroll is a no-op. Restores after 2 animation frames.
 */
export function preventScrollJump(el: HTMLElement): void {
  const sp = findScrollParent(el);
  if (!sp) return;

  // Only intervene if the element is visible within the scroll container.
  const cr = sp.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  if (er.top < cr.top || er.bottom > cr.bottom) return;

  const scrollTop = sp.scrollTop;

  // Freeze: overflow-y hidden prevents any scroll attempt.
  // On iPad Safari, scrollbars are overlay so this causes no layout shift.
  sp.style.overflowY = 'hidden';

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    sp.style.overflowY = '';
    sp.scrollTop = scrollTop;
  };

  // Unfreeze after Safari's focus-scroll has been absorbed.
  requestAnimationFrame(() => requestAnimationFrame(restore));
  setTimeout(restore, 200);
}
