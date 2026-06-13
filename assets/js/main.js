/* ==========================================================================
   MANUEL TABERNA EDARIAK — Interacción y animación (GSAP 3)
   ========================================================================== */
(function () {
  'use strict';

  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('js');

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power2.out', duration: 0.7 });

  var mm = gsap.matchMedia();
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Loader: solo la primera visita de la sesión ---------- */
  var loader = document.getElementById('loader');
  var seen = false;
  try { seen = sessionStorage.getItem('mt-visited') === '1'; } catch (e) {}

  function introContent() {
    var items = document.querySelectorAll('[data-hero-stagger] > *');
    if (items.length && !REDUCED) {
      gsap.from(items, { autoAlpha: 0, y: 34, duration: 0.9, stagger: 0.09, delay: 0.1, clearProps: 'transform' });
    }
  }

  if (loader && !seen && !REDUCED) {
    document.body.style.overflow = 'hidden';
    var dots = loader.querySelectorAll('.loader-dots i');
    var tl = gsap.timeline({
      onComplete: function () {
        loader.remove();
        document.body.style.overflow = '';
        try { sessionStorage.setItem('mt-visited', '1'); } catch (e) {}
        introContent();
      }
    });
    tl.from(dots, { y: 26, autoAlpha: 0, stagger: 0.07, duration: 0.45, ease: 'back.out(2)' })
      .to(dots, { y: -14, stagger: { each: 0.07, repeat: 1, yoyo: true }, duration: 0.3, ease: 'sine.inOut' })
      .from('.loader-word', { autoAlpha: 0, letterSpacing: '0.8em', duration: 0.5 }, '<')
      .to(loader, { yPercent: -100, duration: 0.65, ease: 'power3.inOut', delay: 0.25 });
  } else {
    if (loader) loader.remove();
    try { sessionStorage.setItem('mt-visited', '1'); } catch (e) {}
    introContent();
  }

  /* ---------- Header: sombra al hacer scroll ---------- */
  var header = document.querySelector('.site-header');
  if (header) {
    ScrollTrigger.create({
      start: 24,
      onUpdate: function (self) {
        header.classList.toggle('is-scrolled', self.scroll() > 24);
      }
    });
  }

  /* ---------- Navegación móvil ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        toggle.focus();
      }
    });
  }

  /* ---------- Reveals al hacer scroll ---------- */
  mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, function () {

    gsap.set('[data-reveal]', { autoAlpha: 0, y: 36 });
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 96%',
      once: true,
      onEnter: function (els) {
        gsap.to(els, {
          autoAlpha: 1, y: 0, duration: 0.85,
          stagger: 0.1, overwrite: true, clearProps: 'transform'
        });
      }
    });
    /* Recalcular tras load para que imágenes lazy no desplacen los triggers */
    if (document.readyState === 'complete') {
      ScrollTrigger.refresh();
    } else {
      window.addEventListener('load', function () { ScrollTrigger.refresh(); }, { once: true });
    }

    /* Parallax suave en medios de hero interiores */
    document.querySelectorAll('.page-hero .hero-media').forEach(function (media) {
      gsap.to(media, {
        yPercent: 14, ease: 'none',
        scrollTrigger: { trigger: media.closest('.page-hero'), start: 'top top', end: 'bottom top', scrub: true }
      });
    });

    /* Sello giratorio */
    document.querySelectorAll('[data-spin]').forEach(function (el) {
      gsap.to(el, { rotation: 360, duration: 18, repeat: -1, ease: 'none' });
    });

    return function () {};
  });

  /* ---------- Contadores ---------- */
  document.querySelectorAll('[data-count]').forEach(function (el) {
    var end = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-count-suffix') || '';
    if (REDUCED) { el.textContent = end + suffix; return; }
    var obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: function () {
        gsap.to(obj, {
          v: end, duration: 1.6, ease: 'power3.out',
          onUpdate: function () { el.textContent = Math.round(obj.v) + suffix; }
        });
      }
    });
  });

  /* ---------- Marquee infinito de marcas ---------- */
  document.querySelectorAll('.marquee').forEach(function (mq) {
    var track = mq.querySelector('.marquee-track');
    if (!track) return;
    var originalItems = Array.prototype.slice.call(track.children);
    if (!originalItems.length) return;

    while (track.firstChild) track.removeChild(track.firstChild);

    function addGroup(hidden) {
      var group = document.createElement('div');
      group.className = 'marquee-group';
      if (hidden) group.setAttribute('aria-hidden', 'true');
      originalItems.forEach(function (item) {
        group.appendChild(item.cloneNode(true));
      });
      track.appendChild(group);
      return group;
    }

    var firstGroup = addGroup(false);
    var tween = null;
    var groupWidth = 0;

    /* La velocidad es constante (px/s) para que el ritmo no dependa del nº de grupos */
    var SPEED = 60; // px por segundo

    function rebuild() {
      groupWidth = firstGroup.getBoundingClientRect().width;
      if (!groupWidth) return false;

      /* Eliminar grupos clonados previos y crear los necesarios para cubrir
         SIEMPRE al menos el doble del ancho visible + un grupo de margen.
         Así el bucle nunca deja hueco al envolver. */
      while (track.children.length > 1) track.removeChild(track.lastChild);
      var needed = Math.max(2, Math.ceil((mq.offsetWidth + groupWidth) / groupWidth) + 1);
      for (var i = 1; i < needed; i++) addGroup(true);
      return true;
    }

    function startTween() {
      if (tween) { tween.kill(); tween = null; }
      if (REDUCED || !groupWidth) return;
      gsap.set(track, { x: 0 });
      tween = gsap.to(track, {
        x: -groupWidth,
        ease: 'none',
        duration: groupWidth / SPEED,
        repeat: -1,
        modifiers: {
          /* Envuelve siempre dentro de [-groupWidth, 0] sin saltos */
          x: function (x) { return (gsap.utils.wrap(-groupWidth, 0, parseFloat(x))) + 'px'; }
        }
      });
    }

    function setup() {
      if (rebuild()) startTween();
    }

    /* Medir cuando las imágenes (lazy) ya tienen tamaño real, no antes */
    var imgs = firstGroup.querySelectorAll('img');
    var pending = 0;
    imgs.forEach(function (img) {
      if (!img.complete || !img.naturalWidth) {
        pending++;
        img.addEventListener('load', function () { if (--pending <= 0) setup(); }, { once: true });
        img.addEventListener('error', function () { if (--pending <= 0) setup(); }, { once: true });
      }
    });
    if (pending === 0) setup();
    /* Red de seguridad: si algún 'load' no dispara, reintenta al cargar la ventana */
    window.addEventListener('load', function () { if (!tween) setup(); }, { once: true });

    /* Recalcular en resize (debounce) para que nunca se quede corto */
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(setup, 200);
    });

    mq.addEventListener('mouseenter', function () { if (tween) gsap.to(tween, { timeScale: 0.25, duration: 0.4 }); });
    mq.addEventListener('mouseleave', function () { if (tween) gsap.to(tween, { timeScale: 1, duration: 0.4 }); });
  });

  /* ---------- Particulas del hero ---------- */
  var heroParticles = document.querySelector('[data-bubbles]');
  if (heroParticles && !REDUCED) {
    var particleCanvas = document.createElement('canvas');
    var particleCtx = particleCanvas.getContext('2d');
    var heroDots = [];
    var particleFrame = null;
    var particleW = 0;
    var particleH = 0;
    var particleDpr = Math.min(window.devicePixelRatio || 1, 2);

    particleCanvas.setAttribute('aria-hidden', 'true');
    heroParticles.appendChild(particleCanvas);

    function resetHeroDot(dot) {
      dot.x = Math.random() * particleW;
      dot.y = Math.random() * particleH;
      dot.size = Math.random() * 2.2 + 0.6;
      dot.speedX = (Math.random() - 0.5) * 0.32;
      dot.speedY = -(Math.random() * 0.22 + 0.04);
      dot.gravity = Math.random() * 0.006;
      dot.drift = Math.random() * 0.028 + 0.01;
      dot.driftAmp = Math.random() * 0.55 + 0.15;
      dot.age = Math.random() * 80;
      dot.life = Math.random() * 180 + 120;
      dot.maxLife = dot.life;
      dot.tone = Math.random() > 0.72 ? 'blue' : (Math.random() > 0.46 ? 'white' : 'gold');
      dot.pulse = Math.random() * Math.PI * 2;
    }

    function makeHeroDot() {
      var dot = {};
      resetHeroDot(dot);
      return dot;
    }

    function resizeHeroParticles() {
      particleW = heroParticles.offsetWidth;
      particleH = heroParticles.offsetHeight;
      particleDpr = Math.min(window.devicePixelRatio || 1, 2);
      particleCanvas.width = Math.max(1, Math.floor(particleW * particleDpr));
      particleCanvas.height = Math.max(1, Math.floor(particleH * particleDpr));
      particleCanvas.style.width = particleW + 'px';
      particleCanvas.style.height = particleH + 'px';
      particleCtx.setTransform(particleDpr, 0, 0, particleDpr, 0, 0);

      var count = Math.min(22, Math.max(10, Math.floor((particleW * particleH) / 60000)));
      heroDots = [];
      for (var i = 0; i < count; i++) heroDots.push(makeHeroDot());
    }

    function heroDotColor(dot, alpha, glow) {
      if (dot.tone === 'blue') return 'rgba(127,163,209,' + alpha * glow + ')';
      if (dot.tone === 'white') return 'rgba(255,255,255,' + alpha * glow + ')';
      return 'rgba(249,234,83,' + alpha * glow + ')';
    }

    function updateHeroDot(dot) {
      dot.age++;
      dot.speedY += dot.gravity;
      dot.x += dot.speedX + Math.sin(dot.age * dot.drift) * dot.driftAmp;
      dot.y += dot.speedY;
      dot.pulse += 0.035;
      dot.life--;
      if (dot.life <= 0 || dot.x < -16 || dot.x > particleW + 16 || dot.y < -16 || dot.y > particleH + 16) {
        resetHeroDot(dot);
      }
    }

    function drawHeroDot(dot) {
      var t = dot.life / dot.maxLife;
      var alpha = Math.sin(t * Math.PI) * 0.7;
      var r = dot.size * (0.9 + Math.sin(dot.pulse * 0.7) * 0.1);
      particleCtx.beginPath();
      particleCtx.arc(dot.x, dot.y, r, 0, Math.PI * 2);
      particleCtx.fillStyle = heroDotColor(dot, alpha, 1);
      particleCtx.fill();
    }

    function animateHeroParticles() {
      particleCtx.clearRect(0, 0, particleW, particleH);
      heroDots.forEach(function (dot) {
        updateHeroDot(dot);
        drawHeroDot(dot);
      });
      particleFrame = requestAnimationFrame(animateHeroParticles);
    }

    function startHeroParticles() {
      if (!particleFrame) animateHeroParticles();
    }

    function stopHeroParticles() {
      if (!particleFrame) return;
      cancelAnimationFrame(particleFrame);
      particleFrame = null;
    }

    resizeHeroParticles();
    window.addEventListener('resize', resizeHeroParticles);

    if ('IntersectionObserver' in window) {
      var heroParticleObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) startHeroParticles();
          else stopHeroParticles();
        });
      }, { threshold: 0.1 });
      heroParticleObserver.observe(heroParticles);
    } else {
      startHeroParticles();
    }
  }

  /* ---------- Botones magneticos (solo puntero fino) ---------- */
  mm.add('(pointer: fine) and (prefers-reduced-motion: no-preference)', function () {
    var cleanups = [];
    document.querySelectorAll('.btn, .cat-card-arrow').forEach(function (el) {
      var sx = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
      var sy = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
      function move(e) {
        var r = el.getBoundingClientRect();
        sx((e.clientX - r.left - r.width / 2) * 0.18);
        sy((e.clientY - r.top - r.height / 2) * 0.25);
      }
      function leave() { sx(0); sy(0); }
      el.addEventListener('mousemove', move);
      el.addEventListener('mouseleave', leave);
      cleanups.push(function () {
        el.removeEventListener('mousemove', move);
        el.removeEventListener('mouseleave', leave);
      });
    });
    return function () { cleanups.forEach(function (fn) { fn(); }); };
  });

  /* ---------- Puntos del logotipo: latido sutil ---------- */
  var brandDots = document.querySelectorAll('.brand-dots circle');
  if (brandDots.length && !REDUCED) {
    gsap.to(brandDots, {
      scale: 1.25,
      transformOrigin: 'center',
      duration: 0.55,
      ease: 'sine.inOut',
      stagger: { each: 0.12, repeat: 1, yoyo: true, repeatDelay: 0.05 },
      repeat: -1,
      repeatDelay: 4.4
    });
  }

  /* ---------- "Ver más" en listados largos (móvil) ---------- */
  document.querySelectorAll('.product-group[data-collapsible]').forEach(function (group) {
    var list = group.querySelector('.product-list');
    var btn = group.querySelector('.show-more');
    if (!list || !btn) return;
    if (list.children.length <= 8) { btn.remove(); group.removeAttribute('data-collapsible'); return; }
    list.classList.add('is-clamped');
    btn.addEventListener('click', function () {
      var clamped = list.classList.toggle('is-clamped');
      btn.querySelector('span').textContent = clamped ? 'Ver todo' : 'Ver menos';
      btn.setAttribute('aria-expanded', clamped ? 'false' : 'true');
      ScrollTrigger.refresh();
    });
  });

  /* Recalcular triggers al abrir/cerrar acordeones */
  document.querySelectorAll('details.product-group').forEach(function (d) {
    d.addEventListener('toggle', function () { ScrollTrigger.refresh(); });
  });

  /* ---------- Aviso de cookies ---------- */
  var cookieBox = document.getElementById('cookie-notice');
  if (cookieBox) {
    var consent = null;
    try { consent = localStorage.getItem('mt-cookies'); } catch (e) {}
    if (!consent) {
      cookieBox.classList.add('is-visible');
      if (!REDUCED) gsap.from(cookieBox, { y: 60, autoAlpha: 0, duration: 0.6, delay: 1.2 });
    }
    cookieBox.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cookie]');
      if (!btn) return;
      try { localStorage.setItem('mt-cookies', btn.getAttribute('data-cookie')); } catch (e2) {}
      gsap.to(cookieBox, {
        y: 40, autoAlpha: 0, duration: 0.4,
        onComplete: function () { cookieBox.remove(); }
      });
    });
  }

  /* ---------- Precarga de toda la web (tras la carga inicial) ---------- */
  function prefetchSite() {
    var base = document.querySelector('meta[name="mt-base"]');
    var root = base ? base.getAttribute('content') : '';
    if (!root) return;
    var pages = [
      '', 'catalogo/', 'empresa/', 'contacto/',
      'catalogo/vinos/', 'catalogo/cervezas/', 'catalogo/whiskies/', 'catalogo/licores/',
      'catalogo/ginebra-vodka-ron-tequila/', 'catalogo/anis-brandy-pacharan/',
      'catalogo/refrescos/', 'catalogo/cavas/', 'catalogo/sidra-txakoli/',
      'catalogo/aperitivos/', 'catalogo/cafes/', 'catalogo/leche/', 'catalogo/aguas/',
      'catalogo/cristaleria/', 'catalogo/aceite/', 'catalogo/conservas/',
      'catalogo/zumos-jarabes/', 'catalogo/miniaturas/',
      'aviso-legal/', 'politica-privacidad/', 'politica-cookies/'
    ];
    var save = navigator.connection && navigator.connection.saveData;
    if (save) return;
    pages.forEach(function (p, i) {
      setTimeout(function () {
        var link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = root + p;
        link.as = 'document';
        document.head.appendChild(link);
      }, 350 * i);
    });
    /* Precarga de imágenes de categorías para navegación instantánea */
    var cats = ['vinos','cervezas','whiskies','licores','ginebra-vodka-ron-tequila',
      'anis-brandy-pacharan','refrescos','cavas','sidra-txakoli','aperitivos','cafes',
      'leche','aguas','cristaleria','aceite','conservas','zumos-jarabes','miniaturas'];
    cats.forEach(function (c, i) {
      setTimeout(function () {
        var img = new Image();
        img.src = root + 'assets/images/categorias/' + c + '.webp';
      }, 250 * i + 4000);
    });
  }
  if ('requestIdleCallback' in window) {
    requestIdleCallback(prefetchSite, { timeout: 5000 });
  } else {
    setTimeout(prefetchSite, 3500);
  }

  /* ---------- Transición de salida entre páginas ---------- */
  if (!REDUCED) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.hash) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      gsap.to('main', {
        autoAlpha: 0, y: -16, duration: 0.28, ease: 'power2.in',
        onComplete: function () { location.href = url.href; }
      });
    });
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) gsap.set('main', { autoAlpha: 1, y: 0 });
    });
    gsap.from('main', { autoAlpha: 0, duration: 0.45, ease: 'power1.out' });
  }
})();
