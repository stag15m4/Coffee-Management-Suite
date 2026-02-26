// iPadOS Safari scroll-jump prevention
//
// Scroll prevention is handled purely via CSS (see index.css):
// 1. A brief opacity animation on :focus prevents Safari's initial
//    scroll-into-view (Safari skips scrolling invisible elements).
// 2. scroll-margin constrains any residual scroll distance.
// 3. The viewport lock (html/body overflow:hidden) prevents document-level scroll.
//
// This file only exports helpers used by the Input/Textarea components.

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
