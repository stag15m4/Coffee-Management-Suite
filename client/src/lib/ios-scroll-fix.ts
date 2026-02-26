// iPadOS Safari scroll-jump prevention
//
// Safari scrolls the page when focusing inputs, even when they're already
// visible. This happens with both the virtual keyboard AND the Magic Keyboard
// trackpad. The scroll-restore approach (capturing scrollY and restoring it
// via timeouts) doesn't reliably work because Safari can re-scroll or shift
// the visual viewport independently of window.scrollY.
//
// Strategy: temporarily set position:fixed on the <body> so there is nothing
// for Safari to scroll. After two animation frames (enough for the browser to
// process the focus and give up on scrolling), release the lock and restore
// the original scroll position.

let lastTouchTime = 0;
let lastTabTime = 0;

if (typeof document !== 'undefined') {
  document.addEventListener(
    'touchstart',
    () => { lastTouchTime = Date.now(); },
    { passive: true, capture: true },
  );
  document.addEventListener(
    'keydown',
    (e) => { if (e.key === 'Tab') lastTabTime = Date.now(); },
    { capture: true },
  );
}

/** Returns true when the most recent focus was initiated by a touch (tap). */
export function isTouchFocus(): boolean {
  return Date.now() - lastTouchTime < 500;
}

/** Returns true when the most recent focus was initiated by pressing Tab. */
export function isTabFocus(): boolean {
  return Date.now() - lastTabTime < 200;
}

/**
 * Prevent iPadOS Safari from scrolling when an already-visible input is
 * focused. Works with both virtual keyboard and Magic Keyboard / trackpad.
 */
export function preventScrollJump(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const vv = window.visualViewport;
  const vpHeight = vv?.height ?? window.innerHeight;

  // Only intervene if the element is currently visible on screen.
  if (rect.top < 0 || rect.bottom > vpHeight) return;

  const scrollY = window.scrollY;
  const body = document.body;

  // Freeze the page — with position:fixed the document can't scroll.
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.left = '0';
  body.style.right = '0';

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    window.scrollTo(0, scrollY);
  };

  // Two rAF ticks lets the browser process the focus event and abandon
  // its scroll attempt. The 150 ms timeout is a safety net.
  requestAnimationFrame(() => requestAnimationFrame(release));
  setTimeout(release, 150);
}
