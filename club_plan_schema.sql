/* ============================================================
   store.js — state + localStorage persistence + factories
   ============================================================ */
(function (TL) {
  const KEY = 'tl_tactics_v1';
  const FKEY = 'tl_folders_v1';
  const RKEY = 'tl_rivals_v1';
  const MKEY = 'tl_matches_v1';
  const C = TL.court;

  // ---- memoized parse cache --------------------------------------
  // Each storage key is JSON-parsed ONCE and reused until a save invalidates it.
  // Eliminates the repeated JSON.parse storms during a single view render
  // (a home render used to re-parse localStorage ~12x; list rows did it per-row).
  const _cache = Object.create(null);
  function _read(key) {
    let v = _cache[key];
    if (v !== undefined) return v;
    try { v = JSON.parse(localStorage.getItem(key)) || []; } catch (e) { v = []; }
    _cache[key] = v; return v;
  }
  function _write(key, list) {
    const json = JSON.stringify(list);
    try {
      localStorage.setItem(key, json);
      _cache[key] = list;            // cachea SOLO tras escribir bien (evita que la UI mienta)
    } catch (e) {
      // escritura fallida (p. ej. almacenamiento lleno): mantén la caché igual que el disco
      try { _cache[key] = JSON.parse(localStorage.getItem(key)) || []; } catch (_) {}
      try { TL.app && TL.app.toast && TL.app.toast(TL.i18n && TL.i18n.lang === 'en' ? 'Could not save — storage full' : 'No se pudo guardar — almacenamiento lleno'); } catch (_) {}
      throw e;
    }
  }
  function invalidate(key) { if (key) delete _cache[key]; else for (const k in _cache) delete _cache[k]; }

  TL.PATH_COLORS = { ball:'#FFFFFF', own:'#D7F23A', rival:'#FF5B5B', arrow:'#5BC8FF', line:'#5BC8FF' };

  // tag palette (color + i18n key)
  TL.TAGS = [
    { id:'serve',   color:'#D7F23A', key:'tag_serve' },
    { id:'return',  color:'#5BC8FF', key:'tag_return' },
    { id:'defense', color:'#B07BFF', key:'tag_defense' },
    { id:'attack',  color:'#FF5B5B', key:'tag_attack' },
    { id:'special', color:'#FFB13B', key:'tag_special' },
  ];
  TL.tagById = (id) => TL.TAGS.find(x => x.id === id) || null;

  function uid() { return Math.random().toString(36).slice(2, 9); }
  function now() { return Date.now(); }

  function loadAll() {
    const list = _read(KEY);
    // Robustez: una táctica sin steps/tokens (datos viejos, sync corrupto o
    // importación incompleta) reventaba la vista entera al renderizar. Normaliza
    // en sitio para que toda táctica sea segura de pintar.
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (!t || typeof t !== 'object') continue;
      if (!Array.isArray(t.steps) || t.steps.length === 0) t.steps = [{ id: uid(), pos: {}, paths: [] }];
      if (!Array.isArray(t.tokens)) t.tokens = [];
    }
    return list;
  }
  function saveAll(list) { _write(KEY, list); }

  // ---- folders ---------------------------------------------------
  function loadFolders() { return _read(FKEY); }
  function saveFolders(list) { _write(FKEY, list); }
  function addFolder(name) {
    const list = loadFolders();
    const f = { id: uid(), name: (name || 'Carpeta').trim(), createdAt: now() };
    list.push(f); saveFolders(list); return f;
  }
  function renameFolder(id, name) {
    const list = loadFolders(); const f = list.find(x => x.id === id);
    if (f) { f.name = name; saveFolders(list); }
  }
  function removeFolder(id) {
    saveFolders(loadFolders().filter(f => f.id !== id));
    const list = loadAll(); list.forEach(t => { if (t.folderId === id) t.folderId = ''; }); saveAll(list);
  }

  // ---- rivals ----------------------------------------------------
  function loadRivals() { return _read(RKEY); }
  function saveRivals(list) { _write(RKEY, list); }
  function upsertRival(r) {
    const list = loadRivals();
    if (!r.id) r.id = uid();
    r.updatedAt = now();
    const i = list.findIndex(x => x.id === r.id);
    if (i >= 0) list[i] = Object.assign({}, list[i], r); else { r.createdAt = now(); list.unshift(r); }
    saveRivals(list); return r;
  }
  function removeRival(id) {
    saveRivals(loadRivals().filter(r => r.id !== id));
    const list = loadAll(); list.forEach(t => { if (t.rivalId === id) t.rivalId = ''; }); saveAll(list);
    saveMatches(loadMatches().filter(m => m.rivalId !== id));
  }

  // ---- matches ---------------------------------------------------
  function loadMatches() { return _read(MKEY); }
  function saveMatches(list) { _write(MKEY, list); }
  function upsertMatch(m) {
    const list = loadMatches();
    if (!m.id) m.id = uid();
    m.updatedAt = now();
    const i = list.findIndex(x => x.id === m.id);
    if (i >= 0) list[i] = m; else { m.createdAt = now(); list.unshift(m); }
    saveMatches(list); return m;
  }
  function removeMatch(id) { saveMatches(loadMatches().filter(m => m.id !== id)); }

  // ---- training diary --------------------------------------------
  const DKEY = 'tl_diary_v1';
  function loadDiary() { return _read(DKEY); }
  function saveDiary(list) { _write(DKEY, list); }
  function upsertDiary(d) {
    const list = loadDiary();
    if (!d.id) d.id = uid();
    d.updatedAt = now();
    const i = list.findIndex(x => x.id === d.id);
    if (i >= 0) list[i] = d; else { d.createdAt = now(); list.unshift(d); }
    saveDiary(list); return d;
  }
  function removeDiary(id) { saveDiary(loadDiary().filter(d => d.id !== id)); }

  // ---- season goals ----------------------------------------------
  const GKEY = 'tl_goals_v1';
  function loadGoals() { return _read(GKEY); }
  function saveGoals(list) { _write(GKEY, list); }
  function upsertGoal(g) {
    const list = loadGoals();
    if (!g.id) g.id = uid();
    g.updatedAt = now();
    const i = list.findIndex(x => x.id === g.id);
    if (i >= 0) list[i] = g; else { g.createdAt = now(); list.unshift(g); }
    saveGoals(list); return g;
  }
  function removeGoal(id) { saveGoals(loadGoals().filter(g => g.id !== id)); }

  // compute current value of an auto goal from match stats
  function goalProgress(g) {
    if (g.type === 'manual') return { cur: g.current||0, target: g.target||1, pct: Math.min(100, Math.round((g.current||0)/(g.target||1)*100)) };
    const decided = loadMatches().filter(m => m.played && (m.outcome==='win'||m.outcome==='loss'));
    let pool = decided;
    if (g.surface) pool = pool.filter(m => m.surface === g.surface);
    const wins = pool.filter(m => m.outcome==='win').length;
    if (g.type === 'winrate') {
      const pct = pool.length ? Math.round(wins/pool.length*100) : 0;
      return { cur: pct, target: g.target||70, pct: Math.min(100, Math.round(pct/(g.target||70)*100)), label: `${pct}% (${wins}/${pool.length})` };
    }
    if (g.type === 'wins') {
      return { cur: wins, target: g.target||10, pct: Math.min(100, Math.round(wins/(g.target||10)*100)), label: `${wins}/${g.target||10}` };
    }
    if (g.type === 'matches') {
      const n = pool.length;
      return { cur: n, target: g.target||10, pct: Math.min(100, Math.round(n/(g.target||10)*100)), label: `${n}/${g.target||10}` };
    }
    return { cur:0, target:1, pct:0 };
  }

  // ---- factories -------------------------------------------------
  function blankStep(title) {
    return { id: uid(), title: title || '', pos: {}, paths: [], annos: [] };
  }

  // a fresh tactic with the 3 default tokens placed sensibly
  function newTactic(sport) {
    sport = sport || 'tennis';
    if (sport === 'padel') {
      const o1 = { id: uid(), type:'own',   label:'J1' };
      const o2 = { id: uid(), type:'own',   label:'J2' };
      const r1 = { id: uid(), type:'rival', label:'R1' };
      const r2 = { id: uid(), type:'rival', label:'R2' };
      const ball = { id: uid(), type:'ball', label:'●' };
      const s1 = blankStep('');
      s1.pos[o1.id] = { x: C.cx - 2.4, y: C.net + 5.2 };
      s1.pos[o2.id] = { x: C.cx + 2.4, y: C.net + 5.2 };
      s1.pos[r1.id] = { x: C.cx - 2.4, y: C.net - 5.2 };
      s1.pos[r2.id] = { x: C.cx + 2.4, y: C.net - 5.2 };
      s1.pos[ball.id] = { x: C.cx - 2.0, y: C.net + 5.0 };
      return {
        id: uid(), name:'', number:'', folderId:'', rivalId:'', description:'',
        sport:'padel', surface:'hard', playType:'serve', tag:'', score:'any', format:'doubles',
        rival:'', view:'full', tokens:[o1,o2,r1,r2,ball], steps:[s1],
        createdAt: now(), updatedAt: now(),
      };
    }
    if (sport === 'pickle') {
      const o1 = { id: uid(), type:'own',   label:'J1' };
      const o2 = { id: uid(), type:'own',   label:'J2' };
      const r1 = { id: uid(), type:'rival', label:'R1' };
      const r2 = { id: uid(), type:'rival', label:'R2' };
      const ball = { id: uid(), type:'ball', label:'●' };
      const s1 = blankStep('');
      // ready position: both pairs up at their kitchen line (classic pickleball stance)
      s1.pos[o1.id] = { x: C.cx - 1.5, y: C.kKitBot + 0.5 };
      s1.pos[o2.id] = { x: C.cx + 1.5, y: C.kKitBot + 0.5 };
      s1.pos[r1.id] = { x: C.cx - 1.5, y: C.kKitTop - 0.5 };
      s1.pos[r2.id] = { x: C.cx + 1.5, y: C.kKitTop - 0.5 };
      s1.pos[ball.id] = { x: C.cx - 1.2, y: C.kKitBot + 0.5 };
      return {
        id: uid(), name:'', number:'', folderId:'', rivalId:'', description:'',
        sport:'pickle', surface:'hard', playType:'serve', tag:'', score:'any', format:'doubles',
        rival:'', view:'full', tokens:[o1,o2,r1,r2,ball], steps:[s1],
        createdAt: now(), updatedAt: now(),
      };
    }
    const own  = { id: uid(), type: 'own',   label: 'J1' };
    const rival= { id: uid(), type: 'rival', label: 'R1' };
    const ball = { id: uid(), type: 'ball',  label: '●' };
    const s1 = blankStep('');
    s1.pos[own.id]   = { x: C.cx - 2.4, y: C.cBot - 0.5 };
    s1.pos[rival.id] = { x: C.cx + 1.0, y: C.cTop + 0.6 };
    s1.pos[ball.id]  = { x: C.cx - 2.0, y: C.cBot - 0.7 };
    return {
      id: uid(),
      name: '',
      number: '',
      folderId: '',
      rivalId: '',
      description: '',
      sport: 'tennis',
      surface: 'hard',
      playType: 'serve',
      tag: '',
      score: 'any',
      format: 'singles',
      rival: '',
      view: 'full',
      tokens: [own, rival, ball],
      steps: [s1],
      createdAt: now(),
      updatedAt: now(),
    };
  }

  // a rich demo tactic used on the home screen + as a quick start
  function demoTactic(lang) {
    const names = (TL.i18n && TL.i18n.lang === 'en')
      ? ['Wide serve','Cross-court return','Forehand to backhand','Net rush','Point finish']
      : ['Saque abierto','Resto cruzado','Derecha al revés','Subida a red','Cierre del punto'];
    const own  = { id:'own1',  type:'own',   label:'J1' };
    const rival= { id:'riv1',  type:'rival', label:'R1' };
    const ball = { id:'bal1',  type:'ball',  label:'●' };
    const cx = C.cx;
    // helper for positions
    const P = (x, y) => ({ x, y });
    const steps = [];

    // step 1 — wide serve
    let s = blankStep(names[0]);
    s.pos = { own1:P(cx+3.0, C.cBot-0.4), riv1:P(cx-2.6, C.cTop+0.8), bal1:P(cx+2.7, C.cBot-0.6) };
    s.paths = [{ id:uid(), kind:'ball', dash:'solid',
      points:[P(cx+2.7,C.cBot-0.6),P(cx+0.5,C.net),P(cx-2.4,C.svcTop-0.6),P(cx-3.4,C.cTop+1.6)] }];
    steps.push(s);

    // step 2 — cross-court return
    s = blankStep(names[1]);
    s.pos = { own1:P(cx+2.2, C.cBot-0.6), riv1:P(cx-3.4, C.cTop+1.6), bal1:P(cx-3.4,C.cTop+1.9) };
    s.paths = [{ id:uid(), kind:'rival', dash:'dash',
      points:[P(cx-2.6,C.cTop+0.8),P(cx-3.4,C.cTop+1.6)] },
      { id:uid(), kind:'ball', dash:'solid',
      points:[P(cx-3.4,C.cTop+1.9),P(cx-0.5,C.net),P(cx+2.0,C.svcBot+0.5),P(cx+2.4,C.cBot-1.0)] }];
    steps.push(s);

    // step 3 — forehand to backhand
    s = blankStep(names[2]);
    s.pos = { own1:P(cx+2.4, C.cBot-1.0), riv1:P(cx+2.0, C.cTop+1.2), bal1:P(cx+2.0,C.cTop+1.5) };
    s.paths = [{ id:uid(), kind:'own', dash:'dash',
      points:[P(cx+2.2,C.cBot-0.6),P(cx+2.4,C.cBot-1.0)] },
      { id:uid(), kind:'rival', dash:'dash',
      points:[P(cx-3.4,C.cTop+1.6),P(cx+2.0,C.cTop+1.2)] },
      { id:uid(), kind:'ball', dash:'solid',
      points:[P(cx+2.4,C.cBot-1.0),P(cx,C.net),P(cx+1.8,C.svcTop-0.4),P(cx+2.0,C.cTop+1.5)] }];
    steps.push(s);

    // step 4 — net rush
    s = blankStep(names[3]);
    s.pos = { own1:P(cx-1.0, C.net+2.6), riv1:P(cx+1.4, C.cTop+1.0), bal1:P(cx-3.2,C.cTop+2.2) };
    s.paths = [{ id:uid(), kind:'own', dash:'dash',
      points:[P(cx+2.4,C.cBot-1.0),P(cx+0.6,C.net+4.6),P(cx-1.0,C.net+2.6)] },
      { id:uid(), kind:'ball', dash:'solid',
      points:[P(cx+2.0,C.cTop+1.5),P(cx,C.net),P(cx-3.2,C.cTop+2.2)] }];
    steps.push(s);

    // step 5 — point finish (volley winner)
    s = blankStep(names[4]);
    s.pos = { own1:P(cx-0.6, C.net+2.2), riv1:P(cx+1.4, C.cTop+1.0), bal1:P(cx+3.6,C.cBot-3.0) };
    s.paths = [{ id:uid(), kind:'ball', dash:'solid',
      points:[P(cx-3.2,C.cTop+2.2),P(cx-1.0,C.net+0.4),P(cx+2.0,C.net+3.0),P(cx+3.6,C.cBot-3.0)] },
      { id:uid(), kind:'arrow', dash:'solid',
      points:[P(cx+1.0,C.cBot-5.0),P(cx+3.4,C.cBot-3.4)] }];
    s.annos = [{ id:uid(), type:'text', x:cx+0.2, y:C.cBot-4.0, text: (TL.i18n&&TL.i18n.lang==='en')?'Winner!':'¡Punto!' }];
    steps.push(s);

    return {
      id: 'demo', name: (TL.i18n&&TL.i18n.lang==='en')?'Serve & net pressure':'Saque y presión a la red',
      description: (TL.i18n&&TL.i18n.lang==='en')?'Wide serve, open the court and close at the net.':'Saque abierto, abre la pista y cierra en la red.',
      surface:'clay', playType:'serve', rival:'', view:'full',
      tokens:[own,rival,ball], steps, createdAt:now()-86400000, updatedAt:now()-3600000, demo:true,
    };
  }

  // ---- DEMO SEED: fill the app with example plays, rivals & matches ----
  // Lets a first-run user SEE how powerful the app is (plays + scouting + match log)
  // instead of staring at empty screens. Everything is tagged seed:true so
  // "start fresh" wipes it cleanly without touching the user's own work.
  function hasSeed() {
    return loadAll().some(t=>t.seed) || loadRivals().some(r=>r.seed) || loadMatches().some(m=>m.seed);
  }
  function seedDemo() {
    if (hasSeed()) return;
    const en = TL.i18n && TL.i18n.lang === 'en';
    const D = 86400000;
    const iso = (daysFromNow) => new Date(now()+daysFromNow*D).toISOString().slice(0,10);

    // ---------- folders ----------
    const folders = loadFolders();
    const fServe = { id: uid(), name: en?'Serve patterns':'Patrones de saque', createdAt: now()-30*D, seed:true };
    const fPadel = { id: uid(), name: en?'Padel · net play':'Pádel · juego de red', createdAt: now()-20*D, seed:true };
    saveFolders([fServe, fPadel, ...folders]);

    // ---------- example plays (real multi-step templates so animation works) ----------
    const mkTac = (gen, opts) => {
      const tac = gen(); if (!tac) return null;
      Object.assign(tac, { demo:false, seed:true }, opts);
      tac.createdAt = opts.createdAt || now()-5*D;
      tac.updatedAt = opts.updatedAt || now()-2*D;
      return tac;
    };
    const tacs = [
      mkTac(()=>templateTactic('serve_volley'), { name: en?'Serve & net pressure':'Saque y presión a la red', surface:'clay', folderId:fServe.id, fav:true, number:'1', createdAt: now()-12*D, updatedAt: now()-1*D }),
      mkTac(()=>templateTactic('serve_plus1'),  { name: en?'Wide serve +1 forehand':'Saque abierto +1 derecha', surface:'hard', folderId:fServe.id, number:'2', createdAt: now()-9*D, updatedAt: now()-3*D }),
      mkTac(()=>templateTactic('inside_out'),   { name: en?'Inside-out forehand':'Derecha invertida', surface:'hard', fav:true, createdAt: now()-7*D, updatedAt: now()-2*D }),
      mkTac(()=>templateTactic('drop'),         { name: en?'Disguised drop shot':'Dejada disfrazada', surface:'grass', createdAt: now()-5*D, updatedAt: now()-4*D }),
      mkTac(()=>templatePadel('p_saque'),       { name: en?'Serve & take the net':'Saque y tomar la red', folderId:fPadel.id, fav:true, createdAt: now()-6*D, updatedAt: now()-1*D }),
      mkTac(()=>templatePadel('p_globo'),       { name: en?'Lob & steal the net':'Globo y robar la red', folderId:fPadel.id, createdAt: now()-4*D, updatedAt: now()-2*D }),
    ].filter(Boolean);
    saveAll([...tacs, ...loadAll()]);
    const tacId = (i) => tacs[i] ? tacs[i].id : '';

    // ---------- scouted rivals (full fields → rich attack maps) ----------
    const r1 = upsertRival({ name: en?'A. Moretti':'Á. Moreno', sport:'tennis', hand:'right',
      category: en?'Open':'Absoluta', rank:'#42', club: en?'RC Tennis':'RC Tenis',
      best: en?'Heavy forehand':'Derecha pesada', weak: en?'High backhand':'Revés alto',
      style: en?'Aggressive baseliner':'Agresivo de fondo',
      notes: en?'Struggles when pulled to the net. Serve wide on the deuce side.':'Sufre cuando lo llevas a la red. Saca abierto en el lado de iguales.',
      seed:true });
    const r2 = upsertRival({ name: en?'L. Bauer':'L. Bravo', sport:'tennis', hand:'left',
      category: en?'+35':'+35', rank:'#118', club: en?'City Club':'Club Ciudad',
      best: en?'Lefty slice serve':'Saque cortado de zurdo', weak: en?'Movement, fitness':'Movilidad y físico',
      style: en?'Defensive counterpuncher':'Defensivo contragolpeador',
      notes: en?'Long rallies favour him early. Be patient, attack short balls.':'Los peloteos largos le favorecen al inicio. Paciencia y ataca las bolas cortas.',
      seed:true });
    const r3 = upsertRival({ name: en?'Díaz / Soler':'Díaz / Soler', sport:'padel', hand:'right',
      partner: en?'their net poacher':'el de la red', category: en?'2nd cat.':'2ª cat.', rank:'#7',
      best: en?'Aggressive bandeja':'Bandeja agresiva', weak: en?'Back-glass defense':'Defensa de pared',
      style: en?'Net-dominant pair':'Pareja dominante en red',
      notes: en?'Lob the right-side player early, attack the back glass returns.':'Globo al lado derecho pronto y ataca las salidas de pared.',
      seed:true });

    // ---------- logged matches (with sets, lessons, context) ----------
    const mk = (o) => upsertMatch(Object.assign({ played:true, seed:true, sport:'tennis' }, o));
    mk({ rivalId:r1.id, surface:'clay', outcome:'win', result:'6-4 3-6 6-2', sets:[{me:6,op:4},{me:3,op:6},{me:6,op:2}],
      date: iso(-4), tournament: en?'Spring Open':'Open de Primavera', location:'Madrid', round: en?'QF':'Cuartos',
      mtype:'official', conditions:['sun'], duration:'2h 05m', rating:4, tacticIds:[tacId(0)],
      worked: en?'Serving wide opened his backhand all match':'Sacar abierto le abrió el revés todo el partido',
      failed: en?'Too many double faults in the 2nd set':'Demasiadas dobles faltas en el 2º set' });
    mk({ rivalId:r2.id, surface:'hard', outcome:'loss', result:'4-6 6-7', sets:[{me:4,op:6},{me:6,op:7}],
      date: iso(-11), tournament: en?'City Cup':'Copa Ciudad', location:'Valencia', round: en?'R16':'Octavos',
      mtype:'official', conditions:['wind'], duration:'1h 40m', rating:2, tacticIds:[tacId(2)],
      worked: en?'Stayed patient in long rallies':'Aguanté bien los peloteos largos',
      failed: en?'Rushed the short balls and missed':'Precipité las bolas cortas y fallé' });
    mk({ rivalId:r1.id, surface:'hard', outcome:'win', result:'6-3 6-4', sets:[{me:6,op:3},{me:6,op:4}],
      date: iso(-19), tournament: en?'Club League':'Liga del Club', location:'Sevilla', round: en?'Final':'Final',
      mtype:'official', conditions:['indoor'], duration:'1h 25m', rating:5, tacticIds:[tacId(0),tacId(2)],
      worked: en?'Inside-out forehand dominated the points':'La derecha invertida mandó en los puntos', failed:'' });
    mk({ rivalId:r2.id, surface:'clay', outcome:'win', result:'7-5 6-3', sets:[{me:7,op:5},{me:6,op:3}],
      date: iso(-25), tournament: en?'Regional':'Regional', location:'Granada', round: en?'SF':'Semis',
      mtype:'official', conditions:['heat'], duration:'1h 55m', rating:4, tacticIds:[tacId(3)],
      worked: en?'Drop shots broke his rhythm':'Las dejadas le rompieron el ritmo', failed:'' });
    mk({ rivalId:r3.id, surface:'hard', sport:'padel', outcome:'win', result:'6-2 4-6 6-3', sets:[{me:6,op:2},{me:4,op:6},{me:6,op:3}],
      date: iso(-7), tournament: en?'Padel Night':'Pádel Nocturno', location:'Málaga', round: en?'QF':'Cuartos',
      mtype:'friendly', conditions:['night'], duration:'1h 30m', rating:4, tacticIds:[tacId(4),tacId(5)],
      worked: en?'Lobbing the right-side player worked all night':'Globear al del lado derecho funcionó toda la noche',
      failed: en?'Lost the 2nd set rushing the net':'Perdimos el 2º set subiendo con prisa' });

    // ---------- upcoming matches (drive the prep briefing + calendar) ----------
    mk({ played:false, rivalId:r1.id, surface:'clay', sport:'tennis', date: iso(3),
      tournament: en?'Spring Open':'Open de Primavera', location:'Madrid', round: en?'SF':'Semis',
      goal: en?'Serve wide, finish at the net':'Sacar abierto y definir en la red', tacticIds:[tacId(0),tacId(2)] });
    mk({ played:false, rivalId:r3.id, surface:'hard', sport:'padel', date: iso(9),
      tournament: en?'Padel Night':'Pádel Nocturno', location:'Málaga', round: en?'Final':'Final',
      goal: en?'Lob early, control the net':'Globo pronto, controlar la red', tacticIds:[tacId(4)] });

    // ---------- training diary ----------
    upsertDiary({ date: iso(-1), focus: en?'Serve + first ball':'Saque + primera bola', mood:'great', dur:'1h 20m',
      notes: en?'First serve % up. Wide serve feeling automatic.':'Subió el % de primer saque. El saque abierto sale solo.', seed:true });
    upsertDiary({ date: iso(-3), focus: en?'Backhand down the line':'Revés paralelo', mood:'ok', dur:'1h',
      notes: en?'Still floating under pressure. Keep it.':'Aún flota bajo presión. A seguir.', seed:true });
    upsertDiary({ date: iso(-6), focus: en?'Match play':'Juego de partido', mood:'good', dur:'1h 45m',
      notes: en?'Sparring set, closed it 6-4.':'Set de sparring, cerrado 6-4.', seed:true });

    // ---------- season goals ----------
    upsertGoal({ title: en?'Clay win rate ≥ 65%':'Victorias en tierra ≥ 65%', type:'winrate', surface:'clay', target:65, seed:true });
    upsertGoal({ title: en?'15 wins this season':'15 victorias esta temporada', type:'wins', surface:'', target:15, seed:true });
    upsertGoal({ title: en?'Practice 3×/week':'Entrenar 3×/semana', type:'manual', target:36, current:14, seed:true });
  }
  function clearSeed() {
    saveAll(loadAll().filter(t=>!t.seed));
    saveRivals(loadRivals().filter(r=>!r.seed));
    saveMatches(loadMatches().filter(m=>!m.seed));
    saveFolders(loadFolders().filter(f=>!f.seed));
    saveDiary(loadDiary().filter(d=>!d.seed));
    saveGoals(loadGoals().filter(g=>!g.seed));
  }

  // ---- player rank (free progression by usage) ----
  const RANKS = [
    { key:'r_debut',   min:0,    color:'#36D9B0', icon:'🟢' },
    { key:'r_pelot',   min:60,   color:'#D7F23A', icon:'🟡' },
    { key:'r_estr',    min:180,  color:'#F2A93B', icon:'🟠' },
    { key:'r_maestro', min:400,  color:'#FF5B5B', icon:'🔴' },
    { key:'r_crack',   min:750,  color:'#B07BFF', icon:'🟣' },
    { key:'r_leyenda', min:1300, color:'#E8C24B', icon:'🏆' },
  ];
  function rank() {
    const tacs = loadAll().filter(t => !t.demo);
    const matches = loadMatches();
    const played = matches.filter(m => m.played);
    const wins = played.filter(m => m.outcome === 'win').length;
    const padelTacs = tacs.filter(t => t.sport === 'padel').length;
    const pickleTacs = tacs.filter(t => t.sport === 'pickle').length;
    // XP formula
    const xp = tacs.length*10 + played.length*12 + wins*8 + padelTacs*4 + pickleTacs*4;
    let idx = 0;
    for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].min) idx = i;
    const cur = RANKS[idx], next = RANKS[idx+1] || null;
    const pct = next ? Math.min(100, Math.round((xp - cur.min) / (next.min - cur.min) * 100)) : 100;
    return { idx, level: idx+1, xp, key: cur.key, color: cur.color, icon: cur.icon,
      nextKey: next ? next.key : null, toNext: next ? next.min - xp : 0, pct, max: RANKS.length };
  }

  TL.store = {
    loadAll, saveAll, uid, blankStep, newTactic, demoTactic, templateTactic, templatePadel, templatePickle, stats, rank, weeklyRecap,
    seedDemo, clearSeed, hasSeed,
    loadFolders, saveFolders, addFolder, renameFolder, removeFolder,
    loadRivals, saveRivals, upsertRival, removeRival,
    loadMatches, saveMatches, upsertMatch, removeMatch,
    loadDiary, upsertDiary, removeDiary,
    loadGoals, upsertGoal, removeGoal, goalProgress,
    invalidate,
    get(id) { const x = loadAll().find(t => t.id === id); return x ? JSON.parse(JSON.stringify(x)) : x; },
    upsert(tactic) {
      const list = loadAll();
      tactic.updatedAt = now();
      const i = list.findIndex(t => t.id === tactic.id);
      if (i >= 0) list[i] = tactic; else list.unshift(tactic);
      saveAll(list);
    },
    remove(id) { saveAll(loadAll().filter(t => t.id !== id)); },
    duplicate(id) {
      const t = loadAll().find(x => x.id === id);
      if (!t) return null;
      const copy = JSON.parse(JSON.stringify(t));
      copy.id = uid();
      copy.name = (t.name || '') + (TL.i18n.lang === 'en' ? ' (copy)' : ' (copia)');
      copy.createdAt = copy.updatedAt = now();
      delete copy.demo;
      const list = loadAll(); list.unshift(copy); saveAll(list);
      return copy;
    },
    toggleFav(id) {
      const list = loadAll(); const t = list.find(x => x.id === id);
      if (!t) return false; t.fav = !t.fav; t.updatedAt = now(); saveAll(list); return t.fav;
    },
    rematch(id) {
      const m = loadMatches().find(x => x.id === id);
      if (!m) return null;
      const copy = JSON.parse(JSON.stringify(m));
      copy.id = uid();
      copy.date = new Date().toISOString().slice(0,10);
      copy.played = false; copy.outcome = ''; copy.result = ''; copy.sets = [];
      copy.worked = ''; copy.failed = ''; copy.train = ''; copy.rating = 0;
      copy.createdAt = copy.updatedAt = now();
      const list = loadMatches(); list.unshift(copy); saveMatches(list);
      return copy;
    },
  };

  // ---- stats + templates ----------------------------------------
  function stats(sportFilter) {
    const tacs = loadAll(), rivals = loadRivals();
    let matches = loadMatches();
    if (sportFilter && sportFilter !== 'all') matches = matches.filter(m => (m.sport||'tennis') === sportFilter);
    const played = matches.filter(m => m.played);
    const decided = played.filter(m => m.outcome === 'win' || m.outcome === 'loss');
    const wins = decided.filter(m => m.outcome === 'win').length;
    const winRate = decided.length ? Math.round(wins / decided.length * 100) : null;

    // win rate by surface
    const bySurface = {};
    ['clay','hard','grass','indoor'].forEach(s => {
      const d = decided.filter(m => m.surface === s);
      const w = d.filter(m => m.outcome === 'win').length;
      bySurface[s] = { played: played.filter(m => m.surface === s).length, decided: d.length, wins: w,
        rate: d.length ? Math.round(w / d.length * 100) : null };
    });

    // best / worst surface (need at least 1 decided match)
    let bestCourt = null, worstCourt = null;
    ['clay','hard','grass','indoor'].forEach(s => {
      const d = bySurface[s];
      if (d.decided > 0 && d.rate != null) {
        if (!bestCourt || d.rate > bestCourt.rate) bestCourt = { surface: s, rate: d.rate, decided: d.decided };
        if (!worstCourt || d.rate < worstCourt.rate) worstCourt = { surface: s, rate: d.rate, decided: d.decided };
      }
    });

    // group by an arbitrary text key (club / tournament)
    function groupRate(field) {
      const map = {};
      decided.forEach(m => {
        const k = (m[field] || '').trim();
        if (!k) return;
        (map[k] = map[k] || { key:k, decided:0, wins:0 });
        map[k].decided++; if (m.outcome === 'win') map[k].wins++;
      });
      return Object.values(map).map(x => ({ ...x, rate: Math.round(x.wins / x.decided * 100) }))
        .sort((a,b) => b.rate - a.rate || b.decided - a.decided);
    }
    const byClub = groupRate('location');
    const byTournament = groupRate('tournament');

    // success by tactic: across decided matches, how often a tactic was used in a win
    const byTactic = tacs.map(tc => {
      const used = decided.filter(m => (m.tacticIds||[]).includes(tc.id));
      const w = used.filter(m => m.outcome === 'win').length;
      return { id: tc.id, name: tc.name, uses: used.length, wins: w,
        rate: used.length ? Math.round(w / used.length * 100) : null };
    }).filter(x => x.uses > 0).sort((a,b) => (b.rate||0) - (a.rate||0) || b.uses - a.uses);

    // recent decided results (oldest→newest) for the progress chart
    const timeline = decided.slice().sort((a,b) => (a.date||'').localeCompare(b.date||'') || a.createdAt - b.createdAt)
      .map(m => ({ outcome: m.outcome, date: m.date, rivalId: m.rivalId }));

    return { tactics: tacs.length, rivals: rivals.length, matches: matches.length,
      played: played.length, wins, losses: decided.length - wins, winRate, decided: decided.length,
      bySurface, byTactic, timeline, byClub, byTournament, bestCourt, worstCourt };
  }

  // ---- weekly recap (last 7 days) : drives retention + sharing ----
  function weeklyRecap() {
    const D = 86400000;
    const since = now() - 7 * D;
    const todayStr = new Date().toISOString().slice(0,10);
    const sinceStr = new Date(since).toISOString().slice(0,10);

    const tacs = loadAll().filter(t => !t.demo && !t.seed);
    const newTactics = tacs.filter(t => (t.createdAt||0) >= since).length;

    const matches = loadMatches().filter(m => !m.seed);
    // a match counts in the week if it was logged (createdAt) or dated within the window
    const weekMatches = matches.filter(m => (m.createdAt||0) >= since || ((m.date||'') >= sinceStr && (m.date||'') <= todayStr));
    const weekPlayed = weekMatches.filter(m => m.played);
    const weekDecided = weekPlayed.filter(m => m.outcome === 'win' || m.outcome === 'loss');
    const weekWins = weekDecided.filter(m => m.outcome === 'win').length;
    const winRate = weekDecided.length ? Math.round(weekWins / weekDecided.length * 100) : null;

    const diary = (loadDiary() || []).filter(d => (d.createdAt||0) >= since).length;

    // active days: distinct ISO days touched by any created tactic/match/diary entry
    const days = new Set();
    tacs.forEach(t => { if ((t.createdAt||0) >= since) days.add(new Date(t.createdAt).toISOString().slice(0,10)); });
    matches.forEach(m => { if ((m.createdAt||0) >= since) days.add(new Date(m.createdAt).toISOString().slice(0,10)); });
    (loadDiary()||[]).forEach(d => { if ((d.createdAt||0) >= since) days.add(new Date(d.createdAt).toISOString().slice(0,10)); });

    const streak = (TL.achievements && TL.achievements.streak) ? TL.achievements.streak() : 0;
    const total = newTactics + weekPlayed.length + diary;

    return { newTactics, matches: weekPlayed.length, wins: weekWins, decided: weekDecided.length,
      winRate, diary, activeDays: days.size, streak, total,
      weekStart: sinceStr, weekEnd: todayStr };
  }

  // pre-built PÁDEL tactics (2v2) for the template picker
  function templatePadel(kind) {
    const tac = newTactic('padel');
    const owns = tac.tokens.filter(t => t.type === 'own');
    const rivs = tac.tokens.filter(t => t.type === 'rival');
    const o1 = owns[0], o2 = owns[1], r1 = rivs[0], r2 = rivs[1];
    const ball = tac.tokens.find(t => t.type === 'ball');
    const cx = C.cx, net = C.net, P = (x, y) => ({ x, y });
    const en = TL.i18n && TL.i18n.lang === 'en';
    const mk = (title, pos, paths, shot) => { const s = blankStep(title); s.pos = pos; s.paths = paths || []; if (shot) s.shot = shot; return s; };
    const bp = (pts, shot, dash) => ({ id: uid(), kind:'ball', dash: dash||'solid', shot: shot||'lift', points: pts });
    tac.surface = 'hard'; tac.server = 'own'; tac._guidedInit = true;

    if (kind === 'p_saque') {
      tac.name = en ? 'Serve & net' : 'Saque y subida';
      // both of your team move up together to take the net; rivals shift to cover
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [o1.id]:P(cx+2.2,net+7.5), [o2.id]:P(cx-2.4,net+7.0), [r1.id]:P(cx-2.2,net-7.5), [r2.id]:P(cx+2.4,net-7.0), [ball.id]:P(cx+1.9,net+7.2) }),
        mk(en?'Serve':'Saque',
          { [o1.id]:P(cx+1.8,net+4.0), [o2.id]:P(cx-2.4,net+4.5), [r1.id]:P(cx-2.8,net-6.0), [r2.id]:P(cx+2.0,net-6.5), [ball.id]:P(cx-2.6,net-6.5) },
          [bp([P(cx+1.9,net+7.2),P(cx+0.4,net),P(cx-2.6,net-6.5)],'plana')], 'plana'),
        mk(en?'Return':'Resto',
          { [o1.id]:P(cx+1.6,net+2.6), [o2.id]:P(cx-2.0,net+2.6), [r1.id]:P(cx-2.2,net-4.5), [r2.id]:P(cx+2.2,net-4.0), [ball.id]:P(cx+1.2,net+3.0) },
          [bp([P(cx-2.6,net-6.5),P(cx-0.6,net),P(cx+1.2,net+3.0)],'lift')], 'lift'),
        mk(en?'Net winner':'Definición en red',
          { [o1.id]:P(cx+1.2,net+2.0), [o2.id]:P(cx-1.6,net+2.0), [r1.id]:P(cx-1.0,net-3.5), [r2.id]:P(cx+2.6,net-4.5), [ball.id]:P(cx-3.4,net-4.0) },
          [bp([P(cx+1.2,net+3.0),P(cx-0.8,net-1.2),P(cx-3.4,net-4.0)],'cortado')], 'cortado'),
      ];
    } else if (kind === 'p_bandeja') {
      tac.name = en ? 'Bandeja' : 'Bandeja';
      // you drop back to read the lob, hit the bandeja and recover the net; rivals advance then hold
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [o1.id]:P(cx-2.0,net+2.6), [o2.id]:P(cx+2.0,net+2.6), [r1.id]:P(cx-2.2,net-6.5), [r2.id]:P(cx+2.2,net-6.5), [ball.id]:P(cx-2.0,net-6.2) }),
        mk(en?'Rival lob':'Globo del rival',
          { [o1.id]:P(cx-1.6,net+6.0), [o2.id]:P(cx+1.8,net+4.5), [r1.id]:P(cx-2.0,net-3.5), [r2.id]:P(cx+2.2,net-3.0), [ball.id]:P(cx-1.4,net+5.2) },
          [bp([P(cx-2.0,net-6.2),P(cx-1.7,net-1.5),P(cx-1.4,net+5.2)],'globo','dash')], 'globo'),
        mk(en?'Bandeja':'Bandeja',
          { [o1.id]:P(cx-1.6,net+4.0), [o2.id]:P(cx+1.8,net+3.0), [r1.id]:P(cx-2.6,net-3.0), [r2.id]:P(cx+2.2,net-2.8), [ball.id]:P(cx-3.0,net-5.5) },
          [bp([P(cx-1.4,net+5.2),P(cx-1.8,net-0.5),P(cx-3.0,net-5.5)],'cortado')], 'cortado'),
        mk(en?'Hold the net':'Mantienes la red',
          { [o1.id]:P(cx-1.8,net+2.4), [o2.id]:P(cx+1.8,net+2.4), [r1.id]:P(cx-1.6,net-5.8), [r2.id]:P(cx+2.2,net-5.0), [ball.id]:P(cx-3.2,net-5.6) }),
      ];
    } else if (kind === 'p_vibora') {
      tac.name = en ? 'Víbora' : 'Víbora';
      // you stay at net, read the lob and snap a víbora to the side glass, then close the angle
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [o1.id]:P(cx-1.8,net+2.6), [o2.id]:P(cx+1.8,net+2.6), [r1.id]:P(cx-2.2,net-6.5), [r2.id]:P(cx+2.2,net-6.0), [ball.id]:P(cx+2.0,net-6.2) }),
        mk(en?'Short lob':'Globo corto',
          { [o1.id]:P(cx-1.8,net+3.6), [o2.id]:P(cx+1.6,net+4.6), [r1.id]:P(cx-2.0,net-4.0), [r2.id]:P(cx+2.2,net-3.6), [ball.id]:P(cx+1.4,net+3.8) },
          [bp([P(cx+2.0,net-6.2),P(cx+1.8,net-1.0),P(cx+1.4,net+3.8)],'globo','dash')], 'globo'),
        mk(en?'Víbora':'Víbora',
          { [o1.id]:P(cx-1.6,net+2.6), [o2.id]:P(cx+1.6,net+3.2), [r1.id]:P(cx-2.2,net-3.2), [r2.id]:P(cx+3.0,net-3.0), [ball.id]:P(cx+3.6,net-2.4) },
          [bp([P(cx+1.4,net+3.8),P(cx+2.4,net-0.4),P(cx+3.6,net-2.4)],'cortado')], 'cortado'),
        mk(en?'Close the net':'Cierras la red',
          { [o1.id]:P(cx-1.4,net+2.2), [o2.id]:P(cx+2.0,net+2.2), [r1.id]:P(cx-2.2,net-4.5), [r2.id]:P(cx+3.2,net-4.0), [ball.id]:P(cx+3.6,net-2.4) }),
      ];
    } else if (kind === 'p_contrapared') {
      tac.name = en ? 'Off the back glass' : 'Contrapared';
      // rival smashes, you let it run to the back glass and counter a deep lob to reset the point
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [o1.id]:P(cx-1.8,net+5.0), [o2.id]:P(cx+1.8,net+5.0), [r1.id]:P(cx-1.8,net-2.6), [r2.id]:P(cx+1.8,net-2.6), [ball.id]:P(cx-1.6,net-2.4) }),
        mk(en?'Rival smash':'Remate del rival',
          { [o1.id]:P(cx-1.6,net+8.0), [o2.id]:P(cx+1.8,net+5.5), [r1.id]:P(cx-1.6,net-2.4), [r2.id]:P(cx+1.8,net-2.6), [ball.id]:P(cx-1.8,net+8.6) },
          [bp([P(cx-1.6,net-2.4),P(cx-1.7,net+2.0),P(cx-1.8,net+8.6)],'plana')], 'plana'),
        mk(en?'Off the back glass':'Sale de la pared',
          { [o1.id]:P(cx-1.6,net+6.5), [o2.id]:P(cx+1.8,net+5.5), [r1.id]:P(cx-1.6,net-2.4), [r2.id]:P(cx+1.8,net-2.6), [ball.id]:P(cx-1.4,net+6.0) },
          [bp([P(cx-1.8,net+8.6),P(cx-1.6,net+9.4),P(cx-1.4,net+6.0)],'lift','dash')], 'lift'),
        mk(en?'Counter lob':'Globo de contra',
          { [o1.id]:P(cx-1.6,net+5.0), [o2.id]:P(cx+1.8,net+5.0), [r1.id]:P(cx-1.8,net-5.0), [r2.id]:P(cx+1.8,net-4.5), [ball.id]:P(cx+2.0,net-7.5) },
          [bp([P(cx-1.4,net+6.0),P(cx+0.2,net),P(cx+2.0,net-7.5)],'globo')], 'globo'),
      ];
    } else if (kind === 'p_chiquita') {
      tac.name = en ? 'Chiquita' : 'Chiquita';
      // you're pinned at the back; play a low chiquita at their feet to force a weak volley you can lob
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [o1.id]:P(cx-1.8,net+6.5), [o2.id]:P(cx+1.8,net+6.5), [r1.id]:P(cx-1.8,net-2.4), [r2.id]:P(cx+1.8,net-2.4), [ball.id]:P(cx-1.6,net+6.2) }),
        mk(en?'Chiquita':'Chiquita',
          { [o1.id]:P(cx-1.6,net+5.0), [o2.id]:P(cx+1.8,net+5.5), [r1.id]:P(cx-1.6,net-1.4), [r2.id]:P(cx+1.8,net-2.2), [ball.id]:P(cx-1.4,net-0.8) },
          [bp([P(cx-1.6,net+6.2),P(cx-1.5,net+1.5),P(cx-1.4,net-0.8)],'cortado')], 'cortado'),
        mk(en?'Weak volley':'Volea floja',
          { [o1.id]:P(cx-1.6,net+3.5), [o2.id]:P(cx+1.8,net+4.5), [r1.id]:P(cx-1.6,net-1.4), [r2.id]:P(cx+1.8,net-2.2), [ball.id]:P(cx-1.4,net+3.8) },
          [bp([P(cx-1.4,net-0.8),P(cx-1.5,net+1.4),P(cx-1.4,net+3.8)],'lift')], 'lift'),
        mk(en?'Lob & take net':'Globo y subes',
          { [o1.id]:P(cx-1.6,net+2.4), [o2.id]:P(cx+1.8,net+2.4), [r1.id]:P(cx-1.8,net-6.5), [r2.id]:P(cx+1.8,net-6.0), [ball.id]:P(cx+2.2,net-7.0) },
          [bp([P(cx-1.4,net+3.8),P(cx+0.2,net),P(cx+2.2,net-7.0)],'globo')], 'globo'),
      ];
    } else { // p_globo
      tac.name = en ? 'Lob & attack' : 'Globo y ataque';
      // both of you lift a lob and storm the net together; rivals get pushed back to the glass
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [o1.id]:P(cx-2.0,net+6.5), [o2.id]:P(cx+2.0,net+6.5), [r1.id]:P(cx-2.0,net-2.6), [r2.id]:P(cx+2.0,net-2.6), [ball.id]:P(cx-1.8,net+6.2) }),
        mk(en?'Defensive lob':'Globo defensivo',
          { [o1.id]:P(cx-1.8,net+4.5), [o2.id]:P(cx+1.8,net+4.5), [r1.id]:P(cx-2.0,net-6.5), [r2.id]:P(cx+2.0,net-6.0), [ball.id]:P(cx-2.2,net-7.5) },
          [bp([P(cx-1.8,net+6.2),P(cx-1.9,net),P(cx-2.2,net-7.5)],'globo','dash')], 'globo'),
        mk(en?'You take the net':'Subes a la red',
          { [o1.id]:P(cx-1.8,net+2.4), [o2.id]:P(cx+1.8,net+2.4), [r1.id]:P(cx-2.2,net-8.0), [r2.id]:P(cx+2.0,net-7.5), [ball.id]:P(cx+2.4,net+5.0) },
          [bp([P(cx-2.2,net-7.5),P(cx-0.2,net-1.0),P(cx+2.4,net+5.0)],'lift')], 'lift'),
        mk(en?'Smash winner':'Remate ganador',
          { [o1.id]:P(cx+1.6,net+2.6), [o2.id]:P(cx-1.6,net+2.4), [r1.id]:P(cx-2.2,net-8.0), [r2.id]:P(cx+2.0,net-7.5), [ball.id]:P(cx+3.4,net-6.0) },
          [bp([P(cx+2.4,net+5.0),P(cx+2.0,net-0.5),P(cx+3.4,net-6.0)],'plana')], 'plana'),
      ];
    }
    tac.steps.forEach((s, i) => { if (i > 0 && !s.shot) s.shot = 'lift'; });
    return tac;
  }

  // pre-built PICKLEBALL tactics (2v2) for the template picker
  function templatePickle(kind) {
    const tac = newTactic('pickle');
    const owns = tac.tokens.filter(t => t.type === 'own');
    const rivs = tac.tokens.filter(t => t.type === 'rival');
    const o1 = owns[0], o2 = owns[1], r1 = rivs[0], r2 = rivs[1];
    const ball = tac.tokens.find(t => t.type === 'ball');
    const cx = C.cx, net = C.net, kkb = C.kKitBot, kkt = C.kKitTop, kb = C.kBot, kt = C.kTop;
    const P = (x, y) => ({ x, y });
    const en = TL.i18n && TL.i18n.lang === 'en';
    const mk = (title, pos, paths, shot) => { const s = blankStep(title); s.pos = pos; s.paths = paths || []; if (shot) s.shot = shot; return s; };
    const bp = (pts, shot, dash) => ({ id: uid(), kind:'ball', dash: dash||'solid', shot: shot||'plana', points: pts });
    tac.surface = 'hard'; tac.server = 'own'; tac._guidedInit = true;

    if (kind === 'k_drop') {
      tac.name = en ? 'Third-shot drop' : 'Tercer golpe (drop)';
      // serve deep, take the return, soft drop into the kitchen, then move up to the line
      tac.steps = [
        mk(en?'Serve deep':'Saque profundo',
          { [o1.id]:P(cx-1.5,kb-0.4), [o2.id]:P(cx+1.5,kb-0.4), [r1.id]:P(cx-1.5,kt+0.6), [r2.id]:P(cx+1.5,kkt-0.5), [ball.id]:P(cx-1.4,kt+0.9) },
          [bp([P(cx-1.5,kb-0.6),P(cx-1.45,net),P(cx-1.4,kt+0.9)],'plana')], 'plana'),
        mk(en?'Deep return':'Resto profundo',
          { [o1.id]:P(cx-1.5,kb-0.6), [o2.id]:P(cx+1.5,kb-0.4), [r1.id]:P(cx-1.5,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-1.4,kb-0.7) },
          [bp([P(cx-1.4,kt+0.9),P(cx-1.4,net),P(cx-1.4,kb-0.7)],'plana')], 'plana'),
        mk(en?'Soft drop to kitchen':'Drop suave a la cocina',
          { [o1.id]:P(cx-1.5,kb-2.4), [o2.id]:P(cx+1.5,kb-2.2), [r1.id]:P(cx-1.5,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-1.2,kkt+0.8) },
          [bp([P(cx-1.4,kb-0.7),P(cx-1.3,net-1.0),P(cx-1.2,kkt+0.8)],'lift')], 'lift'),
        mk(en?'Move up to the line':'Sube a la l\u00ednea',
          { [o1.id]:P(cx-1.5,kkb+0.4), [o2.id]:P(cx+1.5,kkb+0.4), [r1.id]:P(cx-1.5,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-1.2,kkt+0.6) }),
      ];
    } else if (kind === 'k_drive') {
      tac.name = en ? 'Third-shot drive' : 'Tercer golpe (drive)';
      // hard drive at the feet, then crash the net behind it
      tac.steps = [
        mk(en?'Serve':'Saque',
          { [o1.id]:P(cx-1.5,kb-0.4), [o2.id]:P(cx+1.5,kb-0.4), [r1.id]:P(cx-1.5,kt+0.6), [r2.id]:P(cx+1.5,kkt-0.5), [ball.id]:P(cx-1.4,kt+0.9) },
          [bp([P(cx-1.5,kb-0.6),P(cx-1.45,net),P(cx-1.4,kt+0.9)],'plana')], 'plana'),
        mk(en?'Return':'Resto',
          { [o1.id]:P(cx-1.5,kb-0.6), [o2.id]:P(cx+1.5,kb-0.4), [r1.id]:P(cx-1.5,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-1.4,kb-0.7) },
          [bp([P(cx-1.4,kt+0.9),P(cx-1.4,net),P(cx-1.4,kb-0.7)],'plana')], 'plana'),
        mk(en?'Hard drive at the feet':'Drive duro a los pies',
          { [o1.id]:P(cx-1.5,kb-2.0), [o2.id]:P(cx+1.5,kb-1.8), [r1.id]:P(cx-1.4,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-1.3,kkt-0.2) },
          [bp([P(cx-1.4,kb-0.7),P(cx-1.35,net),P(cx-1.3,kkt-0.2)],'plana')], 'plana'),
        mk(en?'Crash the net':'Cierra la red',
          { [o1.id]:P(cx-1.5,kkb+0.5), [o2.id]:P(cx+1.5,kkb+0.5), [r1.id]:P(cx-1.4,kkt-0.5), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-1.3,kkt-0.2) }),
      ];
    } else if (kind === 'k_lob') {
      tac.name = en ? 'Offensive lob' : 'Globo de ataque';
      // lob over the net player, push them back, then take the line
      tac.steps = [
        mk(en?'At the kitchen':'En la cocina',
          { [o1.id]:P(cx-1.5,kkb+0.4), [o2.id]:P(cx+1.5,kkb+0.4), [r1.id]:P(cx-1.5,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-1.2,kkb+0.5) }),
        mk(en?'Lob over R2':'Globo sobre R2',
          { [o1.id]:P(cx-1.4,kkb+0.2), [o2.id]:P(cx+1.4,kkb+0.2), [r1.id]:P(cx-1.5,kkt-0.4), [r2.id]:P(cx+1.6,kt+1.6), [ball.id]:P(cx+1.7,kt+1.3) },
          [bp([P(cx-1.2,kkb+0.5),P(cx+0.6,net-3.2),P(cx+1.7,kt+1.3)],'lift')], 'lift'),
        mk(en?'They scramble back':'Corren a defender',
          { [o1.id]:P(cx-1.4,kkb-0.4), [o2.id]:P(cx+1.4,kkb-0.4), [r1.id]:P(cx-1.5,kkt-0.2), [r2.id]:P(cx+1.6,kt+0.9), [ball.id]:P(cx+1.4,kt+1.1) }),
        mk(en?'Take the line, finish':'Toma la línea y define',
          { [o1.id]:P(cx-1.5,kkb+0.3), [o2.id]:P(cx+1.5,kkb+0.3), [r1.id]:P(cx-1.6,kkt-0.3), [r2.id]:P(cx+1.5,kt+1.4), [ball.id]:P(cx-1.9,kkt-0.5) },
          [bp([P(cx+1.4,kt+1.1),P(cx-0.2,net-1.2),P(cx-1.9,kkt-0.5)],'plana')], 'plana'),
      ];
    } else if (kind === 'k_reset') {
      tac.name = en ? 'Reset from the back' : 'Reset desde el fondo';
      // neutralise a hard drive with a soft block into the kitchen, then move up
      tac.steps = [
        mk(en?'Pushed back':'Empujados atrás',
          { [o1.id]:P(cx-1.5,net+4.6), [o2.id]:P(cx+1.5,net+4.6), [r1.id]:P(cx-1.5,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-1.4,kkt-0.2) }),
        mk(en?'They drive hard':'Te atacan fuerte',
          { [o1.id]:P(cx-1.4,net+4.2), [o2.id]:P(cx+1.5,net+4.4), [r1.id]:P(cx-1.4,kkt-0.5), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-1.3,net+3.8) },
          [bp([P(cx-1.4,kkt-0.2),P(cx-1.35,net+1.8),P(cx-1.3,net+3.8)],'plana')], 'plana'),
        mk(en?'Soft block / reset':'Bloqueo suave (reset)',
          { [o1.id]:P(cx-1.4,net+3.4), [o2.id]:P(cx+1.5,net+3.6), [r1.id]:P(cx-1.4,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-0.8,kkt+0.7) },
          [bp([P(cx-1.3,net+3.8),P(cx-1.0,net+1.4),P(cx-0.8,kkt+0.7)],'lift')], 'lift'),
        mk(en?'Even at the kitchen':'Iguales en la cocina',
          { [o1.id]:P(cx-1.5,kkb+0.5), [o2.id]:P(cx+1.5,kkb+0.5), [r1.id]:P(cx-1.4,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-0.8,net-0.2) }),
      ];
    } else if (kind === 'k_poach') {
      tac.name = en ? 'Poach the dink' : 'Intercepta el dink';
      // read the cross-court dink, poach with the net player, finish into the gap
      tac.steps = [
        mk(en?'Dink rally':'Peloteo en la cocina',
          { [o1.id]:P(cx-1.5,kkb+0.4), [o2.id]:P(cx+1.5,kkb+0.4), [r1.id]:P(cx-1.5,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx+1.4,kkt-0.2) }),
        mk(en?'They dink cross':'Dink cruzado rival',
          { [o1.id]:P(cx-1.5,kkb+0.4), [o2.id]:P(cx+1.2,kkb+0.3), [r1.id]:P(cx-1.5,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-0.6,net+0.8) },
          [bp([P(cx+1.4,kkt-0.2),P(cx+0.4,net),P(cx-0.6,net+0.8)],'lift')], 'lift'),
        mk(en?'J2 poaches':'J2 intercepta',
          { [o1.id]:P(cx-1.5,kkb+0.4), [o2.id]:P(cx-0.2,kkb+0.0), [r1.id]:P(cx-1.5,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-0.3,net+0.4) }),
        mk(en?'Finish into the gap':'Define al hueco',
          { [o1.id]:P(cx-1.4,kkb+0.3), [o2.id]:P(cx-0.1,kkb-0.1), [r1.id]:P(cx-1.5,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx+1.9,kkt-0.3) },
          [bp([P(cx-0.3,net+0.4),P(cx+0.9,net-0.4),P(cx+1.9,kkt-0.3)],'plana')], 'plana'),
      ];
    } else { // k_dink
      tac.name = en ? 'Dink & speed-up' : 'Dink y aceleraci\u00f3n';
      // patient cross-court dink, then speed up at the body and put away the pop-up
      tac.steps = [
        mk(en?'At the kitchen':'En la cocina',
          { [o1.id]:P(cx-1.5,kkb+0.4), [o2.id]:P(cx+1.5,kkb+0.4), [r1.id]:P(cx-1.5,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-1.2,kkb+0.6) }),
        mk(en?'Soft dink cross':'Dink cruzado suave',
          { [o1.id]:P(cx-1.5,kkb+0.4), [o2.id]:P(cx+1.5,kkb+0.4), [r1.id]:P(cx-1.8,kkt-0.4), [r2.id]:P(cx+1.5,kkt-0.4), [ball.id]:P(cx-1.6,kkt-0.5) },
          [bp([P(cx-1.2,kkb+0.6),P(cx-1.4,net),P(cx-1.6,kkt-0.5)],'lift')], 'lift'),
        mk(en?'Speed up at the body':'Acelera al cuerpo',
          { [o1.id]:P(cx-1.5,kkb+0.4), [o2.id]:P(cx+1.5,kkb+0.4), [r1.id]:P(cx-1.8,kkt-0.4), [r2.id]:P(cx+1.4,kkt-0.4), [ball.id]:P(cx+0.9,kkt-0.3) },
          [bp([P(cx-1.6,kkt-0.5),P(cx-0.3,net),P(cx+0.9,kkt-0.3)],'plana')], 'plana'),
        mk(en?'Put away the pop-up':'Remata la bola alta',
          { [o1.id]:P(cx-1.5,kkb+0.3), [o2.id]:P(cx+1.5,kkb+0.3), [r1.id]:P(cx-1.8,kkt-0.5), [r2.id]:P(cx+1.4,kkt-0.6), [ball.id]:P(cx+1.6,kt+1.2) },
          [bp([P(cx+0.9,kkt-0.3),P(cx+1.3,net-2.0),P(cx+1.6,kt+1.2)],'plana')], 'plana'),
      ];
    }
    tac.steps.forEach((s, i) => { if (i > 0 && !s.shot) s.shot = 'plana'; });
    return tac;
  }

  // pre-built tactics for the template picker
  function templateTactic(kind) {
    const tac = newTactic();
    const own = tac.tokens.find(t => t.type === 'own');
    const rival = tac.tokens.find(t => t.type === 'rival');
    const ball = tac.tokens.find(t => t.type === 'ball');
    const cx = C.cx, P = (x, y) => ({ x, y });
    const en = TL.i18n && TL.i18n.lang === 'en';
    const mk = (title, pos, paths, shot) => { const s = blankStep(title); s.pos = pos; s.paths = paths || []; if (shot) s.shot = shot; return s; };
    const bp = (pts, shot, dash) => ({ id: uid(), kind:'ball', dash: dash||'solid', shot: shot||'lift', points: pts });

    if (kind === 'serve_volley') {
      // You serve from the deuce court (your right), wide into the far-left service box, rush the net and volley.
      tac.name = en ? 'Serve & volley' : 'Saque y volea';
      tac.surface = 'grass'; tac.server = 'own'; tac._guidedInit = true;
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [own.id]:P(cx+1.8,C.cBot-0.4), [rival.id]:P(cx-2.6,C.cTop+0.2), [ball.id]:P(cx+1.5,C.cBot-0.6) }),
        mk(en?'Wide serve':'Saque abierto',
          { [own.id]:P(cx+1.1,C.cBot-5.0), [rival.id]:P(cx-3.7,C.cTop+1.0), [ball.id]:P(cx-3.5,C.cTop+1.2) },
          [bp([P(cx+1.5,C.cBot-0.6),P(cx+0.2,C.net),P(cx-2.4,C.net-3.8),P(cx-3.5,C.cTop+1.2)],'plana')], 'plana'),
        mk(en?'Return':'Resto del rival',
          { [own.id]:P(cx-0.6,C.net+2.8), [rival.id]:P(cx-2.4,C.cTop+1.0), [ball.id]:P(cx-0.5,C.net+3.4) },
          [bp([P(cx-3.5,C.cTop+1.4),P(cx-1.6,C.net),P(cx-0.5,C.net+3.4)],'lift')], 'lift'),
        mk(en?'Volley winner':'Volea ganadora',
          { [own.id]:P(cx-0.3,C.net+2.4), [rival.id]:P(cx-2.4,C.cTop+1.0), [ball.id]:P(cx+3.2,C.cTop+3.0) },
          [bp([P(cx-0.5,C.net+3.4),P(cx+0.8,C.net-1.5),P(cx+3.2,C.cTop+3.0)],'cortado')], 'cortado'),
      ];
    } else if (kind === 'return') {
      // Rival serves from their deuce court (screen-left) into your right box; you take control with a deep return.
      tac.name = en ? 'Aggressive return' : 'Resto agresivo';
      tac.surface = 'hard'; tac.server = 'rival'; tac._guidedInit = true;
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [rival.id]:P(cx-1.8,C.cTop+0.4), [own.id]:P(cx+2.4,C.cBot-0.3), [ball.id]:P(cx-1.5,C.cTop+0.6) }),
        mk(en?'Rival serve':'Saque del rival',
          { [rival.id]:P(cx-1.2,C.cTop+1.0), [own.id]:P(cx+3.4,C.cBot-0.9), [ball.id]:P(cx+3.3,C.cBot-1.1) },
          [bp([P(cx-1.5,C.cTop+0.6),P(cx-0.2,C.net),P(cx+2.5,C.net+3.9),P(cx+3.3,C.cBot-1.1)],'plana')], 'plana'),
        mk(en?'Deep return':'Resto profundo',
          { [rival.id]:P(cx-1.0,C.cTop+1.0), [own.id]:P(cx+2.4,C.cBot-0.8), [ball.id]:P(cx-2.8,C.cTop+1.4) },
          [bp([P(cx+3.3,C.cBot-1.0),P(cx+0.4,C.net),P(cx-2.8,C.cTop+1.4)],'lift')], 'lift'),
      ];
    } else if (kind === 'baseline') {
      // Cross-court rally, then you change direction down the line into the open court.
      tac.name = en ? 'Baseline rally' : 'Peloteo de fondo';
      tac.surface = 'clay'; tac.server = 'own'; tac._guidedInit = true;
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [own.id]:P(cx-2.0,C.cBot-0.4), [rival.id]:P(cx+2.0,C.cTop+0.5), [ball.id]:P(cx-1.7,C.cBot-0.6) }),
        mk(en?'Cross-court':'Cruzada',
          { [own.id]:P(cx-2.2,C.cBot-0.6), [rival.id]:P(cx+3.0,C.cTop+0.9), [ball.id]:P(cx+2.9,C.cTop+1.1) },
          [bp([P(cx-1.7,C.cBot-0.6),P(cx-0.2,C.net),P(cx+2.9,C.cTop+1.1)],'lift')], 'lift'),
        mk(en?'Rival replies':'Devolución del rival',
          { [own.id]:P(cx-2.8,C.cBot-0.9), [rival.id]:P(cx+1.0,C.cTop+0.8), [ball.id]:P(cx-2.9,C.cBot-1.1) },
          [bp([P(cx+2.9,C.cTop+1.3),P(cx+0.2,C.net),P(cx-2.9,C.cBot-1.1)],'lift')], 'lift'),
        mk(en?'Change direction':'Cambio de dirección',
          { [own.id]:P(cx-2.6,C.cBot-1.0), [rival.id]:P(cx+1.0,C.cTop+0.8), [ball.id]:P(cx-3.0,C.cTop+1.6) },
          [bp([P(cx-2.9,C.cBot-1.1),P(cx-2.7,C.net),P(cx-3.0,C.cTop+1.6)],'plana')], 'plana'),
      ];
    } else if (kind === 'drop') {
      // You drop short, rival sprints in and pops it up, you pass into the open court.
      tac.name = en ? 'Drop & passing' : 'Dejada y passing';
      tac.surface = 'clay'; tac.server = 'own'; tac._guidedInit = true;
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [own.id]:P(cx-1.0,C.cBot-0.5), [rival.id]:P(cx+0.5,C.cTop+2.6), [ball.id]:P(cx-0.8,C.cBot-0.7) }),
        mk(en?'Drop shot':'Dejada',
          { [own.id]:P(cx-0.8,C.cBot-3.5), [rival.id]:P(cx-0.2,C.net-2.2), [ball.id]:P(cx-0.3,C.net-1.5) },
          [bp([P(cx-0.8,C.cBot-0.7),P(cx-0.5,C.net-0.3),P(cx-0.3,C.net-1.5)],'dejada','dash')], 'dejada'),
        mk(en?'Short reply':'Devolución corta',
          { [own.id]:P(cx-0.6,C.net+3.5), [rival.id]:P(cx-0.2,C.net-1.0), [ball.id]:P(cx-0.5,C.net+3.0) },
          [bp([P(cx-0.3,C.net-1.5),P(cx-0.4,C.net+1.0),P(cx-0.5,C.net+3.0)],'lift')], 'lift'),
        mk(en?'Passing shot':'Passing',
          { [own.id]:P(cx-0.4,C.net+2.8), [rival.id]:P(cx-0.2,C.net-1.0), [ball.id]:P(cx+3.2,C.cTop+3.4) },
          [bp([P(cx-0.5,C.net+3.0),P(cx+1.2,C.net-1.0),P(cx+3.2,C.cTop+3.4)],'plana')], 'plana'),
      ];
    } else if (kind === 'counter') {
      // Rival serves big, you defend deep, their reply sits short and you counter into the open court.
      tac.name = en ? 'Counterattack' : 'Contraataque';
      tac.surface = 'hard'; tac.server = 'rival'; tac._guidedInit = true;
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [rival.id]:P(cx-1.8,C.cTop+0.4), [own.id]:P(cx+2.2,C.cBot-0.3), [ball.id]:P(cx-1.5,C.cTop+0.6) }),
        mk(en?'Big serve':'Saque potente',
          { [rival.id]:P(cx-1.0,C.cTop+1.0), [own.id]:P(cx+3.4,C.cBot-0.9), [ball.id]:P(cx+3.3,C.cBot-1.1) },
          [bp([P(cx-1.5,C.cTop+0.6),P(cx-0.2,C.net),P(cx+2.5,C.net+3.9),P(cx+3.3,C.cBot-1.1)],'plana')], 'plana'),
        mk(en?'Defend deep':'Defensa profunda',
          { [rival.id]:P(cx-1.6,C.cTop+1.0), [own.id]:P(cx+1.0,C.cBot-0.7), [ball.id]:P(cx-2.6,C.cTop+1.4) },
          [bp([P(cx+3.3,C.cBot-1.0),P(cx+0.3,C.net),P(cx-2.6,C.cTop+1.4)],'lift')], 'lift'),
        mk(en?'Short ball':'Bola corta del rival',
          { [rival.id]:P(cx-1.4,C.cTop+1.2), [own.id]:P(cx-0.5,C.net+5.0), [ball.id]:P(cx-0.8,C.net+4.2) },
          [bp([P(cx-2.6,C.cTop+1.6),P(cx-1.4,C.net),P(cx-0.8,C.net+4.2)],'lift')], 'lift'),
        mk(en?'Counter':'Contraataque',
          { [rival.id]:P(cx-1.4,C.cTop+1.2), [own.id]:P(cx-0.6,C.net+3.5), [ball.id]:P(cx+3.2,C.cTop+2.6) },
          [bp([P(cx-0.8,C.net+4.2),P(cx+1.0,C.net-1.0),P(cx+3.2,C.cTop+2.6)],'plana')], 'plana'),
      ];
    } else if (kind === 'defense') {
      // Rival hits a deep approach and storms the net; you lob over them into the open court.
      tac.name = en ? 'Defense & lob' : 'Defensa y globo';
      tac.surface = 'clay'; tac.server = 'rival'; tac._guidedInit = true;
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [own.id]:P(cx-0.8,C.cBot-0.4), [rival.id]:P(cx+0.6,C.cTop+0.8), [ball.id]:P(cx+0.4,C.cTop+1.0) }),
        mk(en?'Rival approaches':'Rival sube a la red',
          { [rival.id]:P(cx+0.4,C.net-2.8), [own.id]:P(cx-1.4,C.cBot-1.2), [ball.id]:P(cx-1.6,C.cBot-1.4) },
          [bp([P(cx+0.4,C.cTop+1.0),P(cx+0.0,C.net),P(cx-1.6,C.cBot-1.4)],'plana')], 'plana'),
        mk(en?'Defensive lob':'Globo defensivo',
          { [rival.id]:P(cx+0.2,C.net-1.6), [own.id]:P(cx-1.2,C.cBot-1.4), [ball.id]:P(cx+2.6,C.cTop+2.2) },
          [bp([P(cx-1.6,C.cBot-1.4),P(cx-0.5,C.net-0.5),P(cx+2.6,C.cTop+2.2)],'globo')], 'globo'),
      ];
    } else if (kind === 'serve_plus1') {
      // Serve out wide to drag the rival off court, then hammer the forehand into the open court ("serve +1").
      tac.name = en ? 'Serve +1' : 'Saque +1';
      tac.surface = 'hard'; tac.server = 'own'; tac._guidedInit = true;
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [own.id]:P(cx+1.6,C.cBot-0.4), [rival.id]:P(cx-2.4,C.cTop+0.3), [ball.id]:P(cx+1.3,C.cBot-0.6) }),
        mk(en?'Wide serve':'Saque abierto',
          { [own.id]:P(cx+0.4,C.cBot-0.6), [rival.id]:P(cx-4.0,C.cTop+1.2), [ball.id]:P(cx-3.8,C.cTop+1.4) },
          [bp([P(cx+1.3,C.cBot-0.6),P(cx+0.0,C.net),P(cx-2.8,C.net-3.6),P(cx-3.8,C.cTop+1.4)],'plana')], 'plana'),
        mk(en?'Short return':'Resto corto',
          { [own.id]:P(cx-1.0,C.cBot-2.0), [rival.id]:P(cx-3.6,C.cTop+1.0), [ball.id]:P(cx-1.2,C.cBot-2.6) },
          [bp([P(cx-3.8,C.cTop+1.4),P(cx-1.0,C.net),P(cx-1.2,C.cBot-2.6)],'lift')], 'lift'),
        mk(en?'Forehand +1':'Derecha +1',
          { [own.id]:P(cx-0.8,C.cBot-2.2), [rival.id]:P(cx-3.6,C.cTop+1.0), [ball.id]:P(cx+3.4,C.cTop+1.6) },
          [bp([P(cx-1.2,C.cBot-2.6),P(cx+1.0,C.net),P(cx+3.4,C.cTop+1.6)],'plana')], 'plana'),
      ];
    } else if (kind === 'kick_approach') {
      // Heavy kick serve up the middle, follow it in and finish with a high backhand volley.
      tac.name = en ? 'Kick & approach' : 'Saque liftado y subida';
      tac.surface = 'grass'; tac.server = 'own'; tac._guidedInit = true;
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [own.id]:P(cx+1.4,C.cBot-0.4), [rival.id]:P(cx-2.2,C.cTop+0.3), [ball.id]:P(cx+1.1,C.cBot-0.6) }),
        mk(en?'Kick serve':'Saque liftado',
          { [own.id]:P(cx+0.6,C.cBot-4.5), [rival.id]:P(cx-2.6,C.cTop+2.6), [ball.id]:P(cx-1.6,C.cTop+2.2) },
          [bp([P(cx+1.1,C.cBot-0.6),P(cx-0.4,C.net),P(cx-1.4,C.net-3.2),P(cx-1.6,C.cTop+2.2)],'lift')], 'lift'),
        mk(en?'Floated return':'Resto flotado',
          { [own.id]:P(cx-0.2,C.net+2.6), [rival.id]:P(cx-2.4,C.cTop+1.0), [ball.id]:P(cx-0.4,C.net+3.4) },
          [bp([P(cx-1.6,C.cTop+2.4),P(cx-0.8,C.net),P(cx-0.4,C.net+3.4)],'lift')], 'lift'),
        mk(en?'Backhand volley':'Volea de revés',
          { [own.id]:P(cx-0.2,C.net+2.2), [rival.id]:P(cx-2.4,C.cTop+1.0), [ball.id]:P(cx+3.2,C.cTop+3.2) },
          [bp([P(cx-0.4,C.net+3.4),P(cx+0.9,C.net-1.4),P(cx+3.2,C.cTop+3.2)],'cortado')], 'cortado'),
      ];
    } else if (kind === 'inside_out') {
      // Run around the backhand to crack an inside-out forehand, opening the court for the inside-in finish.
      tac.name = en ? 'Inside-out forehand' : 'Derecha invertida';
      tac.surface = 'clay'; tac.server = 'own'; tac._guidedInit = true;
      tac.steps = [
        mk(en?'Start':'Inicio',
          { [own.id]:P(cx+0.2,C.cBot-0.5), [rival.id]:P(cx-1.8,C.cTop+0.6), [ball.id]:P(cx+0.0,C.cBot-0.7) }),
        mk(en?'Deep to backhand':'Profunda al revés',
          { [own.id]:P(cx-2.6,C.cBot-0.7), [rival.id]:P(cx-1.4,C.cTop+0.8), [ball.id]:P(cx-2.8,C.cBot-1.0) },
          [bp([P(cx+0.0,C.cBot-0.7),P(cx-0.8,C.net),P(cx-2.8,C.cBot-1.0)],'lift')], 'lift'),
        mk(en?'Inside-out forehand':'Derecha invertida',
          { [own.id]:P(cx-2.4,C.cBot-0.9), [rival.id]:P(cx+2.8,C.cTop+1.0), [ball.id]:P(cx+3.0,C.cTop+1.2) },
          [bp([P(cx-2.8,C.cBot-1.0),P(cx+0.4,C.net),P(cx+3.0,C.cTop+1.2)],'plana')], 'plana'),
        mk(en?'Inside-in winner':'Derecha paralela ganadora',
          { [own.id]:P(cx-1.4,C.cBot-1.4), [rival.id]:P(cx+3.0,C.cTop+1.0), [ball.id]:P(cx-3.2,C.cTop+1.6) },
          [bp([P(cx+3.0,C.cTop+1.4),P(cx+0.0,C.net),P(cx-3.2,C.cTop+1.6)],'plana')], 'plana'),
      ];
    } else {
      return null; // blank → use newTactic in guided mode
    }
    tac.steps.forEach((s, i) => { if (i > 0 && !s.shot) s.shot = 'lift'; });
    return tac;
  }

  // global app state
  TL.state = { view: 'home', tactic: null, stepIndex: 0, tool: 'select', speed: 'normal',
    shotType: 'lift', draw: { color: null, dash: 'solid' }, playing: false, viewer: false, guided: false };
})(window.TL = window.TL || {});
