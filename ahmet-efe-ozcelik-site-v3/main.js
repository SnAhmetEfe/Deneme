(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GRID = window.GRID || { setStage() {}, eta: 0.7, energy: 0.4 };

  // ---- sections drive the camera
  const sections = [...document.querySelectorAll('[data-cam]')];
  const sld = [...document.querySelectorAll('.sld a')];
  const hudStage = document.getElementById('hudStage');
  let current = null;
  function pick() {
    const mid = innerHeight * 0.5;
    let found = sections[0];
    for (const s of sections) { const r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) { found = s; break; } }
    if (found === current) return;
    current = found;
    GRID.setStage && GRID.setStage(found.dataset.cam);
    if (hudStage) hudStage.textContent = found.dataset.stage || '';
    sld.forEach(a => a.classList.toggle('on', a.dataset.for === found.id));
    document.body.classList.toggle('at-contact', found.id === 'contact');
    document.body.classList.toggle('wide-on', found.classList.contains('wide'));
  }
  addEventListener('scroll', pick, { passive: true }); addEventListener('resize', pick); pick();

  // ---- oscilloscope: three phases, amplitude follows system energy
  const sc = document.getElementById('scope'), sx = sc && sc.getContext('2d');
  const load = document.getElementById('hudLoad');
  let ph = 0, lastLoad = -1;
  function scope() {
    if (!sx) return;
    const e = GRID.energy || 0.4, w = sc.width, h = sc.height;
    sx.clearRect(0, 0, w, h);
    sx.strokeStyle = 'rgba(242,241,234,.08)'; sx.lineWidth = 1;
    sx.beginPath(); sx.moveTo(0, h / 2); sx.lineTo(w, h / 2); sx.stroke();
    const cols = ['rgba(61,205,88,.95)', 'rgba(242,241,234,.65)', 'rgba(138,143,136,.8)'];
    for (let k = 0; k < 3; k++) {
      sx.strokeStyle = cols[k]; sx.lineWidth = 1.5; sx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y = h / 2 - Math.sin(x / w * Math.PI * 4 + ph - k * 2.094) * (h * 0.38) * (0.45 + e * 0.55);
        x ? sx.lineTo(x, y) : sx.moveTo(x, y);
      }
      sx.stroke();
    }
    if (!reduce) ph += 0.05 + e * 0.08;
    const l = Math.round(e * 100);
    if (load && l !== lastLoad) { load.textContent = 'LOAD ' + l + '%'; lastLoad = l; }
    requestAnimationFrame(scope);
  }
  scope();

  // ---- efficiency experiment (also drives the factory in 3D)
  const r = document.getElementById('eta');
  if (r) {
    const out = document.getElementById('etaOut'), bIn = document.getElementById('bIn'), bLoss = document.getElementById('bLoss');
    const vIn = document.getElementById('vIn'), vLoss = document.getElementById('vLoss'), msg = document.getElementById('effMsg');
    const update = () => {
      let eta = parseInt(r.value, 10); if (!Number.isFinite(eta)) eta = 70; eta = Math.min(98, Math.max(40, eta));
      const input = 10000 / eta, loss = input - 100, scale = 250;
      out.textContent = eta; vIn.textContent = Math.round(input); vLoss.textContent = Math.round(loss);
      bIn.style.width = input / scale * 100 + '%'; bLoss.style.width = loss / scale * 100 + '%';
      GRID.eta = eta / 100;
      const d = 10000 / 70 - input;
      msg.textContent = eta === 70 ? 'At 70%, almost a third of the input leaves as heat.'
        : d > 0 ? `Versus 70%: ${Math.round(d)} fewer units of input for the same work.`
        : `Versus 70%: ${Math.round(-d)} more units of input for the same work.`;
    };
    r.addEventListener('input', update); update();
  }

  // ---- gentle reveal
  if ('IntersectionObserver' in window && !reduce) {
    const els = document.querySelectorAll('.panel > *, .case, .now-list li, .wide h2, .contact > *');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => { el.classList.add('rv'); io.observe(el); });
  }
})();
