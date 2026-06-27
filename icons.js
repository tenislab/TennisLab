/* ============================================================
   heatmap.js — auto "attack map" derived from a rival's scouting fields.
   No new input: reads hand + best + weak + style + notes and infers
   where to attack (hot / red) and what to avoid (cold / blue), plus a
   one-line plan. Renders a clean schematic half-court (the rival's box).
   ============================================================ */
(function (TL) {
  const C = TL.court;

  function norm(s){ return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  function has(t, arr){ return arr.some(w => t.includes(w)); }

  const KW = {
    bh:   ['reves','backhand','dos manos','two hand','revs','bandeja reves'],
    fh:   ['derecha','forehand','drive','liftada'],
    net:  ['volea','volley','red','dejada','drop','bandeja','vibora','remate corto','aproxim','subir','arriba','net'],
    deep: ['fondo','profundidad','globo','passing','defensa','defiend','pasa','lob','desde atras','baselin'],
    move: ['movilidad','velocidad','piernas','lateral','fisic','condicion','lento','desplaz','reflejos','agilidad','resistencia'],
  };

  // ---- infer signals from the text fields ---------------------------------
  function signals(r) {
    const H = 0.75;
    const sig   = { bh:0, fh:0, net:0, deep:0, move:0 };
    const avoid = { bh:0, fh:0, net:0, deep:0 };

    const w = norm(r.weak);
    if (w) {
      if (has(w,KW.bh))   sig.bh  += H;
      if (has(w,KW.fh))   sig.fh  += H;
      if (has(w,KW.net))  sig.net += H;
      if (has(w,KW.move)) sig.move+= H;
      if (has(w,KW.deep)) sig.deep+= H*0.8;
    }
    const b = norm(r.best);
    if (b) {
      if (has(b,KW.fh))   avoid.fh += H;
      if (has(b,KW.bh))   avoid.bh += H;
      if (has(b,KW.net)) { avoid.net += H; sig.deep += H*0.6; } // strong at net → keep deep
      if (has(b,KW.deep)){ avoid.deep += H; sig.net += H*0.6; } // strong defending → bring in
    }
    const st = norm(r.style) + ' ' + norm(r.notes);
    if (st.trim()) {
      const defensive  = has(st,['defensiv','contra','paredista','regular','consist','constante','counter','baselin','pelotea','fondo']);
      const aggressive = has(st,['agresiv','ataque','saque y red','saque-red','serve and volley','voleador','neto','attack','aggressive','remat','pegador']);
      if (defensive)  { sig.net += 0.7; sig.move += 0.3; }
      if (aggressive) { sig.deep += 0.7; avoid.net += 0.5; }
      if (has(st,['completo','all court','allcourt'])) sig.move += 0.4;
      if (has(st,KW.move)) sig.move += 0.5;
    }
    const any = !!(r.weak||r.best||r.style||r.notes);
    return { sig, avoid, any };
  }

  // ---- 3×3 attack grid over the rival's half ------------------------------
  function grid(r) {
    const { sig, avoid, any } = signals(r);
    const bhCol = r.hand === 'left' ? 0 : 2;
    const fhCol = r.hand === 'left' ? 2 : 0;
    const cells = [];
    let maxAbs = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        let s = 0;
        if (col === bhCol) s += sig.bh - avoid.bh;
        if (col === fhCol) s += sig.fh - avoid.fh;
        if (col !== 1) s += sig.move * 0.6; else s -= sig.move * 0.18;
        if (row === 0) s += sig.deep - avoid.deep;     // deep (far baseline)
        if (row === 2) s += sig.net  - avoid.net;      // short / net
        if (row === 1) s += (sig.deep + sig.net) * 0.12;
        cells.push({ col, row, raw: s });
        maxAbs = Math.max(maxAbs, Math.abs(s));
      }
    }
    const div = Math.max(0.75, maxAbs);
    cells.forEach(c => c.n = Math.max(-1, Math.min(1, c.raw / div)));
    let hot = null, cold = null;
    cells.forEach(c => {
      if (c.n > 0.15 && (!hot || c.n > hot.n)) hot = c;
      if (c.n < -0.22 && (!cold || c.n < cold.n)) cold = c;
    });
    return { cells, hot, cold, sig, avoid, any };
  }

  // ---- one-line plan ------------------------------------------------------
  function plan(r, g) {
    const en = TL.i18n.lang === 'en';
    g = g || grid(r);
    const { sig, avoid, any } = g;
    if (!any) return { text: en ? 'Add a strength, weakness or style and the attack plan writes itself.'
                                : 'Añade golpe fuerte, débil o estilo y el plan de ataque se escribe solo.', empty: true };
    const P = en ? {
      bh:['Hammer the backhand','hammer the backhand'], fh:['Attack the forehand','go at the forehand'],
      net:['Drag them to the net with drops','bring them in with drops'],
      deep:['Pin them at the baseline','pin them deep'], move:['Move them side to side','run them corner to corner'],
    } : {
      bh:['Castiga su revés','castiga el revés'], fh:['Ataca su derecha','ataca la derecha'],
      net:['Hazle subir con dejadas','hazle subir a la red'],
      deep:['Profundiza y empújalo al fondo','empújalo al fondo'], move:['Muévelo de lado a lado','muévelo de lado a lado'],
    };
    const AV = en ? { fh:'Avoid the forehand', bh:'Avoid the backhand', net:'don’t feed the net', deep:'don’t get dragged into long rallies' }
                  : { fh:'evita su derecha', bh:'evita su revés', net:'no le des bolas cortas', deep:'no pelotees largo con él' };
    const cand = [
      { k:'bh', v: sig.bh - avoid.bh*0.5 }, { k:'fh', v: sig.fh - avoid.fh*0.5 },
      { k:'net', v: sig.net }, { k:'deep', v: sig.deep }, { k:'move', v: sig.move },
    ].filter(c => c.v > 0.25).sort((a,b) => b.v - a.v);
    const av = [
      { k:'fh', v: avoid.fh }, { k:'bh', v: avoid.bh }, { k:'net', v: avoid.net }, { k:'deep', v: avoid.deep },
    ].filter(x => x.v > 0.5).sort((a,b) => b.v - a.v);

    let text;
    if (!cand.length) {
      text = av.length ? (AV[av[0].k].charAt(0).toUpperCase() + AV[av[0].k].slice(1) + '.')
                       : (en ? 'Play a balanced, patient game.' : 'Juego paciente y equilibrado.');
      return { text, empty:false };
    }
    text = P[cand[0].k][0];
    if (cand[1]) text += (en ? ' and ' : ' y ') + P[cand[1].k][1];
    text += '.';
    if (av.length) text += ' ' + AV[av[0].k].charAt(0).toUpperCase() + AV[av[0].k].slice(1) + '.';
    return { text, empty:false };
  }

  // =========================================================================
  // DOUBLES brain (padel + pickleball): you scout a PAIR, not one player.
  // Targets are doubles concepts — the weaker player, the middle gap, a lob
  // over their heads, or low balls at their feet / into the kitchen.
  // =========================================================================
  const DKW = {
    mid:  ['centro','medio','middle','gap','hueco','entre','cruce','comunic','quien la da','dejan el medio'],
    lob:  ['globo','lob','fondo','profund','espalda','por encima','cabeza','remate flojo','smash flojo','bajitos','bajos','altura','mal de pared','sale mal'],
    feet: ['pies','feet','dejada','drop','dink','volea floja','volea baja','red floja','bajo','corta','cocina','kitchen','reaccion','manos'],
    wall: ['pared','cristal','salida de pared','wall','contrapared'],
    slow: ['lento','slow','movilidad','reflejos','tarda','pesado','condicion','fisic','cansa'],
  };

  function signalsDoubles(r) {
    const H = 0.75;
    const sig = { mid:0, lob:0, feet:0 };
    const avoid = { lob:0, feet:0 };
    const side0 = r.weakSide || 'even';
    const wSrc = side0==='left' ? (r.p1weak||'') : side0==='right' ? (r.p2weak||'') : ((r.p1weak||'')+' '+(r.p2weak||''));
    const bSrc = side0==='left' ? (r.p1best||'') : side0==='right' ? (r.p2best||'') : ((r.p1best||'')+' '+(r.p2best||''));
    const w = norm(wSrc || r.weak);
    if (w) {
      if (has(w,DKW.mid))  sig.mid  += H;
      if (has(w,DKW.lob))  sig.lob  += H;
      if (has(w,DKW.feet)) sig.feet += H;
      if (has(w,DKW.wall)) sig.lob  += H * 0.7;          // bad off the back glass → lob deep
      if (has(w,DKW.slow)) { sig.mid += 0.35; sig.feet += 0.3; }
    }
    const b = norm(bSrc || r.best);
    if (b) {
      if (has(b,['remate','smash','globo','bandeja','vibora','overhead']))                    avoid.lob  += H;  // strong overheads → don't lob
      if (has(b,['volea','volley','red','net','dejada','drop','dink','manos','reflejos','pared'])) avoid.feet += H;  // strong hands/net → don't feed the net
    }
    const st = norm(r.style) + ' ' + norm(r.notes);
    if (st.trim()) {
      if (has(st,['agresiv','red','net','sube','arriba','remat','voleador','ataque','aggressive','attack'])) sig.lob += 0.6;   // crowd the net → lob them
      if (has(st,['defensiv','fondo','paredista','espera','baselin','contra','regular','consist'])) sig.feet += 0.6;          // sit back → bring them in / dink
    }
    const any = !!(r.p1weak || r.p2weak || r.p1best || r.p2best || r.weak || r.best || r.style || r.notes || (r.weakSide && r.weakSide !== 'even'));
    return { sig, avoid, any };
  }

  function gridDoubles(r) {
    const { sig, avoid, any } = signalsDoubles(r);
    const side = r.weakSide || 'even';
    const wcol = side === 'left' ? 0 : side === 'right' ? 2 : 1;
    const cells = []; let maxAbs = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        let s = 0;
        if (col === wcol) s += 0.7;                       // the weaker player / chosen side
        if (col === 1) s += sig.mid * 0.9 + 0.12;         // the middle gap is always a little tempting
        if (col !== 1 && col !== wcol) s -= 0.12;
        if (row === 0) s += sig.lob - avoid.lob;          // deep = lob over their heads
        if (row === 2) s += sig.feet - avoid.feet;        // short = feet / kitchen / drop
        if (row === 1) s += (sig.lob + sig.feet) * 0.1;
        cells.push({ col, row, raw: s });
        maxAbs = Math.max(maxAbs, Math.abs(s));
      }
    }
    const div = Math.max(0.75, maxAbs);
    cells.forEach(c => c.n = Math.max(-1, Math.min(1, c.raw / div)));
    let hot = null, cold = null;
    cells.forEach(c => {
      if (c.n > 0.15 && (!hot || c.n > hot.n)) hot = c;
      if (c.n < -0.22 && (!cold || c.n < cold.n)) cold = c;
    });
    return { cells, hot, cold, sig, avoid, any, side };
  }

  function planDoubles(r, g) {
    const en = TL.i18n.lang === 'en';
    g = g || gridDoubles(r);
    const { sig, avoid, any, side } = g;
    const pickle = r.sport === 'pickle';
    if (!any) return { text: en ? 'Mark the weaker side and a pair weakness — the plan writes itself.'
                                : 'Marca el lado más flojo y un punto débil de la pareja y el plan se escribe solo.', empty: true };
    const sent = [];
    if (side === 'left')  sent.push(r.p1name ? (en?`Attack ${r.p1name}.`:`Ataca a ${r.p1name}.`) : (en ? 'Attack the left player (R1).'  : 'Ataca al jugador de la izquierda (R1).'));
    else if (side === 'right') sent.push(r.p2name ? (en?`Attack ${r.p2name}.`:`Ataca a ${r.p2name}.`) : (en ? 'Attack the right player (R2).' : 'Ataca al jugador de la derecha (R2).'));
    const Z = en
      ? { mid:'play through the middle to sow doubt', lob:'lob deep over their heads', feet: pickle ? 'keep it low at their feet' : 'hit low at their feet' }
      : { mid:'juega al centro para crear duda', lob:'globo profundo por encima de ellos', feet: pickle ? 'bolas bajas a los pies' : 'bolas bajas a los pies' };
    const zones = [{ k:'mid', v:sig.mid }, { k:'lob', v:sig.lob - avoid.lob }, { k:'feet', v:sig.feet - avoid.feet }].sort((a,b) => b.v - a.v);
    const top = (zones[0] && zones[0].v > 0.25) ? zones[0].k : 'mid';
    const net = pickle ? (en ? 'take the kitchen line' : 'toma la línea de cocina') : (en ? 'take the net' : 'toma la red');
    let how = Z[top] + (en ? ', then ' : ', y ') + net + '.';
    how = how.charAt(0).toUpperCase() + how.slice(1);
    sent.push(how);
    let text = sent.join(' ');
    if (avoid.lob > 0.5)  text += en ? ' Don’t lob — strong smashes.' : ' No globees: rematan bien.';
    else if (avoid.feet > 0.5) text += en ? ' Avoid feeding their volleys.' : ' No le des bolas cómodas de volea.';
    return { text, empty: false };
  }

  function isDoubles(r) { return r && (r.sport === 'padel' || r.sport === 'pickle'); }
  function gridFor(r) { return isDoubles(r) ? gridDoubles(r) : grid(r); }
  function planFor(r, g) { return isDoubles(r) ? planDoubles(r, g) : plan(r, g); }

  // ---- schematic half-court + heat overlay --------------------------------
  function courtLines(sport) {
    const lc = 'rgba(238,232,222,.5)', lw = 0.1;
    const ln = (x1,y1,x2,y2,w,o) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${lc}" stroke-width="${w||lw}" opacity="${o||1}" stroke-linecap="round"/>`;
    let g = '';
    if (sport === 'pickle') {
      const { kLeft, kRight, kTop, net, kKitTop, cx } = C;
      g += `<rect x="${kLeft}" y="${kTop}" width="${kRight-kLeft}" height="${net-kTop}" fill="rgba(255,255,255,.035)"/>`;
      g += ln(kLeft,kTop,kRight,kTop) + ln(kLeft,kTop,kLeft,net) + ln(kRight,kTop,kRight,net);
      g += ln(kLeft,kKitTop,kRight,kKitTop) + ln(cx,kTop,cx,kKitTop);
      g += ln(kLeft-0.4,net,kRight+0.4,net,0.18);
    } else if (sport === 'padel') {
      const { pLeft, pRight, pTop, net, pSvcTop, cx } = C;
      g += `<rect x="${pLeft}" y="${pTop}" width="${pRight-pLeft}" height="${net-pTop}" fill="rgba(255,255,255,.035)"/>`;
      g += ln(pLeft,pTop,pRight,pTop) + ln(pLeft,pTop,pLeft,net) + ln(pRight,pTop,pRight,net);
      g += ln(pLeft,pSvcTop,pRight,pSvcTop) + ln(cx,pSvcTop,cx,net);
      g += ln(pLeft-0.55,net,pRight+0.55,net,0.18);
    } else {
      const { sLeft, sRight, cTop, net, svcTop, cx } = C;
      g += `<rect x="${sLeft}" y="${cTop}" width="${sRight-sLeft}" height="${net-cTop}" fill="rgba(255,255,255,.035)"/>`;
      g += ln(sLeft,cTop,sRight,cTop) + ln(sLeft,cTop,sLeft,net) + ln(sRight,cTop,sRight,net);
      g += ln(sLeft,svcTop,sRight,svcTop) + ln(cx,svcTop,cx,net);
      g += ln(cx,cTop,cx,cTop+0.35);
      g += ln(C.cLeft-0.5,net,C.cRight+0.5,net,0.18);
    }
    return g;
  }

  function box(sport) {
    if (sport === 'pickle') return { x0:C.kLeft, x1:C.kRight, y0:C.kTop, y1:C.net };
    if (sport === 'padel') return { x0:C.pLeft, x1:C.pRight, y0:C.pTop, y1:C.net };
    return { x0:C.sLeft, x1:C.sRight, y0:C.cTop, y1:C.net };
  }
  function viewBox(sport) {
    if (sport === 'pickle') return `${C.kLeft-1.0} ${C.kTop-1.0} ${C.KW+2.0} ${(C.net-C.kTop)+1.7}`;
    if (sport === 'padel') return `${C.pLeft-1.0} ${C.pTop-1.0} ${C.PW+2.0} ${(C.net-C.pTop)+1.7}`;
    const w = (C.sRight-C.sLeft);
    return `${C.sLeft-1.3} ${C.cTop-1.0} ${w+2.6} ${(C.net-C.cTop)+1.7}`;
  }

  function svg(r) {
    const sport = r.sport === 'padel' ? 'padel' : r.sport === 'pickle' ? 'pickle' : 'tennis';
    const g = gridFor(r);
    const bx = box(sport);
    const cw = (bx.x1-bx.x0)/3, ch = (bx.y1-bx.y0)/3;
    const rad = Math.max(cw, ch) * 0.64;
    let heat = '';
    g.cells.forEach(c => {
      if (Math.abs(c.n) < 0.07) return;
      const x = bx.x0 + (c.col+0.5)*cw, y = bx.y0 + (c.row+0.5)*ch;
      const hot = c.n > 0;
      const col = hot ? '#FF5237' : '#37A2FF';
      const op = hot ? (0.16 + 0.5*c.n) : (0.12 + 0.34*Math.abs(c.n));
      heat += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${rad.toFixed(2)}" fill="${col}" opacity="${op.toFixed(2)}"/>`;
    });
    let reticle = '';
    if (g.hot) {
      const x = bx.x0 + (g.hot.col+0.5)*cw, y = bx.y0 + (g.hot.row+0.5)*ch, R = 1.05;
      reticle = `<g opacity=".96">
        <circle cx="${x}" cy="${y}" r="${R}" fill="none" stroke="#fff" stroke-width="0.13"/>
        <line x1="${x-R-0.25}" y1="${y}" x2="${x-R+0.3}" y2="${y}" stroke="#fff" stroke-width="0.12" stroke-linecap="round"/>
        <line x1="${x+R-0.3}" y1="${y}" x2="${x+R+0.25}" y2="${y}" stroke="#fff" stroke-width="0.12" stroke-linecap="round"/>
        <line x1="${x}" y1="${y-R-0.25}" x2="${x}" y2="${y-R+0.3}" stroke="#fff" stroke-width="0.12" stroke-linecap="round"/>
        <line x1="${x}" y1="${y+R-0.3}" x2="${x}" y2="${y+R+0.25}" stroke="#fff" stroke-width="0.12" stroke-linecap="round"/>
        <circle cx="${x}" cy="${y}" r="0.3" fill="#fff"/>
      </g>`;
    }
    // doubles: show BOTH opponents as a pair, ringing the weaker one in gold
    let markers = '';
    if (sport === 'padel' || sport === 'pickle') {
      const lx = bx.x0 + (bx.x1 - bx.x0) * 0.30, rx = bx.x0 + (bx.x1 - bx.x0) * 0.70;
      const py = bx.y0 + (bx.y1 - bx.y0) * (sport === 'pickle' ? 0.74 : 0.60);
      const side = r.weakSide || 'even';
      const mk = (x, label, weak) => `<g>
        ${weak ? `<circle cx="${x}" cy="${py}" r="1.5" fill="none" stroke="#FFD84D" stroke-width="0.16" opacity=".95"/>` : ''}
        <circle cx="${x}" cy="${py}" r="${weak ? 1.12 : 0.92}" fill="#FF5B5B" stroke="rgba(0,0,0,.5)" stroke-width="0.14" opacity="${weak ? 1 : 0.82}"/>
        <text x="${x}" y="${(py + 0.34).toFixed(2)}" font-size="0.95" font-weight="800" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">${label}</text>
      </g>`;
      markers = mk(lx, 'R1', side === 'left') + mk(rx, 'R2', side === 'right');
    }
    const fid = 'hb' + (sport==='padel'?'p':sport==='pickle'?'k':'t');
    return `<svg viewBox="${viewBox(sport)}" preserveAspectRatio="xMidYMid meet" class="amap-svg" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="${fid}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="0.82"/></filter></defs>
      <rect x="-2" y="-2" width="${C.TOTAL_W+4}" height="${C.TOTAL_H+4}" fill="#15120F"/>
      <g filter="url(#${fid})">${heat}</g>
      ${courtLines(sport)}
      ${reticle}
      ${markers}
    </svg>`;
  }

  // public: everything the UI needs in one call
  function analyze(r) {
    const g = gridFor(r);
    return { svg: svg(r), plan: planFor(r, g), hasSignal: g.any, hot: g.hot, cold: g.cold };
  }

  TL.heatmap = { analyze, svg, plan, grid };
})(window.TL = window.TL || {});
