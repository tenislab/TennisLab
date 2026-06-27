/* ============================================================
   proplays.js — Pro plays library (curated tactics, free + premium)
   ------------------------------------------------------------
   A browsable gallery of ready-made, coach-grade plays. Free plays
   open for anyone; PRO plays require Premium (soft paywall).
   Reuses the template generators in store.js so the plays are real,
   multi-step animated tactics — not stubs.
   ============================================================ */
(function (TL) {
  const t = (k) => TL.i18n.t(k);
  const C = TL.court, ic = TL.icon;
  const esc = (s) => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function host(){ let h=document.getElementById('modal-host'); if(!h){h=document.createElement('div');h.id='modal-host';document.body.appendChild(h);} return h; }
  function close(){ host().innerHTML=''; }

  // catalog: maps a template kind → metadata. tip is a one-line coaching cue.
  function catalog(sport) {
    const en = TL.i18n.lang === 'en';
    if (sport === 'padel') return [
      { k:'p_saque',   gen:()=>TL.store.templatePadel('p_saque'),   pro:false, level:'beg',
        tip: en?'Serve and step in together to take the net as a pair.':'Saca y subid juntos a tomar la red en pareja.' },
      { k:'p_bandeja', gen:()=>TL.store.templatePadel('p_bandeja'), pro:false, level:'int',
        tip: en?'The bandeja keeps you at the net and buys time to recover position.':'La bandeja te mantiene en la red y te da tiempo a recolocarte.' },
      { k:'p_vibora',  gen:()=>TL.store.templatePadel('p_vibora'),  pro:true,  level:'int',
        tip: en?'Snap the víbora to the side glass to pull them wide, then close.':'Víbora a la pared lateral para abrirlos y cierras la red.' },
      { k:'p_globo',   gen:()=>TL.store.templatePadel('p_globo'),   pro:true,  level:'adv',
        tip: en?'Lob to push them back, then steal the net behind it.':'Globo para echarlos atrás y robar la red detrás de él.' },
      { k:'p_contrapared', gen:()=>TL.store.templatePadel('p_contrapared'), pro:true, level:'adv',
        tip: en?'Let the smash run to the back glass and reset with a deep lob.':'Deja correr el remate a la pared y reinicia con un globo.' },
      { k:'p_chiquita', gen:()=>TL.store.templatePadel('p_chiquita'), pro:true, level:'adv',
        tip: en?'Low chiquita at their feet forces a weak volley to attack.':'Chiquita baja a los pies fuerza una volea floja para atacar.' },
    ];
    if (sport === 'pickle') return [
      { k:'k_drop',  gen:()=>TL.store.templatePickle('k_drop'),  pro:false, level:'beg',
        tip: en?'Soft third-shot drop into the kitchen, then move up together to the line.':'Tercer golpe drop suave a la cocina y subid juntos a la línea.' },
      { k:'k_drive', gen:()=>TL.store.templatePickle('k_drive'), pro:false, level:'int',
        tip: en?'Drive the third hard at their feet and crash the net behind it.':'Drive duro a los pies en el tercer golpe y cierra la red detrás.' },
      { k:'k_dink',  gen:()=>TL.store.templatePickle('k_dink'),  pro:true,  level:'adv',
        tip: en?'Patient cross-court dinks, then speed up at the body to force the pop-up.':'Dinks cruzados con paciencia y acelera al cuerpo para forzar la bola alta.' },
      { k:'k_lob',   gen:()=>TL.store.templatePickle('k_lob'),   pro:true,  level:'int',
        tip: en?'Lob over the net player, push them back, then take the line.':'Globo sobre el jugador de red, échalos atrás y toma la línea.' },
      { k:'k_reset', gen:()=>TL.store.templatePickle('k_reset'), pro:true,  level:'int',
        tip: en?'Soft-block a hard drive into the kitchen to neutralise and reset.':'Bloquea suave el ataque a la cocina para neutralizar y reiniciar.' },
      { k:'k_poach', gen:()=>TL.store.templatePickle('k_poach'), pro:true,  level:'adv',
        tip: en?'Read the cross-court dink and poach with the net player to finish.':'Lee el dink cruzado e intercepta con el jugador de red para definir.' },
    ];
    return [
      { k:'serve_volley', gen:()=>TL.store.templateTactic('serve_volley'), pro:false, level:'int',
        tip: en?'Serve wide to open the court, then close fast for the volley.':'Saca abierto para abrir pista y cierra rápido a la volea.' },
      { k:'return',       gen:()=>TL.store.templateTactic('return'),       pro:false, level:'beg',
        tip: en?'Take the return early and deep to steal the initiative.':'Resta temprano y profundo para robar la iniciativa.' },
      { k:'baseline',     gen:()=>TL.store.templateTactic('baseline'),     pro:false, level:'beg',
        tip: en?'Build cross-court, then change down the line into space.':'Construye cruzado y cambia paralelo al espacio libre.' },
      { k:'serve_plus1',  gen:()=>TL.store.templateTactic('serve_plus1'),  pro:true,  level:'int',
        tip: en?'Serve wide, then hammer the forehand +1 into the open court.':'Saca abierto y pega la derecha +1 al hueco abierto.' },
      { k:'inside_out',   gen:()=>TL.store.templateTactic('inside_out'),   pro:true,  level:'int',
        tip: en?'Run around the backhand to dominate with the forehand.':'Córrete el revés para mandar con la derecha invertida.' },
      { k:'kick_approach',gen:()=>TL.store.templateTactic('kick_approach'),pro:true,  level:'adv',
        tip: en?'Heavy kick serve, follow it in, finish at the net.':'Saque liftado pesado, sube detrás y define en la red.' },
      { k:'counter',      gen:()=>TL.store.templateTactic('counter'),      pro:true,  level:'int',
        tip: en?'Defend deep, wait for the short ball, then strike.':'Defiende profundo, espera la bola corta y golpea.' },
      { k:'drop',         gen:()=>TL.store.templateTactic('drop'),         pro:true,  level:'adv',
        tip: en?'Disguise the drop, then pass behind a stranded rival.':'Disfraza la dejada y pasa por detrás del rival descolocado.' },
      { k:'defense',      gen:()=>TL.store.templateTactic('defense'),      pro:true,  level:'adv',
        tip: en?'Lob over the net-rusher and reset the point on your terms.':'Globo sobre el que sube y reinicia el punto a tu favor.' },
    ];
  }

  function levelLabel(lv) {
    const en = TL.i18n.lang === 'en';
    return lv==='beg' ? (en?'Beginner':'Iniciación') : lv==='int' ? (en?'Intermediate':'Intermedio') : (en?'Advanced':'Avanzado');
  }

  function thumb(tac) {
    return C.playThumb(tac);
  }

  function open(sport) {
    sport = sport || (TL.extras && TL.extras.sportPref && TL.extras.sportPref()) || 'tennis';
    const en = TL.i18n.lang === 'en';
    const premium = !(TL.premium) || TL.premium.isPremium();
    const defs = catalog(sport).map(d => ({ ...d, tac: d.gen() }));
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal modal-lg pro-modal">
      <div class="modal-head">
        <div><div class="kicker">${en?'PRO PLAYS':'JUGADAS PRO'}</div><h2>${en?'Plays from the pros':'Jugadas de profesionales'}</h2>
          <p class="modal-sub">${en?'Ready-made, animated tactics. Open one and tweak it as your own.':'Tácticas animadas listas para usar. Ábrelas y adáptalas a tu juego.'}</p></div>
        <button class="x" id="mx">${ic.x}</button>
      </div>
      <div class="modal-body">
        <div class="sport-tabs">
          <button class="sport-tab ${sport==='tennis'?'on':''}" data-sport="tennis">🎾 ${t('sport_tennis')}</button>
          <button class="sport-tab ${sport==='padel'?'on':''}" data-sport="padel">🥎 ${t('sport_padel')}</button>
          <button class="sport-tab ${sport==='pickle'?'on':''}" data-sport="pickle">🏓 ${t('sport_pickle')}</button>
        </div>
        ${!premium ? `<div class="pro-banner">${ic.star}<span>${en?'Free plays open for everyone. Plays marked PRO unlock with Premium.':'Las jugadas gratis son para todos. Las marcadas PRO se desbloquean con Premium.'}</span></div>` : ''}
        <div class="pro-grid">
          ${defs.map(d=>`
            <div class="pro-card ${d.pro && !premium ? 'locked' : ''}" data-k="${d.k}">
              <div class="pro-thumb">${thumb(d.tac)}
                <span class="pro-badge ${d.pro?'pro':'free'}">${d.pro?(en?'PRO':'PRO'):(en?'FREE':'GRATIS')}</span>
                ${d.pro && !premium ? `<span class="pro-lock">${ic.lock||'🔒'}</span>` : ''}
              </div>
              <div class="pro-tx">
                <div class="pro-tt"><b>${esc(d.tac.name)}</b><span class="pro-lvl">${levelLabel(d.level)}</span></div>
                <p class="pro-tip">${ic.bolt}${esc(d.tip)}</p>
                <div class="pro-meta">
                  <span>${t('surf_'+d.tac.surface)}</span><i>·</i><span>${d.tac.steps.length-1} ${en?'shots':'golpes'}</span>
                </div>
              </div>
              <div class="pro-act">
                <button class="btn btn-line btn-sm pa-watch">${ic.play}${en?'Watch':'Ver'}</button>
                <button class="btn btn-primary btn-sm pa-use">${d.pro && !premium ? (ic.star+(en?'Unlock':'Desbloquear')) : (ic.plus+(en?'Use it':'Usarla'))}</button>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div></div>`;
    const h = host();
    h.querySelector('#mx').onclick = close;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') close(); };
    h.querySelectorAll('.sport-tab').forEach(b => b.onclick = () => { if (b.dataset.sport !== sport) open(b.dataset.sport); });
    defs.forEach(d => {
      const card = h.querySelector(`.pro-card[data-k="${d.k}"]`);
      if (!card) return;
      card.querySelector('.pa-watch').onclick = () => { close(); TL.editor.open(d.gen(), { viewer:true }); };
      card.querySelector('.pa-use').onclick = () => {
        if (d.pro && !premium) { close(); TL.premium.upgrade('proplay'); return; }
        const tac = d.gen();
        tac.id = TL.store.uid(); tac.createdAt = tac.updatedAt = Date.now();
        close();
        TL.editor.open(tac, {});
        TL.app.toast(en?'Loaded — tweak and save it':'Cargada — ajústala y guárdala', true);
      };
    });
  }

  TL.proplays = { open, catalog };
})(window.TL = window.TL || {});
