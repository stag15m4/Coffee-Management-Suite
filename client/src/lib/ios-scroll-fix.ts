// iOS Safari scroll-jump prevention
//
// When a user taps an input on iOS Safari, the virtual keyboard appears and
// the browser scrolls the page to keep the input visible — even when the
// input is ALREADY visible. This creates a jarring "jump" effect.
//
// Strategy:
//  1. Track touch events to distinguish tap-focus from keyboard (tab) focus.
//  2. On tap-focus, capture the current scroll position.
//  3. Listen for visualViewport resize (keyboard appearing) + timeout fallbacks.
//  4. On each tick, check whether the input would still be visible at the
//     original scroll position (accounting for the now-smaller viewport).
//  5. If yes → restore scroll. If no → let the browser's scroll stand.

let lastTouchTime = 0;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'touchstart',
    () => { lastTouchTime = Date.now(); },
    { passive: true, capture: true },
  );
}

/** Returns true when the most recent focus was initiated by a touch (tap). */
export function isTouchFocus(): boolean {
  return Date.now() - lastTouchTime < 500;
}

/**
 * Prevent iOS Safari from scrolling (jumping) when an already-visible input
 * is focused and the virtual keyboard appears.
 */
export function preventScrollJump(el: HTMLElement): void {
  const scrollY = window.scrollY;
  const rect = el.getBoundingClientRect();
  const vv = window.visualViewport;
  const vpHeight = vv?.height ?? window.innerHeight;

  // Only intervene if the element is currently visible on screen.
  if (rect.top < 0 || rect.bottom > vpHeight) return;

  let done = false;

  const restore = () => {
    if (done) return;

    // Would the element still be visible at the original scroll position,
    // given the (possibly smaller) viewport after the keyboard appeared?
    const newVpH = vv?.height ?? window.innerHeight;
    const absTop = window.scrollY + el.getBoundingClientRect().top;
    const topIfRestored = absTop - scrollY;
    const bottomIfRestored = topIfRestored + el.offsetHeight;

    if (topIfRestored >= 0 && bottomIfRestored <= newVpH) {
      // Input fits above the keyboard → undo the jump.
      if (Math.abs(window.scrollY - scrollY) > 1) {
        window.scrollTo(0, scrollY);
      }
    } else {
      // Input would be behind the keyboard — stop restoring.
      done = true;
    }
  };

  // visualViewport "resize" fires when the keyboard appears/disappears.
  const onResize = () => {
    requestAnimationFrame(restore);
    setTimeout(restore, 50);
  };
  if (vv) vv.addEventListener('resize', onResize);

  // Timeout fallbacks covering the full iOS keyboard animation (~400 ms).
  requestAnimationFrame(restore);
  setTimeout(restore, 50);
  setTimeout(restore, 150);
  setTimeout(restore, 300);
  setTimeout(restore, 500);

  // Cleanup after 1 s or on blur — whichever comes first.
  const cleanup = () => {
    done = true;
    if (vv) vv.removeEventListener('resize', onResize);
  };
  setTimeout(cleanup, 1000);
  el.addEventListener('blur', cleanup, { once: true });
}
