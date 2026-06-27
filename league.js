/* ============================================================
   home.js — landing screen
   ============================================================ */
(function (TL) {
  const t = (k) => TL.i18n.t(k);
  const C = TL.court, ic = TL.icon;

  let folderFilter = null;   // null = all
  let searchQuery = '';
  let sortBy = 'recent';
  let tagFilter = '';
  let favOnly = false;
  let libView = localStorage.getItem('tl_lib_view') || 'grid';
  const gridViewIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/></svg>`;
  const listViewIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>`;
  const folderIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
  const searchIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>`;

  const SURF_DOT = { clay:'var(--clay)', hard:'var(--hard)', grass:'var(--grass)', indoor:'var(--indoor)' };
  const surfLabel = (s) => t('surf_' + (s === 'clay'?'clay':s==='hard'?'hard':s==='grass'?'grass':'indoor'));

  // ---- lazy thumbnails: only build the SVG once the card scrolls into view ----
  const lazyObs = ('IntersectionObserver' in window) ? new IntersectionObserver((entries, obs) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      obs.unobserve(el);
      try { el.innerHTML = el.__thumb() + (el.__overlay || ''); } catch(e){}
    });
  }, { rootMargin: '300px' }) : null;

  function lazyThumb(host, build, overlay) {
    if (!lazyObs) { host.innerHTML = build() + (overlay||''); return; }
    host.__thumb = build; host.__overlay = overlay || '';
    host.innerHTML = `<span class="thumb-skel"></span>` + (overlay||'');
    lazyObs.observe(host);
  }


  function fmtDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(TL.i18n.lang === 'en' ? 'en-GB' : 'es-ES', { day:'2-digit', month:'short' });
  }

  function folderOptions(sel) {
    const folders = TL.store.loadFolders();
    let o = `<option value="">${t('no_folder')}</option>`;
    folders.forEach(f => { o += `<option value="${f.id}" ${sel===f.id?'selected':''}>${escapeHtml(f.name)}</option>`; });
    o += `<option value="__new">＋ ${t('new_folder')}</option>`;
    return o;
  }

  function tacticCard(tac) {
    const steps = Array.isArray(tac.steps) ? tac.steps : [];
    const last = steps[steps.length - 1] || steps[0] || { tokens: [] };
    const name = tac.name || t('untitled');
    const card = document.createElement('div');
    card.className = 'tcard';
    card.innerHTML = `
      <div class="tcard-thumb">
        <span class="thumb-svg"><span class="thumb-skel"></span></span>
        <span class="tcard-surf"><i style="background:${SURF_DOT[tac.surface]}"></i>${surfLabel(tac.surface)}</span>
        <button class="tcard-fav ${tac.fav?'on':''}" title="${t('fav')}">${tac.fav?ic.star:ic.starO}</button>
        ${tac.number ? `<span class="tcard-num">#${escapeHtml(String(tac.number))}</span>` : ''}
        ${tagChip(tac.tag)}
      </div>
      <div class="tcard-body">
        <h3>${escapeHtml(name)}</h3>
        <div class="tcard-meta">
          <span><b>${steps.length}</b> ${TL.i18n.lang==='en'?(steps.length===1?'step':'steps'):(steps.length===1?'paso':'pasos')}</span>
          ${tac.rival ? `<span>${escapeHtml(tac.rival)}</span>` : ''}
          <span>${fmtDate(tac.updatedAt)}</span>
        </div>
      </div>
      <div class="tcard-actions">
        <button class="btn btn-line btn-sm act-open">${t('open')}</button>
        <select class="folder-sel" title="${t('move_to')}">${folderOptions(tac.folderId)}</select>
        <button class="btn btn-ghost btn-sm act-dup" title="${t('duplicate')}">${ic.copy}</button>
        <button class="btn btn-ghost btn-sm act-del" title="${t('delete')}">${ic.trash}</button>
      </div>`;
    card.querySelector('.act-open').onclick = () => TL.app.openEditor(tac.id);
    lazyThumb(card.querySelector('.thumb-svg'), () => C.thumb(tac.surface, last, tac.tokens, true, tac.sport));
    card.querySelector('.tcard-thumb').onclick = () => TL.app.openEditor(tac.id);
    card.querySelector('.tcard-body').onclick = () => TL.app.openEditor(tac.id);
    card.querySelector('.act-dup').onclick = (e) => { e.stopPropagation(); const c = TL.store.duplicate(tac.id); if (c) { TL.app.toast(t('duplicate')); TL.app.rerenderView(); } };
    const favBtn = card.querySelector('.tcard-fav');
    if (favBtn) favBtn.onclick = (e) => { e.stopPropagation(); const on = TL.store.toggleFav(tac.id); TL.app.toast(t(on?'fav_added':'fav_removed'), on); TL.app.rerenderView(); };
    card.querySelector('.act-del').onclick = (e) => {
      e.stopPropagation();
      TL.ui.confirmDelete(t('del_confirm')).then(ok => { if (ok) { TL.store.remove(tac.id); TL.app.rerenderView(); } });
    };
    const sel = card.querySelector('.folder-sel');
    sel.onclick = (e) => e.stopPropagation();
    sel.onchange = async (e) => {
      e.stopPropagation();
      let val = sel.value;
      if (val === '__new') {
        const name = await TL.ui.prompt({ title: t('new_folder'), placeholder: t('new_folder_prompt') });
        if (!name) { sel.value = tac.folderId || ''; return; }
        const f = TL.store.addFolder(name); val = f.id;
      }
      if (tac.demo) { // saving the demo into a folder => persist a real copy
        const copy = JSON.parse(JSON.stringify(tac)); copy.id = TL.store.uid(); delete copy.demo;
        copy.folderId = val; TL.store.upsert(copy);
      } else {
        const fresh = TL.store.get(tac.id) || tac; fresh.folderId = val; TL.store.upsert(fresh);
      }
      TL.app.rerenderView();
    };
    return card;
  }

  function escapeHtml(s) { return (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function tagChip(id) {
    const tg = id && TL.tagById(id);
    if (!tg) return '';
    return `<span class="tcard-tag" style="background:${tg.color}">${t(tg.key)}</span>`;
  }

  // ===================== DASHBOARD (Inicio) =====================
  function render(root) {
    const saved = TL.store.loadAll();
    const recent = saved.slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,4);
    const st = TL.store.stats();
    const wr = st.winRate;
    const featured = recent[0] || TL.store.demoTactic();

    root.innerHTML = `
    <div class="view dash-view">
      <section class="wrap dash-hero">
        <div class="dh-court-wrap">
          <div class="dh-court" id="dh-court">${heroCourtSvg(featured)}</div>
          <span class="dh-live"><span class="dh-pulse"></span>${TL.i18n.lang==='en'?'LIVE':'EN VIVO'}</span>
          <span class="dh-score" id="dh-score">0 — 0</span>
          <div class="dh-flash" id="dh-flash"></div>
        </div>
        <div class="dh-right">
          <div class="kicker">${t('dash_hi')}</div>
          <h1 class="dh-title">${TL.i18n.lang==='en'?'Your <span>lab</span>':'Tu <span>laboratorio</span>'}</h1>
          <button class="btn btn-primary btn-lg" id="cta-create">${ic.bolt}${t('cta_create')}</button>
          <div class="dash" id="dash"></div>
          <div id="rank-card"></div>
        </div>
      </section>

      <section class="wrap dash-section" id="onboard-wrap"></section>

      <section class="wrap dash-section" id="demo-banner-wrap"></section>

      <section class="wrap dash-section" id="next-match-wrap"></section>

      <section class="wrap dash-section" id="trial-banner-wrap"></section>

      <section class="wrap dash-section">
        <div class="section-head"><h2>${t('progress')}</h2></div>
        <div class="analytics" id="analytics"></div>
      </section>

      <section class="wrap dash-section">
        <button class="train-cta" id="train-cta">
          <span class="train-cta-ic">${ic.bolt}</span>
          <span class="train-cta-tx">
            <b>${TL.i18n.lang==='en'?'Training mode':'Modo entreno'}</b>
            <span>${TL.i18n.lang==='en'?'Guided sessions with timer, sets & rest':'Sesiones guiadas con tiempo, series y descanso'}</span>
          </span>
          <span class="train-cta-go">${ic.play}</span>
        </button>
      </section>

      <section class="wrap dash-section" style="padding-bottom:48px">
        <div class="section-head">
          <h2>${t('sec_matches')}</h2>
          <button class="btn btn-line btn-sm" id="see-matches">${t('see_all_t')}</button>
        </div>
        <div id="home-matches"></div>
      </section>

      <section class="wrap dash-section" id="weekly-wrap" style="padding-bottom:48px"></section>
    </div>`;

    root.querySelector('#cta-create').onclick = () => TL.app.openEditor(null);
    const dhc = root.querySelector('#dh-court'); if (dhc && featured.id && featured.id!=='demo') dhc.style.cursor='pointer', dhc.onclick=()=>TL.app.openEditor(featured.id);
    root.querySelector('#see-matches').onclick = () => TL.app.openMatches();
    const tcta = root.querySelector('#train-cta'); if (tcta) tcta.onclick = () => TL.session && TL.session.openHub();
    root.querySelectorAll('#quick-row .qrow').forEach(b => b.onclick = () => {
      const g = b.dataset.go;
      if (g==='calendar') TL.app.openCalendar();
      else if (g==='goals') TL.app.openGoals();
      else if (g==='diary') TL.app.openDiary();
    });

    renderDash(root);
    renderRank(root);
    renderAnalytics(root);
    renderMatchesPreview(root);
    renderNextMatch(root);
    renderTrialBanner(root);
    renderDemoBanner(root);
    renderOnboarding(root);
    renderWeekly(root);
    if (TL.achievements) TL.achievements.check(false);
    if (TL.fx) TL.fx.checkRankUp();
    heroMatchSim(root.querySelector('#dh-court svg'), root.querySelector('#dh-score'), root.querySelector('#dh-flash'));
  }

  // ---- first-run onboarding: 3 guided steps, self-checking, dismissable ----
  function renderOnboarding(root) {
    const host = root.querySelector('#onboard-wrap');
    if (!host) return;
    host.innerHTML = '';
    // never alongside the demo seed, and never once dismissed
    if (TL.store.hasSeed && TL.store.hasSeed()) return;
    if (localStorage.getItem('tl_onboard_done') === '1') return;

    const en = TL.i18n.lang === 'en';
    const nTac = TL.store.loadAll().filter(t => !t.seed && !t.demo).length;
    const nRiv = TL.store.loadRivals().filter(r => !r.seed).length;
    const nMat = TL.store.loadMatches().filter(m => !m.seed).length;
    // once the user has built a bit of everything, retire the card for good
    if (nTac > 0 && nRiv > 0 && nMat > 0) { localStorage.setItem('tl_onboard_done','1'); return; }

    const steps = [
      { done: nRiv > 0, act: 'rival',  ic: ic.rival,
        h: en?'Add your first rival':'Añade tu primer rival',
        p: en?'Scout who you play: strengths, weak side, style.':'Apunta a quién juegas: fortalezas, lado débil, estilo.' },
      { done: nTac > 0, act: 'tactic', ic: ic.ball,
        h: en?'Design your first tactic':'Diseña tu primera táctica',
        p: en?'Draw a play on the court — or start from a template.':'Dibuja una jugada en la pista — o parte de una plantilla.' },
      { done: nMat > 0, act: 'match',  ic: ic.flag,
        h: en?'Log a match':'Registra un partido',
        p: en?'Track results to unlock stats and win-rate.':'Guarda resultados y desbloquea estadísticas y % de victorias.' },
    ];
    const doneN = steps.filter(s => s.done).length;

    host.innerHTML = `
      <div class="onb-card">
        <div class="onb-head">
          <div class="onb-head-tx">
            <span class="kicker">${ic.bolt}${en?'GET STARTED':'EMPIEZA AQUÍ'}</span>
            <h2>${en?'Set up your lab in 3 steps':'Monta tu laboratorio en 3 pasos'}</h2>
          </div>
          <button class="onb-skip" id="onb-skip">${en?'Skip':'Omitir'}</button>
        </div>
        <div class="onb-bar"><span style="width:${Math.round(doneN/3*100)}%"></span></div>
        <div class="onb-steps">
          ${steps.map((s,i)=>`
            <button class="onb-step ${s.done?'done':''}" data-act="${s.act}">
              <span class="onb-num">${s.done?ic.check:`<span class="onb-ico">${s.ic}</span>`}</span>
              <span class="onb-tx"><b>${s.h}</b><span>${s.p}</span></span>
              <span class="onb-go">${s.done?(en?'Done':'Hecho'):ic.arrowRight}</span>
            </button>`).join('')}
        </div>
      </div>`;

    host.querySelector('#onb-skip').onclick = () => {
      localStorage.setItem('tl_onboard_done','1');
      TL.fx && TL.fx.press && TL.fx.press();
      host.innerHTML = '';
    };
    host.querySelectorAll('.onb-step').forEach(b => b.onclick = () => {
      if (b.classList.contains('done')) return;
      const a = b.dataset.act;
      if (a === 'rival') TL.app.openRivals();
      else if (a === 'tactic') TL.app.openEditor(null);
      else if (a === 'match') TL.app.openMatches();
    });
  }

  function renderDemoBanner(root) {
    const host = root.querySelector('#demo-banner-wrap');
    if (!host) return;
    if (!TL.store.hasSeed || !TL.store.hasSeed()) { host.innerHTML=''; return; }
    const en = TL.i18n.lang === 'en';
    host.innerHTML = `
      <div class="demo-banner">
        <span class="db-tag">${en?'DEMO':'EJEMPLO'}</span>
        <div class="db-tx">
          <b>${en?"You're exploring with example data":'Estás explorando con datos de ejemplo'}</b>
          <span>${en?'Plays, rivals and matches are samples so you can see how it all fits.':'Las jugadas, rivales y partidos son de muestra para que veas cómo encaja todo.'}</span>
        </div>
        <button class="btn btn-line btn-sm" id="db-clear">${en?'Start fresh':'Empezar de cero'}</button>
      </div>`;
    const b = host.querySelector('#db-clear');
    if (b) b.onclick = () => {
      TL.store.clearSeed();
      TL.fx && TL.fx.press && TL.fx.press();
      TL.app && TL.app.renderHome && TL.app.renderHome();
      TL.app && TL.app.toast && TL.app.toast(en?'Cleared — the app is all yours now':'Limpio — la app es toda tuya', true);
    };
  }

  // ---- weekly recap card (retention + shareable) ----
  function renderWeekly(root) {
    const host = root.querySelector('#weekly-wrap');
    if (!host) return;
    const en = TL.i18n.lang === 'en';
    const w = TL.store.weeklyRecap();
    // hide entirely if the user did literally nothing this week (keeps the dash clean for newcomers)
    if (!w || w.total === 0) { host.innerHTML = ''; return; }

    const cells = [];
    cells.push([w.newTactics, en?'plays':'jugadas', ic.bolt]);
    if (w.matches > 0) cells.push([w.matches, en?'matches':'partidos', ic.trophy || ic.flag]);
    if (w.decided > 0 && w.winRate != null) cells.push([w.winRate + '%', en?'win rate':'victorias', ic.chart || ic.star]);
    if (w.diary > 0) cells.push([w.diary, en?'notes':'notas', ic.edit]);
    while (cells.length < 3) cells.push([w.activeDays, en?'active days':'días activos', ic.calendar]);

    const sub = w.streak >= 2
      ? `🔥 ${w.streak} ${en?'day streak — keep it alive':'días de racha — mantenla viva'}`
      : (en?'Your last 7 days on CourtLab':'Tus últimos 7 días en CourtLab');

    host.innerHTML = `
      <div class="weekly-card">
        <div class="wk-head">
          <div class="wk-ttl">
            <span class="wk-kick">${en?'THIS WEEK':'ESTA SEMANA'}</span>
            <b>${en?'Your recap':'Tu resumen'}</b>
            <span class="wk-sub">${sub}</span>
          </div>
          <button class="wk-share" id="wk-share" aria-label="${t('share')}">${ic.share}<span>${t('share')}</span></button>
        </div>
        <div class="wk-grid">
          ${cells.slice(0,3).map(c => `
            <div class="wk-cell">
              <span class="wk-num">${c[0]}</span>
              <span class="wk-lbl">${c[1]}</span>
            </div>`).join('')}
        </div>
      </div>`;

    const sb = host.querySelector('#wk-share');
    if (sb) sb.onclick = () => { TL.fx && TL.fx.press && TL.fx.press(); shareWeekly(w); };
  }

  // build + share a branded weekly-recap image (reuses the share pipeline)
  function shareWeekly(w) {
    const en = TL.i18n.lang === 'en';
    const W = 1080, H = 1350, M = 90;
    const stats = [
      [String(w.newTactics), en?'PLAYS DESIGNED':'JUGADAS CREADAS'],
      [String(w.matches), en?'MATCHES LOGGED':'PARTIDOS'],
      [w.winRate!=null ? w.winRate+'%' : '—', en?'WIN RATE':'VICTORIAS'],
      [String(w.activeDays), en?'ACTIVE DAYS':'DÍAS ACTIVOS'],
    ];
    let s = '';
    s += `<rect width="${W}" height="${H}" fill="#0E1114"/>`;
    s += `<rect width="${W}" height="${H}" fill="url(#wg)"/>`;
    // header
    s += `<rect x="${M}" y="86" width="40" height="40" rx="9" fill="none" stroke="#E8703D" stroke-width="5"/>`;
    s += `<line x1="${M}" y1="106" x2="${M+40}" y2="106" stroke="#E8703D" stroke-width="5"/>`;
    s += `<text x="${M+58}" y="118" font-size="40" font-weight="900" fill="#F3F5F2" font-family="'Archivo',sans-serif">CourtLab</text>`;
    s += `<text x="${W-M}" y="115" text-anchor="end" font-size="20" letter-spacing="3" fill="#8A9298" font-family="'Space Mono',monospace">${en?'WEEKLY':'SEMANAL'}</text>`;
    // title
    s += `<text x="${M}" y="250" font-size="22" letter-spacing="5" fill="#E8703D" font-family="'Space Mono',monospace">${en?'MY WEEK':'MI SEMANA'}</text>`;
    s += `<text x="${M}" y="322" font-size="62" font-weight="900" fill="#F3F5F2" font-family="'Archivo',sans-serif">${en?'On the court':'En la pista'}</text>`;
    // 2x2 stat grid
    const gx = M, gy = 400, gw = (W - M*2 - 30) / 2, gh = 320, gap = 30;
    stats.forEach((st, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = gx + col * (gw + gap), y = gy + row * (gh + gap);
      s += `<rect x="${x}" y="${y}" width="${gw}" height="${gh}" rx="28" fill="#171B1F" stroke="rgba(255,255,255,.09)" stroke-width="2"/>`;
      s += `<text x="${x+44}" y="${y+150}" font-size="120" font-weight="900" fill="#F3F5F2" font-family="'Archivo',sans-serif">${st[0]}</text>`;
      s += `<text x="${x+46}" y="${y+212}" font-size="24" letter-spacing="2" fill="#8A9298" font-family="'Space Mono',monospace">${st[1]}</text>`;
    });
    // streak ribbon
    if (w.streak >= 2) {
      s += `<rect x="${M}" y="${gy + gh*2 + gap + 26}" width="${W-M*2}" height="92" rx="22" fill="#1B1410" stroke="#E8703D" stroke-width="2"/>`;
      s += `<text x="${W/2}" y="${gy + gh*2 + gap + 84}" text-anchor="middle" font-size="34" font-weight="800" fill="#FF8A3D" font-family="'Archivo',sans-serif">🔥 ${w.streak} ${en?'day streak':'días de racha'}</text>`;
    }
    // footer
    s += `<rect x="0" y="${H-150}" width="${W}" height="150" fill="#13171A"/>`;
    s += `<rect x="0" y="${H-150}" width="${W}" height="4" fill="#E8703D"/>`;
    s += `<text x="${M}" y="${H-86}" font-size="30" font-weight="800" fill="#F3F5F2" font-family="'Archivo',sans-serif">${en?'Plan your tennis & padel tactics':'Crea tus tácticas de tenis y pádel'}</text>`;
    s += `<text x="${M}" y="${H-46}" font-size="24" fill="#E8703D" font-family="'Space Mono',monospace">courtlab · ${en?'free to start':'gratis para empezar'}</text>`;
    const defs = `<defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8703D" stop-opacity=".12"/><stop offset=".4" stop-color="#0E1114" stop-opacity="0"/></linearGradient></defs>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>text{font-family:'Hanken Grotesk','Archivo',sans-serif}</style>${defs}${s}</svg>`;

    const blob = new Blob([svg], { type:'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const sc = 2, cv = document.createElement('canvas');
      cv.width = W*sc; cv.height = H*sc;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#0E1114'; ctx.fillRect(0,0,cv.width,cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(async b => {
        const file = new File([b], 'courtlab_week.png', { type:'image/png' });
        if (navigator.canShare && navigator.canShare({ files:[file] })) {
          try { await navigator.share({ files:[file], title:'CourtLab', text: en?'My week on CourtLab':'Mi semana en CourtLab' }); return; } catch(e){}
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b); a.download = file.name; a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
        TL.app && TL.app.toast && TL.app.toast(en?'Recap saved':'Resumen guardado', true);
      }, 'image/png');
    };
    img.onerror = () => TL.app && TL.app.toast && TL.app.toast('⚠︎');
    img.src = url;
  }

  function renderTrialBanner(root) {    const host = root.querySelector('#trial-banner-wrap');
    if (!host) return;
    // solo para usuarios NO premium
    if (TL.premium && TL.premium.isPremium()) { host.innerHTML=''; return; }
    const en = TL.i18n.lang === 'en';
    host.innerHTML = `
      <div class="trial-banner">
        <div class="tb-ic">${ic.star}</div>
        <div class="tb-tx">
          <b>${en?'Try Premium free for 7 days':'Prueba Premium 7 días gratis'}</b>
          <span>${en?'Unlimited tactics, video export, PDF reports and cloud. No charge during the trial.':'Tácticas ilimitadas, vídeo, informes PDF y nube. No se cobra durante la prueba.'}</span>
        </div>
        <button class="btn btn-primary btn-sm" id="tb-cta">${en?'Start free trial':'Empezar prueba gratis'}</button>
      </div>`;
    const cta = host.querySelector('#tb-cta');
    if (cta) cta.onclick = () => TL.premium.upgrade();
  }

  // ===================== PROFILE (full page) =====================
  function renderProfile(root) {
    const en = TL.i18n.lang === 'en';
    const r = TL.store.rank();
    const av = localStorage.getItem('tl_my_avatar');
    const avHtml = av ? (av.indexOf('data:')===0
        ? `<img src="${av}" alt=""/>`
        : `<span class="pf-emoji">${av}</span>`)
      : ic.user;
    const name = localStorage.getItem('tl_my_user') || '';
    const tacCount = TL.store.loadAll().filter(t=>!t.demo).length;
    const played = TL.store.loadMatches().filter(m=>m.played);
    const decided = played.filter(m=>m.outcome==='win'||m.outcome==='loss');
    const wins = decided.filter(m=>m.outcome==='win').length;
    const winRate = decided.length ? Math.round(wins/decided.length*100) : null;
    const dispName = name ? ('@'+esc(name.replace(/^@/,''))) : t(r.key);
    const stats = [
      [tacCount, en?'Tactics':'Tácticas'],
      [played.length, en?'Matches':'Partidos'],
      [wins, en?'Wins':'Victorias'],
      [winRate==null?'—':winRate+'%', en?'Win rate':'% Victoria'],
    ];
    const tiles = [
      ['league', ic.trophy || ic.star, en?'Club League':'Liga de Clubes'],
      ['session', ic.bolt, en?'Train':'Entrenar'],
      ['matches', ic.flag, t('nav_matches')],
      ['calendar', ic.cal || ic.flag, t('calendar')],
      ['goals',    ic.bolt, t('goals')],
      ['diary',    ic.book, t('diary')],
      ['achievements', ic.star, en?'Achievements':'Logros'],
      ['friends',  ic.user, en?'Friends':'Amigos'],
    ];
    root.innerHTML = `
    <div class="view profile-view">
      <section class="wrap">
        <div class="pf-hero">
          <div class="pf-hero-top">
            <button class="pf-av-lg" id="pf-av-btn">${avHtml}<span class="pf-av-edit">${ic.pencil||''}</span></button>
            <div class="pf-id">
              <h1>${dispName}</h1>
              <div class="pf-rankrow">
                <span class="pf-badge" style="--rc:${r.color}">${r.icon} ${t(r.key)}</span>
                <span class="pf-lvl">${en?'Lvl':'Nv'} ${r.level}/${r.max}</span>
              </div>
            </div>
          </div>
          <div class="pf-xp">
            <div class="pf-xp-head">
              <span>${r.xp} ${t('rank_xp')}</span>
              <span>${r.nextKey ? (r.toNext+' '+(en?'to':'para')+' '+t(r.nextKey)) : (en?'Max rank':'Rango máximo')}</span>
            </div>
            <div class="pf-xp-bar"><i style="width:${r.pct}%;--rc:${r.color}"></i></div>
          </div>
          <div class="pf-stats">
            ${stats.map(s=>`<div class="pf-stat"><b>${s[0]}</b><span>${s[1]}</span></div>`).join('')}
          </div>
        </div>

        <div class="section-head" style="margin-top:8px"><h2>${en?'Activity':'Actividad'}</h2></div>
        <div class="pf-grid">
          ${tiles.map(x=>`<button class="pf-tile" data-go="${x[0]}"><span class="pf-ic">${x[1]}</span><span>${x[2]}</span></button>`).join('')}
        </div>

        <div class="section-head" style="margin-top:20px"><h2>${en?'Account':'Cuenta'}</h2></div>
        <div class="pf-rows">
          <button class="pf-row" id="pf-edit-row"><span class="pf-ic">${ic.user}</span><span class="pf-row-lb">${en?'Edit profile':'Editar perfil'}</span><span class="pf-chev">${ic.chevR||'›'}</span></button>
          <button class="pf-row" id="pf-settings-row"><span class="pf-ic">${ic.sliders}</span><span class="pf-row-lb">${t('settings')}</span><span class="pf-chev">${ic.chevR||'›'}</span></button>
        </div>
      </section>
    </div>`;

    const editProfile = () => { TL.social ? TL.social.profileModal() : TL.settings.open(); };
    const avb = root.querySelector('#pf-av-btn'); if (avb) avb.onclick = editProfile;
    const er = root.querySelector('#pf-edit-row'); if (er) er.onclick = editProfile;
    const sr = root.querySelector('#pf-settings-row'); if (sr) sr.onclick = () => TL.settings.open();
    root.querySelectorAll('.pf-tile').forEach(b => b.onclick = () => {
      const g = b.dataset.go;
      if (g==='session') TL.session && TL.session.openHub();
      else if (g==='league') TL.app.openLeague();
      else if (g==='matches') TL.app.openMatches();
      else if (g==='calendar') TL.app.openCalendar();
      else if (g==='goals') TL.app.openGoals();
      else if (g==='diary') TL.app.openDiary();
      else if (g==='achievements') TL.achievements && TL.achievements.panel();
      else if (g==='friends') TL.social ? TL.social.friendsModal() : TL.settings.open();
    });
  }

  // vertical (portrait) court for the hero left column
  function heroCourtSvg(tac) {
    const C2 = C, vb = C2.viewBox('full');
    const surf = (tac && tac.surface) || 'clay';
    const cx=C2.cx;
    let svg = `<svg viewBox="${vb.str}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${C2.render(surf)}`;
    svg += `<g data-tid="own"><circle cx="${cx-1.5}" cy="${C2.cBot-0.6}" r="0.95" fill="#D7F23A" stroke="rgba(0,0,0,.45)" stroke-width="0.14"/><text x="${cx-1.5}" y="${C2.cBot-0.24}" font-size="0.95" font-family="Space Mono,monospace" font-weight="700" fill="#1A1E12" text-anchor="middle">J1</text></g>`;
    svg += `<g data-tid="rival"><circle cx="${cx+1.5}" cy="${C2.cTop+0.6}" r="0.95" fill="#FF5B5B" stroke="rgba(0,0,0,.45)" stroke-width="0.14"/><text x="${cx+1.5}" y="${C2.cTop+0.96}" font-size="0.95" font-family="Space Mono,monospace" font-weight="700" fill="#fff" text-anchor="middle">R1</text></g>`;
    svg += `<circle class="hero-ball" cx="${cx-1.5}" cy="${C2.cBot-0.8}" r="0.5" fill="#fff"/>`;
    svg += `</svg>`;
    return svg;
  }

  // ---- live match simulator: 10 predefined rallies, random order, alternating winners ----
  function heroMatchSim(svg, scoreEl, flashEl) {
    if (!svg) return;
    const C2 = C, cx = C2.cx, top = C2.cTop, bot = C2.cBot, net = C2.net;
    const ball = svg.querySelector('.hero-ball');
    const ownG = svg.querySelector('[data-tid="own"]');
    const rivG = svg.querySelector('[data-tid="rival"]');
    if (!ball || !ownG || !rivG) return;
    const P = (x,y)=>({x,y});
    // each rally: list of ball hit/land points alternating sides, ending with winner
    // y>net = bottom (you), y<net = top (rival)
    const R = [
      { s:[P(cx-1.5,bot-0.8),P(cx-3,top+1.5),P(cx+3,bot-1),P(cx-3.5,top+2),P(cx+3.8,bot-2.5)], w:'own' },
      { s:[P(cx+1.5,top+0.8),P(cx+3,bot-1.5),P(cx-3,top+1),P(cx+3.5,bot-2)], w:'rival' },
      { s:[P(cx-1.5,bot-0.8),P(cx,top+1),P(cx,bot-1),P(cx+3.8,top+1.5)], w:'own' },
      { s:[P(cx+2,top+0.7),P(cx-3.5,bot-1),P(cx+2,top+2.5),P(cx-4,bot-3)], w:'own' },
      { s:[P(cx-2,bot-0.7),P(cx+3.5,top+1),P(cx-2,bot-2),P(cx+4,top+2.5)], w:'rival' },
      { s:[P(cx+1.5,top+0.8),P(cx-2,bot-1),P(cx+3,top+1.2),P(cx-3.5,bot-1.5),P(cx+3.5,top+2)], w:'rival' },
      { s:[P(cx-1.5,bot-0.8),P(cx+3,top+1.2),P(cx-3,bot-1.2),P(cx+0.5,net+0.6)], w:'own' },
      { s:[P(cx+1.5,top+0.8),P(cx-3,bot-1),P(cx+3,top+1.5),P(cx-0.5,net-0.6)], w:'rival' },
      { s:[P(cx-2,bot-0.7),P(cx-3,top+2),P(cx+3,bot-2),P(cx-4,top+1.5),P(cx+4,bot-1)], w:'own' },
      { s:[P(cx+2,top+0.7),P(cx+3,bot-2),P(cx-3,top+1.5),P(cx+4,bot-2),P(cx-4,top+1)], w:'rival' },
    ];
    let order = shuffle([...Array(R.length).keys()]);
    let oi = 0, scoreOwn = 0, scoreRiv = 0, segs = null, segi = 0, t0 = null, phase='play', rally=null;
    function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
    function setG(g, x, y){ const c=g.querySelector('circle'); const tx=g.querySelector('text'); if(c){c.setAttribute('cx',x);c.setAttribute('cy',y);} if(tx){tx.setAttribute('x',x);tx.setAttribute('y',y+0.36);} }
    function startRally(){
      rally = R[order[oi]];
      segs = []; for(let i=1;i<rally.s.length;i++) segs.push([rally.s[i-1],rally.s[i]]);
      segi = 0; t0 = null; phase='play';
      // place ball + server
      const first = rally.s[0];
      ball.setAttribute('cx',first.x); ball.setAttribute('cy',first.y); ball.style.opacity=1;
      if(first.y>net){ setG(ownG,first.x,Math.min(bot-0.5,first.y)); setG(rivG,cx+0.5,top+0.7);} else { setG(rivG,first.x,Math.max(top+0.5,first.y)); setG(ownG,cx-0.5,bot-0.7);}
      if(scoreEl) scoreEl.textContent = `${scoreOwn} — ${scoreRiv}`;
    }
    const ease=(x)=>x<0.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
    const SHOT=1050, HOLD=120;
    function frame(ts){
      if(t0===null)t0=ts;
      // perf: stop looping if the court left the DOM (navigated away) or tab is hidden
      if (!svg.isConnected) { TL._heroRaf = null; return; }
      if (document.hidden) { TL._heroRaf = requestAnimationFrame(frame); return; }
      if(phase==='play'){
        const seg=segs[segi]; const e=Math.min(1,(ts-t0)/SHOT); const k=ease(e);
        const x=seg[0].x+(seg[1].x-seg[0].x)*k, y=seg[0].y+(seg[1].y-seg[0].y)*k;
        ball.setAttribute('cx',x); ball.setAttribute('cy',y);
        // receiving player tracks the incoming ball; the other recovers toward centre
        const tgt=seg[1];
        const recv = tgt.y>net ? ownG : rivG;
        const other = tgt.y>net ? rivG : ownG;
        const ry = tgt.y>net ? bot-0.6 : top+0.6;
        const rc=recv.querySelector('circle'); const rpx=+rc.getAttribute('cx'); setG(recv, rpx+(tgt.x-rpx)*0.10, ry);
        const oc=other.querySelector('circle'); const opx=+oc.getAttribute('cx'); const oy=tgt.y>net?top+0.6:bot-0.6; setG(other, opx+(cx-opx)*0.04, oy);
        if(e>=1){ if(ts-t0>=SHOT){ segi++; t0=ts; if(segi>=segs.length){ phase='point'; t0=ts; pointWon(); } } }
      } else if(phase==='point'){
        if(ts-t0>1500){ oi=(oi+1)%order.length; if(oi===0) order=shuffle(order); if(flashEl) flashEl.classList.remove('show'); startRally(); }
      }
      TL._heroRaf=requestAnimationFrame(frame);
    }
    function pointWon(){
      const en=TL.i18n.lang==='en';
      if(rally.w==='own'){ scoreOwn++; } else { scoreRiv++; }
      if(scoreOwn>5||scoreRiv>5){ scoreOwn=0; scoreRiv=0; }
      ball.style.opacity=.2;
      if(flashEl){ flashEl.textContent = rally.w==='own'?(en?'POINT · YOU':'PUNTO · TÚ'):(en?'POINT · RIVAL':'PUNTO · RIVAL'); flashEl.className='dh-flash show '+(rally.w==='own'?'own':'riv'); }
      if(scoreEl) scoreEl.textContent = `${scoreOwn} — ${scoreRiv}`;
    }
    startRally();
    TL._heroRaf && cancelAnimationFrame(TL._heroRaf);
    TL._heroRaf=requestAnimationFrame(frame);
  }


  function renderNextMatch(root) {
    const host = root.querySelector('#next-match-wrap');
    if (!host) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const up = TL.store.loadMatches().filter(m=>!m.played && m.date && new Date(m.date+'T00:00')>=today)
      .sort((a,b)=>a.date.localeCompare(b.date));
    if (!up.length) { host.innerHTML=''; return; }
    const m = up[0];
    const rivalName = (id)=>{ const r=TL.store.loadRivals().find(x=>x.id===id); return r?r.name:t('no_rival'); };
    const days = Math.round((new Date(m.date+'T00:00') - today)/86400000);
    const en = TL.i18n.lang==='en';
    const dLabel = days===0 ? (en?'TODAY':'HOY') : days===1 ? (en?'TOMORROW':'MAÑANA') : `${days} ${en?'DAYS':'DÍAS'}`;
    const rv = TL.store.loadRivals().find(x=>x.id===m.rivalId);
    const dateStr = new Date(m.date+'T00:00').toLocaleDateString(en?'en-GB':'es-ES',{weekday:'long',day:'2-digit',month:'long'});
    host.innerHTML = `
      <div class="next-match ${days<=2?'imminent':''}">
        <div class="nm-left">
          <span class="nm-kicker">${ic.flag}${en?'NEXT MATCH':'PRÓXIMO PARTIDO'}</span>
          <h3>${escapeHtml(rivalName(m.rivalId))}</h3>
          <p>${dateStr}${m.tournament?` · ${escapeHtml(m.tournament)}`:''} · ${t('surf_'+m.surface)}</p>
          ${(rv&&rv.weak)?`<p class="nm-weak">${ic.bolt}${escapeHtml(rv.weak)}</p>`:''}
        </div>
        <div class="nm-right">
          <div class="nm-count"><b>${days===0?'0':days}</b><span>${dLabel}</span></div>
          <button class="btn btn-primary btn-sm" id="nm-prep">${ic.bolt}${t('prep')}</button>
          ${(days<=2 && 'Notification' in window) ? `<button class="btn btn-ghost btn-sm" id="nm-bell" title="${t('notify_remind')}">🔔 ${t('notify_remind')}</button>` : ''}
        </div>
      </div>`;
    const pb = host.querySelector('#nm-prep');
    if (pb) pb.onclick = () => { TL.app.openMatches(); };
    const bell = host.querySelector('#nm-bell');
    if (bell) bell.onclick = async () => {
      if (!('Notification' in window)) return;
      let perm = Notification.permission;
      if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch(e){} }
      if (perm === 'granted') { TL.app.toast(t('notify_on'), true); TL.app.notifyUpcomingMatch && TL.app.notifyUpcomingMatch(); }
      else TL.app.toast(t('notify_blocked'));
    };
  }

  // ===================== LIBRARY (Tácticas) =====================
  function renderLibrary(root) {
    root.innerHTML = `
    <div class="view">
      <section class="wrap subhead">
        <div class="subhead-tt"><div class="kicker">${t('sec_tactics_k')}</div><h1>${t('sec_tactics')}</h1></div>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-sm" id="new-2">${ic.plus}${t('new_tactic')}</button>
      </section>
      <section class="wrap" style="padding-bottom:40px">
        <div class="lib-tools">
          <div class="search-box">${searchIcon}<input id="tac-search" placeholder="${t('search_ph')}" value="${escapeHtml(searchQuery)}"/></div>
          <select id="tac-sort" class="sort-sel">
            <option value="recent" ${sortBy==='recent'?'selected':''}>${t('sort_recent')}</option>
            <option value="name" ${sortBy==='name'?'selected':''}>${t('sort_name')}</option>
            <option value="steps" ${sortBy==='steps'?'selected':''}>${t('sort_steps')}</option>
          </select>
          <select id="tac-tag" class="sort-sel">
            <option value="" ${tagFilter===''?'selected':''}>${t('tags_label')}: ${t('all')}</option>
            ${TL.TAGS.map(tg=>`<option value="${tg.id}" ${tagFilter===tg.id?'selected':''}>${t(tg.key)}</option>`).join('')}
          </select>
          <div class="lib-actions">
            <button class="btn btn-line btn-sm" id="pro-btn" title="${t('proplays_d')}">${ic.star}${t('proplays')}</button>
            <button class="btn btn-line btn-sm" id="compare-btn" title="${t('compare')}">${ic.grid}${t('compare')}</button>
            <button class="btn btn-line btn-sm" id="playbook-btn" title="${t('playbook_d')}">${ic.book}${t('playbook')}</button>
            <span class="sep"></span>
            <button class="btn btn-ghost btn-icon btn-sm" id="new-folder" title="${t('new_folder')}">${folderIcon}</button>
            <button class="btn btn-ghost btn-icon btn-sm" id="fav-filter" title="${t('favs_only')}">${ic.starO}</button>
            <button class="btn btn-ghost btn-icon btn-sm" id="lib-view" title="${t('view_toggle')}">${libView==='grid'?listViewIcon:gridViewIcon}</button>
          </div>
        </div>
        <div class="folderbar" id="folderbar"></div>
        <div class="cards" id="tactic-cards"></div>
      </section>
    </div>`;

    root.querySelector('#new-2').onclick = () => TL.app.openEditor(null);
    const pb = root.querySelector('#playbook-btn'); if (pb) pb.onclick = () => TL.modals.playbook();
    const cmp = root.querySelector('#compare-btn'); if (cmp) cmp.onclick = () => compareTactics();
    const pro = root.querySelector('#pro-btn'); if (pro) pro.onclick = () => TL.proplays && TL.proplays.open();
    root.querySelector('#new-folder').onclick = async () => {
      const name = await TL.ui.prompt({ title: t('new_folder'), placeholder: t('new_folder_prompt') });
      if (name) { const f = TL.store.addFolder(name); folderFilter = f.id; TL.app.toast(t('folder_created'), true); renderFolderBar(root); renderTactics(root); }
    };
    if (folderFilter && !TL.store.loadFolders().some(f => f.id === folderFilter)) folderFilter = null;
    renderFolderBar(root);
    renderTactics(root);

    const search = root.querySelector('#tac-search');
    if (search) {
      search.oninput = () => { searchQuery = search.value; renderTactics(root); };
      search.onkeydown = (e) => { if (e.key === 'Escape') { searchQuery=''; search.value=''; renderTactics(root); } };
    }
    const sortSel = root.querySelector('#tac-sort');
    if (sortSel) sortSel.onchange = () => { sortBy = sortSel.value; renderTactics(root); };
    const tagSel = root.querySelector('#tac-tag');
    if (tagSel) tagSel.onchange = () => { tagFilter = tagSel.value; renderTactics(root); };
    const favBtn = root.querySelector('#fav-filter');
    if (favBtn) { favBtn.classList.toggle('on', favOnly); favBtn.onclick = () => { favOnly = !favOnly; favBtn.classList.toggle('on', favOnly); renderTactics(root); }; }
    const viewBtn = root.querySelector('#lib-view');
    if (viewBtn) viewBtn.onclick = () => {
      libView = libView === 'grid' ? 'list' : 'grid';
      localStorage.setItem('tl_lib_view', libView);
      viewBtn.innerHTML = libView==='grid' ? listViewIcon : gridViewIcon;
      TL.fx && TL.fx.tap && TL.fx.tap();
      renderTactics(root);
    };
    window.scrollTo(0,0);
  }

  function renderRank(root) {
    const host = root.querySelector('#rank-card');
    if (!host) return;
    // racha de días seguidos (visible)
    if (TL.achievements && TL.achievements.touchStreak) TL.achievements.touchStreak();
    const sd = (TL.achievements && TL.achievements.streak) ? TL.achievements.streak() : 0;
    const streakHtml = sd >= 1
      ? `<div class="streak-chip"><span class="streak-flame">🔥</span><b>${sd}</b><span class="streak-tx">${sd===1?t('streak_today'):t('streak_days')}</span></div>`
      : '';
    const r = TL.store.rank();
    host.innerHTML = streakHtml + `
      <div class="rank-card" style="--rk:${r.color}">
        <span class="rank-ic">${r.icon}</span>
        <div class="rank-tx">
          <span class="rank-k">${t('rank_title')} · ${r.xp} ${t('rank_xp')}</span>
          <b class="rank-name">${t(r.key)}</b>
          <div class="rank-track"><span class="rank-fill" style="width:${r.pct}%"></span></div>
          <span class="rank-next">${r.nextKey ? `${r.toNext} ${t('rank_xp')} ${t('rank_next')} ${t(r.nextKey)}` : t('rank_max')}</span>
        </div>
        <span class="rank-lvl">${r.level}/${r.max}</span>
      </div>`;
    // achievements progress card (visible button + bar)
    const ctaRow = document.createElement('div');
    ctaRow.className = 'ach-cta-row';
    host.appendChild(ctaRow);
    if (TL.achievements) {
      const st = TL.achievements.state();
      const done = st.filter(a=>a.claimed).length;
      const total = st.length;
      const pct = Math.round(done/total*100);
      const next = st.find(a=>!a.claimed);
      const en = TL.i18n.lang === 'en';
      const card = document.createElement('button');
      card.className = 'ach-cta';
      card.innerHTML = `
        <div class="ach-cta-top">
          <span class="ach-cta-title">🎖️ ${en?'Achievements':'Logros'}</span>
          <span class="ach-cta-count">${done}/${total}</span>
        </div>
        <div class="ach-cta-bar"><i style="width:${pct}%"></i></div>
        <div class="ach-cta-foot">
          <span>${next ? `${TL.i18n.t('ach_'+next.id)} · ${next.cur}/${next.target}` : (en?'All unlocked!':'¡Todos completados!')}</span>
          <span class="ach-cta-go">${next?'🎖️':'✓'}</span>
        </div>`;
      card.onclick = () => TL.achievements.panel();
      ctaRow.appendChild(card);
    }
    // "Invita y gana 1 mes" card
    if (TL.referrals) {
      const en = TL.i18n.lang === 'en';
      const n = Math.min(TL.referrals.invitedCount(), TL.referrals.GOAL);
      const pct = Math.round(n/TL.referrals.GOAL*100);
      const rcard = document.createElement('button');
      rcard.className = 'ach-cta ref-cta';
      rcard.innerHTML = `
        <div class="ach-cta-top">
          <span class="ach-cta-title">🎁 ${en?'Invite & earn':'Invita y gana'}</span>
          <span class="ach-cta-count">${n}/${TL.referrals.GOAL}</span>
        </div>
        <div class="ach-cta-bar"><i style="width:${pct}%"></i></div>
        <div class="ach-cta-foot">
          <span>${en?`Invite ${TL.referrals.GOAL} friends`:`Invita a ${TL.referrals.GOAL} amigos`}</span>
          <span class="ach-cta-go">+${TL.referrals.REWARD_DAYS}${en?'d':'d'} 🎉</span>
        </div>`;
      rcard.onclick = () => TL.referrals.panel();
      ctaRow.appendChild(rcard);
    }
    const ab = host.querySelector('#rank-ach');
    if (ab) ab.onclick = () => TL.achievements && TL.achievements.panel();
  }

  function renderDash(root) {
    const host = root.querySelector('#dash');
    if (!host) return;
    const s = TL.store.stats();
    const cells = [
      [s.tactics, t('dash_tactics'), ic.ball, () => {}],
      [s.rivals, t('dash_rivals'), ic.rival, () => TL.app.openRivals()],
      [s.matches, t('dash_matches'), ic.flag, () => TL.app.openMatches()],
      [s.winRate==null ? '—' : s.winRate+'%', t('dash_winrate'), ic.bolt, () => TL.app.openMatches()],
    ];
    host.innerHTML = cells.map((c,i)=>`
      <button class="dstat" data-i="${i}">
        <span class="dstat-ic">${c[2]}</span>
        <span class="dstat-n">${c[0]}</span>
        <span class="dstat-l">${c[1]}</span>
      </button>`).join('');
    host.querySelectorAll('.dstat').forEach((b,i)=> b.onclick = cells[i][3]);
  }

  function renderAnalytics(root) {
    const host = root.querySelector('#analytics');
    if (!host) return;
    const matchesAll = TL.store.loadMatches();
    const hasPadel = matchesAll.some(m => (m.sport||'tennis')==='padel');
    const hasTennis = matchesAll.some(m => (m.sport||'tennis')==='tennis');
    const hasPickle = matchesAll.some(m => (m.sport||'tennis')==='pickle');
    const showSportTabs = [hasTennis,hasPadel,hasPickle].filter(Boolean).length >= 2;
    const s = TL.store.stats(window.__anSport || 'all');
    if (!s.decided && !showSportTabs) { host.innerHTML = ''; host.classList.add('hide'); return; }
    host.classList.remove('hide');
    const SURF_IN = { clay:C.SURF.clay.in, hard:C.SURF.hard.in, grass:C.SURF.grass.in, indoor:C.SURF.indoor.in };

    // by surface
    const surfRows = ['clay','hard','grass','indoor'].map(k => {
      const d = s.bySurface[k];
      const rate = d.rate==null ? 0 : d.rate;
      return `<div class="bar-row">
        <span class="bar-l"><i style="background:${SURF_IN[k]}"></i>${surfLabel(k)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${rate}%;background:${SURF_IN[k]}"></span></span>
        <span class="bar-v">${d.rate==null?'—':d.rate+'%'}</span>
      </div>`;
    }).join('');

    // top tactics
    const topTacs = s.byTactic.slice(0,4);
    const tacRows = topTacs.length ? topTacs.map(tc=>`
      <div class="bar-row">
        <span class="bar-l bar-l-name">${escapeHtml(tc.name||t('untitled'))}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${tc.rate||0}%;background:var(--ball)"></span></span>
        <span class="bar-v">${tc.rate==null?'—':tc.rate+'%'} <i class="bar-uses">${tc.uses} ${t('stat_uses')}</i></span>
      </div>`).join('') : `<p class="hint-muted">${t('stat_no_data')}</p>`;

    // progress timeline (last 14 decided)
    const tl = s.timeline.slice(-14);
    const dots = tl.map(m=>`<span class="prog-dot ${m.outcome}" title="${m.date||''}">${m.outcome==='win'?t('win_label'):t('loss_label')}</span>`).join('');

    // best / worst surface
    const surfName = (k) => surfLabel(k);
    const bestWorst = (s.bestCourt || s.worstCourt) ? `
      <div class="bw-row">
        ${s.bestCourt?`<div class="bw-cell best"><span class="bw-l">${t('best_court')}</span><b>${surfName(s.bestCourt.surface)}</b><span class="bw-r">${s.bestCourt.rate}%</span></div>`:''}
        ${(s.worstCourt && (!s.bestCourt || s.worstCourt.surface!==s.bestCourt.surface))?`<div class="bw-cell worst"><span class="bw-l">${t('worst_court')}</span><b>${surfName(s.worstCourt.surface)}</b><span class="bw-r">${s.worstCourt.rate}%</span></div>`:''}
      </div>` : '';

    // by club / tournament bars
    const groupBars = (arr) => arr.slice(0,4).map(g=>`
      <div class="bar-row">
        <span class="bar-l bar-l-name">${escapeHtml(g.key)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${g.rate}%;background:var(--ball)"></span></span>
        <span class="bar-v">${g.rate}% <i class="bar-uses">${g.decided}</i></span>
      </div>`).join('');

    host.innerHTML = `
      ${showSportTabs?`<div class="sport-tabs an-sport">
        <button class="sport-tab ${(window.__anSport||'all')==='all'?'on':''}" data-an="all">${t('all')||'Todos'}</button>
        ${hasTennis?`<button class="sport-tab ${window.__anSport==='tennis'?'on':''}" data-an="tennis">🎾 ${t('sport_tennis')}</button>`:''}
        ${hasPadel?`<button class="sport-tab ${window.__anSport==='padel'?'on':''}" data-an="padel">🥎 ${t('sport_padel')}</button>`:''}
        ${hasPickle?`<button class="sport-tab ${window.__anSport==='pickle'?'on':''}" data-an="pickle">🏓 ${t('sport_pickle')}</button>`:''}
      </div>`:''}
      <div class="an-card">
        <div class="an-h"><span class="kicker">${t('stat_by_surface')}</span></div>
        <div class="bars">${surfRows}</div>
        ${bestWorst}
      </div>
      <div class="an-card">
        <div class="an-h"><span class="kicker">${t('stat_by_tactic')}</span></div>
        <div class="bars">${tacRows}</div>
      </div>
      <div class="an-card">
        <div class="an-h"><span class="kicker">${t('progress')}</span><span class="an-rec">${s.wins}-${s.losses}</span></div>
        <div class="prog-row">${dots || `<p class="hint-muted">${t('stat_no_data')}</p>`}</div>
      </div>
      ${s.byClub.length?`<div class="an-card">
        <div class="an-h"><span class="kicker">${t('stat_by_club')}</span></div>
        <div class="bars">${groupBars(s.byClub)}</div>
      </div>`:''}
      ${s.byTournament.length?`<div class="an-card">
        <div class="an-h"><span class="kicker">${t('stat_by_tour')}</span></div>
        <div class="bars">${groupBars(s.byTournament)}</div>
      </div>`:''}`;
    host.querySelectorAll('.an-sport [data-an]').forEach(b => b.onclick = () => { window.__anSport = b.dataset.an; renderAnalytics(root); });
  }

  function renderMatchesPreview(root) {
    const host = root.querySelector('#home-matches');
    if (!host) return;
    const matches = TL.store.loadMatches().slice(0, 3);
    if (!matches.length) {
      host.innerHTML = `<div class="empty"><h3>${t('empty_matches_h2')}</h3><p>${t('empty_matches_p2')}</p><button class="btn btn-primary btn-sm" id="hm-new">${ic.plus}${t('new_match')}</button></div>`;
      const b = host.querySelector('#hm-new'); if (b) b.onclick = () => TL.app.openMatches();
      return;
    }
    const rname = (id) => { const r = TL.store.loadRivals().find(x=>x.id===id); return r?r.name:t('no_rival'); };
    const fd = (d) => d ? new Date(d+'T00:00').toLocaleDateString(TL.i18n.lang==='en'?'en-GB':'es-ES',{day:'2-digit',month:'short'}) : '—';
    host.className = 'home-match-rows';
    host.innerHTML = matches.map(m=>`
      <button class="hm-row" data-id="${m.id}">
        <span class="hm-dot" style="background:${C.SURF[m.surface]?C.SURF[m.surface].in:'#888'}"></span>
        <span class="hm-name">${escapeHtml(rname(m.rivalId))}</span>
        <span class="hm-date">${fd(m.date)}</span>
        <span class="m-status ${m.played?'played':''}">${m.played?t('played'):t('upcoming')}</span>
        ${ic.arrowRight}
      </button>`).join('');
    host.querySelectorAll('.hm-row').forEach(b => b.onclick = () => TL.app.openMatches());
  }

  function renderFolderBar(root) {
    const bar = root.querySelector('#folderbar');
    if (!bar) return;
    const folders = TL.store.loadFolders();
    const saved = TL.store.loadAll();
    if (!folders.length) { bar.innerHTML = ''; bar.classList.add('hide'); return; }
    bar.classList.remove('hide');
    const cnt = (fid) => saved.filter(t2 => t2.folderId === fid).length;
    let html = `<button class="fchip ${folderFilter==null?'on':''}" data-f="">${t('all_tactics')} <b>${saved.length}</b></button>`;
    folders.forEach(f => {
      html += `<button class="fchip ${folderFilter===f.id?'on':''}" data-f="${f.id}">${folderIcon} ${escapeHtml(f.name)} <b>${cnt(f.id)}</b></button>`;
    });
    if (folderFilter) {
      html += `<span class="fbar-tools">
        <button class="x-mini" id="f-rename" title="${t('rename')}">${ic.edit}</button>
        <button class="x-mini" id="f-del" title="${t('delete')}">${ic.trash}</button>
      </span>`;
    }
    bar.innerHTML = html;
    bar.querySelectorAll('.fchip').forEach(b => b.onclick = () => { folderFilter = b.dataset.f || null; renderFolderBar(root); renderTactics(root); });
    const rn = bar.querySelector('#f-rename');
    if (rn) rn.onclick = async () => {
      const f = TL.store.loadFolders().find(x => x.id === folderFilter); if (!f) return;
      const name = await TL.ui.prompt({ title: t('rename'), placeholder: t('rename_folder_prompt'), value: f.name });
      if (name) { TL.store.renameFolder(folderFilter, name); renderFolderBar(root); }
    };
    const dl = bar.querySelector('#f-del');
    if (dl) dl.onclick = () => {
      TL.ui.confirmDelete(t('del_folder')).then(ok => { if (ok) { TL.store.removeFolder(folderFilter); folderFilter = null; renderFolderBar(root); renderTactics(root); } });
    };
  }

  function renderTactics(root) {
    const host = root.querySelector('#tactic-cards');
    if (!host) return;
    host.className = 'cards' + (libView === 'list' ? ' list-view' : '');
    const saved = TL.store.loadAll();
    let list;
    if (folderFilter == null) list = saved.length ? saved : [TL.store.demoTactic()];
    else list = saved.filter(t2 => t2.folderId === folderFilter);
    // search
    const q = (searchQuery||'').trim().toLowerCase();
    let searching = false;
    if (tagFilter) { list = list.filter(t2 => t2.tag === tagFilter); searching = true; }
    if (favOnly) { list = list.filter(t2 => t2.fav); searching = true; }
    if (q) {
      searching = true;
      list = list.filter(t2 => {
        const hay = [t2.name, t2.number, t2.rival, t2.description].filter(Boolean).join(' ').toLowerCase();
        const stepHay = (t2.steps||[]).map(s=>s.title||'').join(' ').toLowerCase();
        return hay.includes(q) || stepHay.includes(q);
      });
    }
    // sort
    list = list.slice();
    if (sortBy === 'name') list.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    else if (sortBy === 'steps') list.sort((a,b)=>(b.steps||[]).length-(a.steps||[]).length);
    else list.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));

    host.innerHTML = '';
    if (!list.length) {
      const msg = searching ? t('no_results') : t('no_tactics_folder');
      const eic = searching ? searchIcon : ic.plus;
      host.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-ic">${eic}</div><h3>${msg}</h3>${searching?'':`<button class="btn btn-primary btn-sm" id="empty-create">${ic.plus}${t('cta_create')}</button>`}</div>`;
      const ec = host.querySelector('#empty-create'); if (ec) ec.onclick = () => TL.app.openEditor(null);
      return;
    }
    list.forEach(tac => host.appendChild(tacticCard(tac)));
  }

  // subtle looping animation of the ball along the last path on the hero
  function animateHero(svg, demo) {
    if (!svg) return;
    const path = demo.steps[4].paths.find(p => p.kind === 'ball');
    if (!path) return;
    const ball = svg.querySelector('circle[r="0.5"]');
    if (!ball) return;
    const pts = path.points;
    // build cumulative length samples
    const seg = []; let total = 0;
    for (let i=1;i<pts.length;i++){ const dx=pts[i].x-pts[i-1].x, dy=pts[i].y-pts[i-1].y; const l=Math.hypot(dx,dy); seg.push({a:pts[i-1],b:pts[i],l,acc:total}); total+=l; }
    let raf, start;
    const dur = 2600;
    function frame(ts){
      if (!ball.isConnected) { return; }
      if (document.hidden) { raf = requestAnimationFrame(frame); return; }
      if (!start) start = ts;
      let p = ((ts - start) % (dur+900)) / dur;
      if (p > 1) { ball.style.opacity = 0; raf = requestAnimationFrame(frame); return; }
      ball.style.opacity = 1;
      const target = TL.anim ? TL.anim.easeInOut(p) : p;
      const dist = target * total;
      let s = seg.find(x => dist >= x.acc && dist <= x.acc + x.l) || seg[seg.length-1];
      const lt = s.l ? (dist - s.acc)/s.l : 0;
      ball.setAttribute('cx', s.a.x + (s.b.x-s.a.x)*lt);
      ball.setAttribute('cy', s.a.y + (s.b.y-s.a.y)*lt);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    TL._heroRaf && cancelAnimationFrame(TL._heroRaf);
    TL._heroRaf = raf;
  }

  function compareTactics(){
    const all = TL.store.loadAll();
    if (all.length < 2) { TL.app.toast(t('no_results')); return; }
    let h = document.getElementById('modal-host'); if(!h){h=document.createElement('div');h.id='modal-host';document.body.appendChild(h);}
    const opts = (sel)=> all.map(tc=>`<option value="${tc.id}" ${sel===tc.id?'selected':''}>${escapeHtml(tc.name||t('untitled'))}</option>`).join('');
    let aId=all[0].id, bId=all[1].id;
    const stepsMini = (tc)=>{
      const s = tc.steps[tc.steps.length-1]||tc.steps[0];
      return `<div class="cmpt-thumb">${C.thumb(tc.surface, s, tc.tokens)}</div>`;
    };
    const col = (tc)=>{
      const tg = tc.tag && TL.tagById(tc.tag);
      return `<div class="cmpt-col">
        ${stepsMini(tc)}
        <div class="cmpt-rows">
          <div class="cmp-row"><span>${t('f_surface')}</span><b>${t('surf_'+tc.surface)}</b></div>
          <div class="cmp-row"><span>${t('steps')}</span><b>${tc.steps.length}</b></div>
          <div class="cmp-row"><span>${t('f_playtype')}</span><b>${tc.playType?t('pt_'+tc.playType):'—'}</b></div>
          <div class="cmp-row"><span>${t('f_score')}</span><b>${tc.score&&tc.score!=='any'?t('score_'+tc.score):'—'}</b></div>
          <div class="cmp-row"><span>${t('tags_label')}</span><b>${tg?t(tg.key):'—'}</b></div>
          <div class="cmp-row"><span>${t('f_rival')}</span><b>${esc(rivalNameById(tc.rivalId))}</b></div>
        </div>
        <button class="btn btn-line btn-sm cmpt-open" data-id="${tc.id}">${ic.arrowRight}${t('open')}</button>
      </div>`;
    };
    function esc(s){return escapeHtml(s);} 
    function rivalNameById(id){ const r=TL.store.loadRivals().find(x=>x.id===id); return r?r.name:'—'; }
    function paint(){
      const a=all.find(x=>x.id===aId), b=all.find(x=>x.id===bId);
      h.querySelector('#cmpt-a').innerHTML=col(a);
      h.querySelector('#cmpt-b').innerHTML=col(b);
      h.querySelectorAll('.cmpt-open').forEach(btn=>btn.onclick=()=>{ h.innerHTML=''; TL.app.openEditor(btn.dataset.id); });
    }
    h.innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal modal-lg">
      <div class="modal-head"><h2>${t('compare')} · ${t('sec_tactics')}</h2><button class="x" id="mx">${ic.x}</button></div>
      <div class="modal-body">
        <div class="cmp-pick grid2">
          <select id="cmpt-sa">${opts(aId)}</select>
          <select id="cmpt-sb">${opts(bId)}</select>
        </div>
        <div class="compare-grid"><div id="cmpt-a"></div><div id="cmpt-b"></div></div>
      </div>
    </div></div>`;
    const close=()=>{h.innerHTML='';};
    h.querySelector('#mx').onclick=close;
    h.querySelector('#ms').onclick=e=>{if(e.target.id==='ms')close();};
    h.querySelector('#cmpt-sa').onchange=e=>{aId=e.target.value;paint();};
    h.querySelector('#cmpt-sb').onchange=e=>{bId=e.target.value;paint();};
    paint();
  }

  TL.home = { render, renderLibrary, renderProfile };
})(window.TL = window.TL || {});
