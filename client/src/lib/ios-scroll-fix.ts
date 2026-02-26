// iPadOS Safari input focus utilities
//
// Tracks touch and Tab-key events to determine HOW an input was focused,
// so we can gate behaviors like select-all appropriately.

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
