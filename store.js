/* ============================================================
   rivals.js — rival profiles (scouting)
   ============================================================ */
(function (TL) {
  const t = (k) => TL.i18n.t(k);
  const ic = TL.icon, C = TL.court;
  const PAL = ['#5BC8FF','#FF5B5B','#D7F23A','#B07BFF','#FFB13B','#46D6A6'];

  function esc(s){return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  function initials(name){ return (name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || '?'; }
  function colorFor(id){ let h=0; for(const c of (id||'')) h=(h*31+c.charCodeAt(0))>>>0; return PAL[h%PAL.length]; }

  function host(){ let h=document.getElementById('modal-host'); if(!h){h=document.createElement('div');h.id='modal-host';document.body.appendChild(h);} return h; }
  function closeModal(){ host().innerHTML=''; }

  function tacticsFor(id){ return TL.store.loadAll().filter(x=>x.rivalId===id); }

  function render(root) {
    const rivals = TL.store.loadRivals();
    root.innerHTML = `
    <div class="view">
      <section class="wrap subhead">
        <button class="btn btn-ghost btn-sm" id="r-back">${ic.prev}${t('back')}</button>
        <div class="subhead-tt">
          <div class="kicker">${t('rivals_k')}</div>
          <h1>${t('rivals_title')}</h1>
        </div>
        <div class="spacer"></div>
        ${rivals.length>=2?`<button class="btn btn-line btn-sm" id="r-compare">${ic.sliders}${t('compare')}</button>`:''}
        <button class="btn btn-primary btn-sm" id="r-new">${ic.plus}${t('new_rival')}</button>
      </section>
      <section class="wrap section" style="padding-top:8px">
        <div class="cards" id="r-cards"></div>
      </section>
    </div>`;
    root.querySelector('#r-back').onclick = () => TL.app.goHome();
    root.querySelector('#r-new').onclick = () => openForm(null);
    const cmp = root.querySelector('#r-compare'); if (cmp) cmp.onclick = () => compare();

    const host2 = root.querySelector('#r-cards');
    if (!rivals.length) {
      host2.outerHTML = `<div class="empty" style="margin:0 clamp(16px,4vw,40px)"><h3>${t('empty_rivals_h')}</h3><p>${t('empty_rivals_p')}</p><button class="btn btn-primary btn-sm" id="r-empty">${ic.plus}${t('new_rival')}</button></div>`;
      root.querySelector('#r-empty').onclick = () => openForm(null);
    } else {
      rivals.forEach(r => host2.appendChild(rivalCard(r)));
    }
    window.scrollTo(0,0);
  }

  function rivalCard(r) {
    const col = colorFor(r.id);
    const n = tacticsFor(r.id).length;
    const card = document.createElement('div');
    card.className = 'rcard';
    card.innerHTML = `
      <div class="rcard-top">
        <span class="r-avatar ${r.photo?'has-photo':''}" style="background:${col}">${r.photo?`<img src="${r.photo}" alt=""/>`:esc(initials(r.name))}</span>
        <div class="rcard-id">
          <h3>${esc(r.name||'—')}</h3>
          <span class="r-hand">${r.sport==='padel'?'🥎':r.sport==='pickle'?'🏓':'🎾'} ${r.hand==='left'?t('r_left'):t('r_right')}${r.category?` · ${esc(r.category)}`:''}</span>
        </div>
        ${r.rank?`<span class="r-rank-badge">${esc(r.rank)}</span>`:''}
      </div>
      <div class="rcard-facts">
        ${r.best?`<div class="rfact"><span>${t('r_best')}</span><b>${esc(r.best)}</b></div>`:''}
        ${r.weak?`<div class="rfact"><span>${t('r_weak')}</span><b>${esc(r.weak)}</b></div>`:''}
        ${r.style?`<div class="rfact"><span>${t('r_style')}</span><b>${esc(r.style)}</b></div>`:''}
      </div>
      ${r.notes?`<p class="rcard-notes">${esc(r.notes)}</p>`:''}
      <div class="rcard-foot">
        <button class="btn btn-line btn-sm r-tac">${ic.ball}<b>${n}</b> ${t('linked_tactics')}</button>
        <div class="spacer"></div>
        <button class="btn btn-ghost btn-sm r-edit" title="${t('edit')}">${ic.edit}</button>
        <button class="btn btn-ghost btn-sm r-del" title="${t('delete')}">${ic.trash}</button>
      </div>`;
    card.querySelector('.r-edit').onclick = (e) => { e.stopPropagation(); openForm(r); };
    card.querySelector('.r-del').onclick = (e) => { e.stopPropagation(); TL.ui.confirmDelete(t('del_rival')).then(ok => { if (ok) { TL.store.removeRival(r.id); render(TL.app.root); } }); };
    card.querySelector('.r-tac').onclick = (e) => { e.stopPropagation(); openDetail(r); };
    card.querySelector('.rcard-top').onclick = () => openDetail(r);
    card.querySelector('.rcard-top').style.cursor = 'pointer';
    if (card.querySelector('.rcard-facts')) { const f = card.querySelector('.rcard-facts'); f.style.cursor='pointer'; f.onclick = () => openDetail(r); }
    return card;
  }

  // ---- rival detail: profile + stats + matches + tactics --------
  function rivalStats(id) {
    const played = TL.store.loadMatches().filter(m => m.rivalId === id && m.played);
    const wins = played.filter(m => m.outcome === 'win').length;
    const losses = played.filter(m => m.outcome === 'loss').length;
    const decided = wins + losses;
    return { played: played.length, wins, losses, decided, winPct: decided ? Math.round(wins/decided*100) : null };
  }

  // chronological decided matches vs this rival → cumulative win% sparkline
  function rivalTrend(id) {
    const decided = TL.store.loadMatches()
      .filter(m => m.rivalId === id && m.played && (m.outcome === 'win' || m.outcome === 'loss'))
      .sort((a,b) => (a.date||'').localeCompare(b.date||'') || a.createdAt - b.createdAt);
    let w = 0;
    return decided.map((m,i) => { if (m.outcome === 'win') w++; return { outcome:m.outcome, date:m.date, pct: Math.round(w/(i+1)*100) }; });
  }

  function trendBlock(r) {
    const en = TL.i18n.lang === 'en';
    const title = en ? 'Trend' : 'Evolución';
    return `<div class="d-block"><div class="kicker">${title}</div>${trendInner(r)}</div>`;
  }
  function trendInner(r) {
    const tr = rivalTrend(r.id);
    const en = TL.i18n.lang === 'en';
    if (tr.length < 2) {
      return `<div class="trend-card"><p class="hint-muted" style="margin:0">${en?'Log at least 2 played matches to see how your win rate evolves.':'Registra al menos 2 partidos jugados para ver cómo evoluciona tu % de victorias.'}</p></div>`;
    }
    const W = 300, H = 96, x0 = 16, x1 = 284, yTop = 12, yBot = 68;
    const X = (i) => tr.length === 1 ? (x0+x1)/2 : x0 + (x1-x0)*i/(tr.length-1);
    const Y = (p) => yTop + (100-p)/100*(yBot-yTop);
    const pts = tr.map((d,i) => [X(i), Y(d.pct)]);
    const line = pts.map((p,i) => (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const area = `${line} L${x1} ${yBot} L${x0} ${yBot} Z`;
    const fd = (d)=> d ? new Date(d+'T00:00').toLocaleDateString(en?'en-GB':'es-ES',{day:'2-digit',month:'short'}) : '';
    const last = tr[tr.length-1].pct;
    const dots = pts.map((p,i)=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.4" fill="${tr[i].outcome==='win'?'#46D6A6':'#FF5B5B'}" stroke="var(--ink-2)" stroke-width="1.5"><title>${fd(tr[i].date)} · ${tr[i].pct}%</title></circle>`).join('');
    const grad = 'tg'+r.id;
    return `<div class="trend-card">
        <svg viewBox="0 0 ${W} ${H}" class="trend-svg" preserveAspectRatio="none" role="img" aria-label="${en?'Trend':'Evolución'} ${last}%">
          <defs><linearGradient id="${grad}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--ball)" stop-opacity=".30"/>
            <stop offset="1" stop-color="var(--ball)" stop-opacity="0"/></linearGradient></defs>
          <line x1="${x0}" y1="${Y(50)}" x2="${x1}" y2="${Y(50)}" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4"/>
          <text x="${x1}" y="${Y(50)-4}" text-anchor="end" font-size="8" fill="var(--txt-3)" font-family="var(--mono)">50%</text>
          <path d="${area}" fill="url(#${grad})"/>
          <path d="${line}" fill="none" stroke="var(--ball)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
          ${dots}
        </svg>
        <div class="trend-axis"><span>${fd(tr[0].date)}</span><b>${en?'Win rate '+last+'% now':last+'% victorias ahora'}</b><span>${fd(tr[tr.length-1].date)}</span></div>
      </div>`;
  }

  // ---- HEAD-TO-HEAD: record + which tactics beat THIS rival ----
  function h2hParts(r) {
    const en = TL.i18n.lang === 'en';
    const decided = TL.store.loadMatches()
      .filter(m => m.rivalId === r.id && m.played && (m.outcome === 'win' || m.outcome === 'loss'))
      .sort((a,b) => (b.date||'').localeCompare(a.date||'') || (b.createdAt||0) - (a.createdAt||0)); // newest first
    if (!decided.length) return null;
    const wins = decided.filter(m => m.outcome === 'win').length;
    const losses = decided.length - wins;
    const wPct = Math.round(wins / decided.length * 100);
    // current streak (decided is newest-first)
    let streak = 0; const sOut = decided[0].outcome;
    for (const m of decided) { if (m.outcome === sOut) streak++; else break; }
    const streakTxt = sOut === 'win'
      ? (en ? `${streak}W streak` : `Racha de ${streak} ${streak===1?'victoria':'victorias'}`)
      : (en ? `${streak}L streak` : `Racha de ${streak} ${streak===1?'derrota':'derrotas'}`);
    const pips = decided.slice(0,6).reverse()
      .map(m => `<span class="h2h-pip ${m.outcome}">${m.outcome==='win'?(en?'W':'V'):(en?'L':'D')}</span>`).join('');

    // per-tactic record vs this rival
    const rec = {};
    decided.forEach(m => (m.tacticIds||[]).forEach(id => {
      rec[id] = rec[id] || { w:0, l:0 };
      if (m.outcome === 'win') rec[id].w++; else rec[id].l++;
    }));
    const all = TL.store.loadAll();
    const tacRows = Object.keys(rec).map(id => {
      const tc = all.find(x => x.id === id); if (!tc) return null;
      const o = rec[id]; const n = o.w + o.l;
      return { id, name: tc.name || t('untitled'), w:o.w, l:o.l, n, pct: Math.round(o.w/n*100) };
    }).filter(Boolean).sort((a,b) => b.pct - a.pct || b.n - a.n);

    const tacHtml = tacRows.length ? tacRows.map(x => {
      const cls = x.pct >= 67 ? 'good' : x.pct >= 34 ? 'mid' : 'bad';
      const verdict = x.pct >= 67 ? (en?'works':'funciona') : x.pct <= 33 ? (en?'risky':'arriesgada') : (en?'mixed':'irregular');
      return `<button class="h2h-tac h2h-${cls}" data-tid="${x.id}">
        <span class="h2h-tac-name">${esc(x.name)}</span>
        <span class="h2h-tac-bar"><span style="width:${x.pct}%"></span></span>
        <span class="h2h-tac-rec">${x.w}-${x.l}</span>
        <span class="h2h-tac-tag">${verdict}</span>
        ${ic.arrowRight}
      </button>`;
    }).join('') : `<p class="hint-muted" style="margin:8px 0 0">${en
      ? 'Link tactics to your matches to see which ones beat this rival.'
      : 'Vincula tácticas a tus partidos para ver cuáles ganan a este rival.'}</p>`;

    // --- titular "momento ajá": récord + táctica que funciona, en lenguaje natural ---
    const bestTac = tacRows.find(x => x.pct >= 60 && x.w >= 1) || null;
    const lead = wins > losses ? 'lead' : wins < losses ? 'trail' : 'even';
    const recPhrase = en
      ? `You're ${wins}–${losses} vs ${r.name}`
      : `Vas ${wins}–${losses} contra ${r.name}`;
    const tacPhrase = bestTac
      ? (en ? ` · <b>${esc(bestTac.name)}</b> works (${bestTac.w}–${bestTac.l})`
            : ` · te funciona <b>${esc(bestTac.name)}</b> (${bestTac.w}–${bestTac.l})`)
      : '';
    const headline = `<button class="h2h-headline h2h-${lead}"${bestTac?` data-tid="${bestTac.id}"`:''}>
          <span class="h2h-hl-ic">${lead==='lead'?'🔥':lead==='trail'?'⚠️':'⚖️'}</span>
          <span class="h2h-hl-tx">${recPhrase}${tacPhrase}</span>
          ${bestTac?ic.arrowRight:''}
        </button>`;

    const recTop = `${headline}<div class="h2h-top">
          <div class="h2h-score" aria-label="${wins}-${losses}">
            <span class="h2h-w">${wins}</span><span class="h2h-sep">–</span><span class="h2h-l">${losses}</span>
          </div>
          <div class="h2h-meta">
            <div class="h2h-bar"><span class="h2h-bar-w" style="width:${wPct}%"></span></div>
            <div class="h2h-sub"><b>${wPct}% ${en?'won':'ganados'}</b> · ${streakTxt}</div>
            <div class="h2h-pips">${pips}</div>
          </div>
        </div>`;
    const tacs = `<div class="h2h-tacs">
          <div class="h2h-tacs-h">${en?'Tactics vs ':'Tácticas contra '}${esc(r.name)}</div>
          ${tacHtml}
        </div>`;
    return { recTop, tacs };
  }

  // ---- RESUMEN: compact record + key stats ----
  function summaryBlock(r, s) {
    const en = TL.i18n.lang === 'en';
    const dash = t('dash');
    const pctCol = s.winPct == null ? 'var(--txt-3)' : (s.winPct >= 50 ? '#46D6A6' : '#FF5B5B');
    return `<div class="d-block"><div class="kicker">${en?'Summary':'Resumen'}</div>
      <div class="recbar">
        <div class="big"><span class="w">${s.wins}</span><span class="x">–</span><span class="l">${s.losses}</span></div>
        <div class="seg${s.winPct==null?' empty':''}"><b style="width:${s.winPct==null?0:s.winPct}%"></b></div>
        <div class="pct" style="color:${pctCol}">${s.winPct==null?dash:s.winPct+'%'}</div>
      </div>
      <div class="statstrip">
        <div class="s"><div class="n">${s.played.length}</div><div class="l">${t('stat_played')}</div></div>
        <div class="s"><div class="n ball">${s.tactics.length}</div><div class="l">${en?'Tactics':'Tácticas'}</div></div>
        <div class="s"><div class="n tac">${s.bestTac?esc(s.bestTac.name||t('untitled')):dash}</div><div class="l">${t('stat_best')}</div></div>
      </div>
    </div>`;
  }

  // ---- CARA A CARA: score + streak + per-tactic record ----
  function h2hBlock(r) {
    const parts = h2hParts(r);
    if (!parts) return '';
    const en = TL.i18n.lang === 'en';
    return `<div class="d-block"><div class="kicker">${en?'Head to head':'Cara a cara'}</div>
      ${parts.recTop}
      ${parts.tacs}
    </div>`;
  }

  function winProbBlock(r) {
    if (!TL.winprob) return '';
    const surf = TL.winprob.defaultSurface(r.id);
    return `<div class="d-block"><div class="kicker">${TL.i18n.lang==='en'?'Win probability':'Probabilidad de victoria'}</div>
      <div class="wp-host" id="wp-host" data-rid="${r.id}" data-surf="${surf}"></div></div>`;
  }

  function paintWinProb(rootEl) {
    const host = rootEl.querySelector('#wp-host');
    if (!host || !TL.winprob) return;
    const en = TL.i18n.lang === 'en';
    const rid = host.dataset.rid, surf = host.dataset.surf;
    const res = TL.winprob.compute(rid, surf);
    if (!res.hasData) {
      host.innerHTML = `<div class="wp-empty">${en
        ? 'Log a few matches against this rival and your win odds appear here automatically.'
        : 'Registra algún partido contra este rival y aquí aparece tu probabilidad de victoria, calculada sola.'}</div>`;
      return;
    }
    const chips = TL.winprob.SURFACES.map(s => `<button class="wp-chip${s===surf?' on':''}" data-s="${s}">${TL.winprob.surfaceName(s)}</button>`).join('');
    const fav = res.pct >= 58 ? (en?'in your favour':'a tu favor') : res.pct >= 45 ? (en?'even match':'partido parejo') : (en?'tough one':'cuesta arriba');
    const factorRows = res.factors.map(f => `<li class="wp-f wp-${f.dir}"><span class="wp-fi"></span>${esc(f.text)}</li>`).join('');
    host.innerHTML = `
      <div class="wp-card">
        <div class="wp-left">
          ${TL.winprob.gaugeSVG(res.pct)}
          <div class="wp-caption" style="color:${TL.winprob.color(res.pct)}">${fav} · ${TL.winprob.surfaceName(surf)}</div>
          <div class="wp-conf wp-conf-${res.confidence}">${esc(res.confLabel)}</div>
        </div>
        <div class="wp-right">
          <div class="wp-chips">${chips}</div>
          <ul class="wp-factors">${factorRows}</ul>
        </div>
      </div>`;
    host.querySelectorAll('.wp-chip').forEach(b => b.onclick = () => {
      host.dataset.surf = b.dataset.s;
      if (TL.fx) TL.fx.tap();
      paintWinProb(rootEl);
    });
  }

  function attackBlock(r) {
    const en = TL.i18n.lang === 'en';
    const title = en ? 'Attack map' : 'Mapa de ataque';
    if (!TL.heatmap) return '';
    const a = TL.heatmap.analyze(r);
    return `<div class="d-block"><div class="kicker">${title}</div>
      <div class="amap-card${a.hasSignal?'':' is-empty'}">
        <div class="amap-court">${a.svg}</div>
        <div class="amap-side">
          <p class="amap-plan">${esc(a.plan.text)}</p>
          <div class="amap-legend">
            <span><i class="amap-sw hot"></i>${en?'Attack':'Ataca'}</span>
            <span><i class="amap-sw cold"></i>${en?'Avoid':'Evita'}</span>
          </div>
        </div>
      </div></div>`;
  }

  function compare() {
    const rivals = TL.store.loadRivals();
    if (rivals.length < 2) return;
    const opts = (sel) => rivals.map(r=>`<option value="${r.id}" ${sel===r.id?'selected':''}>${esc(r.name)}</option>`).join('');
    let aId = rivals[0].id, bId = rivals[1].id;
    function fields(r){
      const st = rivalStats(r.id);
      return [
        [t('stat_played'), st.played],
        [t('stat_winrate'), st.winPct==null?t('dash'):st.winPct+'%'],
        [t('stat_record'), `${st.wins}-${st.losses}`],
        [t('r_hand'), r.hand==='left'?t('r_left'):t('r_right')],
        [t('r_best'), r.best||t('dash')],
        [t('r_weak'), r.weak||t('dash')],
        [t('r_style'), r.style||t('dash')],
      ];
    }
    function col(r){
      const c = colorFor(r.id);
      return `<div class="cmp-col">
        <div class="rcard-top"><span class="r-avatar" style="background:${c}">${esc(initials(r.name))}</span>
          <div class="rcard-id"><h3>${esc(r.name)}</h3></div></div>
        ${fields(r).map(f=>`<div class="cmp-row"><span>${f[0]}</span><b>${esc(String(f[1]))}</b></div>`).join('')}
      </div>`;
    }
    function paint(){
      const a = rivals.find(r=>r.id===aId), b = rivals.find(r=>r.id===bId);
      h.querySelector('#cmp-a').innerHTML = col(a);
      h.querySelector('#cmp-b').innerHTML = col(b);
    }
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal modal-lg">
      <div class="modal-head"><h2>${t('compare_title')}</h2><button class="x" id="mx">${ic.x}</button></div>
      <div class="modal-body">
        <div class="cmp-pick grid2">
          <select id="cmp-sa">${opts(aId)}</select>
          <select id="cmp-sb">${opts(bId)}</select>
        </div>
        <div class="compare-grid">
          <div id="cmp-a"></div>
          <div id="cmp-b"></div>
        </div>
      </div>
    </div></div>`;
    const h = host();
    h.querySelector('#mx').onclick = closeModal;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') closeModal(); };
    h.querySelector('#cmp-sa').onchange = (e) => { aId = e.target.value; paint(); };
    h.querySelector('#cmp-sb').onchange = (e) => { bId = e.target.value; paint(); };
    paint();
  }

  function openDetail(r) {
    const root = TL.app.root;
    const matches = TL.store.loadMatches().filter(m => m.rivalId === r.id);
    const played = matches.filter(m => m.played);
    const wins = played.filter(m => m.outcome === 'win').length;
    const losses = played.filter(m => m.outcome === 'loss').length;
    const decided = wins + losses;
    const winPct = decided ? Math.round(wins / decided * 100) : null;
    const tactics = tacticsFor(r.id);

    // best tactic = most frequent in won matches (fallback: most linked)
    const counts = {};
    played.forEach(m => { if (m.outcome === 'win') (m.tacticIds||[]).forEach(id => counts[id] = (counts[id]||0)+1); });
    let bestId = null, bestN = 0;
    Object.keys(counts).forEach(id => { if (counts[id] > bestN) { bestN = counts[id]; bestId = id; } });
    const bestTac = bestId ? TL.store.loadAll().find(x => x.id === bestId) : null;

    const col = colorFor(r.id);
    const en = TL.i18n.lang === 'en';
    const rname = (id) => { const x = TL.store.loadRivals().find(y=>y.id===id); return x?x.name:t('no_rival'); };
    const fd = (d) => d ? new Date(d+'T00:00').toLocaleDateString(TL.i18n.lang==='en'?'en-GB':'es-ES',{day:'2-digit',month:'short',year:'2-digit'}) : '—';
    const dash = t('dash');

    // threat level (1-5) derived from your win-rate vs this rival
    let threat;
    if (decided === 0) threat = 3;
    else if (winPct >= 80) threat = 1;
    else if (winPct >= 60) threat = 2;
    else if (winPct >= 40) threat = 3;
    else if (winPct >= 20) threat = 4;
    else threat = 5;
    // most-played surface vs this rival
    const surfCount = {};
    matches.forEach(m => { if (m.surface) surfCount[m.surface] = (surfCount[m.surface]||0)+1; });
    let bestSurf = null, bsN = 0;
    Object.keys(surfCount).forEach(s => { if (surfCount[s] > bsN) { bsN = surfCount[s]; bestSurf = s; } });
    const pctCol = winPct == null ? 'var(--txt-3)' : (winPct >= 50 ? '#46D6A6' : '#FF5B5B');

    root.innerHTML = `
    <div class="view">
      <section class="wrap subhead">
        <button class="btn btn-ghost btn-sm" id="d-back">${ic.prev}${t('rivals_title')}</button>
        <div class="subhead-tt"><div class="kicker">${t('rivals_title')}</div><h1>${t('rival_detail')}</h1></div>
        <div class="spacer"></div>
        <button class="btn btn-ghost btn-sm" id="d-pdf">${ic.pdf}${t('export_scout_pdf')}</button>
        <button class="btn btn-line btn-sm" id="d-edit">${ic.edit}${t('edit')}</button>
      </section>

      <section class="wrap d-stack" id="d-grid">
        <div class="d-top">
          <aside class="idp compact">
            <div class="idp-hd">
              <span class="av ${r.photo?'has-photo':''}" style="background:${col}">${r.photo?`<img src="${r.photo}" alt=""/>`:esc(initials(r.name))}</span>
              <div class="idp-id">
                <h2>${esc(r.name)}</h2>
                <div class="sub">${r.sport==='padel'?'🥎':r.sport==='pickle'?'🏓':'🎾'} ${r.hand==='left'?t('r_left'):t('r_right')}${r.category?` · ${esc(r.category)}`:''}</div>
              </div>
              <div class="idp-meta">
                ${r.rank?`<span class="rank">${esc(r.rank)}</span>`:''}
                <div class="idp-threat"><span class="lab">${en?'Threat':'Amenaza'}</span><div class="dots">${[1,2,3,4,5].map(i=>`<i class="${i<=threat?'on':''}"></i>`).join('')}</div></div>
              </div>
            </div>
            ${(r.best||r.weak||r.style)?`<div class="idp-facts">
              ${r.best?`<div class="idp-fact good"><span>${t('r_best')}</span><b>${esc(r.best)}</b></div>`:''}
              ${r.weak?`<div class="idp-fact bad"><span>${t('r_weak')}</span><b>${esc(r.weak)}</b></div>`:''}
              ${r.style?`<div class="idp-fact"><span>${t('r_style')}</span><b>${esc(r.style)}</b></div>`:''}
            </div>`:''}
          </aside>
          <div class="d-prob">${winProbBlock(r)}</div>
        </div>

        <div class="d-main">
          ${attackBlock(r)}

          ${summaryBlock(r, {wins, losses, winPct, played, tactics, bestTac})}

          ${h2hBlock(r)}

          ${trendBlock(r)}

          <details class="d-block d-collapse"${matches.length>3?'':' open'}>
            <summary><span class="kicker">${t('rival_matches')}</span>${matches.length?`<span class="d-collapse-n">${matches.length}</span>`:''}<span class="d-collapse-ico">${ic.arrowRight}</span></summary>
            <div class="d-collapse-body">
            ${matches.length ? `<div class="home-match-rows">${matches.map(m=>`
              <button class="hm-row" data-mid="${m.id}">
                <span class="hm-dot" style="background:${C.SURF[m.surface]?C.SURF[m.surface].in:'#888'}"></span>
                <span class="hm-name">${fd(m.date)} · ${t('surf_'+m.surface)}${m.location?` · 📍 ${esc(m.location)}`:''}${m.tournament?` · ${esc(m.tournament)}`:''}</span>
                <span class="hm-date">${m.result?esc(m.result):''}</span>
                ${m.played?(m.outcome==='win'?`<span class="m-status win">${t('won')}</span>`:m.outcome==='loss'?`<span class="m-status loss">${t('lost')}</span>`:`<span class="m-status played">${t('played')}</span>`):`<span class="m-status">${t('upcoming')}</span>`}
                ${ic.arrowRight}
              </button>`).join('')}</div>`
              : `<p class="hint-muted">${t('no_matches_rival')}</p>`}
            </div>
          </details>

          <div class="d-block">
            <div class="kicker">${t('linked_tactics')}</div>
            ${tactics.length ? `<div class="home-match-rows">${tactics.map(tc=>`
              <button class="hm-row" data-tid="${tc.id}">
                <span class="hm-dot" style="background:${C.SURF[tc.surface]?C.SURF[tc.surface].in:'#888'}"></span>
                <span class="hm-name">${esc(tc.name||t('untitled'))}</span>
                <span class="hm-date">${TL.i18n.steps(tc.steps.length)}</span>
                ${ic.arrowRight}
              </button>`).join('')}</div>`
              : `<p class="hint-muted">${t('no_tactics_yet')}</p>`}
          </div>
        </div>
      </section>
    </div>`;

    root.querySelector('#d-back').onclick = () => render(root);
    root.querySelector('#d-edit').onclick = () => openForm(r);
    root.querySelector('#d-pdf').onclick = () => scoutPdf(r);
    root.querySelectorAll('[data-mid]').forEach(b => b.onclick = () => TL.app.openMatches());
    root.querySelectorAll('[data-tid]').forEach(b => b.onclick = () => TL.app.openEditor(b.dataset.tid));
    paintWinProb(root);
    window.scrollTo(0,0);
  }

  function listTactics(r) {
    const tacs = tacticsFor(r.id);
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal">
      <div class="modal-head"><h2>${esc(r.name)} · ${t('linked_tactics')}</h2><button class="x" id="mx">${ic.x}</button></div>
      <div class="modal-body">
        ${tacs.length ? `<div class="mini-tac-list">${tacs.map(tc=>`<button class="mini-tac" data-id="${tc.id}"><span>${esc(tc.name||t('untitled'))}</span>${ic.arrowRight}</button>`).join('')}</div>`
          : `<div class="empty" style="padding:24px"><p>${t('no_tactics_yet')}</p></div>`}
      </div>
    </div></div>`;
    const h = host();
    h.querySelector('#mx').onclick = closeModal;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') closeModal(); };
    h.querySelectorAll('.mini-tac').forEach(b => b.onclick = () => { closeModal(); TL.app.openEditor(b.dataset.id); });
  }

  function scoutPdf(r) {
    if (TL.premium && !TL.premium.gate('scout-pdf')) return;
    const st = rivalStats(r.id);
    const matches = TL.store.loadMatches().filter(m => m.rivalId === r.id && m.played)
      .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const fd = (d)=> d ? new Date(d+'T00:00').toLocaleDateString(TL.i18n.lang==='en'?'en-GB':'es-ES',{day:'2-digit',month:'short',year:'numeric'}) : '';
    const row = (lbl,val)=> val?`<tr><th>${esc(lbl)}</th><td>${esc(val)}</td></tr>`:'';
    const logo = (TL.settings&&TL.settings.logo&&TL.settings.logo())||'';
    const w = window.open('', '_blank');
    if (!w) { TL.app.toast(t('coming_soon')); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.name)} — ${t('scout_report')}</title>
      <style>
        *{box-sizing:border-box}body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#16140f;background:#fff;padding:40px}
        .hd{display:flex;align-items:center;gap:16px;border-bottom:3px solid #E8703D;padding-bottom:16px;margin-bottom:22px}
        .hd .av{width:60px;height:60px;border-radius:14px;background:#E8703D;color:#fff;display:grid;place-items:center;font-weight:800;font-size:22px;overflow:hidden}
        .hd .av img{width:100%;height:100%;object-fit:cover}
        h1{font-size:26px;margin:0}.sub{color:#777;font-size:13px;margin-top:3px}
        .logo{margin-left:auto;height:46px}
        h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#E8703D;margin:22px 0 10px}
        table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px 4px;border-bottom:1px solid #eee;font-size:14px;vertical-align:top}
        th{width:34%;color:#666;font-weight:600}
        .stat-row{display:flex;gap:10px;margin-bottom:6px}
        .stat{flex:1;border:1px solid #e6e6e6;border-radius:10px;padding:12px}
        .stat b{display:block;font-size:24px}.stat span{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.06em}
        .notes{background:#faf7f2;border-radius:10px;padding:14px;font-size:14px;line-height:1.5}
        @media print{.pbtn{display:none}@page{margin:14mm}}
        .pbtn{position:fixed;right:18px;top:18px;padding:11px 20px;border:0;border-radius:999px;background:#E8703D;color:#fff;font-weight:700;cursor:pointer}
      </style></head><body>
      <button class="pbtn" onclick="print()">${t('sh_pdf')}</button>
      <div class="hd"><div class="av">${logo?'':esc((r.name||'?').slice(0,2).toUpperCase())}</div>
        <div><h1>${esc(r.name)}</h1><div class="sub">${t('scout_report')} · ${r.hand==='left'?t('r_left'):t('r_right')}${r.category?` · ${esc(r.category)}`:''}${r.rank?` · ${esc(r.rank)}`:''}</div></div>
        ${logo?`<img class="logo" src="${logo}"/>`:''}
      </div>
      <div class="stat-row">
        <div class="stat"><b>${st.played}</b><span>${t('stat_played')}</span></div>
        <div class="stat"><b>${st.winPct==null?'—':st.winPct+'%'}</b><span>${t('stat_winrate')}</span></div>
        <div class="stat"><b>${st.wins}-${st.losses}</b><span>${t('stat_record')}</span></div>
      </div>
      <h2>${t('rivals_k')}</h2>
      <table>${row(t('r_best'),r.best)}${row(t('r_weak'),r.weak)}${row(t('r_style'),r.style)}</table>
      ${r.notes?`<h2>${t('r_notes')}</h2><div class="notes">${esc(r.notes)}</div>`:''}
      ${matches.length?`<h2>${t('rival_matches')}</h2><table>${matches.map(m=>`<tr><th>${fd(m.date)}</th><td>${t('surf_'+m.surface)}${m.tournament?` · ${esc(m.tournament)}`:''} — <b>${m.outcome==='win'?t('won'):m.outcome==='loss'?t('lost'):''}</b> ${esc(m.result||'')}</td></tr>`).join('')}</table>`:''}
      <script>window.addEventListener('load',function(){setTimeout(function(){try{print()}catch(e){}},400)})<\/script>
      </body></html>`);
    w.document.close();
  }

  function openForm(r) {
    const edit = !!r;
    r = r || { name:'', sport:(TL.extras.sportPref&&TL.extras.sportPref())||'tennis', hand:'right', weakSide:'even', best:'', weak:'', style:'', notes:'', rank:'', category:'', photo:'', partner:'', p1name:'', p2name:'', p1best:'', p1weak:'', p2best:'', p2weak:'' };
    if (r.partner && !r.p2name && !r.p1name) { r.p2name = r.partner; }  // migrate old single-partner field
    const en = TL.i18n.lang === 'en';
    const dbl = (r.sport === 'padel' || r.sport === 'pickle');
    const weakPh = dbl ? (en?'the middle, lobs, one player’s backhand, slow feet…':'el centro, el globo, el revés de uno, lentos de pies…') : t('r_weak_ph');
    const bestPh = dbl ? (en?'smash, volleys, wall defence…':'remate, volea, defensa de pared…') : t('r_best_ph');
    const fed = (sp) => sp==='padel' ? 'FEP' : sp==='pickle' ? 'DUPR' : 'RFET';
    const rankLabel = (sp) => sp==='pickle' ? (en?'Rating (DUPR)':'Valoración (DUPR)') : (en?`Ranking / ${fed(sp)} no.`:`Ranking / nº ${fed(sp)}`);
    const rankPh = (sp) => sp==='pickle' ? (en?'e.g. 4.5':'Ej. 4.5') : (en?`e.g. #1240 ${fed(sp)}`:`Ej. #1240 ${fed(sp)}`);
    const fedBtnLabel = (sp) => sp==='padel' ? (en?'Search FEP ranking':'Buscar en la FEP') : t('search_rfet');
    const fedBtnHint = (sp) => sp==='padel' ? (en?'Opens a padel ranking search with the name.':'Abre la búsqueda de ranking de pádel con el nombre.') : t('rfet_hint');
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal">
      <div class="modal-head"><h2>${edit?t('edit_rival'):t('new_rival')}</h2><button class="x" id="mx">${ic.x}</button></div>
      <div class="modal-body">
        <div class="rphoto-row">
          <button class="rphoto" id="r-photo-btn" type="button">${r.photo?`<img src="${r.photo}" alt=""/>`:ic.user}</button>
          <div style="flex:1">
            <div class="field" style="margin:0"><label id="r-name-lb">${dbl?t('r_pairname'):t('r_name')}</label><input id="r-name" value="${esc(r.name)}" placeholder="${dbl?t('r_pairname'):t('r_name')}"/></div>
            <button class="photo-link" id="r-photo-act" type="button">${r.photo?t('remove_photo'):t('add_photo')}</button>
          </div>
        </div>
        <input type="file" id="r-photo-file" accept="image/*" class="hide"/>
        <div class="field"><label>${t('sport')}</label>
          <div class="seg2" id="r-sport">
            <button data-sp="tennis" class="${(r.sport!=='padel'&&r.sport!=='pickle')?'on':''}">🎾 ${t('sport_tennis')}</button>
            <button data-sp="padel" class="${r.sport==='padel'?'on':''}">🥎 ${t('sport_padel')}</button>
            <button data-sp="pickle" class="${r.sport==='pickle'?'on':''}">🏓 ${t('sport_pickle')}</button>
          </div>
        </div>
        <div id="r-dbl-players" style="${dbl?'':'display:none'}">
          <div class="r-pcard">
            <div class="r-pcard-h"><span class="r-pcard-tag">R1</span>${en?'Left player':'Jugador izquierda'}</div>
            <div class="field"><label>${t('r_pname')}</label><input id="r-p1name" value="${esc(r.p1name||'')}" placeholder="${en?'e.g. Juan':'p. ej. Juan'}"/></div>
            <div class="grid2">
              <div class="field"><label>${t('r_pbest')}</label><input id="r-p1best" value="${esc(r.p1best||'')}" placeholder="${en?'drive, smash…':'drive, remate…'}"/></div>
              <div class="field"><label>${t('r_pweak')}</label><input id="r-p1weak" value="${esc(r.p1weak||'')}" placeholder="${en?'backhand, lob…':'revés, globo…'}"/></div>
            </div>
          </div>
          <div class="r-pcard">
            <div class="r-pcard-h"><span class="r-pcard-tag">R2</span>${en?'Right player':'Jugador derecha'}</div>
            <div class="field"><label>${t('r_pname')}</label><input id="r-p2name" value="${esc(r.p2name||'')}" placeholder="${en?'e.g. Pedro':'p. ej. Pedro'}"/></div>
            <div class="grid2">
              <div class="field"><label>${t('r_pbest')}</label><input id="r-p2best" value="${esc(r.p2best||'')}" placeholder="${en?'volley, speed…':'volea, velocidad…'}"/></div>
              <div class="field"><label>${t('r_pweak')}</label><input id="r-p2weak" value="${esc(r.p2weak||'')}" placeholder="${en?'feet, dink…':'pies, dejada…'}"/></div>
            </div>
          </div>
        </div>
        <div class="field" id="r-hand-f" style="${dbl?'display:none':''}"><label>${t('r_hand')}</label>
          <div class="seg2" id="r-hand">
            <button data-h="right" class="${r.hand!=='left'?'on':''}">${t('r_right')}</button>
            <button data-h="left" class="${r.hand==='left'?'on':''}">${t('r_left')}</button>
          </div>
        </div>
        <div class="field" id="r-weakside-f" style="${dbl?'':'display:none'}"><label>${t('r_weakside')}</label>
          <div class="seg2" id="r-weakside">
            <button data-ws="left" class="${r.weakSide==='left'?'on':''}">${t('ws_left')}</button>
            <button data-ws="even" class="${(!r.weakSide||r.weakSide==='even')?'on':''}">${t('ws_even')}</button>
            <button data-ws="right" class="${r.weakSide==='right'?'on':''}">${t('ws_right')}</button>
          </div>
        </div>
        <div class="grid2">
          <div class="field"><label id="r-rank-lb">${rankLabel(r.sport)}</label><input id="r-rank" value="${esc(r.rank||'')}" placeholder="${rankPh(r.sport)}"/></div>
          <div class="field"><label>${t('r_cat')}</label><input id="r-cat" value="${esc(r.category||'')}" placeholder="${t('r_cat_ph')}"/></div>
        </div>
        <button class="rfet-btn" id="r-rfet" type="button" style="${r.sport==='pickle'?'display:none':''}">${ic.share}<span><b id="r-rfet-lb">${fedBtnLabel(r.sport)}</b><i id="r-rfet-hint">${fedBtnHint(r.sport)}</i></span>${ic.arrowRight}</button>
        <div class="grid2" id="r-bw-general" style="${dbl?'display:none':''}">
          <div class="field"><label>${t('r_best')}</label><input id="r-best" value="${esc(r.best)}" placeholder="${bestPh}"/></div>
          <div class="field"><label>${t('r_weak')}</label><input id="r-weak" value="${esc(r.weak)}" placeholder="${weakPh}"/></div>
        </div>
        <div class="field"><label>${t('r_style')}</label><input id="r-style" value="${esc(r.style)}" placeholder="${t('r_style_ph')}"/></div>
        <div class="field"><label>${t('r_notes')}</label><textarea id="r-notes" placeholder="…">${esc(r.notes)}</textarea></div>
        <div class="amap-live" id="r-amap"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="m-cancel">${t('cancel')}</button>
        <button class="btn btn-primary" id="m-save">${ic.check}${t('save_rival')}</button>
      </div>
    </div></div>`;
    const h = host();
    let hand = r.hand || 'right';
    let photo = r.photo || '';
    h.querySelector('#mx').onclick = closeModal;
    h.querySelector('#m-cancel').onclick = closeModal;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') closeModal(); };
    let sport = r.sport || 'tennis';
    let weakSide = r.weakSide || 'even';
    h.querySelectorAll('#r-hand button').forEach(b => b.onclick = () => { hand=b.dataset.h; h.querySelectorAll('#r-hand button').forEach(x=>x.classList.toggle('on',x===b)); });
    h.querySelectorAll('#r-weakside button').forEach(b => b.onclick = () => { weakSide=b.dataset.ws; h.querySelectorAll('#r-weakside button').forEach(x=>x.classList.toggle('on',x===b)); setTimeout(refreshMap,0); });
    h.querySelectorAll('#r-sport button').forEach(b => b.onclick = () => { sport=b.dataset.sp; h.querySelectorAll('#r-sport button').forEach(x=>x.classList.toggle('on',x===b)); const isDbl=(sport==='padel'||sport==='pickle'); const hf=h.querySelector('#r-hand-f'); if(hf) hf.style.display = isDbl?'none':''; const wf=h.querySelector('#r-weakside-f'); if(wf) wf.style.display = isDbl?'':'none'; const dp=h.querySelector('#r-dbl-players'); if(dp) dp.style.display = isDbl?'':'none'; const bg=h.querySelector('#r-bw-general'); if(bg) bg.style.display = isDbl?'none':''; const nl=h.querySelector('#r-name-lb'); if(nl) nl.textContent = isDbl?t('r_pairname'):t('r_name'); const rkl=h.querySelector('#r-rank-lb'); if(rkl) rkl.textContent = rankLabel(sport); const rki=h.querySelector('#r-rank'); if(rki) rki.placeholder = rankPh(sport); const rb=h.querySelector('#r-rfet'); if(rb) rb.style.display = (sport==='pickle')?'none':''; const rbl=h.querySelector('#r-rfet-lb'); if(rbl) rbl.textContent = fedBtnLabel(sport); const rbh=h.querySelector('#r-rfet-hint'); if(rbh) rbh.textContent = fedBtnHint(sport); setTimeout(refreshMap,0); });
    // RFET search opens the federation site with the typed name
    h.querySelector('#r-rfet').onclick = () => {
      const q = h.querySelector('#r-name').value.trim();
      let url;
      if (sport === 'padel') url = 'https://www.google.com/search?q=' + encodeURIComponent('ranking FEP pádel' + (q?(' '+q):''));
      else if (sport === 'pickle') url = 'https://www.google.com/search?q=' + encodeURIComponent('DUPR rating' + (q?(' '+q):''));
      else url = q ? 'https://www.google.com/search?q=' + encodeURIComponent('ranking RFET ' + q) : 'https://www.rfet.es/es/ranking';
      window.open(url, '_blank');
    };
    // photo upload (downscaled)
    const pf = h.querySelector('#r-photo-file');
    const pbtn = h.querySelector('#r-photo-btn');
    const pact = h.querySelector('#r-photo-act');
    function setPhotoUI() {
      pbtn.innerHTML = photo ? `<img src="${photo}" alt=""/>` : ic.user;
      pact.textContent = photo ? t('remove_photo') : t('add_photo');
    }
    pbtn.onclick = () => { if (!photo) pf.click(); };
    pact.onclick = () => { if (photo) { photo=''; setPhotoUI(); } else pf.click(); };
    pf.onchange = () => {
      const f = pf.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max=256, sc=Math.min(1,max/Math.max(img.width,img.height));
          const cv=document.createElement('canvas'); cv.width=Math.round(img.width*sc); cv.height=Math.round(img.height*sc);
          cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
          try { photo = cv.toDataURL('image/jpeg', 0.82); setPhotoUI(); } catch(e){}
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(f);
    };
    h.querySelector('#m-save').onclick = () => {
      const name = h.querySelector('#r-name').value.trim();
      if (!name) { h.querySelector('#r-name').focus(); return; }
      const gvt = id => { const el=h.querySelector(id); return el?el.value.trim():''; };
      const isDbl = (sport==='padel'||sport==='pickle');
      const p1name=gvt('#r-p1name'), p2name=gvt('#r-p2name');
      const p1best=gvt('#r-p1best'), p1weak=gvt('#r-p1weak'), p2best=gvt('#r-p2best'), p2weak=gvt('#r-p2weak');
      const compBest = isDbl ? [p1best,p2best].filter(Boolean).join(' / ') : gvt('#r-best');
      const compWeak = isDbl ? [p1weak,p2weak].filter(Boolean).join(' / ') : gvt('#r-weak');
      TL.store.upsertRival({ id: r.id, name, hand, sport, weakSide,
        partner: isDbl ? [p1name,p2name].filter(Boolean).join(' / ') : '',
        p1name, p2name, p1best, p1weak, p2best, p2weak,
        rank: gvt('#r-rank'),
        category: gvt('#r-cat'),
        photo,
        best: compBest,
        weak: compWeak,
        style: gvt('#r-style'),
        notes: gvt('#r-notes') });
      closeModal();
      render(TL.app.root);
      TL.app.toast(t('rival_saved'), true);
    };
    // live attack map — updates as the scouting fields are filled
    const amap = h.querySelector('#r-amap');
    function refreshMap() {
      if (!amap || !TL.heatmap) return;
      const gv = id => { const el=h.querySelector(id); return el?el.value:''; };
      const draft = {
        sport,
        hand,
        weakSide,
        p1name: gv('#r-p1name'), p2name: gv('#r-p2name'),
        p1best: gv('#r-p1best'), p1weak: gv('#r-p1weak'),
        p2best: gv('#r-p2best'), p2weak: gv('#r-p2weak'),
        best: gv('#r-best'),
        weak: gv('#r-weak'),
        style: gv('#r-style'),
        notes: gv('#r-notes'),
      };
      const a = TL.heatmap.analyze(draft);
      const en = TL.i18n.lang === 'en';
      amap.className = 'amap-live' + (a.hasSignal ? ' on' : '');
      amap.innerHTML = `
        <div class="amap-live-head"><span class="kicker">${en?'Attack map':'Mapa de ataque'}</span>
          <span class="amap-live-auto">${en?'auto':'automático'}</span></div>
        <div class="amap-card${a.hasSignal?'':' is-empty'}">
          <div class="amap-court">${a.svg}</div>
          <div class="amap-side">
            <p class="amap-plan">${esc(a.plan.text)}</p>
            <div class="amap-legend"><span><i class="amap-sw hot"></i>${en?'Attack':'Ataca'}</span><span><i class="amap-sw cold"></i>${en?'Avoid':'Evita'}</span></div>
          </div>
        </div>`;
    }
    ['#r-best','#r-weak','#r-style','#r-notes','#r-p1name','#r-p2name','#r-p1best','#r-p1weak','#r-p2best','#r-p2weak'].forEach(sel => {
      const el = h.querySelector(sel); if (el) el.addEventListener('input', refreshMap);
    });
    // hand + sport toggles also refresh
    h.querySelectorAll('#r-hand button').forEach(b => b.addEventListener('click', () => setTimeout(refreshMap,0)));
    h.querySelectorAll('#r-sport button').forEach(b => b.addEventListener('click', () => setTimeout(refreshMap,0)));
    refreshMap();

    setTimeout(()=>h.querySelector('#r-name').focus(), 50);
  }

  TL.rivals = { render, colorFor, initials };
})(window.TL = window.TL || {});
