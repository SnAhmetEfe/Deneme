(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layers = {}; document.querySelectorAll('.layer').forEach(l => layers[l.dataset.art] = l);
  const ART = { hero: 'hero', gen: 'gen', tx: 'tx', dist: 'dist', use: 'use', over: 'hero', plan: 'hero' };

  // sections choose the painting
  const sections = [...document.querySelectorAll('[data-cam]')];
  const rail = [...document.querySelectorAll('.rail a')];
  let current = null, active = layers.hero;
  function pick() {
    const mid = innerHeight * 0.5;
    let found = sections[0];
    for (const s of sections) { const r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) { found = s; break; } }
    if (found !== current) {
      current = found;
      const next = layers[ART[found.dataset.cam]] || layers.hero;
      if (next !== active) { active.classList.remove('on'); next.classList.add('on'); active = next; }
      document.body.classList.toggle('dim', found.dataset.cam === 'over' || found.dataset.cam === 'plan');
      document.body.classList.toggle('at-contact', found.id === 'contact');
      document.body.classList.toggle('no-rail', !found.classList.contains('chapter'));
      rail.forEach(a => a.classList.toggle('on', a.dataset.for === found.id));
    }
    // scroll moves the camera slowly through the painting
    if (!reduce) {
      const r = found.getBoundingClientRect(), p = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight * 0.5)));
      active.style.setProperty('--s', (1.04 + p * 0.06).toFixed(4));
    }
  }
  layers.hero.classList.add('on');
  addEventListener('scroll', pick, { passive: true }); addEventListener('resize', pick); pick();

  // cursor moves the painting a little, like looking through a window
  if (!reduce && matchMedia('(pointer:fine)').matches) {
    let tx = 0, ty = 0, x = 0, y = 0;
    addEventListener('pointermove', e => { tx = (e.clientX / innerWidth - .5) * -18; ty = (e.clientY / innerHeight - .5) * -12; }, { passive: true });
    (function loop() {
      x += (tx - x) * .05; y += (ty - y) * .05;
      active.style.setProperty('--px', x.toFixed(2) + 'px'); active.style.setProperty('--py', y.toFixed(2) + 'px');
      requestAnimationFrame(loop);
    })();
  }

  // generator: clicking the page sends more current through the coupling
  const pulse = document.querySelector('.pulse');
  document.getElementById('generate').addEventListener('click', e => {
    if (e.target.closest('a,button,input')) return;
    pulse.style.setProperty('--glow', 1); setTimeout(() => pulse.style.setProperty('--glow', .35), 600);
  });

  // city: the slider decides how much light escapes to the sky
  const city = layers.use, stars = city.querySelector('.stars'), sc = stars.getContext('2d');
  const STARS = Array.from({ length: 180 }, () => [Math.random(), Math.random() * .55, Math.random() * 1.3 + .3, Math.random()]);
  function drawStars(eta) {
    const w = stars.clientWidth, h = stars.clientHeight;
    if (stars.width !== w) { stars.width = w; stars.height = h; }
    sc.clearRect(0, 0, w, h);
    const vis = Math.max(0, (eta - .45) / .5);
    for (const [x, y, r, b] of STARS) {
      if (b > vis) continue;
      sc.globalAlpha = .4 + .6 * (vis - b); sc.fillStyle = '#F4F0E4';
      sc.beginPath(); sc.arc(x * w, y * h, r, 0, 6.3); sc.fill();
    }
  }
  const r = document.getElementById('eta');
  if (r) {
    const out = document.getElementById('etaOut'), msg = document.getElementById('effMsg');
    const update = () => {
      let v = parseInt(r.value, 10); if (!Number.isFinite(v)) v = 60; v = Math.min(95, Math.max(30, v));
      out.textContent = v;
      const eta = v / 100;
      city.style.setProperty('--loss', ((1 - eta) * 1.4).toFixed(3));
      city.style.setProperty('--cityb', (0.75 + (1 - eta) * 0.4).toFixed(3));
      drawStars(eta);
      msg.textContent = v < 50 ? 'More than half the light goes to the sky.'
        : v < 85 ? `${100 - v} out of every 100 units still light the sky instead of the street.`
        : 'Most of the light lands where people need it, and the stars come back.';
    };
    r.addEventListener('input', update); addEventListener('resize', update); update();
  }

  if ('IntersectionObserver' in window && !reduce) {
    const els = document.querySelectorAll('.col > *, .case, .tools > div, .learn > div, .sheet h2, .contact > *');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => { el.classList.add('rv'); io.observe(el); });
  }
})();
