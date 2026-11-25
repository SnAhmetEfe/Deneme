(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = window.SCENE || { setStage() {} };

  const sections = [...document.querySelectorAll('[data-cam]')];
  const rail = [...document.querySelectorAll('.rail a')];
  let current = null;
  function pick() {
    const mid = innerHeight * 0.5;
    let found = sections[0];
    for (const s of sections) { const r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) { found = s; break; } }
    if (found === current) return;
    current = found;
    S.setStage(found.dataset.cam);
    document.body.classList.toggle('dim', found.classList.contains('sheet'));
    document.body.classList.toggle('night', ['dist', 'use', 'plan'].includes(found.dataset.cam));
    document.body.classList.toggle('at-contact', found.id === 'contact');
    document.body.classList.toggle('no-rail', !found.classList.contains('chapter'));
    rail.forEach(a => a.classList.toggle('on', a.dataset.for === found.id));
  }
  addEventListener('scroll', pick, { passive: true }); addEventListener('resize', pick); pick();

  const r = document.getElementById('eta');
  if (r) {
    const out = document.getElementById('etaOut'), msg = document.getElementById('effMsg');
    const update = () => {
      let v = parseInt(r.value, 10); if (!Number.isFinite(v)) v = 60; v = Math.min(95, Math.max(30, v));
      out.textContent = v; S.eta = v / 100;
      msg.textContent = v < 50 ? 'More than half the light goes to the sky.'
        : v < 85 ? `${100 - v} out of every 100 units still light the sky instead of the street.`
        : 'Most of the light lands where people need it, and the stars come back.';
    };
    r.addEventListener('input', update); update();
  }

  if ('IntersectionObserver' in window && !reduce) {
    const els = document.querySelectorAll('.col > *, .case, .tools > div, .learn > div, .sheet h2, .contact > *');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => { el.classList.add('rv'); io.observe(el); });
  }
})();
