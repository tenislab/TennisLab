/* ============================================================
   modals.js — save + share dialogs, image export
   ============================================================ */
(function (TL) {
  const t = (k) => TL.i18n.t(k);
  const C = TL.court, ic = TL.icon;
  const S = () => TL.state;

  function host() {
    let h = document.getElementById('modal-host');
    if (!h) { h = document.createElement('div'); h.id = 'modal-host'; document.body.appendChild(h); }
    return h;
  }
  function close() { host().innerHTML = ''; }
  function esc(s){return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

  // ---- SAVE ------------------------------------------------------
  function save() {
    const tac = TL.editor.tactic();
    const surfaces = ['clay','hard','grass','indoor'];
    const plays = ['serve','return','defense','attack','net'];
    const folders = TL.store.loadFolders();
    const rivals = TL.store.loadRivals();
    const folderOpts = `<option value="">${t('no_folder')}</option>` +
      folders.map(f=>`<option value="${f.id}" ${tac.folderId===f.id?'selected':''}>${esc(f.name)}</option>`).join('') +
      `<option value="__new">＋ ${t('new_folder')}</option>`;
    const rivalOpts = `<option value="">${t('no_rival')}</option>` +
      rivals.map(r=>`<option value="${r.id}" ${tac.rivalId===r.id?'selected':''}>${esc(r.name)}</option>`).join('');
    host().innerHTML = `
    <div class="modal-scrim" id="ms">
      <div class="modal">
        <div class="modal-head"><h2>${t('save_title')}</h2><button class="x" id="mx">${ic.x}</button></div>
        <div class="modal-body">
          <div class="grid2">
            <div class="field" style="flex:2">
              <label>${t('f_name')}</label>
              <input id="f-name" value="${esc(tac.name)}" placeholder="${t('untitled')}"/>
            </div>
            <div class="field">
              <label>${t('f_number')}</label>
              <input id="f-number" value="${esc(String(tac.number||''))}" placeholder="#" inputmode="numeric"/>
            </div>
          </div>
          <div class="field">
            <label>${t('f_desc')}</label>
            <textarea id="f-desc" placeholder="…">${esc(tac.description)}</textarea>
          </div>
          <div class="grid2">
            <div class="field">
              <label>${t('f_folder')}</label>
              <select id="f-folder">${folderOpts}</select>
            </div>
            <div class="field">
              <label>${t('f_rival')}</label>
              <select id="f-trival">${rivalOpts}</select>
            </div>
          </div>
          <div class="field">
            <label>${t('f_surface')}</label>
            <div class="surf-pick" id="f-surf">
              ${surfaces.map(s=>`<button class="surf-opt ${tac.surface===s?'on':''}" data-s="${s}"><div class="sw" style="background:${C.SURF[s].in}"></div><span>${t('surf_'+s)}</span></button>`).join('')}
            </div>
          </div>
          <div class="field">
            <label>${t('f_tag')}</label>
            <div class="tag-pick" id="f-tag">
              <button class="tagopt ${!tac.tag?'on':''}" data-tag=""><span class="tagdot" style="background:var(--line-2)"></span>${t('tag_off')}</button>
              ${TL.TAGS.map(tg=>`<button class="tagopt ${tac.tag===tg.id?'on':''}" data-tag="${tg.id}"><span class="tagdot" style="background:${tg.color}"></span>${t(tg.key)}</button>`).join('')}
            </div>
          </div>
          <div class="grid2">
            <div class="field">
              <label>${t('f_playtype')}</label>
              <select id="f-play">
                ${plays.map(p=>`<option value="${p}" ${tac.playType===p?'selected':''}>${t('pt_'+p)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>${t('f_score')}</label>
              <select id="f-score">
                ${['any','break','set','match','deuce','pressure'].map(sc=>`<option value="${sc}" ${(tac.score||'any')===sc?'selected':''}>${t('score_'+sc)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="m-cancel">${t('cancel')}</button>
          <button class="btn btn-primary" id="m-save">${ic.save}${t('save_confirm')}</button>
        </div>
      </div>
    </div>`;
    const h = host();
    h.querySelector('#mx').onclick = close;
    h.querySelector('#m-cancel').onclick = close;
    h.querySelector('#ms').onclick = (e) => { if (e.target.id === 'ms') close(); };
    let surf = tac.surface;
    let tag = tac.tag || '';
    h.querySelectorAll('#f-surf .surf-opt').forEach(b => b.onclick = () => {
      surf = b.dataset.s; h.querySelectorAll('#f-surf .surf-opt').forEach(x=>x.classList.toggle('on',x===b));
    });
    h.querySelectorAll('#f-tag .tagopt').forEach(b => b.onclick = () => {
      tag = b.dataset.tag; h.querySelectorAll('#f-tag .tagopt').forEach(x=>x.classList.toggle('on',x===b));
    });
    const fsel = h.querySelector('#f-folder');
    fsel.onchange = async () => {
      if (fsel.value === '__new') {
        const name = await TL.ui.prompt({ title: t('new_folder'), placeholder: t('new_folder_prompt') });
        if (name) { const f = TL.store.addFolder(name);
          fsel.innerHTML = `<option value="">${t('no_folder')}</option>` +
            TL.store.loadFolders().map(x=>`<option value="${x.id}" ${x.id===f.id?'selected':''}>${esc(x.name)}</option>`).join('') +
            `<option value="__new">＋ ${t('new_folder')}</option>`;
        } else { fsel.value = tac.folderId || ''; }
      }
    };
    h.querySelector('#m-save').onclick = () => {
      tac.name = h.querySelector('#f-name').value || t('untitled');
      tac.number = h.querySelector('#f-number').value.trim();
      tac.description = h.querySelector('#f-desc').value;
      tac.folderId = fsel.value === '__new' ? (tac.folderId||'') : fsel.value;
      tac.rivalId = h.querySelector('#f-trival').value;
      tac.surface = surf;
      tac.tag = tag;
      tac.score = h.querySelector('#f-score').value;
      tac.playType = h.querySelector('#f-play').value;
      delete tac.demo;
      TL.editor.markSaved();
      TL.store.upsert(tac);
      // reflect name + surface in editor bar / court
      const nameInput = TL.app.root.querySelector('#ed-name'); if (nameInput) nameInput.value = tac.name;
      TL.app.root.querySelectorAll('[data-surf]').forEach(x=>x.classList.toggle('on', x.dataset.surf===surf));
      TL.editor.renderCourt(); TL.editor.renderSteps();
      close();
      TL.app.toast(t('saved_ok'), true);
      if (TL.fx) { TL.fx.success(); TL.fx.checkRankUp(); }
    };
  }

  // ---- SHARE -----------------------------------------------------
  function share() {
    const tac = TL.editor.tactic();
    // contar para el logro "Embajador" (compartir 5)
    try { localStorage.setItem('tl_shared_count', String((parseInt(localStorage.getItem('tl_shared_count')||'0',10)||0)+1)); if (TL.achievements) TL.achievements.check(false); } catch(e){}
    // make sure the tactic is persisted so the private link actually resolves
    if (tac && !tac.demo && !TL.store.get(tac.id)) { TL.editor.markSaved(); TL.store.upsert(tac); }
    const link = location.origin + location.pathname + '#view=' + (tac.id || 'demo');
    function curLink(){ const e = host().querySelector('#sh-link'); return e ? e.value : link; }
    const items = [
      ['public', ic.share, 'share_public', 'share_public_d', () => createPublicLink(tac)],
      ['brand', ic.star, 'sh_brand', 'sh_brand_d', exportBrandedCard],
      ['img', ic.image, 'sh_img', 'sh_img_d', exportImage],
      ['video', ic.video, 'sh_video', 'sh_video_d', exportVideo],
      ['gif', ic.video, 'sh_gif', 'sh_gif_d', exportGif],
      ['pdf', ic.pdf, 'sh_pdf', 'sh_pdf_d', exportPdf],
      ['wa', ic.wa, 'sh_wa', 'sh_wa_d', () => window.open('https://wa.me/?text=' + encodeURIComponent((tac.name||'CourtLab')+' — '+curLink()), '_blank')],
      ['mail', ic.mail, 'sh_mail', 'sh_mail_d', () => window.open('mailto:?subject=' + encodeURIComponent(tac.name||'CourtLab') + '&body=' + encodeURIComponent(curLink()), '_blank')],
    ];
    host().innerHTML = `
    <div class="modal-scrim" id="ms">
      <div class="modal">
        <div class="modal-head"><h2>${t('share_title')}</h2><button class="x" id="mx">${ic.x}</button></div>
        <div class="modal-body">
          <div class="field">
            <label>${t('share_link')}</label>
            <div class="linkbox">
              <input id="sh-link" value="${esc(link)}" readonly/>
              <button class="btn btn-line btn-sm" id="sh-copy">${ic.copy}${t('copy')}</button>
            </div>
          </div>
          <div class="share-list">
            ${items.map(it=>`<button class="share-item" data-act="${it[0]}">
              <span class="si">${it[1]}</span>
              <span class="st"><b>${t(it[2])}</b><span>${t(it[3])}</span></span>
              ${ic.arrowRight}
            </button>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
    const h = host();
    h.querySelector('#mx').onclick = close;
    h.querySelector('#ms').onclick = (e) => { if (e.target.id === 'ms') close(); };
    h.querySelector('#sh-copy').onclick = () => {
      const inp = h.querySelector('#sh-link'); inp.select();
      navigator.clipboard ? navigator.clipboard.writeText(inp.value).then(()=>TL.app.toast(t('copied'),true)) : (document.execCommand('copy'), TL.app.toast(t('copied'),true));
    };
    items.forEach(it => { h.querySelector(`[data-act="${it[0]}"]`).onclick = it[4]; });
  }

  // ---- PUBLIC SHARE LINK (OG dinámico) --------------------------
  // genera un PNG de la táctica (reutiliza la hoja de export) como imagen Blob
  function tacticPngBlob(tac) {
    return new Promise((resolve) => {
      try {
        const { svg, w, h } = buildStepsSheet(tac);
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#101316'; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          URL.revokeObjectURL(url);
          cv.toBlob(b => resolve(b), 'image/png');
        };
        img.onerror = () => resolve(null);
        img.src = url;
      } catch (e) { resolve(null); }
    });
  }

  async function createPublicLink(tac) {
    if (!TL.cloud || !TL.cloud.enabled) { TL.app.toast(t('cloud_off')); return; }
    if (!TL.cloud.loggedIn()) { TL.app.toast(t('share_need_login')); TL.cloud.authModal(); return; }
    if (tac && !tac.demo && !TL.store.get(tac.id)) { TL.editor.markSaved && TL.editor.markSaved(); TL.store.upsert(tac); }
    const h = host();
    const item = h.querySelector('[data-act="public"]');
    if (item) { item.classList.add('on'); item.style.opacity = '.6'; item.style.pointerEvents = 'none'; }
    TL.app.toast(t('publishing'));
    const blob = await tacticPngBlob(tac);
    const r = await TL.cloud.publishShare(tac, blob);
    if (item) { item.style.opacity = ''; item.style.pointerEvents = ''; }
    if (r.error) { TL.app.toast(r.error); return; }
    const inp = h.querySelector('#sh-link');
    if (inp) { inp.value = r.url; inp.focus(); inp.select(); }
    const label = h.querySelector('.field label'); if (label) label.textContent = t('link_public');
    TL.app.toast(t('share_ready'), true);
  }

  // ---- IMAGE EXPORT ---------------------------------------------
  function buildExportSvg() {
    const live = TL.editor.svg;
    const vbStr = live.getAttribute('viewBox') || '0 0 17 31';
    const vbn = vbStr.split(/\s+/).map(Number);
    const w = Math.round((vbn[2] || 17) * 60), h = Math.round((vbn[3] || 31) * 60);
    // strip transient overlays (live-draw preview + the pulsing active-player ring)
    const inner = live.innerHTML
      .replace(/<g id="preview">[\s\S]*?<\/g>/, '')
      .replace(/<g id="guide">[\s\S]*?<\/g>/, '');
    const fonts = `<style>text{font-family:'Hanken Grotesk','Archivo',system-ui,sans-serif}</style>`;
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbStr}" width="${w}" height="${h}">${fonts}${inner}</svg>`, w, h };
  }

  // ---- BRANDED SHARE CARD (viral, portrait 1080×1350) ----------
  function buildBrandedCard(tac) {
    const en = TL.i18n.lang === 'en';
    const vb = C.viewBox('full', tac.sport);
    const W = 1080, H = 1350;
    const step = (tac.steps && (tac.steps[tac.steps.length-1] || tac.steps[0])) || null;
    const name = esc((tac.name || t('untitled')).toUpperCase());
    const sportTxt = (tac.sport === 'padel') ? (en?'PADEL':'PÁDEL') : (tac.sport === 'pickle') ? 'PICKLEBALL' : (en?'TENNIS':'TENIS');
    const surfTxt = t('surf_'+tac.surface);
    const stepsN = Math.max(0, (tac.steps?tac.steps.length:1) - 1);
    // court frame box
    const margin = 90, frameY = 300;
    const fw = W - margin*2;
    const fh = Math.round(fw * vb.h / vb.w);
    const logo = (TL.settings && TL.settings.logo && TL.settings.logo()) || localStorage.getItem('tl_logo');
    let s = '';
    s += `<rect width="${W}" height="${H}" fill="#0E1114"/>`;
    s += `<rect width="${W}" height="${H}" fill="url(#g)"/>`;
    // header
    s += `<rect x="${margin}" y="86" width="40" height="40" rx="9" fill="none" stroke="#E8703D" stroke-width="5"/>`;
    s += `<line x1="${margin}" y1="106" x2="${margin+40}" y2="106" stroke="#E8703D" stroke-width="5"/>`;
    s += `<text x="${margin+58}" y="118" font-size="40" font-weight="900" fill="#F3F5F2" font-family="'Archivo',sans-serif">CourtLab</text>`;
    s += `<text x="${W-margin}" y="115" text-anchor="end" font-size="20" letter-spacing="3" fill="#8A9298" font-family="'Space Mono',monospace">${sportTxt}</text>`;
    // tactic name
    s += `<text x="${margin}" y="218" font-size="20" letter-spacing="4" fill="#E8703D" font-family="'Space Mono',monospace">${en?'GAME PLAN':'PLAN DE JUEGO'}</text>`;
    s += `<text x="${margin}" y="278" font-size="${name.length>18?44:56}" font-weight="900" fill="#F3F5F2" font-family="'Archivo',sans-serif">${name}</text>`;
    // court frame
    s += `<rect x="${margin-6}" y="${frameY-6}" width="${fw+12}" height="${fh+12}" rx="22" fill="#171B1F" stroke="rgba(255,255,255,.1)" stroke-width="2"/>`;
    s += `<svg x="${margin}" y="${frameY}" width="${fw}" height="${fh}" viewBox="${vb.str}">${step ? courtInner(tac, step.pos, step.paths, step.annos) : C.render(tac.surface, tac.sport)}</svg>`;
    s += `<rect x="${margin}" y="${frameY}" width="${fw}" height="${fh}" rx="16" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1.5"/>`;
    // meta chips
    const chipY = frameY + fh + 54;
    const chips = [surfTxt, `${stepsN} ${en?'shots':'golpes'}`, ((tac.sport==='padel'||tac.sport==='pickle')?'2 vs 2':'1 vs 1')];
    let cx = margin;
    chips.forEach(c => {
      const cw = 34 + String(c).length * 17;
      s += `<rect x="${cx}" y="${chipY}" width="${cw}" height="52" rx="26" fill="#1B2024" stroke="rgba(255,255,255,.1)"/>`;
      s += `<text x="${cx+cw/2}" y="${chipY+34}" text-anchor="middle" font-size="22" fill="#C7CDD2" font-family="'Hanken Grotesk',sans-serif">${esc(String(c))}</text>`;
      cx += cw + 16;
    });
    // footer CTA
    s += `<rect x="0" y="${H-150}" width="${W}" height="150" fill="#13171A"/>`;
    s += `<rect x="0" y="${H-150}" width="${W}" height="4" fill="#E8703D"/>`;
    s += `<text x="${margin}" y="${H-86}" font-size="30" font-weight="800" fill="#F3F5F2" font-family="'Archivo',sans-serif">${en?'Plan your tennis & padel tactics':'Crea tus tácticas de tenis y pádel'}</text>`;
    s += `<text x="${margin}" y="${H-46}" font-size="24" fill="#E8703D" font-family="'Space Mono',monospace">courtlab · ${en?'free to start':'gratis para empezar'}</text>`;
    if (logo) s += `<image href="${logo}" x="${W-margin-72}" y="${H-118}" width="72" height="72" preserveAspectRatio="xMidYMid meet"/>`;
    const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8703D" stop-opacity=".10"/><stop offset=".35" stop-color="#0E1114" stop-opacity="0"/></linearGradient></defs>`;
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>text{font-family:'Hanken Grotesk','Archivo',sans-serif}</style>${defs}${s}</svg>`, w: W, h: H };
  }

  function exportBrandedCard() {
    const tac = TL.editor.tactic();
    const { svg, w, h } = buildBrandedCard(tac);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const cv = document.createElement('canvas');
      cv.width = w*scale; cv.height = h*scale;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#0E1114'; ctx.fillRect(0,0,cv.width,cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(async b => {
        // try native share with the file (great on mobile); fall back to download
        const file = new File([b], ((tac.name||'courtlab').replace(/\s+/g,'_'))+'_card.png', { type:'image/png' });
        if (navigator.canShare && navigator.canShare({ files:[file] })) {
          try { await navigator.share({ files:[file], title:'CourtLab', text: tac.name||'CourtLab' }); TL.app.toast(t('img_exported'), true); return; } catch(e){}
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = file.name;
        a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
        TL.app.toast(t('img_exported'), true);
      }, 'image/png');
    };
    img.onerror = () => TL.app.toast('⚠︎');
    img.src = url;
    // count towards the "share 5" achievement
    try { localStorage.setItem('tl_shared_count', String((parseInt(localStorage.getItem('tl_shared_count')||'0',10)||0)+1)); if (TL.achievements) TL.achievements.check(false); } catch(e){}
    close();
  }

  function exportImage() {
    const tac = TL.editor.tactic();
    const { svg, w, h } = buildStepsSheet(tac);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;   // crisp export
      const cv = document.createElement('canvas');
      cv.width = w*scale; cv.height = h*scale;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#101316'; ctx.fillRect(0,0,cv.width,cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(b => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = ((tac.name||'tactica').replace(/\s+/g,'_')) + '.png';
        a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
        TL.app.toast(t('img_exported'), true);
      }, 'image/png');
    };
    img.onerror = () => TL.app.toast('⚠︎');
    img.src = url;
    close();
  }

  function exportPdf() {
    close();
    const tac = TL.editor.tactic();
    const { svg } = buildStepsSheet(tac);
    const w = window.open('', '_blank');
    if (!w) { TL.app.toast(t('coming_soon')); return; }
    w.document.write(`<!doctype html><html><head><title>${esc(tac.name||'CourtLab')}</title>
      <style>html,body{margin:0;background:#101316}
      .sheet{width:100%;max-width:1100px;margin:0 auto;display:block}
      .print{position:fixed;right:18px;top:18px;padding:11px 20px;border:0;border-radius:999px;background:#D7F23A;color:#1A1E12;font-weight:800;font-family:system-ui;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4)}
      @media print{.print{display:none}@page{margin:10mm}}</style></head>
      <body><button class="print" onclick="print()">${t('sh_pdf')}</button><div class="sheet">${svg}</div>
      <script>window.addEventListener('load',function(){setTimeout(function(){try{print()}catch(e){}},400)})<\/script>
      </body></html>`);
    w.document.close();
  }

  // ---- PLAYBOOK PDF (several tactics in one printable doc) -------
  function playbook() {
    if (TL.premium && !TL.premium.gate('playbook')) return;
    const tactics = TL.store.loadAll();
    if (!tactics.length) { TL.app.toast(t('no_tactics_yet')); return; }
    const sel = new Set();
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal modal-lg">
      <div class="modal-head"><div><h2>${t('playbook_title')}</h2><p class="modal-sub">${t('pick_for_playbook')}</p></div><button class="x" id="mx">${ic.x}</button></div>
      <div class="modal-body">
        <div class="tac-pick" id="pb-pick">
          ${tactics.map(tc=>`<button class="tac-opt" data-id="${tc.id}"><span class="tp-check">${ic.check}</span><span>${esc(tc.name||t('untitled'))}</span><i>${TL.i18n.steps(tc.steps.length)}</i></button>`).join('')}
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="pb-cancel">${t('cancel')}</button>
        <button class="btn btn-primary" id="pb-go">${ic.book}${t('export_playbook')}</button>
      </div>
    </div></div>`;
    const h = host();
    h.querySelector('#mx').onclick = close;
    h.querySelector('#pb-cancel').onclick = close;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') close(); };
    h.querySelectorAll('#pb-pick .tac-opt').forEach(b => b.onclick = () => { const id=b.dataset.id; if(sel.has(id))sel.delete(id); else sel.add(id); b.classList.toggle('on'); });
    h.querySelector('#pb-go').onclick = () => {
      if (!sel.size) { TL.app.toast(t('playbook_empty')); return; }
      const chosen = tactics.filter(tc => sel.has(tc.id));
      const sheets = chosen.map(tc => buildStepsSheet(tc).svg).map(svg => `<div class="sheet">${svg}</div>`).join('');
      const w = window.open('', '_blank');
      if (!w) { TL.app.toast(t('coming_soon')); return; }
      w.document.write(`<!doctype html><html><head><title>CourtLab — Playbook</title>
        <style>html,body{margin:0;background:#101316}
        .sheet{width:100%;max-width:1100px;margin:0 auto 16px;display:block;page-break-after:always}
        .print{position:fixed;right:18px;top:18px;padding:11px 20px;border:0;border-radius:999px;background:#D7F23A;color:#1A1E12;font-weight:800;font-family:system-ui;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4)}
        @media print{.print{display:none}@page{margin:10mm}}</style></head>
        <body><button class="print" onclick="print()">${t('sh_pdf')}</button>${sheets}
        <script>window.addEventListener('load',function(){setTimeout(function(){try{print()}catch(e){}},500)})<\/script>
        </body></html>`);
      w.document.close();
      close();
    };
  }

  // ---- VIDEO EXPORT (animated WebM of the whole play) -----------
  function polySampler(points) {
    const seg = []; let total = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i-1], b = points[i];
      const l = Math.hypot(b.x-a.x, b.y-a.y);
      seg.push({ a, b, l, acc: total }); total += l;
    }
    return (tt) => {
      if (!seg.length) return points[0];
      const dist = tt * total; let s = seg[seg.length-1];
      for (const x of seg) { if (dist >= x.acc && dist <= x.acc + x.l) { s = x; break; } }
      const lt = s.l ? (dist - s.acc) / s.l : 0;
      return { x: s.a.x + (s.b.x-s.a.x)*lt, y: s.a.y + (s.b.y-s.a.y)*lt };
    };
  }

  function tokenMarkup(tk, p) {
    if (tk.type === 'ball')
      return `<circle cx="${p.x}" cy="${p.y}" r="0.78" fill="rgba(215,242,58,.18)"/><circle cx="${p.x}" cy="${p.y}" r="0.5" fill="#fff" stroke="#C9D63A" stroke-width="0.12"/>`;
    const f = tk.type === 'own' ? '#D7F23A' : '#FF5B5B';
    const ink = tk.type === 'own' ? '#1A1E12' : '#fff';
    return `<circle cx="${p.x}" cy="${p.y}" r="0.95" fill="${f}" stroke="rgba(0,0,0,.45)" stroke-width="0.14"/><text x="${p.x}" y="${p.y+0.36}" font-size="0.95" font-family="'Space Mono',monospace" font-weight="700" fill="${ink}" text-anchor="middle">${esc(tk.label)}</text>`;
  }

  function courtInner(tac, posMap, paths, annos) {
    let inner = C.render(tac.surface);
    (paths || []).forEach(p => {
      const d = C.toPathD(p.points); if (!d) return;
      const col = p.color || TL.PATH_COLORS[p.kind] || '#fff';
      inner += `<path d="${d}" fill="none" stroke="${col}" stroke-width="0.22" stroke-linecap="round" stroke-linejoin="round" ${p.dash==='dash'?'stroke-dasharray="0.55 0.45"':''}/>`;
    });
    (annos || []).forEach(a => {
      const col = a.color || '#5BC8FF';
      if (a.type === 'arrow' || a.type === 'line') { const [p0,p1]=a.points; inner += `<line x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}" stroke="${col}" stroke-width="0.22" stroke-linecap="round" ${a.dash==='dash'?'stroke-dasharray="0.55 0.45"':''}/>`; }
      else if (a.type === 'point') inner += `<circle cx="${a.x}" cy="${a.y}" r="0.42" fill="${col}"/>`;
      else if (a.type === 'text') inner += `<text x="${a.x+0.1}" y="${a.y+0.05}" font-size="1.05" font-family="'Hanken Grotesk',sans-serif" font-weight="700" fill="${col}">${esc(a.text)}</text>`;
    });
    (tac.tokens || []).forEach(tk => { const p = posMap[tk.id]; if (p) inner += tokenMarkup(tk, p); });
    return inner;
  }

  function frameSvg(tac, posMap, paths, annos) {
    const vb = C.viewBox(tac.view);
    const inner = courtInner(tac, posMap, paths, annos);
    const w = Math.round(vb.w*48), h = Math.round(vb.h*48);
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.str}" width="${w}" height="${h}"><style>text{font-family:'Hanken Grotesk','Archivo',sans-serif}</style>${inner}</svg>`, w, h };
  }

  // ---- STEP SHEET (all steps in a grid) — used by image + PDF ----
  function buildStepsSheet(tac) {
    const vb = C.viewBox('full');
    const steps = tac.steps || [];
    const n = steps.length;
    const cols = n <= 1 ? 1 : n <= 4 ? Math.min(n, 4) : n <= 6 ? 3 : 4;
    const rows = Math.ceil(n / cols);
    const courtH = 300, courtW = Math.round(courtH * vb.w / vb.h);
    const labelH = 30, gap = 20, padX = 30, padBottom = 34;
    const headH = 96;
    const sheetW = padX*2 + cols*courtW + (cols-1)*gap;
    const sheetH = headH + rows*(labelH + courtH) + (rows-1)*gap + padBottom;
    const surfTxt = (TL.i18n.lang==='en'?'Surface: ':'Superficie: ') + t('surf_'+tac.surface);
    const name = esc(tac.name || t('untitled'));

    let body = `<rect width="${sheetW}" height="${sheetH}" fill="#101316"/>`;
    body += `<rect x="0" y="0" width="${sheetW}" height="${headH}" fill="#171B1F"/>`;
    body += `<rect x="0" y="${headH-2}" width="${sheetW}" height="2" fill="#D7F23A"/>`;
    body += `<text x="${padX}" y="42" font-size="13" letter-spacing="3" fill="#727C84" font-family="'Space Mono',monospace">COURTLAB</text>`;
    body += `<text x="${padX}" y="74" font-size="30" font-weight="900" fill="#F3F5F2" font-family="'Archivo',sans-serif">${name.toUpperCase()}</text>`;
    const logo = (TL.settings && TL.settings.logo && TL.settings.logo()) || localStorage.getItem('tl_logo');
    const rightX = logo ? sheetW - padX - 64 : sheetW - padX;
    body += `<text x="${rightX}" y="60" text-anchor="end" font-size="14" fill="#AAB2B8" font-family="'Hanken Grotesk',sans-serif">${esc(surfTxt)}${tac.number?('  ·  #'+esc(String(tac.number))):''}</text>`;
    if (logo) body += `<image href="${logo}" x="${sheetW-padX-50}" y="${(headH-50)/2}" width="50" height="50" preserveAspectRatio="xMidYMid meet"/>`;

    steps.forEach((st, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = padX + c*(courtW + gap);
      const y = headH + 6 + r*(labelH + courtH + gap);
      const numTxt = (TL.i18n.lang==='en'?'STEP ':'PASO ') + String(i+1).padStart(2,'0');
      const title = esc(st.title || '');
      body += `<text x="${x}" y="${y+19}" font-size="11" letter-spacing="1.5" fill="#D7F23A" font-family="'Space Mono',monospace">${numTxt}</text>`;
      body += `<text x="${x+ (TL.i18n.lang==='en'?64:62)}" y="${y+19}" font-size="14" font-weight="700" fill="#F3F5F2" font-family="'Archivo',sans-serif">${title}</text>`;
      body += `<svg x="${x}" y="${y+labelH}" width="${courtW}" height="${courtH}" viewBox="${vb.str}">${courtInner(tac, st.pos, st.paths, st.annos)}</svg>`;
      body += `<rect x="${x}" y="${y+labelH}" width="${courtW}" height="${courtH}" rx="10" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1"/>`;
    });

    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}" viewBox="0 0 ${sheetW} ${sheetH}"><style>text{font-family:'Hanken Grotesk','Archivo',sans-serif}</style>${body}</svg>`,
      w: sheetW, h: sheetH,
    };
  }

  function buildFrames(tac, fps) {
    const DUR = { slow:1500, normal:950, fast:560 }, HOLD = { slow:520, normal:340, fast:200 };
    const speed = TL.state.speed || 'normal';
    const ease = TL.anim.easeInOut;
    const ref = frameSvg(tac, tac.steps[0].pos, [], tac.steps[0].annos);
    const frames = [];
    const intro = Math.round(0.45 * fps);
    for (let k = 0; k < intro; k++) frames.push(frameSvg(tac, tac.steps[0].pos, [], tac.steps[0].annos).svg);
    for (let i = 0; i < tac.steps.length - 1; i++) {
      const from = tac.steps[i], to = tac.steps[i+1];
      const n = Math.max(2, Math.round(DUR[speed]/1000 * fps));
      const bp = (to.paths || []).find(p => p.kind === 'ball');
      const sampler = (bp && bp.points.length >= 2) ? polySampler(bp.points) : null;
      for (let f = 0; f <= n; f++) {
        const e = ease(f/n), pos = {};
        tac.tokens.forEach(tk => {
          const a = from.pos[tk.id], b = to.pos[tk.id];
          if (!a || !b) { pos[tk.id] = a || b; return; }
          if (tk.type === 'ball' && sampler) pos[tk.id] = sampler(e);
          else pos[tk.id] = { x: a.x+(b.x-a.x)*e, y: a.y+(b.y-a.y)*e };
        });
        frames.push(frameSvg(tac, pos, to.paths, to.annos).svg);
      }
      const hold = Math.round(HOLD[speed]/1000 * fps);
      for (let k = 0; k < hold; k++) frames.push(frameSvg(tac, to.pos, to.paths, to.annos).svg);
    }
    return { frames, w: ref.w, h: ref.h };
  }

  function svgToImage(svg) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([svg], { type:'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      img.onload = () => { res(img); };
      img.onerror = () => rej(new Error('frame'));
      img.src = url;
    });
  }

  function pickMime() {
    const opts = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    if (typeof MediaRecorder === 'undefined') return null;
    return opts.find(m => MediaRecorder.isTypeSupported(m)) || null;
  }

  async function exportVideo() {
    if (TL.premium && !TL.premium.gate('video')) { close(); return; }
    const tac = TL.editor.tactic();
    if (tac.steps.length < 2) { close(); TL.app.toast(t('vid_need')); return; }
    const mime = pickMime();
    if (!mime || !HTMLCanvasElement.prototype.captureStream) { close(); TL.app.toast(t('vid_unsupported')); return; }
    close();
    TL.app.toast(t('vid_building'));
    const fps = 30;
    const { frames, w, h } = buildFrames(tac, fps);
    let imgs;
    try { imgs = await Promise.all(frames.map(svgToImage)); }
    catch (e) { TL.app.toast(t('vid_unsupported')); return; }

    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const stream = cv.captureStream(fps);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = ((tac.name||'jugada').replace(/\s+/g,'_')) + '.webm';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      TL.app.toast(t('vid_done'), true);
    };
    rec.start();
    let i = 0;
    await new Promise(resolve => {
      const id = setInterval(() => {
        ctx.fillStyle = '#101316'; ctx.fillRect(0,0,w,h);
        ctx.drawImage(imgs[i], 0, 0, w, h);
        i++;
        if (i >= imgs.length) { clearInterval(id); setTimeout(() => { rec.stop(); resolve(); }, 250); }
      }, 1000/fps);
    });
  }

  // ---- GIF EXPORT (animated GIF, offline, shareable) ----
  async function exportGif() {
    if (TL.premium && !TL.premium.gate('video')) { close(); return; }
    const tac = TL.editor.tactic();
    if (tac.steps.length < 2) { close(); TL.app.toast(t('vid_need')); return; }
    if (!TL.gif) { close(); TL.app.toast(t('vid_unsupported')); return; }
    close();
    TL.app.toast(t('gif_building') || t('vid_building'));
    const fps = 12;
    const { frames, w, h } = buildFrames(tac, fps);
    const scale = Math.min(1, 360 / w);            // downscale → GIF de tamaño razonable
    const gw = Math.round(w * scale), gh = Math.round(h * scale);
    let imgs;
    try { imgs = await Promise.all(frames.map(svgToImage)); }
    catch (e) { TL.app.toast(t('vid_unsupported')); return; }
    const cv = document.createElement('canvas'); cv.width = gw; cv.height = gh;
    const ctx = cv.getContext('2d');
    const imgData = [];
    for (const im of imgs) {
      ctx.fillStyle = '#101316'; ctx.fillRect(0, 0, gw, gh);
      ctx.drawImage(im, 0, 0, gw, gh);
      imgData.push(ctx.getImageData(0, 0, gw, gh));
      await new Promise(r => setTimeout(r, 0));    // cede el hilo (no congela la UI)
    }
    let blob;
    try { blob = TL.gif.encode({ frames: imgData, width: gw, height: gh, delay: 1000 / fps }); }
    catch (e) { TL.app.toast(t('vid_unsupported')); return; }
    const name = ((tac.name || 'jugada').replace(/\s+/g, '_')) + '.gif';
    const file = new File([blob], name, { type: 'image/gif' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: tac.name || 'CourtLab' }); TL.app.toast(t('vid_done'), true); return; } catch (e) {}
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    TL.app.toast(t('vid_done'), true);
  }

  TL.modals = { save, share, close, playbook };
})(window.TL = window.TL || {});
