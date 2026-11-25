(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GRID = window.GRID || { setStage() {}, eta: 0.6 };

  // sections drive the camera
  const sections = [...document.querySelectorAll('[data-cam]')];
  const sld = [...document.querySelectorAll('.sld a')];
  let current = null;
  function pick() {
    const mid = innerHeight * 0.5;
    let found = sections[0];
    for (const s of sections) { const r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) { found = s; break; } }
    if (found === current) return;
    current = found;
    GRID.setStage && GRID.setStage(found.dataset.cam);
    sld.forEach(a => a.classList.toggle('on', a.dataset.for === found.id));
    document.body.classList.toggle('at-contact', found.id === 'contact');
    document.body.classList.toggle('wide-on', found.classList.contains('wide') || found.id === 'map');
  }
  addEventListener('scroll', pick, { passive: true }); addEventListener('resize', pick); pick();

  // light pollution slider (also drives the street lights in 3D)
  const r = document.getElementById('eta');
  if (r) {
    const out = document.getElementById('etaOut'), bIn = document.getElementById('bIn'), bLoss = document.getElementById('bLoss');
    const vIn = document.getElementById('vIn'), vLoss = document.getElementById('vLoss'), msg = document.getElementById('effMsg');
    const update = () => {
      let eta = parseInt(r.value, 10); if (!Number.isFinite(eta)) eta = 60; eta = Math.min(95, Math.max(30, eta));
      const input = 10000 / eta, loss = input - 100, scale = 340;
      out.textContent = eta; vIn.textContent = Math.round(input); vLoss.textContent = Math.round(loss);
      bIn.style.width = input / scale * 100 + '%'; bLoss.style.width = loss / scale * 100 + '%';
      GRID.eta = eta / 100;
      msg.textContent = eta < 50 ? 'Most of the energy is lighting the sky.'
        : eta < 80 ? `For every 100 units on the street, ${Math.round(loss)} go up and are lost.`
        : `Well aimed light. Only ${Math.round(loss)} units are lost for every 100 that are used.`;
    };
    r.addEventListener('input', update); update();
  }

  // gentle reveal
  if ('IntersectionObserver' in window && !reduce) {
    const els = document.querySelectorAll('.panel > *, .case, .now-list li, .wide h2, .map-inner > *, .contact > *');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => { el.classList.add('rv'); io.observe(el); });
  }
})();
