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
 * Briefly lock overflow-y on a scroll container so Safari's
 * scroll-into-view is a no-op, then restore.
 */
function freezeScroll(sp: HTMLElement): void {
  const scrollTop = sp.scrollTop;

  sp.style.overflowY = 'hidden';

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    sp.style.overflowY = '';
    sp.scrollTop = scrollTop;
  };

  requestAnimationFrame(() => requestAnimationFrame(restore));
  setTimeout(restore, 200);
}

/**
 * Prevent iPadOS Safari from scrolling the nearest scroll container
 * when an already-visible input is focused or typed into.
 *
 * Safari triggers scroll-into-view not only on focus but also after
 * React re-renders caused by keystrokes. We freeze on focus AND on
 * every keydown while the element is focused.
 */
export function preventScrollJump(el: HTMLElement): void {
  const sp = findScrollParent(el);
  if (!sp) return;

  // Only intervene if the element is visible within the scroll container.
  const cr = sp.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  if (er.top < cr.top || er.bottom > cr.bottom) return;

  // Freeze for the initial focus event.
  freezeScroll(sp);

  // Also freeze on each keystroke so React re-renders don't cause jumps.
  const onKeyDown = () => freezeScroll(sp);
  el.addEventListener('keydown', onKeyDown);

  const onBlur = () => {
    el.removeEventListener('keydown', onKeyDown);
    el.removeEventListener('blur', onBlur);
  };
  el.addEventListener('blur', onBlur);
}
