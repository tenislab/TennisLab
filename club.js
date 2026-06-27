/* ============================================================
   achievements.js — Logros con recompensa en días Premium (local)
   ------------------------------------------------------------
   - Define logros con condición (función sobre stats) y premio en días.
   - Al cargar / tras acciones, detecta los recién desbloqueados,
     concede los días de Premium (TL.premium.grantDays) y muestra
     un aviso animado.
   - Guarda los logros ya cobrados en localStorage (no se pagan 2 veces).
   - Lleva una racha de días de uso (tl_streak).
   ============================================================ */
(function (TL) {
  const t = (k) => TL.i18n.t(k);
  const ic = TL.icon;
  const CLAIMED = 'tl_ach_claimed';

  function host(){ let h=document.getElementById('modal-host'); if(!h){h=document.createElement('div');h.id='modal-host';document.body.appendChild(h);} return h; }
  function close(){ host().innerHTML=''; }

  // ---- daily streak ----
  function touchStreak() {
    const today = new Date().toISOString().slice(0,10);
    const last = localStorage.getItem('tl_streak_day');
    let n = parseInt(localStorage.getItem('tl_streak')||'0',10) || 0;
    if (last === today) return n;
    const y = new Date(Date.now()-86400000).toISOString().slice(0,10);
    n = (last === y) ? n+1 : 1;
    localStorage.setItem('tl_streak', String(n));
    localStorage.setItem('tl_streak_day', today);
    return n;
  }
  function streak(){ return parseInt(localStorage.getItem('tl_streak')||'0',10) || 0; }

  // ---- metrics snapshot ----
  function metrics() {
    const tacs = TL.store.loadAll().filter(t=>!t.demo);
    const matches = TL.store.loadMatches();
    const played = matches.filter(m=>m.played);
    return {
      tactics: tacs.length,
      padel: tacs.filter(t=>t.sport==='padel').length,
      matches: played.length,
      wins: played.filter(m=>m.outcome==='win').length,
      rivals: TL.store.loadRivals().length,
      streak: streak(),
      shared: parseInt(localStorage.getItem('tl_shared_count')||'0',10)||0,
      invited: parseInt(localStorage.getItem('tl_invited_count')||'0',10)||0,
    };
  }

  // ---- achievement catalog (días = recompensa Premium) ----
  // id estable (no cambiar), emoji, días, y meta(m)->{done, cur, target}
  const ACH = [
    { id:'first_tactic', emoji:'🎾', days:1,  goal:1,   metric:'tactics' },
    { id:'five_tactics', emoji:'📐', days:2,  goal:5,   metric:'tactics' },
    { id:'first_padel',  emoji:'🥎', days:2,  goal:1,   metric:'padel' },
    { id:'first_match',  emoji:'📋', days:1,  goal:1,   metric:'matches' },
    { id:'ten_matches',  emoji:'🏆', days:7,  goal:10,  metric:'matches' },
    { id:'five_wins',    emoji:'🔥', days:3,  goal:5,   metric:'wins' },
    { id:'three_rivals', emoji:'🕵️', days:2,  goal:3,   metric:'rivals' },
    { id:'streak3',      emoji:'📅', days:2,  goal:3,   metric:'streak' },
    { id:'streak7',      emoji:'⚡', days:5,  goal:7,   metric:'streak' },
    { id:'share5',       emoji:'📣', days:3,  goal:5,   metric:'shared' },
    { id:'invite10',     emoji:'🎁', days:30, goal:10,  metric:'invited' },
  ];

  function readClaimed() {
    try { return JSON.parse(localStorage.getItem(CLAIMED) || '{}') || {}; } catch (e) { return {}; }
  }

  function state() {
    const m = metrics();
    const claimed = readClaimed();
    return ACH.map(a => {
      const cur = Math.min(m[a.metric]||0, a.goal);
      return { ...a, cur, target:a.goal, done: (m[a.metric]||0) >= a.goal, claimed: !!claimed[a.id], pct: Math.round(cur/a.goal*100) };
    });
  }

  // detect newly-completed achievements, grant premium days, notify
  function check(silent) {
    if (!TL.premium || !TL.premium.grantDays) return;
    const claimed = readClaimed();
    const m = metrics();
    const justUnlocked = [];
    ACH.forEach(a => {
      if (!claimed[a.id] && (m[a.metric]||0) >= a.goal) {
        claimed[a.id] = Date.now();
        // los logros son solo medallas (no regalan Premium)
        justUnlocked.push(a);
      }
    });
    if (justUnlocked.length) {
      localStorage.setItem(CLAIMED, JSON.stringify(claimed));
      if (!silent) justUnlocked.forEach((a,i)=> setTimeout(()=>celebrate(a), i*1400));
      if (TL.app && TL.app.renderTopbar) TL.app.renderTopbar();
    }
    return justUnlocked;
  }

  // animated unlock toast
  function celebrate(a) {
    const en = TL.i18n.lang === 'en';
    const el = document.createElement('div');
    el.className = 'ach-pop';
    el.innerHTML = `
      <div class="ach-pop-card">
        <div class="ach-pop-emoji">${a.emoji}</div>
        <div class="ach-pop-tx">
          <span class="ach-pop-k">${en?'Achievement unlocked':'¡Logro desbloqueado!'}</span>
          <b>${t('ach_'+a.id)}</b>
          <span class="ach-pop-reward">${en?'Medal earned':'Medalla conseguida'} 🎖️</span>
        </div>
      </div>`;
    document.body.appendChild(el);
    if (TL.anim && TL.anim.hitSound) try { TL.anim.hitSound(1); } catch(e){}
    requestAnimationFrame(()=>el.classList.add('in'));
    setTimeout(()=>{ el.classList.remove('in'); setTimeout(()=>el.remove(), 400); }, 3600);
  }

  // ---- achievements panel ----
  function panel() {
    const en = TL.i18n.lang === 'en';
    const list = state();
    const earned = list.filter(a=>a.claimed).length;
    const stk = streak();
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal modal-lg ach-modal">
      <div class="modal-head"><div><h2>${en?'Achievements':'Logros'}</h2><p class="modal-sub">${en?'Complete challenges and unlock medals.':'Completa retos y desbloquea medallas.'}</p></div><button class="x" id="mx">${ic.x}</button></div>
      <div class="modal-body">
        <div class="ach-summary">
          <div class="ach-sum-box"><b>${earned}/${list.length}</b><span>${en?'unlocked':'desbloqueados'}</span></div>
          <div class="ach-sum-box on"><b>${earned}</b><span>${en?'medals':'medallas'}</span></div>
          <div class="ach-sum-box"><b>${stk}</b><span>${en?'day streak':'racha (días)'}</span></div>
        </div>
        <div class="ach-grid">
          ${list.map(a=>`
            <div class="ach-card ${a.claimed?'done':''}">
              <div class="ach-emoji">${a.emoji}</div>
              <div class="ach-info">
                <b>${t('ach_'+a.id)}</b>
                <span>${t('ach_'+a.id+'_d')}</span>
                <div class="ach-bar"><i style="width:${a.pct}%"></i></div>
                <span class="ach-prog">${a.cur}/${a.target}</span>
              </div>
              <div class="ach-reward ${a.claimed?'got':''}">${a.claimed?ic.check:'🎖️'}</div>
            </div>`).join('')}
        </div>
      </div>
    </div></div>`;
    const h = host();
    h.querySelector('#mx').onclick = close;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') close(); };
  }

  // call after meaningful actions
  function bump(){ check(false); }

  TL.achievements = { check, panel, bump, touchStreak, streak, state, metrics, celebrate };
})(window.TL = window.TL || {});
