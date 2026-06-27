/* ============================================================
   settings.js — theme, language, data backup (export/import)
   ============================================================ */
(function (TL) {
  const t = (k) => TL.i18n.t(k);
  const ic = TL.icon;
  const KEYS = ['tl_tactics_v1','tl_folders_v1','tl_rivals_v1','tl_matches_v1','tl_diary_v1','tl_goals_v1','tl_lang','tl_theme','tl_sound','tl_haptic','tl_reduce_anim','tl_sport_pref','tl_logo','tl_accent'];

  function host(){ let h=document.getElementById('modal-host'); if(!h){h=document.createElement('div');h.id='modal-host';document.body.appendChild(h);} return h; }
  function close(){ host().innerHTML=''; }

  function theme(){ return localStorage.getItem('tl_theme') || 'dark'; }
  function haptic(){ return localStorage.getItem('tl_haptic') !== '0'; }
  function setTheme(v){ localStorage.setItem('tl_theme', v); document.documentElement.dataset.theme = v; }
  function sound(){ return localStorage.getItem('tl_sound') !== '0'; }
  // reduce animations: forces 'no-anim' on <html> when on
  function reduceAnim(){ const m = localStorage.getItem('tl_reduce_anim')||'auto'; return m==='on' || (m==='auto' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function setReduceAnim(on){ localStorage.setItem('tl_reduce_anim', on?'on':'off'); document.documentElement.classList.toggle('no-anim', !!on); }
  function logo(){ return localStorage.getItem('tl_logo') || ''; }

  // 10 preset accent colors [name, accent, dim, ink-on-accent]
  const ACCENTS = [
    ['Terracota','#F26C36','#CC5C2B','#190A02'],
    ['Pelota',   '#CBF24A','#A9D02F','#10180A'],
    ['Azul',     '#3B82F6','#2563EB','#06122B'],
    ['Menta',    '#36D9B0','#1FB894','#04201A'],
    ['Coral',    '#FF5B6E','#E23A4F','#2A0509'],
    ['Violeta',  '#9D7BFF','#7C54F0','#140A2E'],
    ['Ámbar',    '#FFB020','#E0930A','#241600'],
    ['Cian',     '#22C7E0','#10A6BE','#03212A'],
    ['Rosa',     '#FF6FB5','#E84A98','#2C0518'],
    ['Lima',     '#9BE000','#7EB800','#152000'],
  ];
  function accent(){ return localStorage.getItem('tl_accent') || '#F26C36'; }
  function applyAccent(hex){
    const a = ACCENTS.find(x=>x[1].toLowerCase()===(hex||'').toLowerCase()) || ACCENTS[0];
    const r = document.documentElement.style;
    r.setProperty('--ball', a[1]);
    r.setProperty('--ball-dim', a[2]);
    r.setProperty('--ball-ink', a[3]);
    r.setProperty('--glow', a[1]+'8c');
  }
  applyAccent(accent());

  function open() {
    const cur = theme();
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal">
      <div class="modal-head"><h2>${t('settings')}</h2><button class="x" id="mx">${ic.x}</button></div>
      <div class="modal-body">
        <div class="field"><label>${t('s_account')}</label>
          ${(TL.cloud && TL.cloud.enabled) ? (
            TL.cloud.loggedIn()
            ? `<div class="acct-card on">
                 <span class="acct-ic">${ic.check}</span>
                 <div class="acct-tx"><b>${TL.cloud.email()}</b><span>${t('cloud_sync')}</span></div>
                 <button class="btn btn-ghost btn-sm" id="s-profile">${ic.user}${TL.i18n.lang==='en'?'Profile':'Perfil'}</button>
                 <button class="btn btn-ghost btn-sm" id="s-logout">${t('sign_out')}</button>
               </div>`
            : `<div class="acct-card">
                 <span class="acct-ic">${ic.mail||ic.star}</span>
                 <div class="acct-tx"><b>${t('sign_in')}</b><span>${TL.i18n.lang==='en'?'Sync across devices':'Sincroniza tus dispositivos'}</span></div>
                 <button class="btn btn-primary btn-sm" id="s-login">${t('sign_in')}</button>
               </div>`
          ) : ''}
          <div class="acct-card ${TL.premium.isPremium()?'on':''}" style="margin-top:8px">
            <span class="acct-ic">${ic.star}</span>
            <div class="acct-tx"><b>${TL.premium.isPremium()? (TL.premium.isAdmin()?t('admin_active'):t('premium_on')) : t('s_premium')}</b>
              <span>${(function(){
                const en = TL.i18n.lang==='en';
                if (!TL.premium.isPremium()) return en?'Free plan':'Plan gratis';
                if (TL.premium.isAdmin()) return en?'Always on':'Siempre activo';
                if (TL.cloud && TL.cloud.isCloudPremium && TL.cloud.isCloudPremium()) return en?'Subscription active':'Suscripción activa';
                if (TL.premium.earnedActive && TL.premium.earnedActive()) { const d = TL.premium.earnedDaysLeft?TL.premium.earnedDaysLeft():0; return en?`Free Premium · ${d} ${d===1?'day':'days'} left`:`Premium gratis · quedan ${d} ${d===1?'día':'días'}`; }
                return '';
              })()}</span></div>
            ${TL.premium.isPremium()?'':`<button class="btn btn-primary btn-sm" id="s-upgrade">${t('go_premium')}</button>`}
            ${(TL.premium.isPremium() && TL.cloud && TL.cloud.hasSubscription && TL.cloud.hasSubscription())?`<button class="btn btn-line btn-sm" id="s-manage">${TL.i18n.lang==='en'?'Manage':'Gestionar'}</button>`:''}
          </div>
        </div>
        <div class="field"><label>${t('s_club')}</label>
          <div class="acct-card">
            <span class="acct-ic">${ic.users}</span>
            <div class="acct-tx"><b>${t('club_title')}</b><span>${t('club_d')}</span></div>
            <button class="btn btn-line btn-sm" id="s-club">${t('club_open')}</button>
          </div>
        </div>
        <div class="field"><label>${t('sport')}</label>
          <div class="seg2" id="s-sport">
            <button data-sp="tennis" class="${(TL.extras.sportPref()==='tennis')?'on':''}">🎾 ${t('sport_tennis')}</button>
            <button data-sp="padel" class="${TL.extras.sportPref()==='padel'?'on':''}">🥎 ${t('sport_padel')}</button>
            <button data-sp="pickle" class="${TL.extras.sportPref()==='pickle'?'on':''}">🏓 ${t('sport_pickle')}</button>
          </div>
        </div>
        <div class="field"><label>${t('s_theme')}</label>
          <div class="seg2" id="s-theme">
            <button data-v="light" class="${cur==='light'?'on':''}">☀️ ${t('theme_light')}</button>
            <button data-v="dark" class="${cur==='dark'?'on':''}">🌙 ${t('theme_dark')}</button>
          </div>
        </div>
        <div class="field"><label>${t('s_accent')}</label>
          <div class="accent-grid" id="s-accent">
            ${ACCENTS.map(a=>`<button class="accent-sw ${accent().toLowerCase()===a[1].toLowerCase()?'on':''}" data-c="${a[1]}" title="${a[0]}" style="--sw:${a[1]}"></button>`).join('')}
          </div>
        </div>
        <div class="field"><label>${t('s_lang')}</label>
          <div class="seg2" id="s-lang">
            <button data-v="es" class="${TL.i18n.lang==='es'?'on':''}">Español</button>
            <button data-v="en" class="${TL.i18n.lang==='en'?'on':''}">English</button>
          </div>
        </div>
        <div class="field"><label>${t('s_sound')}</label>
          <div class="set-toggle">
            <b>${t('s_sound')}</b>
            <button class="switch ${sound()?'on':''}" id="s-sound" role="switch" aria-checked="${sound()}"><i></i></button>
          </div>
        </div>
        <div class="field"><label>${t('s_haptic')}</label>
          <div class="set-toggle">
            <b>${t('s_haptic')}</b>
            <button class="switch ${haptic()?'on':''}" id="s-haptic" role="switch" aria-checked="${haptic()}"><i></i></button>
          </div>
          <p class="field-hint">${t('s_haptic_d')}</p>
        </div>
        <div class="field"><label>${t('s_motion')}</label>
          <div class="set-toggle">
            <b>${t('s_motion')}</b>
            <button class="switch ${reduceAnim()?'on':''}" id="s-motion" role="switch" aria-checked="${reduceAnim()}"><i></i></button>
          </div>
          <span style="font-size:12px;color:var(--txt-3);display:block;margin-top:6px">${t('s_motion_d')}</span>
        </div>
        <div class="field"><label>${t('s_logo')}</label>
          <div class="logo-slot">
            <span class="logo-prev" id="logo-prev">${logo() ? `<img src="${logo()}" alt=""/>` : ic.image}</span>
            <div class="st" style="flex:1"><b style="font-family:var(--head)">${t('s_logo')}</b><span style="font-size:12px;color:var(--txt-3);display:block">${t('s_logo_d')}</span></div>
            <button class="btn btn-ghost btn-sm" id="logo-add">${t(logo()?'remove_logo':'add_logo')}</button>
          </div>
          <input type="file" id="logo-file" accept="image/*" class="hide"/>
        </div>
        <div class="field"><label>${t('s_data')}</label>
          <div class="share-list">
            ${(TL._installPrompt) ? `<button class="share-item" id="s-install">
              <span class="si">${ic.arrowRight}</span>
              <span class="st"><b>${t('install_app')}</b><span>${t('install_d')}</span></span>${ic.arrowRight}
            </button>` : ''}
            <button class="share-item" id="s-export">
              <span class="si">${ic.save}</span>
              <span class="st"><b>${t('s_export')}</b><span>${t('s_export_d')}</span></span>${ic.arrowRight}
            </button>
            <button class="share-item" id="s-import">
              <span class="si">${ic.copy}</span>
              <span class="st"><b>${t('s_import')}</b><span>${t('s_import_d')}</span></span>${ic.arrowRight}
            </button>
            <button class="share-item danger" id="s-wipe">
              <span class="si">${ic.trash}</span>
              <span class="st"><b>${t('s_wipe')}</b></span>
            </button>
          </div>
          <input type="file" id="s-file" accept="application/json" class="hide"/>
        </div>
        <div class="field"><label>${t('s_support')}</label>
          <div class="share-list">
            <button class="share-item" id="s-feedback">
              <span class="si">${ic.edit}</span>
              <span class="st"><b>${t('s_feedback')}</b></span>${ic.arrowRight}
            </button>
            <a class="share-item" id="s-contact" href="mailto:soporte.tennislab@gmail.com">
              <span class="si">${ic.mail}</span>
              <span class="st"><b>${t('s_contact')}</b><span>soporte.tennislab@gmail.com</span></span>${ic.arrowRight}
            </a>
            <a class="share-item" href="privacidad.html" target="_blank">
              <span class="si">${ic.book}</span><span class="st"><b>${t('s_privacy')}</b></span>${ic.arrowRight}
            </a>
            <a class="share-item" href="terminos.html" target="_blank">
              <span class="si">${ic.book}</span><span class="st"><b>${t('s_terms')}</b></span>${ic.arrowRight}
            </a>
          </div>
          <input id="s-admin" class="admin-in" placeholder="${t('admin_ph')}" autocomplete="off"/>
        </div>
        <div class="field"><label>${t('s_about')}</label>
          <div class="share-list">
            <button class="share-item" id="s-replay">
              <span class="si">${ic.book}</span>
              <span class="st"><b>${t('s_reset_tutorial')}</b><span>${t('s_reset_tutorial_d')}</span></span>${ic.arrowRight}
            </button>
            <button class="share-item" id="s-update">
              <span class="si">${ic.arrowRight}</span>
              <span class="st"><b>${t('s_update')}</b><span>${t('s_update_d')}</span></span>${ic.arrowRight}
            </button>
          </div>
          <p class="field-hint" style="text-align:center;opacity:.6">CourtLab · ${t('s_version')} ${TL.VERSION||'1.0'}</p>
        </div>
      </div>
    </div></div>`;
    const h = host();
    h.querySelector('#mx').onclick = close;
    const up = h.querySelector('#s-upgrade'); if (up) up.onclick = () => { close(); TL.premium.upgrade(); };
    const mg = h.querySelector('#s-manage'); if (mg) mg.onclick = () => { TL.premium.manageSubscription(); };
    const li = h.querySelector('#s-login'); if (li) li.onclick = () => { close(); TL.cloud.authModal(); };
    const lo = h.querySelector('#s-logout'); if (lo) lo.onclick = async () => { close(); await TL.cloud.signOut(); };
    const prof = h.querySelector('#s-profile'); if (prof) prof.onclick = () => { close(); TL.social.profileModal(); };
    const clb = h.querySelector('#s-club'); if (clb) clb.onclick = () => { close(); TL.club.open(); };
    const fb = h.querySelector('#s-feedback'); if (fb) fb.onclick = () => feedbackForm();
    const replay = h.querySelector('#s-replay'); if (replay) replay.onclick = async () => {
      ['tl_onboard_done','tl_onboarded'].forEach(k=>localStorage.removeItem(k));
      close(); TL.app.toast(t('tutorial_reset'), true); TL.app.goHome();
      setTimeout(()=>{ TL.extras && TL.extras.onboard && TL.extras.onboard(); }, 400);
    };
    const upd = h.querySelector('#s-update'); if (upd) upd.onclick = async () => {
      TL.app.toast(t('updating'), true);
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.update().catch(()=>{})));
        }
        if (window.caches) { const keys = await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); }
      } catch(e){}
      setTimeout(()=>location.reload(true), 500);
    };
    const adm = h.querySelector('#s-admin'); if (adm) adm.onkeydown = (e) => {
      if (e.key==='Enter'){ if (TL.premium.unlockAdmin(adm.value)){ TL.app.toast(t('admin_ok'), true); close(); open(); } else TL.app.toast(t('admin_bad')); }
    };
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') close(); };
    h.querySelectorAll('#s-sport button').forEach(b => b.onclick = () => {
      localStorage.setItem('tl_sport_pref', b.dataset.sp);
      h.querySelectorAll('#s-sport button').forEach(x=>x.classList.toggle('on',x===b));
      TL.app.toast(b.dataset.sp==='padel'?'🥎 '+t('sport_padel'):b.dataset.sp==='pickle'?'🏓 '+t('sport_pickle'):'🎾 '+t('sport_tennis'), true);
    });
    h.querySelectorAll('#s-theme button').forEach(b => b.onclick = () => {
      setTheme(b.dataset.v);
      h.querySelectorAll('#s-theme button').forEach(x=>x.classList.toggle('on',x===b));
    });
    h.querySelectorAll('#s-accent .accent-sw').forEach(b => b.onclick = () => {
      localStorage.setItem('tl_accent', b.dataset.c);
      applyAccent(b.dataset.c);
      h.querySelectorAll('#s-accent .accent-sw').forEach(x=>x.classList.toggle('on',x===b));
    });
    h.querySelectorAll('#s-lang button').forEach(b => b.onclick = () => {
      TL.i18n.set(b.dataset.v);
      close(); TL.app.renderTopbar();
      if (TL.state.view==='editor' && TL.state.tactic) TL.editor.render(); else TL.app.renderHome();
      open();
    });
    h.querySelector('#s-export').onclick = exportData;
    const inst = h.querySelector('#s-install');
    if (inst) inst.onclick = async () => {
      const p = TL._installPrompt; if (!p) return;
      p.prompt();
      try { await p.userChoice; } catch(e){}
      TL._installPrompt = null; close();
    };
    const snd = h.querySelector('#s-sound');
    if (snd) snd.onclick = () => { const on = !sound(); localStorage.setItem('tl_sound', on ? '1' : '0'); snd.classList.toggle('on', on); if (on && TL.anim) TL.anim.hitSound(1); };
    const hap = h.querySelector('#s-haptic');
    if (hap) hap.onclick = () => { const on = !haptic(); localStorage.setItem('tl_haptic', on ? '1' : '0'); hap.classList.toggle('on', on); hap.setAttribute('aria-checked', on); if (on && TL.fx) TL.fx.success(); };
    const mot = h.querySelector('#s-motion');
    if (mot) mot.onclick = () => { const on = !mot.classList.contains('on'); setReduceAnim(on); mot.classList.toggle('on', on); mot.setAttribute('aria-checked', on); };
    const logoFile = h.querySelector('#logo-file');
    const logoAdd = h.querySelector('#logo-add');
    if (logoAdd) logoAdd.onclick = () => {
      if (logo()) { localStorage.removeItem('tl_logo'); close(); open(); TL.app.toast(t('remove_logo')); }
      else logoFile.click();
    };
    if (logoFile) logoFile.onchange = () => {
      const f = logoFile.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        // downscale to keep storage small
        const img = new Image();
        img.onload = () => {
          const max = 256, sc = Math.min(1, max/Math.max(img.width, img.height));
          const cv = document.createElement('canvas'); cv.width = Math.round(img.width*sc); cv.height = Math.round(img.height*sc);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          try { localStorage.setItem('tl_logo', cv.toDataURL('image/png')); close(); open(); TL.app.toast(t('logo_added'), true); }
          catch(e){ TL.app.toast(t('import_bad')); }
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(f);
    };
    h.querySelector('#s-wipe').onclick = async () => {
      const ok = await TL.ui.confirm({ message: t('s_wipe_confirm'), danger: true, ok: TL.i18n.lang==='en'?'Delete all':'Borrar todo' });
      if (!ok) return;
      ['tl_tactics_v1','tl_folders_v1','tl_rivals_v1','tl_matches_v1','tl_diary_v1','tl_goals_v1'].forEach(k=>localStorage.removeItem(k));
      TL.store && TL.store.invalidate && TL.store.invalidate(); // limpiar caché tras borrar
      close(); TL.app.goHome();
    };
    const file = h.querySelector('#s-file');
    h.querySelector('#s-import').onclick = () => file.click();
    file.onchange = () => {
      const f = file.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const data = JSON.parse(fr.result);
          if (!data || typeof data !== 'object' || !data.__jrr) throw new Error('bad');
          KEYS.forEach(k => { if (data[k] != null) localStorage.setItem(k, typeof data[k]==='string' ? data[k] : JSON.stringify(data[k])); });
          TL.app.toast(t('data_imported'), true);
          setTimeout(()=>location.reload(), 600);
        } catch (e) { TL.app.toast(t('import_bad')); }
      };
      fr.readAsText(f);
    };
  }

  function exportData() {
    const out = { __jrr: 1, exportedAt: new Date().toISOString() };
    KEYS.forEach(k => { const v = localStorage.getItem(k); if (v != null) out[k] = v; });
    const blob = new Blob([JSON.stringify(out, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'courtlab-copia.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
    TL.app.toast(t('data_exported'), true);
  }

  function feedbackForm(){
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal">
      <div class="modal-head"><h2>${t('s_feedback')}</h2><button class="x" id="mx">${ic.x}</button></div>
      <div class="modal-body">
        <div class="field"><textarea id="fb-text" placeholder="${t('feedback_ph')}" style="min-height:120px"></textarea></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="fb-cancel">${t('cancel')}</button>
        <button class="btn btn-primary" id="fb-send">${ic.check}${t('s_feedback')}</button>
      </div>
    </div></div>`;
    const h = host();
    h.querySelector('#mx').onclick = close; h.querySelector('#fb-cancel').onclick = close;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') close(); };
    h.querySelector('#fb-send').onclick = () => {
      const txt = h.querySelector('#fb-text').value.trim();
      if (txt) {
        // production: POST to backend / email service. For now open the user's mail client.
        window.open('mailto:soporte.tennislab@gmail.com?subject=' + encodeURIComponent('Feedback CourtLab') + '&body=' + encodeURIComponent(txt), '_blank');
      }
      close(); TL.app.toast(t('feedback_sent'), true);
    };
    setTimeout(()=>h.querySelector('#fb-text').focus(), 50);
  }

  TL.settings = { open, setTheme, theme, logo, sound, applyAccent, accent };
})(window.TL = window.TL || {});
