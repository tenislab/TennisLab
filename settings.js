/* ============================================================
   premium.js — Free vs Premium gating, upgrade screen, admin unlock
   ------------------------------------------------------------
   NO real payment here. The app exposes a single source of truth
   TL.premium.isPremium() that a backend (Supabase + Stripe webhook)
   will drive in production. For now it is stored locally, plus an
   admin code that unlocks Premium without paying.
   ============================================================ */
(function (TL) {
  const t = (k) => TL.i18n.t(k);
  const ic = TL.icon;

  // --- config (edit freely) ---
  const FREE_TACTIC_LIMIT = 5;
  const PRICE_MONTH = '2,99 €';
  const PRICE_YEAR = '22,99 €';
  // admin code → unlocks premium forever on this device (give ONLY to yourself)
  const ADMIN_CODE = 'TL-ADMIN-2026';

  function host(){ let h=document.getElementById('modal-host'); if(!h){h=document.createElement('div');h.id='modal-host';document.body.appendChild(h);} return h; }
  function close(){ host().innerHTML=''; }
  function esc(s){return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

  // ---- state ----
  // production: this comes from the user's account (Supabase) after Stripe webhook.
  function isAdmin(){ return localStorage.getItem('tl_admin') === '1'; }
  // premium ganado por logros / promos: timestamp hasta el que hay premium
  function earnedUntil(){ return parseInt(localStorage.getItem('tl_premium_until')||'0', 10) || 0; }
  function earnedActive(){ return earnedUntil() > Date.now(); }
  function earnedDaysLeft(){ const ms = earnedUntil() - Date.now(); return ms > 0 ? Math.ceil(ms/86400000) : 0; }
  // suma días de premium (no resta si ya tienes más); base = ahora o lo que quede
  function grantDays(days){
    const base = Math.max(Date.now(), earnedUntil());
    const until = base + days*86400000;
    localStorage.setItem('tl_premium_until', String(until));
    return until;
  }
  function isPremium(){ return isAdmin() || localStorage.getItem('tl_premium') === '1' || earnedActive() || (TL.cloud && TL.cloud.isCloudPremium && TL.cloud.isCloudPremium()); }
  function setPremium(on){ localStorage.setItem('tl_premium', on ? '1' : '0'); }
  function unlockAdmin(code){
    if ((code||'').trim().toUpperCase() === ADMIN_CODE) { localStorage.setItem('tl_admin','1'); return true; }
    return false;
  }
  function clearAdmin(){ localStorage.removeItem('tl_admin'); }

  // gate a premium-only action. returns true if allowed; otherwise shows paywall + returns false.
  function gate(featureKey){
    if (isPremium()) return true;
    upgrade(featureKey);
    return false;
  }
  // can the user create another tactic? (solo cuentan las SUYAS, no ejemplos/demo)
  function canCreateTactic(){
    if (isPremium()) return true;
    return (TL.store.loadAll().filter(t => !t.demo && !t.seed).length < FREE_TACTIC_LIMIT);
  }
  function tacticLimit(){ return FREE_TACTIC_LIMIT; }

  // ---- upgrade / paywall screen ----
  function upgrade(reason){
    const en = TL.i18n.lang === 'en';
    const rows = [
      [en?'Saved tactics':'Tácticas guardadas', `${FREE_TACTIC_LIMIT}`, '∞'],
      [en?'Editor + animation':'Editor + animación', '✓','✓'],
      [en?'Rivals, matches & scouting':'Rivales, partidos y scouting', '✓','✓'],
      [en?'Attack map + win probability':'Mapa de ataque + prob. victoria', '✓','✓'],
      [en?'Auto match plan':'Plan automático de partido', '✓','✓'],
      [en?'Cloud · all devices':'Nube · multidispositivo', '✓','✓'],
      [en?'Export image':'Exportar imagen', '✓','✓'],
      [en?'Export video':'Exportar vídeo', '—','✓'],
      [en?'PDF reports · scouting / match / playbook':'Informes PDF · scouting / partido / playbook', '—','✓'],
      [en?'Pro templates & plays':'Plantillas y jugadas Pro', '—','✓'],
      [en?'Club mode':'Modo Club', '—','✓'],
    ];
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal pm-modal">
      <div class="pm-hero">
        <span class="pm-crown">${ic.star}</span>
        <h2>${en?'Go Premium':'Hazte Premium'}</h2>
        <p>${en?'7 days free, then choose a plan. Cancel anytime.':'7 días gratis, luego eliges plan. Cancela cuando quieras.'}</p>
      </div>
      <div class="modal-body">
        <table class="pm-table">
          <thead><tr><th></th><th>${en?'Free':'Gratis'}</th><th class="pm-pro">Premium</th></tr></thead>
          <tbody>${rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td class="pm-pro">${r[2]}</td></tr>`).join('')}</tbody>
        </table>
        <div class="pm-plans">
          <button class="pm-plan" data-plan="month"><span class="pm-trial">${en?'7 days free':'7 días gratis'}</span><span class="pm-price">${PRICE_MONTH}</span><span class="pm-per">${en?'then / month':'luego / mes'}</span></button>
          <button class="pm-plan best" data-plan="year"><span class="pm-tag">${t('save_label')} 36%</span><span class="pm-trial">${en?'7 days free':'7 días gratis'}</span><span class="pm-price">${PRICE_YEAR}</span><span class="pm-per">${en?'then / year · 1,92 €/mo':'luego / año · 1,92 €/mes'}</span></button>
        </div>
        <p class="pm-note">${en?'The yearly plan is like getting almost 5 months free. Secure payment with Stripe. No charge during the trial.':'El plan anual es como tener casi 5 meses gratis. Pago seguro con Stripe. No se cobra durante la prueba.'}</p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="pm-close">${en?'Maybe later':'Quizá más tarde'}</button>
      </div>
    </div></div>`;
    const h = host();
    h.querySelector('#pm-close').onclick = close;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') close(); };
    h.querySelectorAll('.pm-plan').forEach(b => b.onclick = () => {
      if (b.dataset.busy) return;
      h.querySelectorAll('.pm-plan').forEach(x=>{ x.dataset.busy='1'; x.classList.add('is-busy'); });
      b.classList.add('is-loading');
      startCheckout(b.dataset.plan).finally(()=>{
        h.querySelectorAll('.pm-plan').forEach(x=>{ delete x.dataset.busy; x.classList.remove('is-busy'); });
        b.classList.remove('is-loading');
      });
    });
  }

  // ---- checkout (REAL: Supabase Edge Function → Stripe) ----
  async function startCheckout(plan, opts){
    const en = TL.i18n.lang === 'en';
    TL.app && TL.app.toast(en?'Opening secure checkout…':'Abriendo pago seguro…', true);
    // necesitas tener sesión iniciada para asociar el pago a tu cuenta
    if (!(TL.cloud && TL.cloud.enabled && TL.cloud.loggedIn())) {
      TL.app.toast(en?'Sign in first to subscribe':'Inicia sesión para suscribirte');
      if (TL.cloud && TL.cloud.authModal) TL.cloud.authModal();
      return;
    }
    try {
      const { data } = await TL.cloud.client.auth.getSession();
      const token = data && data.session && data.session.access_token;
      const payload = { plan };
      if (opts && opts.club_id) payload.club_id = opts.club_id;   // Plan Club
      const r = await fetch(TL.cloud.config.url + '/functions/v1/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'apikey': TL.cloud.config.anonKey },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (json.url) { if (plan !== 'club') { try { localStorage.setItem('tl_trial_start', String(Date.now())); } catch(e){} } location.href = json.url; }            // página de pago de Stripe
      else { TL.app.toast(en?'Payments not configured yet':'Pagos aún sin configurar'); console.warn(json); }
    } catch (e) {
      TL.app.toast(en?'Payments not configured yet':'Pagos aún sin configurar'); console.warn(e);
    }
  }

  // ---- portal de cliente (gestionar / cancelar suscripción) ----
  async function manageSubscription(){
    const en = TL.i18n.lang === 'en';
    if (!(TL.cloud && TL.cloud.enabled && TL.cloud.loggedIn())) {
      TL.app.toast(en?'Sign in first':'Inicia sesión primero');
      return;
    }
    try {
      const { data } = await TL.cloud.client.auth.getSession();
      const token = data && data.session && data.session.access_token;
      const r = await fetch(TL.cloud.config.url + '/functions/v1/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'apikey': TL.cloud.config.anonKey },
      });
      const json = await r.json();
      if (json.url) { location.href = json.url; }
      else { TL.app.toast(en?'Could not open billing portal':'No se pudo abrir el portal de pagos'); console.warn(json); }
    } catch (e) {
      TL.app.toast(en?'Could not open billing portal':'No se pudo abrir el portal de pagos'); console.warn(e);
    }
  }

  // al volver de Stripe (?premium=ok) refrescamos el estado desde la nube
  function checkReturn(){
    const params = new URLSearchParams(location.search);
    const p = params.get('premium');
    const c = params.get('club');
    if (c === 'ok') {
      // vuelta del pago del Plan Club → refresca el club y avisa
      TL.app && TL.app.toast(TL.i18n.lang==='en'?'Club Plan active — unlimited players!':'¡Plan Club activo — jugadores ilimitados!', true);
      if (TL.club && TL.club.load) setTimeout(()=>{ TL.club.current=null; TL.club.load().then(()=>{ if (TL.club.open) TL.club.open(); }); }, 1500);
      history.replaceState(null,'',location.pathname);
      return;
    } else if (c === 'cancel') {
      history.replaceState(null,'',location.pathname);
      return;
    }
    if (p === 'ok') {
      TL.app && TL.app.toast(TL.i18n.lang==='en'?'Welcome to Premium!':'¡Bienvenido a Premium!', true);
      if (TL.cloud && TL.cloud.loggedIn) setTimeout(()=>TL.cloud.onLogin(true), 1500);
      history.replaceState(null,'',location.pathname);
    } else if (p === 'cancel') {
      history.replaceState(null,'',location.pathname);
    }
  }

  // recordatorio de fin de prueba (cliente, best-effort): avisa el día 5 y el último día
  function trialReminder(){
    try {
      const start = parseInt(localStorage.getItem('tl_trial_start')||'0', 10) || 0;
      if (!start) return;
      const day = Math.floor((Date.now() - start) / 86400000); // 0 = hoy
      if (day < 0 || day > 7) return;
      const flag = 'tl_trial_remind_' + day;
      if (localStorage.getItem(flag)) return;
      let msg = null;
      if (day === 5) msg = t('trial_remind5');
      else if (day === 7) msg = t('trial_remind_last');
      if (msg) { localStorage.setItem(flag, '1'); setTimeout(()=>TL.app && TL.app.toast(msg, true), 2200); }
    } catch(e){}
  }

  TL.premium = { isPremium, isAdmin, setPremium, unlockAdmin, clearAdmin, gate, canCreateTactic, tacticLimit, upgrade, startCheckout, manageSubscription, checkReturn, trialReminder, grantDays, earnedUntil, earnedActive, earnedDaysLeft, ADMIN_CODE, PRICE_MONTH, PRICE_YEAR, FREE_TACTIC_LIMIT };
})(window.TL = window.TL || {});
