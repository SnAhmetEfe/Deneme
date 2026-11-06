(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.querySelector('.site-header');
  const progressBar = document.getElementById('progressBar');
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.getElementById('navLinks');

  const onScroll = () => {
    header?.classList.toggle('scrolled', window.scrollY > 24);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    if (progressBar) progressBar.style.transform = `scaleX(${progress})`;
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const closeMenu = () => {
    navToggle?.setAttribute('aria-expanded', 'false');
    navLinks?.classList.remove('open');
    document.body.classList.remove('menu-open');
  };
  navToggle?.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!open));
    navLinks?.classList.toggle('open', !open);
    document.body.classList.toggle('menu-open', !open);
  });
  navLinks?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  window.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

  const reveals = [...document.querySelectorAll('.reveal')];
  if (reducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.13, rootMargin: '0px 0px -5% 0px' });
    reveals.forEach(el => revealObserver.observe(el));
  }

  const sections = [...document.querySelectorAll('main section[id]')];
  const navigation = [...document.querySelectorAll('.nav-links a')];
  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navigation.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${visible.target.id}`));
    }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, .25, .5] });
    sections.forEach(section => sectionObserver.observe(section));
  }

  const timelineToggle = document.getElementById('timelineToggle');
  const earlierRoles = [...document.querySelectorAll('.timeline-more')];
  timelineToggle?.addEventListener('click', () => {
    const expanded = timelineToggle.getAttribute('aria-expanded') === 'true';
    timelineToggle.setAttribute('aria-expanded', String(!expanded));
    earlierRoles.forEach(role => {
      role.hidden = expanded;
      if (!expanded) requestAnimationFrame(() => role.classList.add('is-visible'));
    });
    timelineToggle.innerHTML = expanded
      ? 'View earlier roles <span aria-hidden="true">＋</span>'
      : 'Hide earlier roles <span aria-hidden="true">−</span>';
  });

  const skillNodes = [...document.querySelectorAll('.skill-node')];
  const skillTitle = document.getElementById('skillTitle');
  const skillStatus = document.getElementById('skillStatus');
  const skillCopy = document.getElementById('skillCopy');
  const selectSkill = node => {
    skillNodes.forEach(item => item.classList.toggle('active', item === node));
    if (skillTitle) skillTitle.textContent = node.dataset.title || '';
    if (skillStatus) skillStatus.textContent = node.dataset.status || '';
    if (skillCopy) skillCopy.textContent = node.dataset.copy || '';
  };
  skillNodes.forEach(node => node.addEventListener('click', () => selectSkill(node)));

  const storySteps = [...document.querySelectorAll('.story-step')];
  const storyScene = document.getElementById('storyScene');
  const sceneWord = document.getElementById('sceneWord');
  const setStoryStage = step => {
    const stage = Number(step.dataset.stage || 0);
    storySteps.forEach(item => item.classList.toggle('active', item === step));
    if (storyScene) {
      storyScene.dataset.stage = String(stage);
      storyScene.style.setProperty('--stage', String(stage));
    }
    if (sceneWord) sceneWord.textContent = step.dataset.word || '';
  };
  if ('IntersectionObserver' in window && window.innerWidth > 820) {
    const storyObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) setStoryStage(entry.target); });
    }, { rootMargin: '-40% 0px -40% 0px', threshold: .05 });
    storySteps.forEach(step => storyObserver.observe(step));
  } else {
    storySteps.forEach(step => step.addEventListener('click', () => setStoryStage(step)));
  }

  document.getElementById('year').textContent = String(new Date().getFullYear());

  // Lightweight procedural energy globe: no models, textures or third-party runtime.
  const canvas = document.getElementById('energyGlobe');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let rotation = 0;
  let pointerX = 0;
  let pointerY = 0;
  let globeVisible = true;
  let raf = 0;
  const mobile = window.matchMedia('(max-width: 560px)').matches;
  const points = [];
  const count = mobile ? 90 : 165;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    points.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius });
  }

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };

  const projected = point => {
    const cos = Math.cos(rotation + pointerX * .12);
    const sin = Math.sin(rotation + pointerX * .12);
    const x = point.x * cos - point.z * sin;
    const z = point.x * sin + point.z * cos;
    const tilt = pointerY * .08;
    const yy = point.y * Math.cos(tilt) - z * Math.sin(tilt);
    const zz = point.y * Math.sin(tilt) + z * Math.cos(tilt);
    const size = Math.min(width, height) * .285;
    return { x: width / 2 + x * size, y: height / 2 + yy * size, z: zz, alpha: .18 + ((zz + 1) / 2) * .74 };
  };

  const draw = () => {
    ctx.clearRect(0, 0, width, height);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * .292;
    const glow = ctx.createRadialGradient(centerX, centerY, radius * .15, centerX, centerY, radius * 1.18);
    glow.addColorStop(0, 'rgba(30, 160, 104, .13)');
    glow.addColorStop(.66, 'rgba(13, 92, 59, .08)');
    glow.addColorStop(1, 'rgba(7, 23, 17, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 1.2, 0, Math.PI * 2);
    ctx.fill();

    const mapped = points.map(projected);
    ctx.lineWidth = .55;
    for (let i = 0; i < mapped.length; i += 1) {
      const a = mapped[i];
      if (a.z < -.18) continue;
      let links = 0;
      for (let j = i + 1; j < mapped.length && links < 3; j += 1) {
        const b = mapped[j];
        if (b.z < -.18) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < radius * .23) {
          ctx.strokeStyle = `rgba(114, 218, 157, ${Math.min(a.alpha, b.alpha) * .18})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          links += 1;
        }
      }
    }
    mapped.forEach((point, index) => {
      if (point.z < -.28) return;
      const pulse = 1 + Math.sin(index * 1.7 + rotation * 8) * .25;
      ctx.fillStyle = index % 13 === 0
        ? `rgba(184, 239, 102, ${point.alpha})`
        : `rgba(70, 181, 125, ${point.alpha * .76})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, (index % 13 === 0 ? 2.1 : 1.05) * pulse, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = 'rgba(184, 239, 102, .17)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radius * 1.18, radius * .27, -.18, 0, Math.PI * 2);
    ctx.stroke();
  };

  const animate = () => {
    if (!globeVisible || reducedMotion || mobile) return;
    rotation += .0016;
    draw();
    raf = requestAnimationFrame(animate);
  };

  const visual = canvas.closest('.hero-visual');
  visual?.addEventListener('pointermove', event => {
    if (reducedMotion || mobile) return;
    const rect = visual.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width - .5) * 2;
    pointerY = ((event.clientY - rect.top) / rect.height - .5) * 2;
  }, { passive: true });
  visual?.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });

  if ('IntersectionObserver' in window) {
    const globeObserver = new IntersectionObserver(entries => {
      globeVisible = entries[0]?.isIntersecting ?? true;
      cancelAnimationFrame(raf);
      if (globeVisible) animate();
    });
    globeObserver.observe(canvas);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();
  if (!reducedMotion && !mobile) animate();
})();
