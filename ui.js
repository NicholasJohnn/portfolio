/* Page behaviour that doesn't need the 3D world: the section-to-section glide, the intro and the
   scroll-in reveals. A plain script, so it keeps working if WebGL is unavailable or the 3D scripts fail.
   main.js calls window.startIntro() once the 3D scene is ready (or straight away if it can't start). */

// Respects the visitor's "reduce motion" setting. Add ?motion=full to the address to preview the full-motion version anyway.
var uiReduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  && new URLSearchParams(location.search).get('motion') !== 'full';

/* ============================================================
   Checkpoint scrolling for the opening sections.
   Hero → About → Experience → Featured: one scroll gesture glides to the next
   text, centred on screen. Below Featured, scrolling is normal again.
   ============================================================ */
(() => {
  const sections = [
    document.querySelector('.hero'),
    document.querySelector('.about'),
    document.querySelector('.featured'),
  ].filter(Boolean);   // a missing section (e.g. a cached old page) is skipped, not a crash
  const root = document.documentElement;
  const maxY = () => root.scrollHeight - innerHeight;
  // Each stop centres the section's content (its card) in the space under the menu. If the content is taller
  // than that space, the stop puts its top just below the menu, and a second stop shows its bottom, so a
  // swipe never skips part of a card.
  const MENU = 96;
  const clampY = y => Math.max(0, Math.min(maxY(), Math.round(y)));
  const content = s => {
    const c = s.querySelector('.card, .featured-inner') || s;
    return { top: s.offsetTop + (c === s ? 0 : c.offsetTop), h: c.offsetHeight };   // offsets ignore reveal transforms
  };
  const stops = () => sections.map((s, i) => {          // one stop per section (menu links use these)
    if (i === 0) return 0;
    const { top, h } = content(s);
    return clampY(h > innerHeight - MENU - 24 ? top - MENU : top + h / 2 - (innerHeight + MENU) / 2);
  });
  const allStops = () => {                              // plus a "see the rest" stop for tall content
    const base = stops(), out = [];
    sections.forEach((s, i) => {
      out.push(base[i]);
      if (i === 0) return;
      const { top, h } = content(s);
      const tail = clampY(top + h + 24 - innerHeight);
      if (tail > base[i] + 8) out.push(tail);
    });
    return out;
  };
  const lastStop = () => allStops().at(-1);
  const locked = () => root.classList.contains('g-lock');            // gallery open

  let anim = null;
  function glideTo(y) {
    y = Math.max(0, Math.min(maxY(), y));
    if (anim) cancelAnimationFrame(anim.raf);
    const from = scrollY, dist = y - from;
    if (Math.abs(dist) < 2) return;
    // glides even with reduce-motion: a short, user-started scroll reads better than a hard jump
    const dur = Math.min(1100, 650 + Math.abs(dist) * 0.25);
    const t0 = performance.now();
    const easeIO = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    anim = { raf: 0 };
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      scrollTo(0, from + dist * easeIO(k));
      if (k < 1) anim.raf = requestAnimationFrame(step); else anim = null;
    };
    anim.raf = requestAnimationFrame(step);
  }
  function go(dir) {                                   // dir: +1 next, -1 previous
    const s = allStops(), y = scrollY;
    if (dir > 0) { const i = s.findIndex(v => v > y + 4); if (i >= 0) glideTo(s[i]); }
    else { let i = -1; s.forEach((v, k) => { if (v < y - 4) i = k; }); glideTo(i >= 0 ? s[i] : 0); }
  }
  // Should this gesture be handled as a checkpoint move (instead of normal scrolling)?
  function inZone(dir) {
    const y = scrollY, last = lastStop();
    if (dir > 0) return y < last - 4;                                    // still before Featured
    return y > 2 && y <= last + innerHeight * 0.6;                       // coming back up into the intro
  }

  // Mouse wheel / trackpad: one gesture = one checkpoint. Trackpad momentum is swallowed.
  let lastWheel = 0, gestureUsed = false;
  addEventListener('wheel', e => {
    if (locked() || e.ctrlKey) return;
    const now = performance.now();
    const newGesture = now - lastWheel > 180;
    lastWheel = now;
    const dir = Math.sign(e.deltaY);
    if (!dir) return;
    if (anim || (!newGesture && gestureUsed)) {        // mid-glide or trailing momentum
      if (anim || inZone(dir)) e.preventDefault();
      return;
    }
    gestureUsed = false;
    if (!inZone(dir)) return;                          // normal scrolling below the intro
    e.preventDefault();
    if (Math.abs(e.deltaY) < 4) return;                // ignore tiny trackpad jitter
    gestureUsed = true;
    go(dir);
  }, { passive: false });

  // Keyboard
  addEventListener('keydown', e => {
    if (locked() || e.defaultPrevented || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (e.key === ' ' && e.target.closest?.('a, button')) return;          // Space presses a focused button, it doesn't scroll
    const down = ['ArrowDown', 'PageDown', ' '].includes(e.key) && !e.shiftKey;
    const up = ['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey);
    const dir = down ? 1 : up ? -1 : 0;
    if (!dir || !inZone(dir)) return;
    e.preventDefault();
    go(dir);
  });

  // Touch: a swipe moves one checkpoint
  let touch = null;
  addEventListener('touchstart', e => { if (!locked()) touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, moved: false }; }, { passive: true });
  addEventListener('touchmove', e => {
    if (!touch || locked()) return;
    const dy = touch.y - e.touches[0].clientY;
    const dx = touch.x - e.touches[0].clientX;
    if (!touch.moved && Math.abs(dx) > Math.abs(dy)) { touch = null; return; }   // sideways swipe (e.g. the work row): leave it alone
    const dir = Math.sign(dy);
    if (dir && (anim || inZone(dir))) { e.preventDefault(); touch.moved = true; touch.dir = dir; touch.dy = dy; }
  }, { passive: false });
  addEventListener('touchend', () => {
    if (touch?.moved && Math.abs(touch.dy) > 30 && !anim) go(touch.dir);
    touch = null;
  });

  // No snap-back: if someone drags the scrollbar or lands between checkpoints, the page stays where they put it.

  // In-page links (menu, logo) glide to their section; intro sections land on their checkpoint.
  // Gallery buttons (data-gallery) are handled separately and open the 3D gallery instead.
  const checkpointOf = { '#top': 0, '#about': 1, '#work': 2 };
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (a.hasAttribute('data-gallery') || href === '#') return;
    const el = document.querySelector(href);
    if (!el) return;
    e.preventDefault();
    if (locked()) return;
    const isCard = el.classList.contains('proj');            // hero tiles point at project cards
    glideTo(href in checkpointOf ? stops()[checkpointOf[href]]
      : el.getBoundingClientRect().top + scrollY - (isCard ? 110 : 0));   // cards stop clear of the menu
    if (isCard) {                                            // brief highlight so it's clear where you landed
      el.classList.remove('arrived'); void el.offsetWidth; el.classList.add('arrived');
      setTimeout(() => el.classList.remove('arrived'), 1800);
    }
    if (e.detail === 0) {                                    // keyboard activation: move focus too
      if (!isCard) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }
  }));
})();

/* ============================================================
   Intro and reveals (started by main.js, or by the fallback below)
   ============================================================ */
window.startIntro = (() => {
  let started = false;
  return function startIntro() {
    if (started) return;
    started = true;
    const gsap = window.gsap;
    const fill = document.getElementById('loaderFill');
    if (fill) fill.style.width = '100%';
    setTimeout(() => {
      document.getElementById('loader')?.classList.add('done');
      if (gsap && !uiReduceMotion) {
        gsap.from('.hero-title .line span', { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.12, delay: 0.15 });
      }
    }, 450);
    if (gsap && window.ScrollTrigger && !uiReduceMotion) {
      gsap.registerPlugin(window.ScrollTrigger);
      // Hero items are on screen from the start, so they fade in on load instead of waiting for a scroll trigger
      gsap.from('.hero .reveal', { y: 30, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.1, delay: 0.5 });
      gsap.utils.toArray('.reveal').filter(el => !el.closest('.hero')).forEach(el => {
        gsap.from(el, {
          y: 46, opacity: 0, duration: 1.1, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%' },
        });
      });
    }
  };
})();
