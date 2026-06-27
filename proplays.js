/* ============================================================
   matches.js — matches: plan, link tactics, log result & analysis
   ============================================================ */
(function (TL) {
  const t = (k) => TL.i18n.t(k);
  const C = TL.court, ic = TL.icon;

  function esc(s){return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  function host(){ let h=document.getElementById('modal-host'); if(!h){h=document.createElement('div');h.id='modal-host';document.body.appendChild(h);} return h; }
  function closeModal(){ host().innerHTML=''; }

  function rivalName(id){ const r=TL.store.loadRivals().find(x=>x.id===id); return r?r.name:t('no_rival'); }
  function fmtDate(d){ if(!d) return '—'; const dt=new Date(d+'T00:00'); return dt.toLocaleDateString(TL.i18n.lang==='en'?'en-GB':'es-ES',{day:'2-digit',month:'short',year:'numeric'}); }
  function surfLabel(s){ return t('surf_'+s); }

  function render(root) {
    const matches = TL.store.loadMatches();
    root.innerHTML = `
    <div class="view">
      <section class="wrap subhead">
        <button class="btn btn-ghost btn-sm" id="m-back">${ic.prev}${t('back')}</button>
        <div class="subhead-tt"><div class="kicker">${t('sec_matches_k')}</div><h1>${t('matches_title')}</h1></div>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-sm" id="m-new">${ic.plus}${t('new_match')}</button>
      </section>
      <section class="wrap section" style="padding-top:8px">
        <div class="match-list" id="m-list"></div>
      </section>
    </div>`;
    root.querySelector('#m-back').onclick = () => TL.app.goHome();
    root.querySelector('#m-new').onclick = () => openForm(null);

    const list = root.querySelector('#m-list');
    if (!matches.length) {
      list.outerHTML = `<div class="empty" style="margin:0 clamp(16px,4vw,40px)"><h3>${t('empty_matches_h2')}</h3><p>${t('empty_matches_p2')}</p><button class="btn btn-primary btn-sm" id="m-empty">${ic.plus}${t('new_match')}</button></div>`;
      root.querySelector('#m-empty').onclick = () => openForm(null);
    } else {
      matches.forEach(m => list.appendChild(matchCard(m)));
    }
    window.scrollTo(0,0);
  }

  function ratingDots(n){ let s=''; for(let i=1;i<=5;i++) s+=`<i class="${i<=n?'on':''}"></i>`; return `<span class="rate-dots">${s}</span>`; }

  // visual set-by-set scoreline chips (green = set you won)
  function setChips(m){
    if(!m.sets||!m.sets.length) return '';
    return `<span class="set-chips">${m.sets.map(s=>{
      const me=parseInt(s.me,10), op=parseInt(s.op,10);
      const cls = (!isNaN(me)&&!isNaN(op)) ? (me>op?'w':(me<op?'l':'')) : '';
      return `<span class="set-chip ${cls}"><b>${esc(String(s.me??''))}</b><i>${esc(String(s.op??''))}</i></span>`;
    }).join('')}</span>`;
  }

  function favLabel(pct){ const en=TL.i18n.lang==='en'; return pct>=58?(en?'in your favour':'a tu favor'):pct>=45?(en?'even match':'partido parejo'):(en?'tough one':'cuesta arriba'); }

  // Phase 3: after a played match with notes, offer to fold the lesson into rival scouting
  function maybeSaveLesson(rivalId, worked, failed) {
    const rival = TL.store.loadRivals().find(r => r.id === rivalId);
    if (!rival) return;
    const en = TL.i18n.lang === 'en';
    const bits = [];
    if (worked) bits.push((en?'✓ Worked: ':'✓ Funcionó: ') + worked);
    if (failed) bits.push((en?'✕ Failed: ':'✕ Falló: ') + failed);
    const lesson = bits.join('   ·   ');
    TL.ui.confirm({
      title: en ? 'Add to scouting?' : '¿Guardar en el scouting?',
      message: (en ? 'Save this lesson to ' : 'Guarda este aprendizaje en ') + (rival.name||'') +
               (en ? "'s notes — your next prep against him gets smarter." : ' — tu próxima preparación contra él será más lista.') + '\n\n' + lesson,
      ok: en ? 'Save to rival' : 'Guardar en rival',
      cancel: en ? 'Not now' : 'Ahora no'
    }).then(ok => {
      if (!ok) return;
      const d = new Date().toLocaleDateString(en?'en-GB':'es-ES',{day:'2-digit',month:'short'});
      const line = '[' + d + '] ' + lesson;
      const prev = (rival.notes||'').trim();
      rival.notes = prev ? (prev + '\n' + line) : line;
      TL.store.upsertRival(rival);
      TL.app.toast(en ? 'Saved to scouting' : 'Guardado en el scouting', true);
    });
  }

  function matchCard(m) {
    const card = document.createElement('div');
    card.className = 'mcard';
    const tacN = (m.tacticIds||[]).length;
    card.innerHTML = `
      <div class="mcard-l">
        <span class="m-surf-dot" style="background:${C.SURF[m.surface]?C.SURF[m.surface].in:'#888'}"></span>
        <div>
          <h3>${esc(rivalName(m.rivalId))}</h3>
          <div class="mcard-meta">
            <span>${fmtDate(m.date)}</span><span>${surfLabel(m.surface)}</span>
            ${m.mtype?`<span>${t('mt_'+m.mtype)}</span>`:''}
            <span><b>${tacN}</b> ${TL.i18n.lang==='en'?'tactics':'tácticas'}</span>
          </div>
          ${(m.location||m.tournament||m.duration)?`<div class="mcard-meta mcard-meta2">
            ${m.location?`<span>${ic.pin||''}📍 ${esc(m.location)}</span>`:''}
            ${m.tournament?`<span>${esc(m.tournament)}${m.round?` · ${esc(m.round)}`:''}</span>`:''}
            ${m.duration?`<span>⏱ ${esc(m.duration)}</span>`:''}
          </div>`:''}
          ${(m.conditions&&m.conditions.length)?`<div class="cond-tags">${m.conditions.map(c=>`<span class="cond-tag">${t('cond_'+c)}</span>`).join('')}</div>`:''}
          ${m.goal?`<p class="mcard-goal">${ic.flag}${esc(m.goal)}</p>`:''}
        </div>
      </div>
      <div class="mcard-r">
        ${m.played
          ? (m.outcome==='win' ? `<span class="m-status win">${t('won')}</span>`
            : m.outcome==='loss' ? `<span class="m-status loss">${t('lost')}</span>`
            : `<span class="m-status played">${t('played')}</span>`)
          : `<span class="m-status">${t('upcoming')}</span>`}
        ${m.played?`<div class="m-result">${(m.sets&&m.sets.length)?setChips(m):(m.result?`<b>${esc(m.result)}</b>`:'')}${m.rating?ratingDots(m.rating):''}</div>`:''}
        <div class="mcard-actions">
          ${!m.played?`<button class="btn btn-primary btn-sm m-prep">${ic.bolt}${t('prep')}</button>`:''}
          ${!m.played?`<button class="btn btn-line btn-sm m-res">${ic.flag}${t('register_result')}</button>`:''}
          ${m.played?`<button class="btn btn-line btn-sm m-rematch">${ic.restart}${t('rematch')}</button>`:''}
          <button class="btn btn-ghost btn-sm m-edit" title="${t('edit')}">${ic.edit}</button>
          <button class="btn btn-ghost btn-sm m-del" title="${t('delete')}">${ic.trash}</button>
        </div>
      </div>`;
    card.querySelector('.m-edit').onclick = () => openForm(m);
    card.querySelector('.m-del').onclick = () => { TL.ui.confirmDelete(t('del_match')).then(ok => { if (ok) { TL.store.removeMatch(m.id); render(TL.app.root); } }); };
    const res = card.querySelector('.m-res'); if (res) res.onclick = () => openForm(m, true);
    const rem = card.querySelector('.m-rematch'); if (rem) rem.onclick = () => { const c = TL.store.rematch(m.id); if (c) { TL.app.toast(t('rematch_done'), true); render(TL.app.root); } };
    const prep = card.querySelector('.m-prep'); if (prep) prep.onclick = () => openPrep(m);
    return card;
  }

  // ---- auto game-plan from rival weak spot / style -------------
  function buildPlan(rival) {
    if (!rival) return [];
    const hay = [rival.weak, rival.style, rival.notes].filter(Boolean).join(' ').toLowerCase();
    const en = TL.i18n.lang === 'en';
    const out = [];
    const add = (cond, es, eng) => { if (cond && out.length < 5) out.push(en ? eng : es); };
    add(/rev[eé]s|backhand/.test(hay), 'Ataca su revés con dirección y profundidad; cárgalo en ese lado.', 'Attack the backhand with depth and direction; load that wing.');
    add(/alt|high|bote alto|kick/.test(hay), 'Sube bolas altas y liftadas a su punto débil para sacarlo de zona.', 'Use high, heavy topspin to his weak side to push him back.');
    add(/dejad|corta|drop|red floja|net/.test(hay), 'Llévalo a la red con dejadas: no está cómodo arriba.', 'Bring him to the net with drop shots — he is uncomfortable there.');
    add(/saque|serve|segundo/.test(hay), 'Resta profundo y agresivo para neutralizar su saque.', 'Return deep and aggressive to neutralize his serve.');
    add(/fond|baseline|ritmo|peloteo/.test(hay), 'Rómpele el ritmo: cambia alturas y direcciones, mete la dejada.', 'Break his rhythm: vary height and direction, mix in the drop.');
    add(/f[ií]sic|resist|cansa|fitness|condici/.test(hay), 'Alarga los puntos y presiónalo físicamente.', 'Extend the rallies and apply physical pressure.');
    add(/presi|nervios|mental|tie.?break/.test(hay), 'Aprieta en los puntos importantes: suele fallar bajo presión.', 'Tighten up on big points — he tends to falter under pressure.');
    // avoid their best weapon
    if (rival.best) add(true,
      `Evita su ${rival.best.toLowerCase()}: no le des esa bola cómoda.`,
      `Avoid his ${rival.best.toLowerCase()}: don't feed that shot.`);
    return out;
  }

  function planTactics(rival) {
    const all = TL.store.loadAll();
    const linked = rival ? all.filter(x => x.rivalId === rival.id) : [];
    const ids = new Set(linked.map(x=>x.id));
    // top win-rate tactics from stats to round it out
    const top = (TL.store.stats().byTactic || []).filter(x=>x.rate!=null).slice(0,3)
      .map(x => all.find(a=>a.id===x.id)).filter(Boolean).filter(x=>!ids.has(x.id));
    return linked.concat(top).slice(0,6);
  }

  function openPrep(m) {
    const en = TL.i18n.lang === 'en';
    const rival = TL.store.loadRivals().find(r => r.id === m.rivalId);
    const tactics = (m.tacticIds||[]).map(id => TL.store.get(id)).filter(Boolean);
    const plan = buildPlan(rival);
    const suggested = planTactics(rival).filter(tc => !(m.tacticIds||[]).includes(tc.id));
    const wp = (rival && TL.winprob) ? TL.winprob.compute(m.rivalId, m.surface) : null;

    // ---- Phase 3: post-match learning loop ----
    const pastVs = rival ? TL.store.loadMatches()
      .filter(x => x.rivalId === m.rivalId && x.played && x.id !== m.id)
      .sort((a,b)=>(b.date||'').localeCompare(a.date||'')) : [];
    const lessons = pastVs.filter(x => (x.worked||'').trim() || (x.failed||'').trim()).slice(0,4);
    const wonTacIds = new Set();
    pastVs.filter(x=>x.outcome==='win').forEach(x=>(x.tacticIds||[]).forEach(id=>wonTacIds.add(id)));

    const lessonsBlock = lessons.length ? `
      <div class="prep-block">
        <div class="kicker">${en?'What you learned vs him':'Lo que aprendiste contra él'}</div>
        <ul class="prep-lessons">
          ${lessons.map(x=>`<li class="plz">
            <div class="plz-top"><span class="plz-date">${fmtDate(x.date)}</span>${x.outcome==='win'?`<span class="plz-out win">${t('won')}</span>`:x.outcome==='loss'?`<span class="plz-out loss">${t('lost')}</span>`:''}${x.result?`<span class="plz-score">${esc(x.result)}</span>`:''}</div>
            ${(x.worked||'').trim()?`<p class="plz-w"><i>${en?'Worked':'Funcionó'}</i>${esc(x.worked)}</p>`:''}
            ${(x.failed||'').trim()?`<p class="plz-f"><i>${en?'Failed':'Falló'}</i>${esc(x.failed)}</p>`:''}
          </li>`).join('')}
        </ul>
      </div>` : '';

    const winBlock = (wp && wp.hasData) ? `
      <div class="prep-block">
        <div class="kicker">${en?'Win probability':'Probabilidad de victoria'}</div>
        <div class="wp-host">
          <div class="wp-card">
            <div class="wp-left">
              ${TL.winprob.gaugeSVG(wp.pct)}
              <div class="wp-caption" style="color:${TL.winprob.color(wp.pct)}">${favLabel(wp.pct)} · ${TL.winprob.surfaceName(m.surface)}</div>
              <div class="wp-conf wp-conf-${wp.confidence}">${esc(wp.confLabel)}</div>
            </div>
            <div class="wp-right">
              <div class="prep-h2h"><b>${wp.h2h.w}&ndash;${wp.h2h.l}</b><span>${en?'head-to-head':'cara a cara'}</span></div>
              <ul class="wp-factors">${wp.factors.map(f=>`<li class="wp-f wp-${f.dir}"><span class="wp-fi"></span>${esc(f.text)}</li>`).join('')}</ul>
            </div>
          </div>
        </div>
      </div>` : '';

    const rivalBlock = rival ? `
      <div class="prep-scout">
        <div class="rcard-top"><span class="r-avatar ${rival.photo?'has-photo':''}" style="background:${TL.rivals?TL.rivals.colorFor(rival.id):'#888'}">${rival.photo?`<img src="${rival.photo}" alt=""/>`:esc((rival.name||'?').slice(0,2).toUpperCase())}</span>
          <div class="rcard-id"><h3>${esc(rival.name)}</h3><span class="r-hand">${rival.hand==='left'?t('r_left'):t('r_right')}${rival.category?` · ${esc(rival.category)}`:''}${rival.rank?` · ${esc(rival.rank)}`:''}</span></div></div>
        <div class="prep-facts">
          ${rival.best?`<span class="pf"><i>${t('r_best')}</i>${esc(rival.best)}</span>`:''}
          ${rival.weak?`<span class="pf weak"><i>${t('r_weak')}</i>${esc(rival.weak)}</span>`:''}
          ${rival.style?`<span class="pf"><i>${t('r_style')}</i>${esc(rival.style)}</span>`:''}
        </div>
        ${rival.notes?`<p class="prep-notes">${esc(rival.notes)}</p>`:''}
      </div>` : `<p class="hint-muted">${t('prep_no_rival')}</p>`;

    const planBlock = `
      <div class="prep-block">
        <div class="kicker">${t('prep_plan')}</div>
        ${plan.length ? `<ol class="plan-list">${plan.map(p=>`<li>${ic.check}<span>${esc(p)}</span></li>`).join('')}</ol>`
          : `<p class="hint-muted">${t('prep_no_plan')}</p>`}
      </div>`;

    const tacCard = (tc, sug) => `<button class="prep-tac ${sug?'sug':''}" data-id="${tc.id}">
        <span class="prep-tac-thumb">${C.thumb(tc.surface, tc.steps[tc.steps.length-1]||tc.steps[0], tc.tokens)}</span>
        <span class="prep-tac-tx"><b>${esc(tc.name||t('untitled'))}${wonTacIds.has(tc.id)?`<span class="tac-won">${ic.check}${en?'won':'ganó'}</span>`:''}</b><i>${TL.i18n.steps(tc.steps.length)}${tc.tag&&TL.tagById(tc.tag)?` · ${t(TL.tagById(tc.tag).key)}`:''}</i></span>
        ${ic.arrowRight}
      </button>`;

    const tacticsBlock = `
      <div class="prep-block">
        <div class="kicker">${t('prep_tactics')}</div>
        ${tactics.length ? `<div class="prep-tac-list">${tactics.map(tc=>tacCard(tc,false)).join('')}</div>` : `<p class="hint-muted">${t('prep_no_tactics')}</p>`}
        ${suggested.length ? `<div class="prep-sug-label kicker">${TL.i18n.lang==='en'?'Suggested':'Sugeridas'}</div><div class="prep-tac-list">${suggested.map(tc=>tacCard(tc,true)).join('')}</div>` : ''}
      </div>`;

    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal modal-lg prep-modal">
      <div class="modal-head">
        <div><div class="kicker">${t('prep_title')}</div><h2>${esc(rivalName(m.rivalId))}</h2>
          <p class="modal-sub">${fmtDate(m.date)} · ${surfLabel(m.surface)}${m.tournament?` · ${esc(m.tournament)}`:''}</p></div>
        <button class="x" id="mx">${ic.x}</button>
      </div>
      <div class="modal-body">
        ${m.goal?`<div class="prep-goal">${ic.flag}<div><span class="kicker">${t('prep_goal')}</span><p>${esc(m.goal)}</p></div></div>`:''}
        ${winBlock}
        ${rivalBlock}
        ${planBlock}
        ${lessonsBlock}
        ${tacticsBlock}
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="prep-pdf">${ic.pdf}${t('prep_print')}</button>
        <button class="btn btn-ghost" id="prep-edit">${ic.edit}${t('edit')}</button>
        <button class="btn btn-primary" id="prep-close">${TL.i18n.lang==='en'?'Got it':'Entendido'}</button>
      </div>
    </div></div>`;
    const h = host();
    h.querySelector('#mx').onclick = closeModal;
    h.querySelector('#prep-close').onclick = closeModal;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') closeModal(); };
    h.querySelector('#prep-edit').onclick = () => { closeModal(); openForm(m); };
    h.querySelector('#prep-pdf').onclick = () => prepPdf(m, rival, plan, tactics);
    h.querySelectorAll('.prep-tac').forEach(b => b.onclick = () => { closeModal(); TL.app.openEditor(b.dataset.id); });
  }

  function prepPdf(m, rival, plan, tactics) {
    if (TL.premium && !TL.premium.gate('prep-pdf')) return;
    const fd = (d)=> d ? new Date(d+'T00:00').toLocaleDateString(TL.i18n.lang==='en'?'en-GB':'es-ES',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}) : '';
    const logo = (TL.settings&&TL.settings.logo&&TL.settings.logo())||'';
    const w = window.open('', '_blank');
    if (!w) { TL.app.toast(t('coming_soon')); return; }
    const scoutRows = rival ? [
      [t('r_best'), rival.best],[t('r_weak'), rival.weak],[t('r_style'), rival.style],
    ].filter(r=>r[1]).map(r=>`<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('') : '';
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(rivalName(m.rivalId))} — ${t('prep_title')}</title>
      <style>
        *{box-sizing:border-box}body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#16140f;background:#fff;padding:40px}
        .hd{display:flex;align-items:flex-start;gap:16px;border-bottom:3px solid #E8703D;padding-bottom:16px;margin-bottom:8px}
        h1{font-size:25px;margin:0}.sub{color:#777;font-size:13px;margin-top:4px;text-transform:capitalize}
        .logo{margin-left:auto;height:46px}
        h2{font-size:12px;text-transform:uppercase;letter-spacing:.09em;color:#E8703D;margin:24px 0 10px}
        .goal{background:#faf3ee;border-left:4px solid #E8703D;border-radius:8px;padding:13px 15px;font-size:15px;line-height:1.45}
        table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px 4px;border-bottom:1px solid #eee;font-size:14px;vertical-align:top}th{width:34%;color:#666;font-weight:600}
        ol{margin:0;padding-left:20px}ol li{font-size:14.5px;line-height:1.5;margin-bottom:7px}
        ul.tl{list-style:none;padding:0;margin:0}ul.tl li{font-size:14px;padding:8px 0;border-bottom:1px solid #eee}
        @media print{.pbtn{display:none}@page{margin:14mm}}
        .pbtn{position:fixed;right:18px;top:18px;padding:11px 20px;border:0;border-radius:999px;background:#E8703D;color:#fff;font-weight:700;cursor:pointer}
      </style></head><body>
      <button class="pbtn" onclick="print()">${t('sh_pdf')}</button>
      <div class="hd"><div><h1>${esc(rivalName(m.rivalId))}</h1>
        <div class="sub">${t('prep_title')} · ${fd(m.date)} · ${t('surf_'+m.surface)}${m.tournament?` · ${esc(m.tournament)}`:''}</div></div>
        ${logo?`<img class="logo" src="${logo}"/>`:''}</div>
      ${m.goal?`<h2>${t('prep_goal')}</h2><div class="goal">${esc(m.goal)}</div>`:''}
      ${scoutRows?`<h2>${t('prep_scout')}</h2><table>${scoutRows}</table>`:''}
      ${rival&&rival.notes?`<h2>${t('r_notes')}</h2><div class="goal" style="border-color:#bbb;background:#f7f7f7">${esc(rival.notes)}</div>`:''}
      ${plan&&plan.length?`<h2>${t('prep_plan')}</h2><ol>${plan.map(p=>`<li>${esc(p)}</li>`).join('')}</ol>`:''}
      ${tactics&&tactics.length?`<h2>${t('prep_tactics')}</h2><ul class="tl">${tactics.map(tc=>`<li>${esc(tc.name||t('untitled'))} — ${TL.i18n.steps(tc.steps.length)}</li>`).join('')}</ul>`:''}
      <script>window.addEventListener('load',function(){setTimeout(function(){try{print()}catch(e){}},400)})<\/script>
      </body></html>`);
    w.document.close();
  }

  function openForm(m, focusResult) {
    const edit = !!m;
    m = m || { rivalId:'', date:new Date().toISOString().slice(0,10), surface:'hard', goal:'', tacticIds:[], played:false, result:'', worked:'', failed:'', train:'', rating:0,
      location:'', tournament:'', round:'', mtype:'official', duration:'', conditions:[], sets:[], sport:(TL.extras.sportPref&&TL.extras.sportPref())||'tennis' };
    if (!m.conditions) m.conditions = [];
    if (!m.sets) m.sets = [];
    const rivals = TL.store.loadRivals();
    const tactics = TL.store.loadAll();
    const surfaces = ['clay','hard','grass','indoor'];
    const conds = ['sun','wind','indoor','heat','cold','night','rain'];
    const types = ['official','friendly','practice'];

    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal modal-lg">
      <div class="modal-head"><h2>${edit?t('edit_match'):t('new_match')}</h2><button class="x" id="mx">${ic.x}</button></div>
      <div class="modal-body">
        <div class="grid2">
          <div class="field"><label>${t('m_rival')}</label>
            <select id="f-rival">
              <option value="">${t('no_rival')}</option>
              ${rivals.map(r=>`<option value="${r.id}" ${m.rivalId===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>${t('m_date')}</label><input type="date" id="f-date" value="${esc(m.date)}"/></div>
        </div>
        <div class="field"><label>${t('sport')}</label>
          <div class="seg2" id="f-sport">
            <button type="button" data-sp="tennis" class="${(m.sport!=='padel'&&m.sport!=='pickle')?'on':''}">🎾 ${t('sport_tennis')}</button>
            <button type="button" data-sp="padel" class="${m.sport==='padel'?'on':''}">🥎 ${t('sport_padel')}</button>
            <button type="button" data-sp="pickle" class="${m.sport==='pickle'?'on':''}">🏓 ${t('sport_pickle')}</button>
          </div>
        </div>
        <div class="field"><label>${t('m_surface')}</label>
          <div class="surf-pick" id="f-surf">
            ${surfaces.map(s=>`<button class="surf-opt ${m.surface===s?'on':''}" data-s="${s}"><div class="sw" style="background:${C.SURF[s].in}"></div><span>${t('surf_'+s)}</span></button>`).join('')}
          </div>
        </div>
        <div class="field"><label>${t('m_goal')}</label><textarea id="f-goal" placeholder="${t('m_goal_ph')}">${esc(m.goal)}</textarea></div>

        <div class="kicker" style="margin-top:4px">${t('m_details')}</div>
        <div class="grid2">
          <div class="field"><label>${t('m_location')}</label><input id="f-loc" value="${esc(m.location)}" placeholder="${t('m_location_ph')}"/></div>
          <div class="field"><label>${t('m_type')}</label>
            <select id="f-type">${types.map(ty=>`<option value="${ty}" ${(m.mtype||'official')===ty?'selected':''}>${t('mt_'+ty)}</option>`).join('')}</select>
          </div>
        </div>
        <div class="grid2">
          <div class="field"><label>${t('m_tournament')}</label><input id="f-tour" value="${esc(m.tournament)}" placeholder="${t('m_tournament_ph')}"/></div>
          <div class="grid2" style="gap:10px">
            <div class="field"><label>${t('m_round')}</label><input id="f-round" value="${esc(m.round)}" placeholder="${t('round_ph')}"/></div>
            <div class="field"><label>${t('m_duration')}</label><input id="f-dur" value="${esc(m.duration)}" placeholder="${t('m_duration_ph')}"/></div>
          </div>
        </div>
        <div class="field"><label>${t('m_conditions')}</label>
          <div class="cond-pick" id="f-cond">
            ${conds.map(c=>`<button class="cond-opt ${m.conditions.includes(c)?'on':''}" data-c="${c}">${t('cond_'+c)}</button>`).join('')}
          </div>
        </div>
        <div class="field"><label>${t('m_tactics')}</label>
          ${tactics.length ? `<div class="tac-pick" id="f-tac">${tactics.map(tc=>`<button class="tac-opt ${(m.tacticIds||[]).includes(tc.id)?'on':''}" data-id="${tc.id}"><span class="tp-check">${ic.check}</span><span>${esc(tc.name||t('untitled'))}</span><i>${tc.steps.length} ${TL.i18n.lang==='en'?'steps':'pasos'}</i></button>`).join('')}</div>`
            : `<p class="hint-muted">${t('no_tactics_yet')}</p>`}
        </div>

        <div class="field toggle-field">
          <label>${t('m_played')}</label>
          <button class="switch ${m.played?'on':''}" id="f-played" role="switch" aria-checked="${m.played}"><i></i></button>
        </div>
        <div class="analysis ${m.played?'':'hide'}" id="analysis">
          <div class="kicker">${t('match_analysis')}</div>
          <div class="grid2">
            <div class="field"><label>${t('m_result')}</label><input id="f-result" value="${esc(m.result)}" placeholder="${t('m_result_ph')}"/></div>
            <div class="field"><label>${t('m_outcome')}</label>
              <div class="seg2" id="f-outcome">
                <button data-o="win" class="${m.outcome==='win'?'on win':''}">${t('won')}</button>
                <button data-o="loss" class="${m.outcome==='loss'?'on loss':''}">${t('lost')}</button>
              </div>
            </div>
          </div>
          <div class="field"><label>${t('m_sets')}</label>
            <div class="sets-wrap"><div class="sets-row" id="f-sets"></div>
            <button class="btn btn-ghost btn-sm" id="f-set-add" type="button">${ic.plus}${t('set_add')}</button></div>
          </div>
          <div class="field"><label>${t('m_rating')}</label><div class="rate-pick" id="f-rating">${[1,2,3,4,5].map(i=>`<button data-v="${i}" class="${i<=m.rating?'on':''}">${ic.ball}</button>`).join('')}</div></div>
          <div class="field"><label>${t('m_worked')}</label><textarea id="f-worked">${esc(m.worked)}</textarea></div>
          <div class="field"><label>${t('m_failed')}</label><textarea id="f-failed">${esc(m.failed)}</textarea></div>
          <div class="field"><label>${t('m_train')}</label><textarea id="f-train">${esc(m.train)}</textarea></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="m-cancel">${t('cancel')}</button>
        <button class="btn btn-primary" id="m-save">${ic.check}${t('save_match')}</button>
      </div>
    </div></div>`;

    const h = host();
    let surf = m.surface, played = !!m.played, rating = m.rating||0, outcome = m.outcome||'', mSport = m.sport||'tennis';
    const conditions = new Set(m.conditions||[]);
    let sets = (m.sets||[]).map(s=>({...s}));
    const tacticIds = new Set(m.tacticIds||[]);
    h.querySelector('#mx').onclick = closeModal;
    h.querySelector('#m-cancel').onclick = closeModal;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') closeModal(); };
    h.querySelectorAll('#f-surf .surf-opt').forEach(b => b.onclick = () => { surf=b.dataset.s; h.querySelectorAll('#f-surf .surf-opt').forEach(x=>x.classList.toggle('on',x===b)); });
    h.querySelectorAll('#f-sport button').forEach(b => b.onclick = () => { mSport=b.dataset.sp; h.querySelectorAll('#f-sport button').forEach(x=>x.classList.toggle('on',x===b)); });
    h.querySelectorAll('#f-cond .cond-opt').forEach(b => b.onclick = () => { const c=b.dataset.c; if(conditions.has(c))conditions.delete(c); else conditions.add(c); b.classList.toggle('on'); });
    // structured set scores
    function renderSets() {
      const row = h.querySelector('#f-sets');
      row.innerHTML = sets.map((s,i)=>`<span class="set-box"><input class="set-in" data-si="${i}" data-side="me" value="${esc(String(s.me??''))}" inputmode="numeric" maxlength="2"/><i>-</i><input class="set-in" data-si="${i}" data-side="op" value="${esc(String(s.op??''))}" inputmode="numeric" maxlength="2"/><button class="set-del" data-sd="${i}" type="button">${ic.x}</button></span>`).join('');
      row.querySelectorAll('.set-in').forEach(inp => inp.oninput = () => { sets[+inp.dataset.si][inp.dataset.side] = inp.value.replace(/[^0-9]/g,''); });
      row.querySelectorAll('.set-del').forEach(b => b.onclick = () => { sets.splice(+b.dataset.sd,1); renderSets(); });
    }
    const setAdd = h.querySelector('#f-set-add');
    if (setAdd) setAdd.onclick = () => { sets.push({me:'',op:''}); renderSets(); };
    renderSets();
    h.querySelectorAll('#f-tac .tac-opt').forEach(b => b.onclick = () => { const id=b.dataset.id; if(tacticIds.has(id))tacticIds.delete(id); else tacticIds.add(id); b.classList.toggle('on'); });
    const analysis = h.querySelector('#analysis');
    h.querySelector('#f-played').onclick = () => { played=!played; h.querySelector('#f-played').classList.toggle('on',played); analysis.classList.toggle('hide',!played); };
    h.querySelectorAll('#f-rating button').forEach(b => b.onclick = () => { rating=+b.dataset.v; h.querySelectorAll('#f-rating button').forEach(x=>x.classList.toggle('on',+x.dataset.v<=rating)); });
    h.querySelectorAll('#f-outcome button').forEach(b => b.onclick = () => {
      outcome = (outcome===b.dataset.o)?'':b.dataset.o;
      h.querySelectorAll('#f-outcome button').forEach(x=>{ x.classList.toggle('on', x.dataset.o===outcome); x.classList.toggle('win', x.dataset.o==='win'&&outcome==='win'); x.classList.toggle('loss', x.dataset.o==='loss'&&outcome==='loss'); });
    });

    if (focusResult && !played) { played=true; h.querySelector('#f-played').classList.add('on'); analysis.classList.remove('hide'); }

    h.querySelector('#m-save').onclick = () => {
      const fWorked = h.querySelector('#f-worked').value.trim();
      const fFailed = h.querySelector('#f-failed').value.trim();
      const fRival = h.querySelector('#f-rival').value;
      const setsClean = sets.filter(s => String(s.me).length || String(s.op).length);
      const resultStr = setsClean.length ? setsClean.map(s=>`${s.me||0}-${s.op||0}`).join(', ') : h.querySelector('#f-result').value.trim();
      const savedMatch = TL.store.upsertMatch({ id:m.id, rivalId:h.querySelector('#f-rival').value,
        date:h.querySelector('#f-date').value, surface:surf, sport:mSport,
        goal:h.querySelector('#f-goal').value.trim(),
        location:h.querySelector('#f-loc').value.trim(),
        tournament:h.querySelector('#f-tour').value.trim(),
        round:h.querySelector('#f-round').value.trim(),
        mtype:h.querySelector('#f-type').value,
        duration:h.querySelector('#f-dur').value.trim(),
        conditions:[...conditions],
        sets:setsClean,
        tacticIds:[...tacticIds], played,
        result:resultStr,
        outcome,
        worked:h.querySelector('#f-worked').value.trim(),
        failed:h.querySelector('#f-failed').value.trim(),
        train:h.querySelector('#f-train').value.trim(),
        rating });
      closeModal();
      render(TL.app.root);
      TL.app.toast(t('match_saved'), true);
      if (TL.fx) { TL.fx.success(); TL.fx.checkRankUp(); }
      if (played && TL.league && TL.league.award) TL.league.award({ id:(savedMatch&&savedMatch.id)||m.id, played, outcome });
      if (played && fRival && (fWorked || fFailed)) maybeSaveLesson(fRival, fWorked, fFailed);
    };
  }

  TL.matches = { render };
})(window.TL = window.TL || {});
