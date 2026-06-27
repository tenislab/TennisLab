/* ============================================================
   extras.js — template picker, onboarding tour, keyboard help
   ============================================================ */
(function (TL) {
  const t = (k) => TL.i18n.t(k);
  const C = TL.court, ic = TL.icon;

  function host(){ let h=document.getElementById('modal-host'); if(!h){h=document.createElement('div');h.id='modal-host';document.body.appendChild(h);} return h; }
  function close(){ host().innerHTML=''; }
  function esc(s){return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

  // small court preview for a template
  function preview(tac) {
    return C.playThumb(tac);
  }

  // ---- TEMPLATE PICKER ------------------------------------------
  function sportPref(){
    const saved = localStorage.getItem('tl_sport_pref');
    if (saved) return saved;
    return inferSport();   // sin preferencia explícita: deduce el más usado
  }
  // deduce el deporte dominante a partir de los datos del jugador
  function inferSport(){
    try {
      const S = TL.store; if (!S) return 'tennis';
      const norm = s => (s === 'padel' || s === 'pickle') ? s : 'tennis';
      const c = { tennis:0, padel:0, pickle:0 };
      const tally = list => (list || []).forEach(x => { if (x && !x.seed && !x.demo) c[norm(x.sport)]++; });
      tally(S.loadMatches && S.loadMatches());
      if (!(c.tennis + c.padel + c.pickle)) tally(S.loadRivals && S.loadRivals());
      if (!(c.tennis + c.padel + c.pickle)) tally(S.loadAll && S.loadAll());
      let best = 'tennis';
      if (c.padel  > c[best]) best = 'padel';
      if (c.pickle > c[best]) best = 'pickle';
      return best;
    } catch (e) { return 'tennis'; }
  }

  function templates(sport) {
    sport = sport || sportPref();
    const en = TL.i18n.lang === 'en';
    const premium = !(TL.premium) || TL.premium.isPremium();
    const cat = (TL.proplays && TL.proplays.catalog) ? TL.proplays.catalog(sport) : [];
    const defs = [{ k:'blank', blank:true }].concat(cat.map(d => ({ ...d, tac: d.gen() })));
    const levelLabel = (lv) => lv==='beg' ? (en?'Beginner':'Iniciación') : lv==='int' ? (en?'Intermediate':'Intermedio') : (en?'Advanced':'Avanzado');
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal modal-lg">
      <div class="modal-head"><div><h2>${t('tpl_title')}</h2><p class="modal-sub">${t('tpl_sub')}</p></div><button class="x" id="mx">${ic.x}</button></div>
      <div class="modal-body">
        <div class="sport-tabs">
          <button class="sport-tab ${sport==='tennis'?'on':''}" data-sport="tennis">🎾 ${t('sport_tennis')}</button>
          <button class="sport-tab ${sport==='padel'?'on':''}" data-sport="padel">🥎 ${t('sport_padel')}</button>
          <button class="sport-tab ${sport==='pickle'?'on':''}" data-sport="pickle">🏓 ${t('sport_pickle')}</button>
        </div>
        <div class="tpl-legend">
          <span class="tpl-chip free">🎾 ${en?'Free':'Gratis'}</span>
          <span class="tpl-chip pro">👑 ${en?'Premium':'Premium'}</span>
        </div>
        <div class="tpl-grid">
          ${defs.map(d => {
            if (d.blank) return `
            <button class="tpl-card tpl-blank" data-k="blank">
              <div class="tpl-thumb">${blankThumb(sport)}</div>
              <div class="tpl-tx">
                <b>${sport==='padel' ? t('tpl_blank_padel') : sport==='pickle' ? t('tpl_blank_pickle') : t('tpl_blank')}</b>
                <span>${sport==='padel' ? t('tpl_blank_padel_d') : sport==='pickle' ? t('tpl_blank_pickle_d') : t('tpl_blank_d')}</span>
              </div>
              <span class="tpl-steps tpl-go">${ic.bolt}</span>
            </button>`;
            const locked = d.pro && !premium;
            return `
            <button class="tpl-card ${d.pro?'is-pro':'is-free'} ${locked?'locked':''}" data-k="${d.k}">
              <div class="tpl-thumb">${preview(d.tac)}
                <span class="tpl-badge ${d.pro?'pro':'free'}">${d.pro ? '👑 '+(en?'PREMIUM':'PREMIUM') : '🎾 '+(en?'FREE':'GRATIS')}</span>
                ${locked ? `<span class="tpl-lock">${ic.lock||'🔒'}</span>` : ''}
              </div>
              <div class="tpl-tx">
                <b>${esc(d.tac.name)} <i class="tpl-lvl">${levelLabel(d.level)}</i></b>
                <span>${esc(d.tip)}</span>
              </div>
              <span class="tpl-steps">${d.tac.steps.length-1} ${en?'shots':'golpes'}</span>
            </button>`;
          }).join('')}
        </div>
      </div>
    </div></div>`;
    const h = host();
    h.querySelector('#mx').onclick = close;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') close(); };
    h.querySelectorAll('.sport-tab').forEach(b => b.onclick = () => { if (b.dataset.sport !== sport) templates(b.dataset.sport); });
    h.querySelectorAll('.tpl-card').forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (k === 'blank') { close(); TL.editor.open(TL.store.newTactic(sport), { guided:true }); return; }
      const d = defs.find(x => x.k === k);
      if (d.pro && !premium) { close(); TL.premium.upgrade('template'); return; }
      const tac = d.gen();
      close();
      TL.editor.open(tac, { guided:true });
    });
  }

  function blankThumb(sport) {
    let x0,x1,y0,y1,pad;
    if (sport === 'padel'){ x0=C.cx-C.PW/2; x1=C.cx+C.PW/2; y0=C.net-C.PL/2; y1=C.net+C.PL/2; pad=1.0; }
    else if (sport === 'pickle'){ x0=C.kLeft; x1=C.kRight; y0=C.kTop; y1=C.kBot; pad=0.9; }
    else { x0=C.cLeft-0.9; x1=C.cRight+0.9; y0=C.cTop-0.9; y1=C.cBot+0.9; pad=0.7; }
    const sx=(C.TOTAL_H-y1)-pad, sy=x0-pad, sw=(y1-y0)+2*pad, sh=(x1-x0)+2*pad;
    return `<svg viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${C.TOTAL_H},0) rotate(90)">${C.render('hard', sport)}</g></svg>`;
  }

  // ---- ONBOARDING -----------------------------------------------
  function maybeOnboard() {
    if (!localStorage.getItem('tl_sport_pref')) { setTimeout(sportChooser, 500); return; }
    if (localStorage.getItem('tl_onboarded')) return;
    setTimeout(onboard, 700);
  }

  // first-run: ask whether the user plays tennis or padel
  function sportChooser() {
    const en = TL.i18n.lang === 'en';
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal sc-modal">
      <div class="ob-hero">
        <div class="ob-ball">${ballSvg()}</div>
        <h2>${en?'What do you play?':'¿A qué juegas?'}</h2>
        <p>${en?'We tailor the app to your sport. You can change it later in Settings.':'Adaptamos la app a tu deporte. Puedes cambiarlo luego en Ajustes.'}</p>
      </div>
      <div class="modal-body">
        <div class="sc-grid sc-grid-3">
          <button class="sc-card" data-sp="tennis"><span class="sc-emoji">🎾</span><b>${t('sport_tennis')}</b></button>
          <button class="sc-card" data-sp="padel"><span class="sc-emoji">🥎</span><b>${t('sport_padel')}</b></button>
          <button class="sc-card" data-sp="pickle"><span class="sc-emoji">🏓</span><b>${t('sport_pickle')}</b></button>
        </div>
      </div>
    </div></div>`;
    const h = host();
    h.querySelectorAll('.sc-card').forEach(b => b.onclick = () => {
      localStorage.setItem('tl_sport_pref', b.dataset.sp);
      close();
      if (!localStorage.getItem('tl_onboarded')) setTimeout(() => onboard(b.dataset.sp), 250);
      TL.app && TL.app.renderHome && TL.app.renderHome();
    });
  }

  function onboard(sport) {
    sport = sport || sportPref();
    const en = TL.i18n.lang === 'en';
    const padel = sport === 'padel';
    const pickle = sport === 'pickle';
    const sportName = pickle ? 'pickleball' : padel ? (en?'padel':'pádel') : (en?'tennis':'tenis');
    const emoji = pickle ? '🏓' : padel ? '🥎' : '🎾';

    // --- live mini-court that animates a rally (shows, doesn't tell) ---
    const courtViz = `
      <div class="ob-court">
        <svg viewBox="0 0 110 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <rect x="14" y="10" width="82" height="130" rx="3" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.55)" stroke-width="1.4"/>
          <line x1="14" y1="75" x2="96" y2="75" stroke="rgba(255,255,255,.85)" stroke-width="1.6" stroke-dasharray="3 3"/>
          <line x1="34" y1="10" x2="34" y2="140" stroke="rgba(255,255,255,.3)" stroke-width="1"/>
          <line x1="76" y1="10" x2="76" y2="140" stroke="rgba(255,255,255,.3)" stroke-width="1"/>
          <line x1="34" y1="48" x2="76" y2="48" stroke="rgba(255,255,255,.3)" stroke-width="1"/>
          <line x1="34" y1="102" x2="76" y2="102" stroke="rgba(255,255,255,.3)" stroke-width="1"/>
          <path d="M72,124 Q42,60 36,26 T72,124" fill="none" stroke="rgba(215,242,58,.45)" stroke-width="1.4" stroke-dasharray="2 3"/>
          <circle cx="72" cy="124" r="5.4" fill="#D7F23A" stroke="rgba(0,0,0,.4)" stroke-width="1"/>
          <text x="72" y="126.6" font-size="4.6" font-weight="800" text-anchor="middle" fill="#1a1e12">J1</text>
          <circle cx="40" cy="26" r="5.4" fill="#FF5B5B" stroke="rgba(0,0,0,.4)" stroke-width="1"/>
          <text x="40" y="28.6" font-size="4.6" font-weight="800" text-anchor="middle" fill="#fff">R1</text>
          <circle r="3" fill="#fff" stroke="rgba(0,0,0,.45)" stroke-width="0.8">
            <animateMotion dur="3.8s" repeatCount="indefinite" calcMode="spline"
              keyTimes="0;0.5;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
              path="M72,122 Q42,60 36,26 T72,122"/>
          </circle>
        </svg>
        <span class="ob-court-play">${ic.play}</span>
      </div>`;

    // --- example rival card (scouting) ---
    const rivalViz = `
      <div class="ob-demo-card ob-rcard">
        <div class="ob-rc-top">
          <span class="ob-rc-av">${en?'AM':'ÁM'}</span>
          <div class="ob-rc-id"><b>${en?'A. Moretti':'Á. Moreno'}</b><span>🎾 ${en?'Right · Open':'Diestro · Absoluta'} · #42</span></div>
          <span class="ob-rc-badge">${en?'Scouted':'Estudiado'}</span>
        </div>
        <div class="ob-rc-facts">
          <div><span>${en?'Strength':'Fuerte'}</span><b>${en?'Heavy forehand':'Derecha pesada'}</b></div>
          <div><span>${en?'Weakness':'Débil'}</span><b>${en?'High backhand':'Revés alto'}</b></div>
          <div><span>${en?'Style':'Estilo'}</span><b>${en?'Baseliner':'Fondo'}</b></div>
        </div>
      </div>`;

    // --- example match log ---
    const sd = (c)=>`<span class="ob-m-dot" style="background:${c}"></span>`;
    const matchViz = `
      <div class="ob-demo-card ob-matches">
        <div class="ob-m-row">${sd('#E8703D')}<div class="ob-m-id"><b>${en?'A. Moretti':'Á. Moreno'}</b><span>${en?'Clay · Spring Open':'Tierra · Open de Primavera'}</span></div><span class="ob-m-score">6-4 3-6 6-2</span><span class="ob-m-pill win">${en?'W':'V'}</span></div>
        <div class="ob-m-row">${sd('#3D7BE8')}<div class="ob-m-id"><b>${en?'L. Bauer':'L. Bravo'}</b><span>${en?'Hard · City Cup':'Pista dura · Copa Ciudad'}</span></div><span class="ob-m-score">4-6 6-7</span><span class="ob-m-pill loss">${en?'L':'D'}</span></div>
        <div class="ob-m-row">${sd('#3D7BE8')}<div class="ob-m-id"><b>${en?'A. Moretti':'Á. Moreno'}</b><span>${en?'Hard · Club League':'Pista dura · Liga del Club'}</span></div><span class="ob-m-score">6-3 6-4</span><span class="ob-m-pill win">${en?'W':'V'}</span></div>
      </div>`;

    // --- example progress ---
    const bars = [42,55,48,67,61,74].map(h=>`<span style="height:${h}%"></span>`).join('');
    const progViz = `
      <div class="ob-demo-card ob-progress">
        <div class="ob-pg-stats">
          <div class="ob-pg-stat"><b>67%</b><span>${en?'Win rate':'Victorias'}</span></div>
          <div class="ob-pg-stat"><b>2-1</b><span>${en?'Record':'Balance'}</span></div>
          <div class="ob-pg-stat"><b>+14</b><span>${en?'Form':'Forma'}</span></div>
        </div>
        <div class="ob-pg-bars">${bars}</div>
      </div>`;

    const slides = [
      { ic: ic.ball, viz: courtViz,
        t: en?`Design a ${sportName} play`:`Diseña una jugada de ${sportName}`,
        d: en?'Drop players and the ball, draw the shots step by step — then hit play and watch it come alive with real timing.':'Coloca jugadores y la bola, dibuja los golpes paso a paso… y dale al play para verla cobrar vida con tiempos reales.' },
      { ic: ic.rival, viz: rivalViz,
        t: en?'Scout your rivals':'Estudia a tus rivales',
        d: en?'Save each rival with their strengths, weak spots and style. Walk on court already knowing the plan.':'Guarda cada rival con sus fortalezas, puntos débiles y estilo. Sal a la pista sabiendo ya el plan.' },
      { ic: ic.trophy||ic.flag, viz: matchViz,
        t: en?'Log every match':'Registra tus partidos',
        d: en?'Record results set by set, link the tactics you used and note what worked. Your history builds itself.':'Anota resultados set a set, enlaza las tácticas que usaste y apunta qué funcionó. Tu historial se construye solo.' },
      { ic: ic.chart||ic.star, viz: progViz,
        t: en?'See yourself improve':'Mira cómo mejoras',
        d: en?'Win rate by surface, form over time and your player rank — every play and match makes the picture clearer.':'Victorias por superficie, forma en el tiempo y tu rango de jugador — cada jugada y partido lo deja más claro.' },
    ];

    let i = 0;
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal ob-modal2">
      <button class="ob-x" id="ob-skip" aria-label="${en?'Skip':'Saltar'}">${ic.x}</button>
      <div class="ob-track" id="ob-track">
        ${slides.map(s=>`
          <div class="ob-slide">
            <div class="ob-viz">${s.viz}</div>
            <div class="ob-copy">
              <span class="ob-ic">${s.ic||''}</span>
              <h2>${s.t}</h2>
              <p>${s.d}</p>
            </div>
          </div>`).join('')}
      </div>
      <div class="ob-dots" id="ob-dots">${slides.map((_,k)=>`<span class="${k===0?'on':''}"></span>`).join('')}</div>
      <div class="ob-foot ob-foot2">
        <button class="btn btn-ghost" id="ob-prev" style="visibility:hidden">${en?'Back':'Atrás'}</button>
        <button class="btn btn-primary" id="ob-next">${en?'Next':'Siguiente'}</button>
      </div>
      <div class="ob-start-row" id="ob-start-row" hidden>
        <button class="btn btn-primary btn-lg" id="ob-seed">${ic.bolt}${en?'Explore with examples':'Explorar con ejemplos'}</button>
        <button class="btn btn-ghost" id="ob-fresh">${en?'Start from scratch':'Empezar de cero'}</button>
      </div>
    </div></div>`;

    const h = host();
    const track = h.querySelector('#ob-track');
    const dots = [...h.querySelectorAll('#ob-dots span')];
    const prev = h.querySelector('#ob-prev');
    const next = h.querySelector('#ob-next');
    const foot = h.querySelector('#ob-foot') || h.querySelector('.ob-foot2');
    const startRow = h.querySelector('#ob-start-row');
    const last = slides.length - 1;
    const go = (n) => {
      i = Math.max(0, Math.min(last, n));
      track.style.transform = `translateX(${-i*100}%)`;
      dots.forEach((d,k)=>d.classList.toggle('on',k===i));
      prev.style.visibility = i===0 ? 'hidden' : 'visible';
      const onLast = i===last;
      foot.style.display = onLast ? 'none' : '';
      startRow.hidden = !onLast;
      TL.fx && TL.fx.tap && TL.fx.tap();
    };
    const done = () => { localStorage.setItem('tl_onboarded','1'); close(); };
    prev.onclick = () => go(i-1);
    next.onclick = () => go(i+1);
    h.querySelector('#ob-skip').onclick = done;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') done(); };
    h.querySelector('#ob-seed').onclick = () => {
      done();
      try { TL.store.seedDemo(); } catch(e){}
      TL.app && TL.app.renderHome && TL.app.renderHome();
      TL.app && TL.app.toast && TL.app.toast(en?'Example data loaded — explore freely':'Datos de ejemplo cargados — explora con libertad', true);
    };
    h.querySelector('#ob-fresh').onclick = () => { done(); templates(sport); };

    // swipe support
    let x0 = null;
    track.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, {passive:true});
    track.addEventListener('touchend', e => {
      if (x0==null) return; const dx = e.changedTouches[0].clientX - x0; x0=null;
      if (dx < -40) go(i+1); else if (dx > 40) go(i-1);
    }, {passive:true});
  }
  function ballSvg(){ return `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" fill="#D7F23A"/><path d="M8 12c10 7 10 29 0 36M52 12c-10 7-10 29 0 36" fill="none" stroke="#1A1E12" stroke-width="2.6" stroke-linecap="round"/></svg>`; }

  // ---- KEYBOARD SHORTCUTS ---------------------------------------
  function helpModal() {
    const rows = [
      ['Space', 'sc_play'], ['← →', 'sc_steps'], ['Z', 'sc_undo'], ['S', 'sc_save'], ['Esc', 'sc_back'],
    ];
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal">
      <div class="modal-head"><h2>${t('shortcuts')}</h2><button class="x" id="mx">${ic.x}</button></div>
      <div class="modal-body">
        <div class="kb-list">
          ${rows.map(r=>`<div class="kb-row"><kbd>${r[0]}</kbd><span>${t(r[1])}</span></div>`).join('')}
        </div>
      </div>
    </div></div>`;
    const h = host();
    h.querySelector('#mx').onclick = close;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') close(); };
  }

  function bindKeys() {
    if (TL._keysBound) return; TL._keysBound = true;
    window.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName||'').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      // '?' help works anywhere (except while typing)
      if (!typing && (e.key === '?' )) { e.preventDefault(); helpModal(); return; }
      if (TL.state.view !== 'editor') return;
      if (typing) return;
      const modalOpen = document.getElementById('modal-host') && document.getElementById('modal-host').children.length;
      if (modalOpen && e.key !== 'Escape') return;
      if (e.key === ' ') { e.preventDefault(); TL.anim && TL.anim.toggle(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); TL.editor.goToStep(TL.state.stepIndex+1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); TL.editor.goToStep(TL.state.stepIndex-1); }
      else if (e.key === 'Escape') {
        if (modalOpen) { close(); return; }
        TL.anim && TL.anim.stop && TL.anim.stop(); TL.app.goHome();
      }
      else if ((e.key === 'z' || e.key === 'Z') && TL.state.guided) { e.preventDefault(); TL.editor.undoShot && TL.editor.undoShot(); }
      else if ((e.key === 's' || e.key === 'S')) { e.preventDefault(); TL.modals && TL.modals.save(); }
    });
  }

  TL.extras = { templates, onboard, maybeOnboard, helpModal, bindKeys, sportChooser, sportPref };
})(window.TL = window.TL || {});
