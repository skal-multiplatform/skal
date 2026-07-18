// Site interactions (ex assets/site.js) — run from onMount after render.
export function initSiteBehaviors() {
  const reduced = globalThis.__skalPrerender || matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── reveal on scroll ─────────────────────────────────────────── */
  const revealed = document.querySelectorAll('.rv');
  if (reduced || !('IntersectionObserver' in window)) {
    revealed.forEach(el => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealed.forEach(el => io.observe(el));
  }

  /* ── animated stat counters ───────────────────────────────────── */
  const counters = document.querySelectorAll('[data-count]');
  const runCount = el => {
    const target = parseFloat(el.dataset.count);
    const decimals = (el.dataset.count.split('.')[1] || '').length;
    const dur = 1100;
    const t0 = performance.now();
    const tick = now => {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (reduced || !('IntersectionObserver' in window)) {
    counters.forEach(el => { el.textContent = el.dataset.count; });
  } else {
    const cio = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) { runCount(e.target); cio.unobserve(e.target); }
      }
    }, { threshold: 0.6 });
    counters.forEach(el => cio.observe(el));
  }

  /* ── copy-to-clipboard on install commands ────────────────────── */
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        const was = btn.textContent;
        btn.textContent = 'copied';
        setTimeout(() => { btn.textContent = was; }, 1400);
      } catch { /* clipboard unavailable — ignore */ }
    });
  });

  /* ── live phone demo: the hero code drives the mockup ─────────── */
  const label = document.getElementById('demo-label');
  const tapBtn = document.getElementById('demo-tap');
  const resetBtn = document.getElementById('demo-reset');
  const chip = document.getElementById('op-chip');
  const opCount = document.getElementById('op-count');
  if (label && tapBtn) {
    let n = 0, ops = 39; /* 39 = widgets mounted at boot */
    const render = () => {
      label.textContent = n === 0 ? 'Tap the button' : `Tapped ${n} time${n === 1 ? '' : 's'}`;
      if (opCount) opCount.textContent = String(ops);
    };
    const flyChip = text => {
      if (!chip || reduced) return;
      chip.textContent = text;
      chip.classList.remove('fly');
      void chip.offsetWidth; /* restart animation */
      chip.classList.add('fly');
    };
    const press = btn => {
      if (reduced) return;
      btn.classList.remove('tapped');
      void btn.offsetWidth;
      btn.classList.add('tapped');
    };
    const tap = () => { n++; ops++; render(); press(tapBtn); flyChip('SET_TEXT · 14 B'); };
    const reset = () => { n = 0; ops++; render(); press(resetBtn); flyChip('SET_TEXT · 14 B'); };
    tapBtn.addEventListener('click', tap);
    if (resetBtn) resetBtn.addEventListener('click', reset);
    render();
    /* ambient auto-demo until the user interacts */
    if (!reduced) {
      let auto = setInterval(() => { (n >= 7 ? reset : tap)(); }, 2200);
      const stop = () => { clearInterval(auto); auto = null; };
      tapBtn.addEventListener('pointerdown', stop, { once: true });
      if (resetBtn) resetBtn.addEventListener('pointerdown', stop, { once: true });
    }
  }

  /* ── phone clock ──────────────────────────────────────────────── */
  const clock = document.getElementById('phone-clock');
  if (clock) {
    const d = new Date();
    clock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /* ── footer year ──────────────────────────────────────────────── */
  const yr = document.getElementById('yr');
  if (yr) yr.textContent = String(new Date().getFullYear());
}

// "▶ run live" buttons on the components reference: drive the shared
// Flutter-wasm player to that demo (one engine, per-component links).
// The player boots asynchronously (lazy iframe + wasm engine), so a click
// before its listener is registered is queued and flushed when the player
// posts back `skal-gallery-ready`. Demos are addressed by slug so the
// wiring survives the docs and the wasm bundle being regenerated apart.
export function initRunLive() {
  const box = document.querySelector('.live-gallery');
  if (!box) return;
  const player = box.querySelector('iframe');
  if (!player) return;
  let ready = false;
  let pending = null;
  const send = (slug) =>
    player.contentWindow?.postMessage({ type: 'skal-gallery-demo', slug }, '*');
  window.addEventListener('message', (e) => {
    if (e.data?.type !== 'skal-gallery-ready') return;
    ready = true;
    if (pending != null) { send(pending); pending = null; }
  });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-run-demo]');
    if (!btn) return;
    const slug = btn.dataset.runDemo;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (ready) send(slug);
    else pending = slug;
  });
}
