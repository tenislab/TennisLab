/* ============================================================
   court.js — tennis court geometry + SVG rendering
   Coordinate space is in METRES, court drawn vertically
   (baselines top & bottom, net horizontal in the middle).
   Everything in the app stores positions in these metre units.
   ============================================================ */
(function (TL) {
  // real ITF dimensions (metres)
  const L = 23.77;            // baseline to baseline
  const W = 10.97;            // doubles width
  const ALLEY = 1.37;         // doubles alley
  const SVC = 6.40;           // net to service line
  const MX = 3.0, MY = 3.4;   // out-of-bounds margin around the court

  const TOTAL_W = W + MX * 2; // 16.97
  const TOTAL_H = L + MY * 2; // 30.57

  // key lines (metres, origin at top-left of the whole play area)
  const cLeft = MX;                 // doubles sideline L
  const cRight = MX + W;            // doubles sideline R
  const cTop = MY;                  // far baseline
  const cBot = MY + L;              // near baseline
  const net = MY + L / 2;           // net line
  const svcTop = net - SVC;
  const svcBot = net + SVC;
  const sLeft = cLeft + ALLEY;      // singles sideline L
  const sRight = cRight - ALLEY;    // singles sideline R
  const cx = MX + W / 2;            // centre x

  const SURF = {
    clay:   { out:'#A8512E', in:'#C4663E', line:'#F2E6DC' },
    hard:   { out:'#235B95', in:'#2E72B8', line:'#EAF1F7' },
    grass:  { out:'#316B39', in:'#3F8348', line:'#F0F4ED' },
    indoor: { out:'#3D356E', in:'#5B53A6', line:'#ECE9F7' },
  };

  // ---- PÁDEL geometry (20m x 10m), centred in the same canvas ----
  const PW = 10, PL = 20;            // padel court width / length (m)
  const pLeft  = cx - PW / 2;        // padel sideline L
  const pRight = cx + PW / 2;        // padel sideline R
  const pTop   = net - PL / 2;       // padel back line (far)
  const pBot   = net + PL / 2;       // padel back line (near)
  const pSvc   = 6.95;               // service line distance from net
  const pSvcTop = net - pSvc;
  const pSvcBot = net + pSvc;

  // ---- PICKLEBALL geometry (6.10m x 13.41m), centred in the same canvas ----
  const KW = 6.10, KL = 13.41;       // pickleball court width / length (m)
  const kLeft  = cx - KW / 2;        // pickleball sideline L
  const kRight = cx + KW / 2;        // pickleball sideline R
  const kTop   = net - KL / 2;       // pickleball baseline (far)
  const kBot   = net + KL / 2;       // pickleball baseline (near)
  const kNVZ   = 2.13;               // non-volley zone (kitchen) depth from net
  const kKitTop = net - kNVZ;
  const kKitBot = net + kNVZ;

  // helper: is this a padel tactic?
  function sportOf(sport){ return sport || (TL.state && TL.state.tactic && TL.state.tactic.sport) || 'tennis'; }

  TL.court = {
    L, W, MX, MY, TOTAL_W, TOTAL_H,
    cLeft, cRight, cTop, cBot, net, svcTop, svcBot, sLeft, sRight, cx,
    PW, PL, pLeft, pRight, pTop, pBot, pSvcTop, pSvcBot,
    KW, KL, kLeft, kRight, kTop, kBot, kKitTop, kKitBot,
    SURF,

    // viewBox string for a given view mode
    viewBox(view, sport) {
      if (sportOf(sport) === 'pickle') {
        if (view === 'half') {
          const top = net - 1.3;
          return { x: kLeft-1.4, y: top, w: KW+2.8, h: (kBot-top)+1.5, str: `${kLeft-1.4} ${top} ${KW+2.8} ${(kBot-top)+1.5}` };
        }
        return { x: kLeft-1.5, y: kTop-1.5, w: KW+3.0, h: KL+3.0, str: `${kLeft-1.5} ${kTop-1.5} ${KW+3.0} ${KL+3.0}` };
      }
      if (sportOf(sport) === 'padel') {
        if (view === 'half') {
          const top = net - 1.4;
          return { x: pLeft-1.5, y: top, w: PW+3, h: (pBot-top)+1.6, str: `${pLeft-1.5} ${top} ${PW+3} ${(pBot-top)+1.6}` };
        }
        return { x: pLeft-1.6, y: pTop-1.6, w: PW+3.2, h: PL+3.2, str: `${pLeft-1.6} ${pTop-1.6} ${PW+3.2} ${PL+3.2}` };
      }
      if (view === 'half') {
        // show net → near baseline with a little air
        const top = net - 1.6;
        const h = (cBot - top) + MY;
        return { x: 0, y: top, w: TOTAL_W, h, str: `0 ${top} ${TOTAL_W} ${h}` };
      }
      return { x: 0, y: 0, w: TOTAL_W, h: TOTAL_H, str: `0 0 ${TOTAL_W} ${TOTAL_H}` };
    },

    // PÁDEL court background as an SVG <g> string
    renderPadel(surface) {
      const s = SURF[surface] || SURF.hard;
      const lw = 0.12;
      const ln = `stroke="${s.line}" stroke-width="${lw}" fill="none"`;
      let g = '';
      // dark surround (outside the glass)
      g += `<rect x="0" y="0" width="${TOTAL_W}" height="${TOTAL_H}" fill="#14110E"/>`;
      // glass walls frame (slightly larger than court)
      g += `<rect x="${pLeft-0.55}" y="${pTop-0.55}" width="${PW+1.1}" height="${PL+1.1}" rx="0.3" fill="none" stroke="#8FB7C9" stroke-width="0.5" opacity=".55"/>`;
      g += `<rect x="${pLeft-0.55}" y="${pTop-0.55}" width="${PW+1.1}" height="${PL+1.1}" rx="0.3" fill="rgba(143,183,201,.07)"/>`;
      // playing surface
      g += `<rect x="${pLeft}" y="${pTop}" width="${PW}" height="${PL}" fill="${s.in}"/>`;
      // court outline
      g += `<rect x="${pLeft}" y="${pTop}" width="${PW}" height="${PL}" ${ln}/>`;
      // service lines
      g += `<line x1="${pLeft}" y1="${pSvcTop}" x2="${pRight}" y2="${pSvcTop}" ${ln}/>`;
      g += `<line x1="${pLeft}" y1="${pSvcBot}" x2="${pRight}" y2="${pSvcBot}" ${ln}/>`;
      // centre service line (only between service lines)
      g += `<line x1="${cx}" y1="${pSvcTop}" x2="${cx}" y2="${pSvcBot}" ${ln}/>`;
      // net
      g += `<line x1="${pLeft-0.55}" y1="${net}" x2="${pRight+0.55}" y2="${net}" stroke="${s.line}" stroke-width="0.16"/>`;
      g += `<rect x="${pLeft}" y="${net-0.14}" width="${PW}" height="0.28" fill="rgba(255,255,255,.18)"/>`;
      // glass corner posts
      [[pLeft-0.55,pTop-0.55],[pRight+0.55,pTop-0.55],[pLeft-0.55,pBot+0.55],[pRight+0.55,pBot+0.55]].forEach(([x,y])=>{
        g += `<circle cx="${x}" cy="${y}" r="0.22" fill="#8FB7C9"/>`;
      });
      // net posts
      g += `<circle cx="${pLeft-0.55}" cy="${net}" r="0.18" fill="${s.line}"/>`;
      g += `<circle cx="${pRight+0.55}" cy="${net}" r="0.18" fill="${s.line}"/>`;
      return g;
    },

    // PICKLEBALL court background as an SVG <g> string
    renderPickle(surface) {
      const s = SURF[surface] || SURF.hard;
      const lw = 0.10;
      const ln = `stroke="${s.line}" stroke-width="${lw}" fill="none"`;
      let g = '';
      // outer surround
      g += `<rect x="0" y="0" width="${TOTAL_W}" height="${TOTAL_H}" fill="${s.out}"/>`;
      // playing surface (a little air around the court)
      g += `<rect x="${kLeft-0.8}" y="${kTop-0.8}" width="${KW+1.6}" height="${KL+1.6}" rx="0.25" fill="${s.in}"/>`;
      // kitchen (non-volley zone) — subtly darker band across the net
      g += `<rect x="${kLeft}" y="${kKitTop}" width="${KW}" height="${kKitBot-kKitTop}" fill="rgba(0,0,0,.14)"/>`;
      // court outline
      g += `<rect x="${kLeft}" y="${kTop}" width="${KW}" height="${KL}" ${ln}/>`;
      // non-volley-zone lines (both sides)
      g += `<line x1="${kLeft}" y1="${kKitTop}" x2="${kRight}" y2="${kKitTop}" ${ln}/>`;
      g += `<line x1="${kLeft}" y1="${kKitBot}" x2="${kRight}" y2="${kKitBot}" ${ln}/>`;
      // centre service lines (baseline → kitchen, never through the kitchen)
      g += `<line x1="${cx}" y1="${kTop}" x2="${cx}" y2="${kKitTop}" ${ln}/>`;
      g += `<line x1="${cx}" y1="${kBot}" x2="${cx}" y2="${kKitBot}" ${ln}/>`;
      // net
      g += `<line x1="${kLeft-0.4}" y1="${net}" x2="${kRight+0.4}" y2="${net}" stroke="${s.line}" stroke-width="0.14"/>`;
      g += `<rect x="${kLeft}" y="${net-0.12}" width="${KW}" height="0.24" fill="rgba(255,255,255,.16)"/>`;
      // net posts
      g += `<circle cx="${kLeft-0.4}" cy="${net}" r="0.16" fill="${s.line}"/>`;
      g += `<circle cx="${kRight+0.4}" cy="${net}" r="0.16" fill="${s.line}"/>`;
      return g;
    },

    // build the static court background as an SVG <g> string
    render(surface, sport) {
      if (sportOf(sport) === 'pickle') return this.renderPickle(surface);
      if (sportOf(sport) === 'padel') return this.renderPadel(surface);
      const s = SURF[surface] || SURF.hard;
      const lw = 0.12;          // line width metres
      const ln = `stroke="${s.line}" stroke-width="${lw}" fill="none"`;
      let g = '';
      // outer surround
      g += `<rect x="0" y="0" width="${TOTAL_W}" height="${TOTAL_H}" fill="${s.out}"/>`;
      // playing rectangle (slightly lighter inner)
      g += `<rect x="${cLeft-0.9}" y="${cTop-0.9}" width="${W+1.8}" height="${L+1.8}" rx="0.25" fill="${s.in}"/>`;
      // court outline (doubles)
      g += `<rect x="${cLeft}" y="${cTop}" width="${W}" height="${L}" ${ln}/>`;
      // singles sidelines
      g += `<line x1="${sLeft}" y1="${cTop}" x2="${sLeft}" y2="${cBot}" ${ln}/>`;
      g += `<line x1="${sRight}" y1="${cTop}" x2="${sRight}" y2="${cBot}" ${ln}/>`;
      // service lines
      g += `<line x1="${sLeft}" y1="${svcTop}" x2="${sRight}" y2="${svcTop}" ${ln}/>`;
      g += `<line x1="${sLeft}" y1="${svcBot}" x2="${sRight}" y2="${svcBot}" ${ln}/>`;
      // centre service line
      g += `<line x1="${cx}" y1="${svcTop}" x2="${cx}" y2="${svcBot}" ${ln}/>`;
      // centre marks on baselines
      g += `<line x1="${cx}" y1="${cTop}" x2="${cx}" y2="${cTop+0.35}" ${ln}/>`;
      g += `<line x1="${cx}" y1="${cBot}" x2="${cx}" y2="${cBot-0.35}" ${ln}/>`;
      // net
      g += `<line x1="${cLeft-0.9}" y1="${net}" x2="${cRight+0.9}" y2="${net}" stroke="${s.line}" stroke-width="0.16"/>`;
      g += `<rect x="${cLeft-0.9}" y="${net-0.16}" width="${W+1.8}" height="0.32" fill="rgba(255,255,255,.16)"/>`;
      // net posts
      g += `<circle cx="${cLeft-0.9}" cy="${net}" r="0.18" fill="${s.line}"/>`;
      g += `<circle cx="${cRight+0.9}" cy="${net}" r="0.18" fill="${s.line}"/>`;
      return g;
    },

    // a tiny thumbnail (used in cards / step minis): court + tokens of a step
    // cached: identical (surface, step, tokens) signatures reuse the built SVG string
    thumb(surface, step, tokens, landscape, sport) {
      tokens = tokens || (TL.state.tactic && TL.state.tactic.tokens) || [];
      const _cache = (this._thumbCache || (this._thumbCache = new Map()));
      let _key = null;
      try {
        _key = surface + '|' + (sport||'tennis') + '|' + (landscape?'L':'P') + '|' +
          (step ? JSON.stringify({p:step.pos,h:step.paths}) : '0') + '|' +
          tokens.map(k=>k.id+k.type).join(',');
        if (_cache.has(_key)) return _cache.get(_key);
      } catch(e) { _key = null; }
      let svg = this.render(surface, sport);
      if (step) {
        // draw paths faintly
        (step.paths || []).forEach(p => {
          const col = TL.PATH_COLORS[p.kind] || '#fff';
          const d = this.toPathD(p.points);
          if (d) svg += `<path d="${d}" fill="none" stroke="${col}" stroke-width="0.18" stroke-linecap="round" opacity=".9" ${p.dash==='dash'?'stroke-dasharray="0.5 0.4"':''}/>`;
        });
        const pos = step.pos || {};
        Object.keys(pos).forEach(id => {
          const t = tokens.find(k => k.id === id);
          if (!t) return;
          const p = pos[id];
          if (t.type === 'ball') {
            svg += `<circle cx="${p.x}" cy="${p.y}" r="0.45" fill="#fff"/>`;
          } else {
            const c = t.type === 'own' ? 'var(--c-own)' : '#FF5B5B';
            const fill = t.type === 'own' ? '#D7F23A' : '#FF5B5B';
            svg += `<circle cx="${p.x}" cy="${p.y}" r="0.85" fill="${fill}" stroke="rgba(0,0,0,.45)" stroke-width="0.12"/>`;
          }
        });
      }
      const vbStr = landscape ? `0 0 ${TOTAL_H} ${TOTAL_W}` : this.viewBox('full', sport).str;
      const content = landscape ? `<g transform="translate(${TOTAL_H},0) rotate(90)">${svg}</g>` : svg;
      const out = `<svg viewBox="${vbStr}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
      if (_key) { if (_cache.size > 300) _cache.clear(); _cache.set(_key, out); }
      return out;
    },

    // ---- PLAY-MAP thumbnail -------------------------------------------------
    // Unlike thumb() (which shows a single step), this overlays the WHOLE ball
    // journey across every step — earlier shots faint, the signature shot bold —
    // plus the final player positions and the ball at the last contact. It tells
    // the whole tactic in one glance and is tightly cropped to the court so the
    // markers read large even in a small card. Always landscape (~2:1).
    playThumb(tac) {
      if (!tac || !tac.steps) return '';
      const surface = tac.surface, sport = sportOf(tac.sport), tokens = tac.tokens || [];
      const _cache = (this._playCache || (this._playCache = new Map()));
      let _key = null;
      try {
        _key = 'PT|' + surface + '|' + sport + '|' +
          tac.steps.map(s => JSON.stringify({ p: s.pos, h: s.paths })).join(';') + '|' +
          tokens.map(k => k.id + k.type).join(',');
        if (_cache.has(_key)) return _cache.get(_key);
      } catch (e) { _key = null; }

      let svg = this.render(surface, tac.sport);

      // every ball path, oldest → newest, fading in
      const pathSteps = tac.steps.filter(s => (s.paths || []).length);
      pathSteps.forEach((s, idx) => {
        const isLast = idx === pathSteps.length - 1;
        (s.paths || []).forEach(p => {
          const col = TL.PATH_COLORS[p.kind] || '#fff';
          const d = this.toPathD(p.points);
          if (!d) return;
          const frac = pathSteps.length > 1 ? idx / (pathSteps.length - 1) : 1;
          const op = isLast ? 1 : (0.32 + 0.4 * frac);
          const w = isLast ? 0.30 : 0.17;
          svg += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}" ${p.dash === 'dash' ? 'stroke-dasharray="0.55 0.4"' : ''}/>`;
        });
      });

      // final player positions
      const last = tac.steps[tac.steps.length - 1] || {};
      const pos = last.pos || {};
      Object.keys(pos).forEach(id => {
        const tk = tokens.find(k => k.id === id);
        if (!tk || tk.type === 'ball') return;
        const p = pos[id];
        const fill = tk.type === 'own' ? '#D7F23A' : '#FF5B5B';
        svg += `<circle cx="${p.x}" cy="${p.y}" r="0.92" fill="${fill}" stroke="rgba(0,0,0,.5)" stroke-width="0.14"/>`;
      });

      // ball at the last contact point (end of the final drawn shot) — the "winner"
      let ballPt = null;
      if (pathSteps.length) {
        const lastPaths = pathSteps[pathSteps.length - 1].paths;
        const bp2 = lastPaths.filter(p => p.kind === 'ball').pop() || lastPaths[lastPaths.length - 1];
        if (bp2 && bp2.points && bp2.points.length) ballPt = bp2.points[bp2.points.length - 1];
      }
      if (!ballPt) { const b = tokens.find(k => k.type === 'ball'); if (b && pos[b.id]) ballPt = pos[b.id]; }
      if (ballPt) {
        svg += `<circle cx="${ballPt.x}" cy="${ballPt.y}" r="0.66" fill="rgba(0,0,0,.35)"/>`;
        svg += `<circle cx="${ballPt.x}" cy="${ballPt.y}" r="0.44" fill="#fff" stroke="#1A1715" stroke-width="0.1"/>`;
      }

      // tight landscape crop: rotate the canvas 90°, then frame just the court + a little air.
      // after translate(TOTAL_H,0) rotate(90): screenX = TOTAL_H - courtY, screenY = courtX
      let x0, x1, y0, y1, pad;
      if (sport === 'pickle') {
        x0 = kLeft; x1 = kRight; y0 = kTop; y1 = kBot; pad = 0.9;
      } else if (sport === 'padel') {
        x0 = cx - PW / 2; x1 = cx + PW / 2; y0 = net - PL / 2; y1 = net + PL / 2; pad = 1.0;
      } else {
        x0 = cLeft - 0.9; x1 = cRight + 0.9; y0 = cTop - 0.9; y1 = cBot + 0.9; pad = 0.7;
      }
      const sx = (TOTAL_H - y1) - pad, sy = x0 - pad, sw = (y1 - y0) + 2 * pad, sh = (x1 - x0) + 2 * pad;
      const vbStr = `${sx} ${sy} ${sw} ${sh}`;
      const content = `<g transform="translate(${TOTAL_H},0) rotate(90)">${svg}</g>`;
      const out = `<svg viewBox="${vbStr}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
      if (_key) { if (_cache.size > 300) _cache.clear(); _cache.set(_key, out); }
      return out;
    },
    toPathD(points) {
      if (!points || points.length < 2) return '';
      const p = points;
      let d = `M ${p[0].x} ${p[0].y}`;
      for (let i = 1; i < p.length; i++) {
        const prev = p[i - 1], cur = p[i];
        const mx = (prev.x + cur.x) / 2, my = (prev.y + cur.y) / 2;
        d += ` Q ${prev.x} ${prev.y} ${mx} ${my}`;
      }
      const last = p[p.length - 1];
      d += ` L ${last.x} ${last.y}`;
      return d;
    },

    // clamp a point inside the whole play area
    clamp(pt) {
      return {
        x: Math.max(0.4, Math.min(TOTAL_W - 0.4, pt.x)),
        y: Math.max(0.4, Math.min(TOTAL_H - 0.4, pt.y)),
      };
    },
  };
})(window.TL = window.TL || {});
