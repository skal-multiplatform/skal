/* Skal site interactions. No dependencies, respects reduced motion. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
})();
