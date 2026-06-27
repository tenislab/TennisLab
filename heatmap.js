/* ============================================================
   editor.js — the tactic editor (court canvas, tools, steps)
   ============================================================ */
(function (TL) {
  const t = (k) => TL.i18n.t(k);
  const C = TL.court, ic = TL.icon;
  const S = () => TL.state;

  let el = {};                 // cached DOM refs
  let drawing = null;          // active stroke being drawn
  let dragging = null;         // {id, ...} token being dragged
  let landscapeMode = false;   // court rotated to landscape (wide screens, guided)

  const SWATCHES = ['#D7F23A','#FF5B5B','#FFFFFF','#5BC8FF','#FFB13B','#B07BFF'];

  // ---- helpers ----------------------------------------------------
  function tactic() { return S().tactic; }
  function step() { return tactic().steps[S().stepIndex]; }
  function pathColor(kind) { return TL.PATH_COLORS[kind] || '#fff'; }

  function toCourt(evt) {
    const svg = el.svg;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const r = pt.matrixTransform(svg.getScreenCTM().inverse());
    if (landscapeMode) return C.clamp({ x: r.y, y: C.TOTAL_H - r.x });
    return C.clamp({ x: r.x, y: r.y });
  }

  // ============================================================
  // RENDER — full editor shell
  // ============================================================
  function render() {
    const root = TL.app.root;
    const tac = tactic();
    const viewer = S().viewer;
    const guided = S().guided;

    root.innerHTML = `
    <div class="editor view">
      ${viewer ? `<div class="viewer-note">${ic.ball}${t('viewer_mode')}</div>` : ''}
      <div class="ed-bar">
        <button class="btn btn-ghost btn-sm" id="ed-back">${ic.prev}${t('back')}</button>
        <div class="ed-title">
          <span class="kicker">${t('ed_kicker')}</span>
          <input id="ed-name" placeholder="${t('untitled')}" value="${attr(tac.name)}" ${viewer?'disabled':''}/>
        </div>
        <div class="spacer"></div>
        ${viewer?'':`<button class="btn btn-ghost btn-sm" id="ed-flip" title="${t('mirror_d')}">${ic.flip}<span class="lbl-txt">${t('mirror')}</span></button>`}
        <button class="btn btn-ghost btn-sm kb-help-btn" id="ed-help" title="${t('shortcuts')}">${ic.help||'?'}<span class="lbl-txt">?</span></button>
        <button class="btn btn-ghost btn-sm" id="ed-present" title="${t('present_mode')}">${ic.expand}<span class="lbl-txt">${t('present')}</span></button>
        ${(viewer||guided)?'':`<button class="btn btn-ghost btn-sm" id="ed-save">${ic.save}<span class="lbl-txt">${t('save')}</span></button>`}
        <button class="btn btn-primary btn-sm" id="ed-share">${ic.share}<span class="lbl-txt">${t('share')}</span></button>
      </div>

      <div class="ed-main ${guided?'guided':''}">
        ${(viewer||guided) ? '' : railHtml()}
        <div class="stage">
          ${guided ? '' : `<div class="stage-top">
            <div class="seg surf">
              ${['clay','hard','grass','indoor'].map(s=>`<button data-surf="${s}" class="${tac.surface===s?'on':''}"><i style="background:${C.SURF[s].in}"></i>${t('surf_'+s)}</button>`).join('')}
            </div>
            <div class="seg view">
              <button data-view="full" class="${tac.view!=='half'?'on':''}">${t('view_full')}</button>
              <button data-view="half" class="${tac.view==='half'?'on':''}">${t('view_half')}</button>
            </div>
          </div>`}
          ${guided ? guidedStageHtml() : `<div class="court-hold">
            <svg id="court" class="court-svg" xmlns="http://www.w3.org/2000/svg"></svg>
          </div>
          <div class="timeline-wrap">
            <div class="tl-head">
              <span class="kicker">${t('steps')}</span>
              <div class="transport">
                <button class="btn-icon" id="t-clear" title="${t('clear_step')}">${ic.erase}</button>
                <button class="btn-icon" id="t-prev" title="${t('prev_step')}">${ic.prev}</button>
                <button class="btn-icon play" id="t-play" title="${t('play')}">${ic.play}</button>
                <button class="btn-icon" id="t-reverse" title="${t('reverse_d')}">${ic.reverse}</button>
                <button class="btn-icon" id="t-next" title="${t('next_step')}">${ic.next}</button>
                <button class="btn-icon" id="t-restart" title="${t('restart')}">${ic.restart}</button>
                <div class="speed">
                  ${['slow','normal','fast'].map(s=>`<button data-spd="${s}" class="${S().speed===s?'on':''}">${t(s)}</button>`).join('')}
                </div>
              </div>
            </div>
            <div class="steps" id="steps"></div>
          </div>`}
        </div>
        ${(viewer||guided) ? '' : inspectorHtml()}
      </div>
      ${(viewer||guided)?'':`<button class="insp-fab" id="insp-fab">${ic.sliders}</button><div class="scrim" id="insp-scrim"></div>`}
    </div>`;

    // cache
    el.svg = root.querySelector('#court');
    el.steps = root.querySelector('#steps');
    el.inspector = root.querySelector('.inspector');

    wireBar(root, viewer);
    if (!viewer && !guided) { wireRail(root); wireInspector(root); }
    if (guided) wireCoach(root);
    wireTransport(root, viewer);
    wireStageToggles(root);
    wirePointer();

    renderCourt();
    renderSteps();
    if (guided) updateGuidedActions();
    if (guided) maybeCoach();
    if (!viewer && !guided) refreshTool();
  }

  function attr(s){return (s||'').replace(/"/g,'&quot;');}
  function esc(s){return (s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

  // ---- tool rail --------------------------------------------------
  function railHtml() {
    const g1 = [['select',ic.cursor],['own',ic.user],['rival',ic.rival],['ball',ic.ball]];
    const g2 = [['ballpath',ic.ballpath],['ownmove',ic.move],['rivalmove',ic.move]];
    const g3 = [['arrow',ic.arrow],['line',ic.line],['point',ic.point],['text',ic.text],['zone',ic.zone],['measure',ic.measure]];
    const g4 = [['erase',ic.erase]];
    const tool = (id,svg)=>`<button class="tool" data-tool="${id}">${svg}<span class="lbl">${t('tool_'+id)}</span></button>`;
    return `<div class="rail">
      <div class="rail-group">${g1.map(x=>tool(x[0],x[1])).join('')}</div>
      <div class="rail-sep"></div>
      <div class="rail-group">${g2.map(x=>tool(x[0],x[1])).join('')}</div>
      <div class="rail-sep"></div>
      <div class="rail-group">${g3.map(x=>tool(x[0],x[1])).join('')}</div>
      <div class="rail-sep"></div>
      <div class="rail-group">${g4.map(x=>tool(x[0],x[1])).join('')}</div>
    </div>`;
  }

  // ---- inspector --------------------------------------------------
  function inspectorHtml() {
    return `<div class="inspector">
      <div class="insp-block">
        <span class="kicker">${t('insp_props')}</span>
        <div class="field">
          <label>${t('insp_color')}</label>
          <div class="swatch-row" id="sw-row">
            ${SWATCHES.map(c=>`<button class="swatch" data-col="${c}" style="background:${c}"></button>`).join('')}
          </div>
        </div>
        <div class="field">
          <label>${t('insp_line')}</label>
          <div class="dash-row" id="dash-row">
            <button class="dash-opt" data-dash="solid"><svg viewBox="0 0 40 10"><line x1="2" y1="5" x2="38" y2="5" stroke="#fff" stroke-width="2.5"/></svg></button>
            <button class="dash-opt" data-dash="dash"><svg viewBox="0 0 40 10"><line x1="2" y1="5" x2="38" y2="5" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 4"/></svg></button>
          </div>
        </div>
      </div>
      <div class="insp-block">
        <span class="kicker">${t('legend')}</span>
        <div class="legend">
          <div class="legend-item"><span class="dot" style="background:#D7F23A"></span>${t('lg_own')}</div>
          <div class="legend-item"><span class="dot" style="background:#FF5B5B"></span>${t('lg_rival')}</div>
          <div class="legend-item"><span class="dot" style="background:#fff"></span>${t('lg_ball')}</div>
          <div class="legend-item"><span class="k" style="border-color:#D7F23A;border-style:dashed"></span>${t('lg_ownmove')}</div>
          <div class="legend-item"><span class="k" style="border-color:#FF5B5B;border-style:dashed"></span>${t('lg_rivalmove')}</div>
          <div class="legend-item"><span class="k" style="border-color:#fff"></span>${t('lg_ballpath')}</div>
        </div>
      </div>
      <div class="insp-block" id="insp-dna"></div>
    </div>`;
  }

  // Play DNA — shot-type composition of the current tactic
  const DNA_SHOTS = [
    { k:'plana',   col:'#FF7A45' },
    { k:'lift',    col:'#46D6A6' },
    { k:'cortado', col:'#5BAEF4' },
    { k:'globo',   col:'#B07BFF' },
    { k:'dejada',  col:'#F4C14B' },
  ];
  function renderDna() {
    const box = el.inspector && el.inspector.querySelector('#insp-dna');
    if (!box) return;
    const tac = tactic();
    const counts = {};
    let total = 0;
    (tac.steps || []).forEach((s, i) => { if (i > 0 && s.shot) { counts[s.shot] = (counts[s.shot]||0) + 1; total++; } });
    if (!total) { box.innerHTML = ''; return; }
    const rows = DNA_SHOTS.filter(d => counts[d.k]).map(d => {
      const n = counts[d.k], pct = Math.round(n/total*100);
      return `<div class="dna-row">
        <span class="dna-lbl"><i style="background:${d.col}"></i>${t('shot_'+d.k)}</span>
        <span class="dna-bar"><b style="width:${pct}%;background:${d.col}"></b></span>
        <span class="dna-n">${n}</span>
      </div>`;
    }).join('');
    box.innerHTML = `<span class="kicker">${t('play_dna')}</span>
      <div class="dna-meta">${total} ${t('dna_shots')} · ${t('surf_'+tac.surface)}</div>
      <div class="dna-list">${rows}</div>`;
  }

  // ============================================================
  // COURT rendering
  // ============================================================
  function renderCourt() {
    const tac = tactic();
    const st = step();
    landscapeMode = false;   // court is always vertical (top-down)
    el.svg.setAttribute('viewBox', C.viewBox(tac.view, tac.sport).str);

    let s = `<g>${C.render(tac.surface, tac.sport)}</g>`;

    // paths (trajectories)
    s += `<g id="paths">`;
    (st.paths || []).forEach(p => {
      const d = C.toPathD(p.points);
      if (!d) return;
      const col = p.color || pathColor(p.kind);
      const dash = p.dash === 'dash' ? 'stroke-dasharray="0.55 0.45"' : '';
      const head = p.kind === 'ball';
      s += `<path class="hit" data-eid="${p.id}" data-kind="path" d="${d}" fill="none" stroke="${col}" stroke-width="0.22" stroke-linecap="round" stroke-linejoin="round" ${dash}/>`;
      // arrow head at the end
      const head2 = arrowHead(p.points, col);
      if (head2) s += head2;
    });
    s += `</g>`;

    // annotations
    s += `<g id="annos">`;
    (st.annos || []).forEach(a => {
      const col = a.color || '#5BC8FF';
      if (a.type === 'zone') {
        const [p0,p1] = a.points;
        const x=Math.min(p0.x,p1.x), y=Math.min(p0.y,p1.y), w=Math.abs(p1.x-p0.x), h=Math.abs(p1.y-p0.y);
        s += `<rect class="hit" data-eid="${a.id}" data-kind="anno" x="${x}" y="${y}" width="${w}" height="${h}" rx="0.4" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="0.12" stroke-dasharray="0.4 0.3"/>`;
      } else if (a.type === 'measure') {
        s += `<g class="hit" data-eid="${a.id}" data-kind="anno">${measureMarkup(a.points[0], a.points[1], col)}</g>`;
      } else if (a.type === 'arrow' || a.type === 'line') {
        const [p0,p1] = a.points;
        s += `<line class="hit" data-eid="${a.id}" data-kind="anno" x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}" stroke="${col}" stroke-width="0.22" stroke-linecap="round" ${a.dash==='dash'?'stroke-dasharray="0.55 0.45"':''}/>`;
        if (a.type === 'arrow') s += arrowHead(a.points, col, true);
      } else if (a.type === 'point') {
        s += `<circle class="hit" data-eid="${a.id}" data-kind="anno" cx="${a.x}" cy="${a.y}" r="0.42" fill="${col}" stroke="rgba(0,0,0,.4)" stroke-width="0.1"/>`;
      } else if (a.type === 'text') {
        s += `<g class="hit" data-eid="${a.id}" data-kind="anno">
          <rect x="${a.x-0.2}" y="${a.y-1.05}" width="${Math.max(2,(a.text||'').length*0.62)}" height="1.5" rx="0.3" fill="rgba(0,0,0,.55)"/>
          <text x="${a.x+0.1}" y="${a.y+0.05}" font-size="1.05" font-family="Hanken Grotesk, sans-serif" font-weight="700" fill="${col}">${esc(a.text)}</text></g>`;
      }
    });
    s += `</g>`;

    // guided: pulse ring on the player who hits next
    if (S().guided && !S().playing) {
      const cd = coachData();
      const tk = chosenHitter(cd);
      const gp = tk && st.pos[tk.id];
      if (gp) {
        const col = cd.actor === 'own' ? '#D7F23A' : '#FF5B5B';
        s += `<g id="guide"><circle class="pulse-ring" cx="${gp.x}" cy="${gp.y}" r="1.2" fill="none" stroke="${col}" stroke-width="0.16"/><circle class="pulse-ring" cx="${gp.x}" cy="${gp.y}" r="1.2" fill="none" stroke="${col}" stroke-width="0.16" style="animation-delay:.75s"/></g>`;
      }
    }

    // tokens
    s += `<g id="tokens">`;
    tac.tokens.forEach(tk => {
      const p = st.pos[tk.id];
      if (!p) return;
      s += tokenSvg(tk, p);
    });
    s += `</g>`;

    el.svg.innerHTML = landscapeMode ? `<g transform="translate(${C.TOTAL_H},0) rotate(90)">${s}</g>` : s;
    if (S().guided) el.svg.style.cursor = 'crosshair';
  }

  function tokenSvg(tk, p) {
    if (tk.type === 'ball') {
      return `<g class="token" data-id="${tk.id}" data-type="ball" style="cursor:grab">
        <circle cx="${p.x}" cy="${p.y}" r="0.78" fill="rgba(215,242,58,.18)"/>
        <circle cx="${p.x}" cy="${p.y}" r="0.5" fill="#fff" stroke="#C9D63A" stroke-width="0.12"/>
        <path d="M ${p.x-0.5} ${p.y} A 0.5 0.5 0 0 1 ${p.x+0.5} ${p.y}" fill="none" stroke="#C9D63A" stroke-width="0.08" opacity=".7"/>
      </g>`;
    }
    const f = tk.type === 'own' ? '#D7F23A' : '#FF5B5B';
    const ink = tk.type === 'own' ? '#1A1E12' : '#fff';
    return `<g class="token" data-id="${tk.id}" data-type="${tk.type}" style="cursor:grab">
      <circle cx="${p.x}" cy="${p.y}" r="1.15" fill="rgba(0,0,0,.18)"/>
      <circle cx="${p.x}" cy="${p.y}" r="0.95" fill="${f}" stroke="rgba(0,0,0,.45)" stroke-width="0.14"/>
      <text x="${p.x}" y="${p.y+0.36}" font-size="0.95" font-family="Space Mono, monospace" font-weight="700" fill="${ink}" text-anchor="middle">${esc(tk.label)}</text>
    </g>`;
  }

  function measureMarkup(a, b, col) {
    col = col || '#5BC8FF';
    const dist = Math.hypot(b.x-a.x, b.y-a.y);
    const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
    const label = dist.toFixed(1) + ' m';
    const w = label.length * 0.52 + 0.5;
    // perpendicular end ticks
    const ang = Math.atan2(b.y-a.y, b.x-a.x);
    const tx = Math.cos(ang+Math.PI/2)*0.35, ty = Math.sin(ang+Math.PI/2)*0.35;
    let g = `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${col}" stroke-width="0.12" stroke-dasharray="0.35 0.25"/>`;
    g += `<line x1="${a.x-tx}" y1="${a.y-ty}" x2="${a.x+tx}" y2="${a.y+ty}" stroke="${col}" stroke-width="0.12"/>`;
    g += `<line x1="${b.x-tx}" y1="${b.y-ty}" x2="${b.x+tx}" y2="${b.y+ty}" stroke="${col}" stroke-width="0.12"/>`;
    g += `<rect x="${mx-w/2}" y="${my-0.65}" width="${w}" height="1.2" rx="0.3" fill="rgba(0,0,0,.62)"/>`;
    g += `<text x="${mx}" y="${my+0.35}" font-size="0.85" font-family="Space Mono, monospace" font-weight="700" fill="${col}" text-anchor="middle">${label}</text>`;
    return g;
  }

  function arrowHead(points, col, force) {
    if (!points || points.length < 2) return '';
    const n = points.length;
    const a = points[n-2], b = points[n-1];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const len = 0.55, spread = 0.42;
    const x1 = b.x - len*Math.cos(ang) + spread*Math.cos(ang+Math.PI/2);
    const y1 = b.y - len*Math.sin(ang) + spread*Math.sin(ang+Math.PI/2);
    const x2 = b.x - len*Math.cos(ang) - spread*Math.cos(ang+Math.PI/2);
    const y2 = b.y - len*Math.sin(ang) - spread*Math.sin(ang+Math.PI/2);
    return `<path d="M ${x1} ${y1} L ${b.x} ${b.y} L ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="0.22" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // ============================================================
  // POINTER — drag tokens + draw tools
  // ============================================================
  function wirePointer() {
    const svg = el.svg;
    svg.addEventListener('pointerdown', onDown);
    if (!TL._pointerBound) {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('resize', () => {
        if (S().view === 'editor' && S().guided && el.svg && el.svg.isConnected) {
          clearTimeout(TL._rz);
          TL._rz = setTimeout(() => { renderCourt(); }, 150);
        }
      });
      TL._pointerBound = true;
    }
  }

  function onDown(evt) {
    if (S().viewer || S().playing) return;
    // guided mode: a tap places the next shot
    if (S().guided) { nextShot(toCourt(evt)); return; }
    const tool = S().tool;
    const tokenG = evt.target.closest('.token');

    // erase: remove clicked element
    if (tool === 'erase') {
      const hit = evt.target.closest('.hit');
      if (hit) { eraseEl(hit.dataset.eid, hit.dataset.kind); return; }
      return;
    }

    // select tool → drag a token
    if (tool === 'select') {
      if (tokenG) startDrag(tokenG, evt);
      return;
    }

    // ball tool → move ball in this step
    if (tool === 'ball') {
      const ball = tactic().tokens.find(k => k.type === 'ball');
      if (ball) { step().pos[ball.id] = toCourt(evt); renderCourt(); persist(); }
      return;
    }
    // add own / rival
    if (tool === 'own' || tool === 'rival') { addToken(tool, toCourt(evt)); return; }

    // point / text
    if (tool === 'point') {
      step().annos.push({ id: TL.store.uid(), type:'point', ...toCourt(evt), color: S().draw.color || '#5BC8FF' });
      renderCourt(); persist(); return;
    }
    if (tool === 'text') {
      const p = toCourt(evt);
      TL.ui.prompt({ title: t('text_prompt') }).then(txt => {
        if (txt) { step().annos.push({ id:TL.store.uid(), type:'text', x:p.x, y:p.y, text:txt, color:S().draw.color||'#5BC8FF' }); renderCourt(); persist(); }
      });
      return;
    }

    // freehand / 2-point strokes
    const p = toCourt(evt);
    if (tool === 'arrow' || tool === 'line') {
      drawing = { mode:'anno', type:tool, points:[p, p], color:S().draw.color, dash:S().draw.dash };
    } else if (tool === 'zone' || tool === 'measure') {
      drawing = { mode:'anno', type:tool, points:[p, p], color:S().draw.color };
    } else { // ballpath / ownmove / rivalmove
      const kind = tool === 'ballpath' ? 'ball' : tool === 'ownmove' ? 'own' : 'rival';
      drawing = { mode:'path', kind, points:[p], color:S().draw.color, dash: S().draw.dash };
    }
    el.svg.setPointerCapture && el.svg.setPointerCapture(evt.pointerId);
    drawPreview();
  }

  function onMove(evt) {
    if (dragging) {
      const p = toCourt(evt);
      const g = dragging.g;
      moveTokenG(g, p);
      dragging.pos = p;
      return;
    }
    if (drawing) {
      const p = toCourt(evt);
      if (drawing.mode === 'anno') drawing.points[1] = p;
      else {
        const last = drawing.points[drawing.points.length-1];
        if (Math.hypot(p.x-last.x, p.y-last.y) > 0.35) drawing.points.push(p);
      }
      drawPreview();
    }
  }

  function onUp() {
    if (dragging) {
      step().pos[dragging.id] = dragging.pos;
      dragging = null; persist(); renderSteps();
      return;
    }
    if (drawing) {
      const d = drawing;
      if (d.mode === 'anno') {
        const [a,b] = d.points;
        if (d.type === 'zone') {
          if (Math.abs(b.x-a.x) > 0.6 && Math.abs(b.y-a.y) > 0.6)
            step().annos.push({ id:TL.store.uid(), type:'zone', points:[a,b], color:d.color||'#FF5B5B' });
        } else if (d.type === 'measure') {
          if (Math.hypot(b.x-a.x, b.y-a.y) > 0.5)
            step().annos.push({ id:TL.store.uid(), type:'measure', points:[a,b], color:d.color||'#5BC8FF' });
        } else if (Math.hypot(b.x-a.x, b.y-a.y) > 0.3) {
          step().annos.push({ id:TL.store.uid(), type:d.type, points:[a,b], color:d.color, dash:d.dash });
        }
      } else if (d.points.length >= 2) {
        step().paths.push({ id:TL.store.uid(), kind:d.kind, points:d.points, color:d.color, dash:d.dash });
      }
      drawing = null;
      renderCourt(); renderSteps(); persist();
    }
  }

  // live preview overlay while drawing
  function drawPreview() {
    let prev = el.svg.querySelector('#preview');
    if (!prev) { prev = document.createElementNS('http://www.w3.org/2000/svg','g'); prev.id='preview'; el.svg.appendChild(prev); }
    const d = drawing; if (!d) { prev.innerHTML=''; return; }
    const col = d.color || (d.mode==='path' ? pathColor(d.kind) : '#5BC8FF');
    const dash = d.dash==='dash' ? 'stroke-dasharray="0.55 0.45"' : '';
    if (d.mode === 'anno') {
      const [a,b]=d.points;
      if (d.type === 'zone') {
        const x=Math.min(a.x,b.x), y=Math.min(a.y,b.y), w=Math.abs(b.x-a.x), h=Math.abs(b.y-a.y);
        prev.innerHTML = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.4" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="0.12" stroke-dasharray="0.4 0.3"/>`;
      } else if (d.type === 'measure') {
        prev.innerHTML = measureMarkup(a, b, col);
      } else {
        prev.innerHTML = `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${col}" stroke-width="0.22" stroke-linecap="round" ${dash}/>` + (d.type==='arrow'?arrowHead(d.points,col):'');
      }
    } else {
      const path = C.toPathD(d.points);
      prev.innerHTML = path ? `<path d="${path}" fill="none" stroke="${col}" stroke-width="0.22" stroke-linecap="round" stroke-linejoin="round" ${dash}/>` : '';
    }
  }

  function startDrag(g, evt) {
    dragging = { g, id: g.dataset.id, pos: step().pos[g.dataset.id] };
    g.style.cursor = 'grabbing';
    el.svg.setPointerCapture && el.svg.setPointerCapture(evt.pointerId);
  }
  function moveTokenG(g, p) {
    g.querySelectorAll('circle').forEach(c => { c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); });
    const tx = g.querySelector('text'); if (tx) { tx.setAttribute('x', p.x); tx.setAttribute('y', p.y+0.36); }
    const arc = g.querySelector('path');
    if (arc && g.dataset.type === 'ball') arc.setAttribute('d', `M ${p.x-0.5} ${p.y} A 0.5 0.5 0 0 1 ${p.x+0.5} ${p.y}`);
  }

  function addToken(type, p) {
    const tac = tactic();
    const count = tac.tokens.filter(k => k.type === type).length + 1;
    const label = (type === 'own' ? 'J' : 'R') + count;
    const tk = { id: TL.store.uid(), type, label };
    tac.tokens.push(tk);
    tac.steps.forEach(st => { st.pos[tk.id] = { ...p }; });
    S().tool = 'select';
    renderCourt(); renderSteps(); refreshTool(); persist();
  }

  function eraseEl(eid, kind) {
    const st = step();
    if (kind === 'path') st.paths = st.paths.filter(p => p.id !== eid);
    else st.annos = st.annos.filter(a => a.id !== eid);
    renderCourt(); renderSteps(); persist();
  }

  // ============================================================
  // STEPS timeline
  // ============================================================
  function renderSteps() {
    const tac = tactic();
    const viewer = S().viewer;
    let html = '';
    tac.steps.forEach((st, i) => {
      const num = String(i+1).padStart(2,'0');
      html += `<div class="step ${i===S().stepIndex?'on':''}" data-i="${i}">
        ${(!viewer && !S().guided && tac.steps.length>1)?`<button class="del" data-del="${i}">${ic.x}</button>`:''}
        ${(!viewer && !S().guided)?`<button class="dup-step" data-dup="${i}" title="${t('duplicate_step')}">${ic.copy}</button>`:''}
        <div class="n">${TL.i18n.lang==='en'?'STEP':'PASO'} ${num}</div>
        <input data-title="${i}" placeholder="${TL.i18n.lang==='en'?'Untitled':'Sin título'}" value="${attr(st.title)}" ${viewer?'disabled':''}/>
        <div class="mini">${C.thumb(tac.surface, st, tac.tokens, landscapeMode)}</div>
        ${viewer ? (st.note?`<p class="step-note-ro">${esc(st.note)}</p>`:'') : `<input class="step-note" data-note="${i}" placeholder="${t('notes_short')}…" value="${attr(st.note||'')}"/>`}
      </div>`;
    });
    if (!viewer && !S().guided) html += `<button class="step-add" id="add-step" title="${t('add_step')}">${ic.plus}</button>`;
    el.steps.innerHTML = html;

    el.steps.querySelectorAll('.step').forEach(node => {
      const i = +node.dataset.i;
      node.addEventListener('click', (e) => {
        if (e.target.closest('.del') || e.target.tagName === 'INPUT') return;
        goToStep(i);
      });
    });
    el.steps.querySelectorAll('[data-title]').forEach(inp => {
      inp.addEventListener('input', () => { tac.steps[+inp.dataset.title].title = inp.value; persist(); });
    });
    el.steps.querySelectorAll('[data-note]').forEach(inp => {
      inp.addEventListener('input', () => { tac.steps[+inp.dataset.note].note = inp.value; persist(); });
      inp.addEventListener('click', (e) => e.stopPropagation());
    });
    el.steps.querySelectorAll('[data-del]').forEach(b => {
      b.addEventListener('click', (e) => { e.stopPropagation(); delStep(+b.dataset.del); });
    });
    el.steps.querySelectorAll('[data-dup]').forEach(b => {
      b.addEventListener('click', (e) => { e.stopPropagation(); dupStep(+b.dataset.dup); });
    });
    const add = el.steps.querySelector('#add-step');
    if (add) add.onclick = addStep;
    renderDna();
  }

  function goToStep(i) {
    if (S().playing) TL.anim.stop();
    S().stepIndex = Math.max(0, Math.min(tactic().steps.length-1, i));
    renderCourt(); renderSteps();
    const node = el.steps.querySelector(`.step[data-i="${S().stepIndex}"]`);
    if (node) node.scrollIntoView({ block:'nearest', inline:'center' });
  }

  function addStep() {
    const tac = tactic();
    const src = step();
    const ns = TL.store.blankStep('');
    // carry positions forward; start fresh on drawings
    ns.pos = JSON.parse(JSON.stringify(src.pos));
    const names = t('step_names');
    ns.title = names[tac.steps.length] || '';
    tac.steps.splice(S().stepIndex+1, 0, ns);
    S().stepIndex++;
    renderCourt(); renderSteps(); persist();
    TL.app.toast(t('step_added'));
    const node = el.steps.querySelector(`.step[data-i="${S().stepIndex}"]`);
    if (node) node.scrollIntoView({ block:'nearest', inline:'center' });
  }

  function delStep(i) {
    const tac = tactic();
    if (tac.steps.length <= 1) return;
    tac.steps.splice(i, 1);
    if (S().stepIndex >= tac.steps.length) S().stepIndex = tac.steps.length-1;
    renderCourt(); renderSteps(); persist();
  }

  function dupStep(i) {
    const tac = tactic();
    const copy = JSON.parse(JSON.stringify(tac.steps[i]));
    copy.id = TL.store.uid();
    (copy.paths||[]).forEach(p => p.id = TL.store.uid());
    (copy.annos||[]).forEach(a => a.id = TL.store.uid());
    tac.steps.splice(i+1, 0, copy);
    S().stepIndex = i+1;
    renderCourt(); renderSteps(); persist();
    TL.app.toast(t('duplicate_step'));
  }

  function presentMode() {
    const tac = tactic();
    let i = S().stepIndex || 0;
    const vb = C.viewBox(tac.view, tac.sport);
    const ov = document.createElement('div');
    ov.className = 'present-ov';
    function draw() {
      const st = tac.steps[i];
      let inner = C.render(tac.surface, tac.sport);
      (st.paths||[]).forEach(p => { const d = C.toPathD(p.points); if (d) { const col = p.color||TL.PATH_COLORS[p.kind]||'#fff'; inner += `<path d="${d}" fill="none" stroke="${col}" stroke-width="0.24" stroke-linecap="round" stroke-linejoin="round" ${p.dash==='dash'?'stroke-dasharray="0.55 0.45"':''}/>`; } });
      (st.annos||[]).forEach(a => { const col=a.color||'#5BC8FF'; if(a.type==='point') inner+=`<circle cx="${a.x}" cy="${a.y}" r="0.42" fill="${col}"/>`; else if(a.type==='text') inner+=`<text x="${a.x+0.1}" y="${a.y+0.05}" font-size="1.05" font-family="Hanken Grotesk,sans-serif" font-weight="700" fill="${col}">${esc(a.text)}</text>`; });
      tac.tokens.forEach(tk => { const p=st.pos[tk.id]; if(!p) return; if(tk.type==='ball'){ inner+=`<g data-tid="${tk.id}"><circle cx="${p.x}" cy="${p.y}" r="0.5" fill="#fff" stroke="#C9D63A" stroke-width="0.12"/></g>`; } else { const f=tk.type==='own'?'#D7F23A':'#FF5B5B', ink=tk.type==='own'?'#1A1E12':'#fff'; inner+=`<g data-tid="${tk.id}"><circle cx="${p.x}" cy="${p.y}" r="0.95" fill="${f}" stroke="rgba(0,0,0,.45)" stroke-width="0.14"/><text x="${p.x}" y="${p.y+0.36}" font-size="0.95" font-family="Space Mono,monospace" font-weight="700" fill="${ink}" text-anchor="middle">${esc(tk.label)}</text></g>`; } });
      ov.querySelector('.present-court').innerHTML = `<svg viewBox="${vb.str}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
      ov.querySelector('.present-step').textContent = `${(TL.i18n.lang==='en'?'STEP':'PASO')} ${String(i+1).padStart(2,'0')} / ${String(tac.steps.length).padStart(2,'0')}`;
      ov.querySelector('.present-title').textContent = st.title || tac.name || '';
      ov.querySelector('.present-note').textContent = st.note || '';
      ov.querySelector('#pv-prev').disabled = i<=0;
      ov.querySelector('#pv-next').disabled = i>=tac.steps.length-1;
    }
    ov.innerHTML = `
      <button class="present-x" id="pv-x">${ic.x}</button>
      <div class="present-hd"><span class="present-step"></span><b class="present-title"></b></div>
      <div class="present-court"></div>
      <div class="present-note"></div>
      <div class="present-nav">
        <button class="btn-icon" id="pv-prev">${ic.prev}</button>
        <button class="btn-icon play" id="pv-play">${ic.play}</button>
        <button class="btn-icon" id="pv-next">${ic.next}</button>
      </div>`;
    document.body.appendChild(ov);
    draw();
    const go = (n) => { i = Math.max(0, Math.min(tac.steps.length-1, n)); draw(); };
    ov.querySelector('#pv-prev').onclick = () => go(i-1);
    ov.querySelector('#pv-next').onclick = () => go(i+1);
    ov.querySelector('#pv-x').onclick = () => { stopPres(); document.removeEventListener('keydown', onKey); ov.remove(); };

    let presRaf = null, presPlaying = false;
    function stopPres(){ if(presRaf){ cancelAnimationFrame(presRaf); clearTimeout(presRaf); presRaf=null; } presPlaying=false; const b=ov.querySelector('#pv-play'); if(b) b.innerHTML=ic.play; }
    function sampler(points){
      const seg=[]; let total=0;
      for(let k=1;k<points.length;k++){ const a=points[k-1],b=points[k]; const l=Math.hypot(b.x-a.x,b.y-a.y); seg.push({a,b,l,acc:total}); total+=l; }
      return (tt)=>{ if(!seg.length) return points[0]; const dist=tt*total; let s=seg[seg.length-1]; for(const x of seg){ if(dist>=x.acc&&dist<=x.acc+x.l){s=x;break;} } const lt=s.l?(dist-s.acc)/s.l:0; return {x:s.a.x+(s.b.x-s.a.x)*lt,y:s.a.y+(s.b.y-s.a.y)*lt}; };
    }
    const ease = (TL.anim&&TL.anim.easeInOut) || (x=>x);
    function animTo(target, done){
      const from = tac.steps[i], to = tac.steps[target];
      // render destination so trajectories show, then move tokens from->to
      i = target; draw();
      const movers = tac.tokens.map(tk=>{ const a=from.pos[tk.id], b=to.pos[tk.id]; if(!a||!b) return null;
        let smp=null; if(tk.type==='ball'){ const bp=(to.paths||[]).find(p=>p.kind==='ball'); if(bp&&bp.points.length>=2) smp=sampler(bp.points); }
        return {id:tk.id,type:tk.type,a,b,smp}; }).filter(Boolean);
      const svg = ov.querySelector('.present-court svg');
      const elFor = (id)=> svg.querySelector(`[data-tid="${id}"]`);
      if (TL.anim&&TL.anim.hitSound) TL.anim.hitSound(1);
      const dur=950; let start=null;
      function frame(ts){ if(start===null)start=ts; const tt=Math.min(1,(ts-start)/dur); const e=ease(tt);
        movers.forEach(m=>{ const p=m.smp?m.smp(e):{x:m.a.x+(m.b.x-m.a.x)*e,y:m.a.y+(m.b.y-m.a.y)*e}; const g=elFor(m.id); if(g){ g.querySelectorAll('circle').forEach(c=>{c.setAttribute('cx',p.x);c.setAttribute('cy',p.y);}); const tx=g.querySelector('text'); if(tx){tx.setAttribute('x',p.x);tx.setAttribute('y',p.y+0.36);} } });
        if(tt<1){ presRaf=requestAnimationFrame(frame); } else { done&&done(); }
      }
      presRaf=requestAnimationFrame(frame);
    }
    function playSeq(){
      if(presPlaying){ stopPres(); return; }
      presPlaying=true; ov.querySelector('#pv-play').innerHTML=ic.pause;
      const startAt = (i>=tac.steps.length-1)?0:i;
      i=startAt; draw();
      const run=()=>{ if(!presPlaying) return; if(i>=tac.steps.length-1){ stopPres(); return; } animTo(i+1, ()=>{ presRaf=setTimeout(run,340); }); };
      presRaf=setTimeout(run,300);
    }
    ov.querySelector('#pv-play').onclick = playSeq;
    function onKey(e){ if(e.key==='ArrowRight'){stopPres();go(i+1);} else if(e.key==='ArrowLeft'){stopPres();go(i-1);} else if(e.key===' '){e.preventDefault();playSeq();} else if(e.key==='Escape'){ stopPres(); document.removeEventListener('keydown', onKey); ov.remove(); } }
    document.addEventListener('keydown', onKey);
  }

  function mirrorTactic() {
    const tac = tactic();
    const cx = C.cx;
    const fx = (x) => 2*cx - x;
    tac.steps.forEach(st => {
      Object.keys(st.pos || {}).forEach(id => { st.pos[id].x = fx(st.pos[id].x); });
      (st.paths || []).forEach(p => (p.points||[]).forEach(pt => { pt.x = fx(pt.x); }));
      (st.annos || []).forEach(a => {
        if (a.points) a.points.forEach(pt => { pt.x = fx(pt.x); });
        if (a.x != null) a.x = fx(a.x);
      });
    });
    renderCourt(); renderSteps();
    if (S().guided) renderCoach();
    persist();
    TL.app.toast(t('flipped'));
  }

  function clearStep() {
    const st = step();
    st.paths = []; st.annos = [];
    renderCourt(); renderSteps(); persist();
  }

  // ============================================================
  // WIRING
  // ============================================================
  function wireBar(root, viewer) {
    root.querySelector('#ed-back').onclick = () => { TL.anim.stop && TL.anim.stop(); TL.app.goHome(); };
    const name = root.querySelector('#ed-name');
    if (name && !viewer) name.addEventListener('input', () => { tactic().name = name.value; persist(); });
    const save = root.querySelector('#ed-save');
    if (save) save.onclick = () => TL.modals.save();
    const flip = root.querySelector('#ed-flip');
    if (flip) flip.onclick = mirrorTactic;
    const pres = root.querySelector('#ed-present');
    if (pres) pres.onclick = presentMode;
    const help = root.querySelector('#ed-help');
    if (help) help.onclick = () => TL.extras && TL.extras.helpModal && TL.extras.helpModal();
    root.querySelector('#ed-share').onclick = () => TL.modals.share();
  }

  function wireRail(root) {
    root.querySelectorAll('.tool').forEach(b => {
      b.onclick = () => { S().tool = b.dataset.tool; refreshTool(); showHint(b.dataset.tool); };
    });
  }

  function refreshTool() {
    const root = TL.app.root;
    root.querySelectorAll('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === S().tool));
    // cursor hint on svg
    if (el.svg) el.svg.style.cursor = (S().tool==='select') ? 'default' : (S().tool==='erase'?'not-allowed':'crosshair');
  }

  let hintTimer;
  function showHint(tool) {
    const map = { select:'hint_select', own:'hint_place', rival:'hint_place', ball:'hint_place',
      point:'hint_place', text:'hint_text', ballpath:'hint_draw', ownmove:'hint_draw', rivalmove:'hint_draw',
      arrow:'hint_draw', line:'hint_draw', zone:'zone_hint', measure:'measure_hint', erase:'tool_erase' };
    clearTimeout(hintTimer);
  }

  function wireInspector(root) {
    root.querySelectorAll('#sw-row .swatch').forEach(b => {
      b.onclick = () => { S().draw.color = (S().draw.color === b.dataset.col) ? null : b.dataset.col; syncInspector(root); };
    });
    root.querySelectorAll('#dash-row .dash-opt').forEach(b => {
      b.onclick = () => { S().draw.dash = b.dataset.dash; syncInspector(root); };
    });
    syncInspector(root);
    // mobile fab
    const fab = root.querySelector('#insp-fab'), scrim = root.querySelector('#insp-scrim');
    if (fab) fab.onclick = () => { el.inspector.classList.add('open'); scrim.classList.add('open'); };
    if (scrim) scrim.onclick = () => { el.inspector.classList.remove('open'); scrim.classList.remove('open'); };
  }
  function syncInspector(root) {
    root.querySelectorAll('#sw-row .swatch').forEach(b => b.classList.toggle('on', S().draw.color === b.dataset.col));
    root.querySelectorAll('#dash-row .dash-opt').forEach(b => b.classList.toggle('on', S().draw.dash === b.dataset.dash));
  }

  function wireTransport(root, viewer) {
    const prev = root.querySelector('#t-prev'); if (prev) prev.onclick = () => goToStep(S().stepIndex-1);
    const next = root.querySelector('#t-next'); if (next) next.onclick = () => goToStep(S().stepIndex+1);
    const rst = root.querySelector('#t-restart'); if (rst) rst.onclick = () => { TL.anim.stop(); goToStep(0); };
    const pl = root.querySelector('#t-play'); if (pl) pl.onclick = () => TL.anim.toggle();
    const rev = root.querySelector('#t-reverse'); if (rev) rev.onclick = () => TL.anim.toggle(true);
    const clear = root.querySelector('#t-clear');
    if (clear) clear.onclick = clearStep;
    root.querySelectorAll('.speed [data-spd]').forEach(b => {
      b.onclick = () => { S().speed = b.dataset.spd; root.querySelectorAll('.speed [data-spd]').forEach(x=>x.classList.toggle('on',x===b)); };
    });
  }

  function wireStageToggles(root) {
    root.querySelectorAll('[data-surf]').forEach(b => {
      b.onclick = () => { tactic().surface = b.dataset.surf; root.querySelectorAll('[data-surf]').forEach(x=>x.classList.toggle('on',x===b)); renderCourt(); renderSteps(); persist(); };
    });
    root.querySelectorAll('[data-view]').forEach(b => {
      b.onclick = () => { tactic().view = b.dataset.view; root.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('on',x===b)); renderCourt(); persist(); };
    });
  }

  function persist() {
    if (S().viewer || tactic().demo) return;       // don't auto-save demo / viewer
    if (S()._saved) TL.store.upsert(tactic());      // only persist once it's been saved at least once
  }

  // ============================================================
  // GUIDED MODE — the coach builds the point shot by shot
  // ============================================================
  function guidedSetup(tac, server) {
    // Robustez: una táctica importada/corrupta puede llegar sin las fichas
    // base (bola / jugador / rival). Sin ellas el editor reventaba al abrir.
    const hasTok = (type) => Array.isArray(tac.tokens) && tac.tokens.some(t => t.type === type);
    if (!hasTok('ball') || !hasTok('own') || !hasTok('rival')) {
      const fresh = TL.store.newTactic(tac.sport, tac.format);
      tac.tokens = fresh.tokens;
    }
    server = server || tac.server || 'own';
    tac.server = server;
    const own = tac.tokens.find(t => t.type === 'own');
    const rival = tac.tokens.find(t => t.type === 'rival');
    const ball = tac.tokens.find(t => t.type === 'ball');
    const own2 = tac.tokens.find(t => t.type === 'own' && t.id !== own.id);
    const rival2 = tac.tokens.find(t => t.type === 'rival' && t.id !== rival.id);
    const s0 = TL.store.blankStep(t('g_start'));
    if (tac.sport === 'padel') {
      // padel: 2v2 inside the glass court; server diagonal, partners forward
      if (server === 'own') {
        s0.pos[own.id]   = { x: C.cx + 1.9, y: C.net + 6.0 };
        s0.pos[rival.id] = { x: C.cx - 1.9, y: C.net - 6.0 };
        s0.pos[ball.id]  = { x: C.cx + 1.6, y: C.net + 5.8 };
      } else {
        s0.pos[rival.id] = { x: C.cx + 1.9, y: C.net - 6.0 };
        s0.pos[own.id]   = { x: C.cx - 1.9, y: C.net + 6.0 };
        s0.pos[ball.id]  = { x: C.cx + 1.6, y: C.net - 5.8 };
      }
      if (own2)   s0.pos[own2.id]   = { x: C.cx - 2.2, y: C.net + 2.6 };
      if (rival2) s0.pos[rival2.id] = { x: C.cx + 2.2, y: C.net - 2.6 };
      tac.steps = [s0];
      tac._guidedInit = true;
      return;
    }
    // server and receiver placed diagonally; ball at the server's racket
    if (server === 'own') {
      s0.pos[own.id]   = { x: C.cx + 1.7, y: C.cBot - 0.5 };   // you serve (near baseline)
      s0.pos[rival.id] = { x: C.cx - 1.9, y: C.cTop + 0.9 };   // rival receives (diagonal)
      s0.pos[ball.id]  = { x: C.cx + 1.4, y: C.cBot - 0.7 };
    } else {
      s0.pos[rival.id] = { x: C.cx + 1.7, y: C.cTop + 0.6 };   // rival serves (far baseline)
      s0.pos[own.id]   = { x: C.cx - 1.9, y: C.cBot - 0.7 };   // you receive (diagonal)
      s0.pos[ball.id]  = { x: C.cx + 1.4, y: C.cTop + 0.8 };
    }
    // doubles partners take the net positions on the opposite half
    if (own2) s0.pos[own2.id] = { x: C.cx - 2.4, y: C.net + 3.0 };
    if (rival2) s0.pos[rival2.id] = { x: C.cx + 2.4, y: C.net - 3.0 };
    tac.steps = [s0];
    tac._guidedInit = true;
  }

  function setFormat(fmt) {
    const tac = tactic();
    if ((tac.format || 'singles') === fmt) return;
    tac.format = fmt;
    const owns = tac.tokens.filter(k => k.type === 'own');
    const rivals = tac.tokens.filter(k => k.type === 'rival');
    if (fmt === 'doubles') {
      if (owns.length < 2) tac.tokens.push({ id: TL.store.uid(), type:'own', label:'J2' });
      if (rivals.length < 2) tac.tokens.push({ id: TL.store.uid(), type:'rival', label:'R2' });
    } else {
      // remove partners (keep first of each)
      const keepOwn = owns[0], keepRival = rivals[0];
      tac.tokens = tac.tokens.filter(k => k.type === 'ball' || k.id === keepOwn.id || k.id === keepRival.id);
    }
    guidedSetup(tac, tac.server);
    S().stepIndex = 0;
    renderCourt(); renderSteps(); renderCoach(); persist();
  }

  function setServer(server) {
    const tac = tactic();
    if ((tac.server || 'own') === server) return;
    guidedSetup(tac, server);
    S().stepIndex = 0;
    renderCourt(); renderSteps(); renderCoach(); persist();
  }

  // info for the current (next) shot, aware of who serves
  function coachData() {
    const tac = tactic();
    const srv = tac.server || 'own';
    const recv = srv === 'own' ? 'rival' : 'own';
    const n = tac.steps.length; // 1 = serve, 2 = return, ...
    if (n === 1) return { n, actor:srv,  label:t('g_serve'),  title: srv==='own'?t('g_you_serve'):t('g_rival_serve'),  hint: srv==='own'?t('g_hint_serve'):t('g_hint_rserve') };
    if (n === 2) return { n, actor:recv, label:t('g_return'), title: recv==='own'?t('g_you_return'):t('g_rival_return'), hint: recv==='own'?t('g_hint_yreturn'):t('g_hint_return') };
    const actor = (n % 2 === 1) ? srv : recv;
    const you = actor === 'own';
    return { n, actor, label:t('g_shot')+' '+n, title: you?t('g_you_hit'):t('g_rival_hit'), hint: you?t('g_hint_you'):t('g_hint_rival') };
  }

  // tokens of the side that hits this shot (2 in doubles/padel, 1 in singles)
  function actingTokens(cd) {
    return tactic().tokens.filter(tk => tk.type === cd.actor);
  }
  // which specific player hits: the user's pick if valid, else the one nearest the ball
  function chosenHitter(cd) {
    const toks = actingTokens(cd);
    if (toks.length <= 1) return toks[0];
    const picked = toks.find(tk => tk.id === S().nextHitter);
    if (picked) return picked;
    const tac = tactic();
    const ball = tac.tokens.find(tk => tk.type === 'ball');
    const last = tac.steps[tac.steps.length - 1];
    const bp = (last && ball) ? last.pos[ball.id] : null;
    if (!bp) return toks[0];
    return toks.slice().sort((a, b) => {
      const pa = last.pos[a.id] || { x:0, y:0 }, pb = last.pos[b.id] || { x:0, y:0 };
      return Math.hypot(pa.x-bp.x, pa.y-bp.y) - Math.hypot(pb.x-bp.x, pb.y-bp.y);
    })[0];
  }

  function stepTitleFor(n) {
    if (n === 1) return t('g_serve');
    if (n === 2) return t('g_return');
    return t('g_shot') + ' ' + n;
  }

  // keep a player on their own half of the court (own = near/bottom, rival = far/top)
  // so a token never "crosses the net" to the opponent's side when it runs to the ball.
  function clampHalf(type, pt) {
    if (type === 'ball') return pt;          // the ball legitimately crosses
    const m = 0.7;                            // small buffer off the net
    const p = { x: pt.x, y: pt.y };
    if (type === 'own')   p.y = Math.max(p.y, C.net + m);   // stay below the net
    if (type === 'rival') p.y = Math.min(p.y, C.net - m);   // stay above the net
    return p;
  }

  // perpendicular arc whose height depends on the shot type
  const SHOT_ARC = { plana: 0.05, cortado: 0.11, lift: 0.20, globo: 0.52, dejada: 0.34 };
  function arcPoints(a, b, type) {
    const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
    const dx = b.x-a.x, dy = b.y-a.y, len = Math.hypot(dx,dy) || 1;
    const factor = SHOT_ARC[type] != null ? SHOT_ARC[type] : 0.18;
    const off = Math.min(len * factor, type === 'globo' ? 4.5 : 2.2);
    const dir = (a.x <= b.x) ? 1 : -1;          // bow naturally to one side
    return [ {...a}, { x: mx + (-dy/len)*off*dir, y: my + (dx/len)*off*dir }, {...b} ];
  }

  function nextShot(target) {
    const tac = tactic();
    const n = tac.steps.length;                 // shot number we're placing
    const ball = tac.tokens.find(t => t.type === 'ball');
    const cd = coachData();
    const hitter = chosenHitter(cd);
    const last = tac.steps[tac.steps.length - 1];
    const prevBall = { ...last.pos[ball.id] };
    const stype = S().shotType || 'lift';

    const ns = TL.store.blankStep(stepTitleFor(n));
    ns.pos = JSON.parse(JSON.stringify(last.pos));
    if (n > 1) ns.pos[hitter.id] = clampHalf(hitter.type, prevBall);    // hitter ran to the ball (never crossing the net)
    ns.pos[ball.id] = { ...target };            // ball flies to the chosen spot
    ns.shot = stype;
    ns.paths = [{ id: TL.store.uid(), kind:'ball', dash: stype==='dejada'?'dash':'solid', shot: stype, points: arcPoints(prevBall, target, stype) }];

    tac.steps.push(ns);
    S().nextHitter = null;                       // reset pick for the following shot
    S().stepIndex = tac.steps.length - 1;
    renderCourt(); renderSteps(); renderCoach(); persist();
    const node = el.steps.querySelector(`.step[data-i="${S().stepIndex}"]`);
    if (node) node.scrollIntoView({ block:'nearest', inline:'center' });
  }

  function undoShot() {
    const tac = tactic();
    if (tac.steps.length <= 1) return;
    tac.steps.pop();
    S().stepIndex = tac.steps.length - 1;
    renderCourt(); renderSteps(); renderCoach(); persist();
  }

  function switchToAdvanced() {
    S().guided = false;
    S().tool = 'select';
    render();
    TL.app.toast(t('advanced_on'));
  }

  function coachHtml() { return `<div class="coach" id="coach">${coachInner()}</div>`; }

  // shot-type list (guided): how you hit the ball -> arc shape
  function shotTypeHtml() {
    const types = [
      ['plana',  'M3 13h18'],
      ['cortado','M3 11C8 15 16 9 21 13'],
      ['lift',   'M3 15C8 7 16 7 21 15'],
      ['globo',  'M3 17C8 1 16 1 21 17'],
      ['dejada', 'M3 14C7 9 10 9 12 14'],
    ];
    return `<div class="cp-shots">
      <div class="cp-h">${t('shot_how')}</div>
      <div class="shot-col">
      ${types.map(([k,d])=>`<button class="stype ${S().shotType===k?'on':''}" data-stype="${k}"><svg viewBox="0 0 24 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="${d}"/></svg>${t('shot_'+k)}</button>`).join('')}
      </div>
    </div>`;
  }

  function coachInner() {
    const tac = tactic();
    const cd = coachData();
    const own = tac.tokens.find(x => x.type==='own');
    const rival = tac.tokens.find(x => x.type==='rival');
    const isYou = cd.actor === 'own';
    const col = isYou ? 'var(--c-own)' : 'var(--c-rival)';
    const label = isYou ? own.label : rival.label;
    const surfs = ['clay','hard','grass','indoor'];
    const atStart = tac.steps.length === 1;
    const srv = tac.server || 'own';
    return `
      <div class="cp-turn">
        <span class="avatar" style="background:${col};color:${isYou?'#1A1E12':'#fff'}">${esc(label)}</span>
        <div class="cp-turn-tx">
          <div class="coach-step">${esc(cd.label.toUpperCase())} · ${isYou?t('turn_you'):t('turn_rival')}</div>
          <div class="coach-title">${cd.title}</div>
        </div>
      </div>
      <div class="coach-hint">${ic.cursor}${cd.hint}</div>
      ${(function(){
        const toks = actingTokens(cd);
        if (toks.length <= 1) return '';
        const pick = chosenHitter(cd);
        const sideCol = isYou ? 'var(--c-own)' : 'var(--c-rival)';
        return `<div class="hit-pick">
          <span class="sp-label">${t('who_hits')}</span>
          <div class="sp-row">
            ${toks.map(tk=>`<button class="hit-btn ${pick&&pick.id===tk.id?'on':''}" data-hit="${tk.id}"><span class="avatar sm" style="background:${sideCol};color:${isYou?'#1A1E12':'#fff'}">${esc(tk.label)}</span></button>`).join('')}
          </div>
        </div>`;
      })()}
      ${atStart ? `<div class="serve-pick">
        <span class="sp-label">${t('mode_play')}</span>
        <div class="sp-row">
          <button class="sp-btn ${(tac.format||'singles')==='singles'?'on':''}" data-fmt="singles">${t('singles')}</button>
          <button class="sp-btn ${tac.format==='doubles'?'on':''}" data-fmt="doubles">${t('doubles')}</button>
        </div>
      </div>
      <div class="serve-pick">
        <span class="sp-label">${t('who_serves')}</span>
        <div class="sp-row">
          <button class="sp-btn ${srv==='own'?'on':''}" data-srv="own">${t('i_serve')}</button>
          <button class="sp-btn ${srv==='rival'?'on':''}" data-srv="rival">${t('rival_serves')}</button>
        </div>
      </div>` : ''}
      ${shotTypeHtml()}
      <div class="cp-foot">
        <div class="surf-dots">${surfs.map(s=>`<button class="sdot ${tac.surface===s?'on':''}" data-surf="${s}" title="${t('surf_'+s)}" style="--sc:${C.SURF[s].in}"></button>`).join('')}</div>
        <button class="link-adv" id="c-adv">${t('g_advanced')} →</button>
      </div>`;
  }

  // guided: controls panel on the left, big court in the middle, steps on the right
  function guidedStageHtml() {
    return `<div class="guided-body">
      <div class="control-panel" id="coach">${coachInner()}</div>
      <div class="court-hold">
        <svg id="court" class="court-svg" xmlns="http://www.w3.org/2000/svg"></svg>
      </div>
      <aside class="steps-side">
        <div class="kicker steps-side-h">${t('steps')}</div>
        <div class="steps" id="steps"></div>
      </aside>
    </div>
    <div class="g-actionbar">
      <button class="btn btn-ghost" id="c-undo">${ic.restart}${t('g_undo')}</button>
      <div class="g-play">
        <button class="btn btn-primary btn-lg" id="c-play">${ic.play}${t('g_watch')}</button>
        <div class="speed">${['slow','normal','fast'].map(s=>`<button data-spd="${s}" class="${S().speed===s?'on':''}">${t(s)}</button>`).join('')}</div>
      </div>
      <button class="btn btn-line" id="c-finish">${ic.check}${t('g_finish')}</button>
    </div>`;
  }

  // enable/disable the guided action buttons based on shots placed
  function updateGuidedActions() {
    const done = tactic().steps.length - 1;
    ['c-undo','c-play','c-finish'].forEach(id => {
      const b = TL.app.root.querySelector('#' + id);
      if (b) b.disabled = done < 1;
    });
    const gb = TL.app.root.querySelector('.guided-body');
    if (gb) gb.classList.toggle('has-shots', done >= 1);
  }

  function renderCoach() {
    const c = TL.app.root.querySelector('#coach');
    if (c) { c.innerHTML = coachInner(); }
    updateGuidedActions();
    wireCoach(TL.app.root);
  }

  function wireCoach(root) {
    const u = root.querySelector('#c-undo'); if (u) u.onclick = undoShot;
    const p = root.querySelector('#c-play'); if (p) p.onclick = () => TL.anim.toggle();
    const f = root.querySelector('#c-finish'); if (f) f.onclick = () => TL.modals.save();
    const a = root.querySelector('#c-adv'); if (a) a.onclick = switchToAdvanced;
    root.querySelectorAll('.sp-btn').forEach(b => b.onclick = () => { if (b.dataset.srv) setServer(b.dataset.srv); else if (b.dataset.fmt) setFormat(b.dataset.fmt); });
    root.querySelectorAll('.hit-btn').forEach(b => b.onclick = () => {
      S().nextHitter = b.dataset.hit;
      renderCoach(); renderCourt();
    });
    root.querySelectorAll('.stype').forEach(b => b.onclick = () => {
      S().shotType = b.dataset.stype;
      root.querySelectorAll('.stype').forEach(x => x.classList.toggle('on', x === b));
    });
  }

  // ---- COACHMARKS (first guided run) ------------------------------
  function maybeCoach() {
    if (localStorage.getItem('tl_coach_editor')) return;
    setTimeout(() => {
      // only if guided layout actually rendered
      if (!TL.app.root.querySelector('.guided-body')) return;
      const en = TL.i18n.lang === 'en';
      runCoach([
        { sel:'#coach', side:'right',
          title: en?'Your coach panel':'Tu panel de entrenador',
          text: en?'We tell you whose turn it is and which shot to draw. Pick how the ball is hit here.':'Te decimos a quién le toca y qué golpe dibujar. Elige aquí cómo se golpea la bola.' },
        { sel:'.court-hold', side:'top',
          title: en?'Tap the court':'Toca en la pista',
          text: en?'Tap where the ball lands. Players follow automatically — you just place each shot.':'Toca dónde cae la bola. Los jugadores se mueven solos — tú solo colocas cada golpe.' },
        { sel:'#c-play', side:'top',
          title: en?'Watch it animate':'Mírala animada',
          text: en?'After a couple of shots, press here to see the point play out with real timing.':'Tras un par de golpes, pulsa aquí para ver el punto con tiempos reales.' },
        { sel:'#c-finish', side:'top',
          title: en?'Save your play':'Guarda tu jugada',
          text: en?'Done? Save it to your library, link a rival and replay it anytime.':'¿Listo? Guárdala en tu biblioteca, enlaza un rival y reprodúcela cuando quieras.' },
      ]);
    }, 480);
  }

  function runCoach(steps) {
    const en = TL.i18n.lang === 'en';
    const ov = document.createElement('div');
    ov.className = 'cmk-overlay';
    ov.innerHTML = `<div class="cmk-ring"></div>
      <div class="cmk-pop">
        <div class="cmk-n"></div>
        <h4></h4><p></p>
        <div class="cmk-foot">
          <button class="cmk-skip">${en?'Skip':'Saltar'}</button>
          <button class="cmk-next btn btn-primary btn-sm"></button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const ring = ov.querySelector('.cmk-ring');
    const pop = ov.querySelector('.cmk-pop');
    const nEl = ov.querySelector('.cmk-n'), hEl = pop.querySelector('h4'), pEl = pop.querySelector('p');
    const nextBtn = ov.querySelector('.cmk-next'), skipBtn = ov.querySelector('.cmk-skip');
    let i = 0;

    function done() {
      localStorage.setItem('tl_coach_editor','1');
      window.removeEventListener('resize', place);
      ov.classList.remove('show');
      setTimeout(() => ov.remove(), 220);
    }
    function place() {
      const s = steps[i];
      const node = TL.app.root.querySelector(s.sel);
      if (!node) { i++; if (i >= steps.length) return done(); return place(); }
      const r = node.getBoundingClientRect();
      const pad = 6;
      const rx = Math.max(4, r.left - pad), ry = Math.max(4, r.top - pad);
      const rw = Math.min(window.innerWidth - rx - 4, r.width + pad*2);
      const rh = Math.min(window.innerHeight - ry - 4, r.height + pad*2);
      ring.style.left = rx+'px'; ring.style.top = ry+'px';
      ring.style.width = rw+'px'; ring.style.height = rh+'px';
      // populate
      nEl.textContent = `${i+1} / ${steps.length}`;
      hEl.textContent = s.title; pEl.textContent = s.text;
      nextBtn.textContent = i === steps.length-1 ? (en?'Got it':'¡Entendido!') : (en?'Next':'Siguiente');
      // position pop
      const pw = 300, gap = 14;
      pop.style.width = pw+'px';
      let top, left;
      const side = s.side || 'top';
      if (side === 'right' && rx + rw + gap + pw < window.innerWidth) {
        left = rx + rw + gap; top = ry;
      } else if (ry > 200) { // above
        left = Math.min(Math.max(8, rx + rw/2 - pw/2), window.innerWidth - pw - 8);
        top = ry - gap - pop.offsetHeight;
      } else { // below
        left = Math.min(Math.max(8, rx + rw/2 - pw/2), window.innerWidth - pw - 8);
        top = ry + rh + gap;
      }
      // clamp vertically after we know height
      requestAnimationFrame(() => {
        let tp = top;
        if (side !== 'right') tp = (ry > 200) ? ry - gap - pop.offsetHeight : ry + rh + gap;
        tp = Math.min(Math.max(8, tp), window.innerHeight - pop.offsetHeight - 8);
        pop.style.top = tp+'px';
      });
      pop.style.left = left+'px';
      pop.style.top = top+'px';
    }
    nextBtn.onclick = () => { i++; if (i >= steps.length) done(); else place(); };
    skipBtn.onclick = done;
    ov.addEventListener('click', (e) => { if (e.target === ov) done(); });
    window.addEventListener('resize', place);
    requestAnimationFrame(() => { ov.classList.add('show'); place(); });
  }

  // ---- public API -------------------------------------------------
  function open(tac, opts) {
    opts = opts || {};
    S().tactic = tac;
    S().stepIndex = 0;
    S().viewer = !!opts.viewer;
    S().guided = !!opts.guided && !opts.viewer;
    S().tool = S().guided ? 'guided' : 'select';
    S().playing = false;
    S()._saved = !!opts.saved;
    S().view = 'editor';
    // fija barra/'mundo club' ANTES de render (correcto aunque la táctica venga mal)
    if (TL.app && TL.app.updateTabbar) TL.app.updateTabbar();
    if (S().guided && tac.steps.length <= 1 && !tac._guidedInit) guidedSetup(tac);
    render();
    if (TL.app && TL.app.updateTabbar) TL.app.updateTabbar();
  }

  TL.editor = { open, render, renderCourt, renderSteps, goToStep, step, tactic, toCourt,
    get svg(){ return el.svg; }, persist,
    setPlayState(on, rev){
      const b = TL.app.root.querySelector('#t-play');
      if (b){ b.innerHTML = (on&&!rev)?ic.pause:ic.play; b.title = (on&&!rev)? t('pause'):t('play'); }
      const r = TL.app.root.querySelector('#t-reverse');
      if (r){ r.innerHTML = (on&&rev)?ic.pause:ic.reverse; r.classList.toggle('on', !!(on&&rev)); }
      const c = TL.app.root.querySelector('#c-play');
      if (c){ c.innerHTML = (on?ic.pause:ic.play) + (on? t('pause') : t('g_watch')); }
    },
    markSaved(){ S()._saved = true; }, undoShot };
})(window.TL = window.TL || {});
