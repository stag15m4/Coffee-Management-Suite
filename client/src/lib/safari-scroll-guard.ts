/**
 * Global iPad Safari scroll-jump fix.
 *
 * Safari automatically scrolls focused elements into view whenever the
 * DOM changes (React re-renders from onChange, TanStack Query refetches,
 * debounced saves, visibility-change refreshes, etc.). This fires
 * asynchronously — often 200ms–1.5s after the keystroke — well past a
 * short per-event guard.
 *
 * This module installs a single global `focusin` listener on `document`
 * that protects EVERY <input>, <textarea>, and [contenteditable] element
 * automatically — regardless of whether it uses the shadcn Input/Textarea
 * components. This eliminates the ~45 native HTML inputs across the
 * recipe-costing, coffee-order, kiosk, and other pages that previously
 * had no protection.
 *
 * User-initiated scrolls (wheel / trackpad / touch) are allowed through;
 * only Safari's automatic scroll-into-view is blocked.
 */

const guarded = new WeakSet<Element>();

function attachScrollGuard(el: HTMLElement): void {
  if (guarded.has(el)) return;
  guarded.add(el);

  let expectedScrollY = window.scrollY;
  let userScrolling = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  // When the user scrolls intentionally (wheel = trackpad/mouse,
  // touchmove = finger), let the scroll happen and update our anchor.
  const markUserScroll = () => {
    userScrolling = true;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      userScrolling = false;
      expectedScrollY = window.scrollY;
    }, 150);
  };

  const onScroll = () => {
    if (userScrolling) return;
    if (Math.abs(window.scrollY - expectedScrollY) > 1) {
      window.scrollTo(0, expectedScrollY);
    }
  };

  // Update anchor on keydown — the user may have scrolled between
  // keystrokes via trackpad, and we want the latest position.
  const onKeyDown = () => {
    expectedScrollY = window.scrollY;
  };

  window.addEventListener('scroll', onScroll);
  window.addEventListener('wheel', markUserScroll, { passive: true });
  window.addEventListener('touchmove', markUserScroll, { passive: true });
  el.addEventListener('keydown', onKeyDown);

  el.addEventListener('blur', () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', markUserScroll);
    window.removeEventListener('touchmove', markUserScroll);
    el.removeEventListener('keydown', onKeyDown);
    if (settleTimer) clearTimeout(settleTimer);
    guarded.delete(el);
  }, { once: true });
}

// Single global listener — captures focusin on any input/textarea in the app.
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  ) {
    attachScrollGuard(el);
  }
});
