/* ============================================================
   CourtLab — Controlador de overlays del recorrido 3D
   - Sincroniza paneles con el progreso de la cámara (court3d)
   - Selector de superficie interactivo (cambia % + fuerte/débil)
   - Medidor (gauge) animado, reveal, año
   ============================================================ */
(function () {
  'use strict';

  // ---------- año ----------
  var yr = document.getElementById('yr'); if (yr) yr.textContent = new Date().getFullYear();

  // ---------- datos del rival de ejemplo ----------
  var SURF = {
    clay:   { pct: 52, best: 'Derecha liftada', weak: 'Revés alto',     cap: 'en tierra' },
    hard:   { pct: 68, best: 'Saque plano',     weak: 'Dejada corta',   cap: 'en dura' },
    grass:  { pct: 74, best: 'Saque-volea',     weak: 'Resto 2º saque', cap: 'en hierba' },
    indoor: { pct: 63, best: 'Derecha plana',   weak: 'Globo defensivo',cap: 'indoor' }
  };

  // ---------- gauge ----------
  var R = 84, CIRC = Math.PI * R; // semicircle length
  var gFill = document.querySelector('.gauge .g-fill');
  var gVal = document.getElementById('gaugeVal');
  var gCap = document.getElementById('gaugeCap');
  var rivBest = document.getElementById('rivBest');
  var rivWeak = document.getElementById('rivWeak');
  if (gFill) { gFill.style.strokeDasharray = CIRC; gFill.style.strokeDashoffset = CIRC; }

  function setSurface(key, animateNum) {
    var d = SURF[key]; if (!d) return;
    if (gFill) gFill.style.strokeDashoffset = CIRC * (1 - d.pct / 100);
    if (gCap) gCap.textContent = d.cap;
    if (rivBest) rivBest.textContent = d.best;
    if (rivWeak) rivWeak.textContent = d.weak;
    if (gVal) {
      if (animateNum === false) { gVal.innerHTML = d.pct + '<small>%</small>'; return; }
      var from = parseInt(gVal.textContent, 10) || 0, to = d.pct, t0 = performance.now();
      (function tick(now) {
        var k = Math.min(1, (now - t0) / 600), e = 1 - Math.pow(1 - k, 3);
        gVal.innerHTML = Math.round(from + (to - from) * e) + '<small>%</small>';
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    }
  }
  var surfBtns = Array.prototype.slice.call(document.querySelectorAll('.surf button'));
  surfBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      surfBtns.forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      setSurface(b.getAttribute('data-s'), true);
    });
  });

  // ---------- sincronía de actos con la cámara (flujo continuo) ----------
  var acts = Array.prototype.slice.call(document.querySelectorAll('.act'));
  var inners = acts.map(function (a) { return a.querySelector('.inner'); });
  // bandas encadenadas (se solapan un poco → cross-fade sin huecos)
  var BANDS = [
    [-0.08, 0.24], // act 1 pista (visible ya al cargar)
    [0.17, 0.49],  // act 2 salón
    [0.43, 0.72],  // act 3 tele
    [0.67, 1.001]  // act 4 balcón (banda como los demás; no se queda clavado)
  ];
  function ramp(p, s, e, holdTail) {
    if (p <= s || p >= e) return null;
    var lt = (p - s) / (e - s);
    var o;
    if (lt < 0.26) o = lt / 0.26;
    else if (lt > 0.74) o = holdTail ? 1 : (1 - lt) / 0.26;
    else o = 1;
    o = Math.max(0, Math.min(1, o));
    var ty = (lt - 0.5); // -0.5 (entra abajo) → 0 (centro) → +0.5 (sale arriba)
    if (holdTail && ty > 0) ty = 0; // se queda centrado durante el dwell del club
    return { o: o, ty: ty };
  }

  var gaugeShown = false, noGL = false;
  function frame() {
    if (document.documentElement.classList.contains('no-gl')) { noGL = true; return; }
    var p = (window.__court3d && typeof window.__court3d.progress === 'number') ? window.__court3d.progress : 0;
    // al final del recorrido los paneles fijos se van con el canvas (si no, se solapan con FAQ/Precios)
    var endFade = p > 0.95 ? Math.max(0, 1 - (p - 0.95) / 0.05) : 1;
    for (var i = 0; i < acts.length; i++) {
      var r = ramp(p, BANDS[i][0], BANDS[i][1], i === acts.length - 1);
      var o = (r ? r.o : 0) * endFade;
      acts[i].style.opacity = o.toFixed(3);
      acts[i].style.pointerEvents = o > 0.45 ? 'auto' : 'none';
      acts[i].classList.toggle('is-on', o > 0.04);
      if (inners[i]) inners[i].style.transform = 'translateY(' + (r ? (r.ty * -66) : 0).toFixed(1) + 'px)';
    }
    // anima el gauge la primera vez que el salón entra
    var r2 = ramp(p, BANDS[1][0], BANDS[1][1]);
    if (!gaugeShown && r2 && r2.o > 0.3) { gaugeShown = true; setSurface('clay', true); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // estado inicial del gauge (sin animar)
  setSurface('clay', false);

  // ---------- reveal para secciones inferiores ----------
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.16 }) : null;
  document.querySelectorAll('.reveal').forEach(function (el) {
    if (io) io.observe(el); else el.classList.add('in');
  });

  // ---------- fallback sin WebGL: muestra act 1 fijo ----------
  setTimeout(function () {
    if (document.documentElement.classList.contains('no-gl')) {
      acts.forEach(function (a, i) { a.style.position = 'relative'; a.style.opacity = 1; a.classList.add('is-on'); a.style.minHeight = 'auto'; });
      var t = document.getElementById('tourTrack'); if (t) t.style.display = 'none';
      var c = document.getElementById('gl'); if (c) c.style.display = 'none';
    }
  }, 400);
})();
