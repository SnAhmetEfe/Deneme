(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Energy wire: fills as the visitor reads
  const wire = document.querySelector('.wire');
  const bar = document.querySelector('.bar');
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    wire.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max) : 0);
    bar.classList.toggle('scrolled', scrollY > 10);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Active nav link
  const links = [...document.querySelectorAll('.bar nav a')];
  const secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const navIO = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(s => navIO.observe(s));

    // Path of energy: current flows through the chain once it is in view
    const chain = document.querySelector('.chain');
    const items = [...chain.children];
    const chainIO = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return;
      chain.style.setProperty('--flow', 1);
      items.forEach((li, i) => setTimeout(() => li.classList.add('lit'), reduce ? 0 : 250 + i * 520));
      chainIO.disconnect();
    }, { threshold: .45 });
    chainIO.observe(chain);

    // Gentle reveal
    if (!reduce) {
      const rv = document.querySelectorAll('.belief article, .timeline li, .case, .now-list li, .chapter-cols, .eff-tool');
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
      rv.forEach(el => { el.classList.add('rv'); io.observe(el); });
    }
  } else {
    document.querySelectorAll('.chain li').forEach(li => li.classList.add('lit'));
  }

  // Efficiency experiment
  const r = document.getElementById('etaRange');
  const out = document.getElementById('etaOut');
  const barIn = document.getElementById('barIn'), barLoss = document.getElementById('barLoss');
  const vIn = document.getElementById('valIn'), vLoss = document.getElementById('valLoss');
  const msg = document.getElementById('effMsg');
  const SCALE = 250; // input of 250 = full bar (efficiency 40%)
  function update() {
    let eta = parseInt(r.value, 10);
    if (!Number.isFinite(eta)) eta = 70;
    eta = Math.min(98, Math.max(40, eta));
    const input = 100 / (eta / 100), loss = input - 100;
    out.textContent = eta;
    vIn.textContent = Math.round(input);
    vLoss.textContent = Math.round(loss);
    barIn.style.width = (input / SCALE * 100) + '%';
    barLoss.style.width = (loss / SCALE * 100) + '%';
    const vs70 = 100 / 0.7 - input;
    msg.textContent = eta === 70
      ? 'At 70%, almost a third of the input becomes heat.'
      : vs70 > 0
        ? `Compared with 70%, this saves ${Math.round(vs70)} units of input for the same work.`
        : `Compared with 70%, this needs ${Math.round(-vs70)} more units of input for the same work.`;
  }
  r.addEventListener('input', update); update();
})();
