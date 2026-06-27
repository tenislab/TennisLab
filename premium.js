/* ============================================================
   league.js — LIGA DE CLUBES (competición ciudad / país / mundo)
   ------------------------------------------------------------
   Vista pública (cualquier usuario con sesión): rankings de clubes
   por Ciudad, País y Mundo + tabla de Países. Los puntos los suman
   los partidos de los jugadores (award_match_points en Supabase).
   Requiere supabase/league_schema.sql ejecutado.
   ============================================================ */
(function (TL) {
  const ic = TL.icon;
  const esc = (s) => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function db() { return TL.cloud && TL.cloud.client; }
  function ready() { return TL.cloud && TL.cloud.enabled && TL.cloud.loggedIn(); }
  function en() { return TL.i18n.lang === 'en'; }

  // ISO 2-letras → emoji bandera (sirve para cualquier país)
  function flag(code) {
    if (!code || code.length !== 2) return '🏳️';
    const cc = code.toUpperCase();
    return String.fromCodePoint(0x1F1E6 + cc.charCodeAt(0) - 65,
                                0x1F1E6 + cc.charCodeAt(1) - 65);
  }
  // lista curada para el selector (cualquier otro país sigue valiendo por código)
  const COUNTRIES = [
    ['ES','España'],['FR','Francia'],['IT','Italia'],['PT','Portugal'],['DE','Alemania'],
    ['GB','Reino Unido'],['AR','Argentina'],['MX','México'],['US','EE. UU.'],['BR','Brasil'],
    ['CL','Chile'],['CO','Colombia'],['UY','Uruguay'],['PE','Perú'],['EC','Ecuador'],
    ['NL','Países Bajos'],['BE','Bélgica'],['CH','Suiza'],['SE','Suecia'],['PL','Polonia'],
    ['AT','Austria'],['CZ','Chequia'],['GR','Grecia'],['RO','Rumanía'],['MA','Marruecos']
  ];
  function countryName(code) {
    const f = COUNTRIES.find(c => c[0] === code); return f ? f[1] : (code || '—');
  }

  const league = {
    tab: 'mine',          // 'mine' | 'league' | 'countries'
    scope: 'world',       // para la pestaña Liga: 'city' | 'country' | 'world'
    q: '',                // búsqueda de texto en la pestaña Liga
    rows: null,           // cache de club_points de la temporada
    demo: false,          // modo demostración (datos de ejemplo, sin nube)

    season() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); },
    seasonLabel() {
      const d = new Date();
      const m = (en()
        ? ['January','February','March','April','May','June','July','August','September','October','November','December']
        : ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']);
      return m[d.getMonth()] + ' ' + d.getFullYear();
    },
    daysLeft() {
      const d = new Date(), end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return Math.max(0, Math.ceil((end - d) / 86400000));
    },

    async fetchRows() {
      if (this.demo) { this.rows = this.demoRows(); return this.rows; }
      if (!ready()) return [];
      const { data } = await db().from('club_points').select('*')
        .eq('season', this.season()).order('points', { ascending: false });
      this.rows = (data || []).slice().sort((a, b) => b.points - a.points);
      return this.rows;
    },

    // ---- datos de ejemplo (modo demo) ----
    DEMO_CLUB_ID: 'demo-myclub',
    demoRows() {
      const r = [
        { club_id: 'demo-myclub', name: 'Club Indoor Madrid', city: 'Madrid', country: 'ES', crest: '🎾', color: '#E8703D', points: 268, wins: 24, played: 31 },
        { club_id: 'd2', name: 'Academia Nadal', city: 'Manacor', country: 'ES', crest: 'N', color: '#2A6FDB', points: 412, wins: 38, played: 47 },
        { club_id: 'd3', name: 'RC Tenis Barcelona', city: 'Barcelona', country: 'ES', crest: 'B', color: '#C0392B', points: 351, wins: 31, played: 42 },
        { club_id: 'd4', name: 'Sevilla Padel Pro', city: 'Sevilla', country: 'ES', crest: '🥎', color: '#1F8A5B', points: 205, wins: 19, played: 26 },
        { club_id: 'd5', name: 'Valencia Tennis Hub', city: 'Valencia', country: 'ES', crest: 'V', color: '#8E44AD', points: 188, wins: 17, played: 24 },
        { club_id: 'd6', name: 'Club Madrid Río', city: 'Madrid', country: 'ES', crest: 'R', color: '#16A085', points: 142, wins: 13, played: 20 },
        { club_id: 'd7', name: 'Padel Lyon', city: 'Lyon', country: 'FR', crest: '🥎', color: '#2A6FDB', points: 398, wins: 36, played: 45 },
        { club_id: 'd8', name: 'Paris Smash Club', city: 'París', country: 'FR', crest: 'P', color: '#C0392B', points: 276, wins: 25, played: 33 },
        { club_id: 'd9', name: 'Roma Tennis', city: 'Roma', country: 'IT', crest: '🎾', color: '#E1A100', points: 233, wins: 21, played: 29 },
        { club_id: 'd10', name: 'Buenos Aires Padel', city: 'Buenos Aires', country: 'AR', crest: 'B', color: '#2A6FDB', points: 321, wins: 29, played: 38 },
        { club_id: 'd11', name: 'Lisboa Racket', city: 'Lisboa', country: 'PT', crest: 'L', color: '#1F8A5B', points: 167, wins: 15, played: 22 },
        { club_id: 'd12', name: 'CDMX Tennis', city: 'Ciudad de México', country: 'MX', crest: 'M', color: '#C0392B', points: 198, wins: 18, played: 25 },
      ];
      return r.sort((a, b) => b.points - a.points);
    },

    myClub() {
      if (TL.club && TL.club.current) return TL.club.current;
      if (this.demo) return { id: this.DEMO_CLUB_ID, name: 'Club Indoor Madrid', city: 'Madrid', country: 'ES', crest: '🎾', color: '#E8703D' };
      return null;
    },

    // posición (1-based) de mi club dentro de una lista filtrada
    posOf(list, clubId) {
      const i = list.findIndex(r => r.club_id === clubId);
      return i < 0 ? null : i + 1;
    },

    // ---------- award (lo llama matches.js al guardar un partido) ----------
    async award(match) {
      try {
        if (!ready() || !match || !match.played) return;
        const oc = match.outcome;
        if (oc !== 'win' && oc !== 'loss') return;          // empate/nulo no puntúa
        if (localStorage.getItem('tl_lg_' + match.id)) return; // ya contado en este equipo
        const { data, error } = await db().rpc('award_match_points',
          { p_match_id: String(match.id), p_outcome: oc, p_bonus: 0 });
        if (error) return;
        localStorage.setItem('tl_lg_' + match.id, '1');
        const got = data && data[0] && data[0].points;
        // mini-liga interna: suma también al miembro (best-effort; requiere columnas points/wins/played en club_members)
        try {
          if (TL.club && TL.club.current && TL.cloud && TL.cloud.user) {
            const u = TL.cloud.user.id, cid = TL.club.current.id;
            const { data: m, error: me } = await db().from('club_members')
              .select('points,wins,played').eq('club_id', cid).eq('user_id', u).maybeSingle();
            if (!me && m) {
              await db().from('club_members').update({
                points: (m.points || 0) + (got || 0),
                wins: (m.wins || 0) + (oc === 'win' ? 1 : 0),
                played: (m.played || 0) + 1,
              }).eq('club_id', cid).eq('user_id', u);
            }
          }
        } catch (e) {}
        if (got && TL.app && TL.app.toast) {
          TL.app.toast((en() ? '+' : '+') + got + (en() ? ' club points 🏆' : ' puntos para tu club 🏆'), true);
        }
      } catch (e) {}
    },

    // ---------- UI ----------
    async render(root) {
      TL.state.view = 'league'; TL.state.tactic = null;
      root.innerHTML = `<div class="lg-wrap"><div class="lg-load">${en() ? 'Loading league…' : 'Cargando liga…'}</div></div>`;
      TL.app.updateTabbar && TL.app.updateTabbar();
      window.scrollTo(0, 0);
      if (!ready() && !this.demo) {
        root.innerHTML = `<div class="lg-wrap"><div class="lg-empty">
          <span class="lg-empty-ic">${ic.trophy || ic.star}</span>
          <h2>${en() ? 'Club League' : 'Liga de Clubes'}</h2>
          <p>${en() ? 'Sign in to compete with your club by city, country and worldwide.' : 'Inicia sesión para competir con tu club por ciudad, país y a nivel mundial.'}</p>
          <button class="btn btn-primary" id="lg-login">${en() ? 'Sign in' : 'Iniciar sesión'}</button>
        </div></div>`;
        const b = root.querySelector('#lg-login');
        if (b) b.onclick = () => { if (TL.cloud.authModal) TL.cloud.authModal(); };
        return;
      }
      if (TL.club && TL.club.load) { try { await TL.club.load(); } catch (e) {} }
      await this.fetchRows();
      this.draw(root);
    },

    draw(root) {
      const tabs = [
        ['mine', en() ? 'My Club' : 'Mi Club'],
        ['league', en() ? 'League' : 'Liga'],
        ['countries', en() ? 'Countries' : 'Países'],
      ];
      root.innerHTML = `
        <div class="lg-wrap">
          <div class="lg-head">
            <div>
              <span class="kicker">${ic.trophy || ic.star} ${en() ? 'CLUB LEAGUE' : 'LIGA DE CLUBES'}</span>
              <h1>${this.seasonLabel()}</h1>
            </div>
            <div class="lg-season">${this.daysLeft()} ${en() ? 'days left' : 'días restantes'}</div>
          </div>
          <div class="lg-tabs">${tabs.map(tb =>
            `<button class="lg-tab ${this.tab === tb[0] ? 'on' : ''}" data-tab="${tb[0]}">${tb[1]}</button>`).join('')}</div>
          <div id="lg-body" class="lg-body"></div>
        </div>`;
      root.querySelectorAll('.lg-tab').forEach(b => b.onclick = () => {
        this.tab = b.dataset.tab;
        root.querySelectorAll('.lg-tab').forEach(x => x.classList.toggle('on', x === b));
        this.drawBody(root);
      });
      this.drawBody(root);
    },

    drawBody(root) {
      const box = root.querySelector('#lg-body'); if (!box) return;
      if (this.tab === 'mine') return this.drawMine(box);
      if (this.tab === 'countries') return this.drawCountries(box);
      return this.drawLeague(box);
    },

    // ---- Mi Club ----
    drawMine(box) {
      const club = this.myClub();
      const rows = this.rows || [];
      if (!club) {
        box.innerHTML = `<div class="lg-empty sm">
          <span class="lg-empty-ic">${ic.users || ic.user}</span>
          <h2>${en() ? 'You have no club yet' : 'Aún no tienes club'}</h2>
          <p>${en() ? 'Create or join a club to start earning points and climb the rankings.' : 'Crea o únete a un club para sumar puntos y escalar en los rankings.'}</p>
          <button class="btn btn-primary" id="lg-club">${en() ? 'Create / join a club' : 'Crear / unirse a un club'}</button>
        </div>`;
        const b = box.querySelector('#lg-club'); if (b) b.onclick = () => TL.club.open();
        return;
      }
      const mine = rows.find(r => r.club_id === club.id);
      const pts = mine ? mine.points : 0, wins = mine ? mine.wins : 0, played = mine ? mine.played : 0;
      const world = this.posOf(rows, club.id);
      const cityList = rows.filter(r => (r.city || '').toLowerCase() === (club.city || '').toLowerCase() && club.city);
      const ctryList = rows.filter(r => (r.country || '') === (club.country || '') && club.country);
      const cityPos = club.city ? this.posOf(cityList, club.id) : null;
      const ctryPos = club.country ? this.posOf(ctryList, club.id) : null;
      const medal = (pos, total, label) => `
        <div class="lg-medal">
          <span class="lg-medal-pos">${pos ? '#' + pos : '—'}</span>
          <span class="lg-medal-of">${pos ? (en() ? 'of ' : 'de ') + total : ''}</span>
          <span class="lg-medal-lb">${label}</span>
        </div>`;
      box.innerHTML = `
        <div class="lg-myclub" style="--club:${esc(club.color || '#E8703D')}">
          <span class="lg-crest">${esc(club.crest || (club.name || '?').slice(0, 1).toUpperCase())}</span>
          <div class="lg-myclub-tx">
            <h2>${esc(club.name)}</h2>
            <p>${club.city ? '📍 ' + esc(club.city) : ''}${club.country ? ' · ' + flag(club.country) + ' ' + esc(countryName(club.country)) : ''}</p>
          </div>
          <div class="lg-myclub-pts"><b>${pts}</b><span>${en() ? 'pts' : 'pts'}</span></div>
        </div>
        <div class="lg-medals">
          ${medal(cityPos, cityList.length, en() ? 'City' : 'Ciudad')}
          ${medal(ctryPos, ctryList.length, en() ? 'Country' : 'País')}
          ${medal(world, rows.length, en() ? 'World' : 'Mundo')}
        </div>
        <div class="lg-myclub-stats">
          <div><b>${wins}</b><span>${en() ? 'wins' : 'victorias'}</span></div>
          <div><b>${played}</b><span>${en() ? 'matches' : 'partidos'}</span></div>
          <div><b>${this.daysLeft()}</b><span>${en() ? 'days left' : 'días restan'}</span></div>
        </div>
        <p class="lg-hint">${en() ? 'Every match your players log adds points: win +10, played +2.' : 'Cada partido que registran tus jugadores suma: ganar +10, jugar +2.'}</p>
        ${!club.country ? `<div class="lg-warn">${en() ? 'Set your club city & country so it ranks. ' : 'Pon la ciudad y el país del club para que aparezca en los rankings. '}<button class="lk" id="lg-edit">${en() ? 'Edit club' : 'Editar club'}</button></div>` : ''}`;
      const ed = box.querySelector('#lg-edit'); if (ed) ed.onclick = () => TL.club.open();
    },

    // ---- Liga (Ciudad / País / Mundo) ----
    drawLeague(box) {
      const club = this.myClub();
      const scopes = [
        ['city', en() ? 'City' : 'Ciudad'],
        ['country', en() ? 'Country' : 'País'],
        ['world', en() ? 'World' : 'Mundo'],
      ];
      box.innerHTML = `
        <div class="lg-search">
          <span class="lg-search-ic">${ic.search || ''}</span>
          <input id="lg-q" type="search" autocomplete="off" placeholder="${en() ? 'Search club, city or country…' : 'Buscar club, ciudad o país…'}" value="${esc(this.q || '')}"/>
          ${this.q ? `<button class="lg-search-x" id="lg-qx" aria-label="clear">${ic.x || '×'}</button>` : ''}
        </div>
        <div class="lg-scopes">${scopes.map(s =>
          `<button class="lg-scope ${this.scope === s[0] ? 'on' : ''}" data-scope="${s[0]}">${s[1]}</button>`).join('')}</div>
        <div class="lg-subhead" id="lg-sub"></div>
        <div class="lg-table" id="lg-tbl"></div>`;
      box.querySelectorAll('.lg-scope').forEach(b => b.onclick = () => {
        this.scope = b.dataset.scope;
        // al elegir un ámbito, salimos de la búsqueda de texto
        if (this.q) { this.q = ''; const i = box.querySelector('#lg-q'); if (i) i.value = ''; const x = box.querySelector('#lg-qx'); if (x) x.remove(); }
        box.querySelectorAll('.lg-scope').forEach(x => x.classList.toggle('on', x === b));
        this.renderLeagueTable(box, club);
      });
      const inp = box.querySelector('#lg-q');
      if (inp) inp.oninput = () => { this.q = inp.value; this.renderLeagueTable(box, club); };
      const qx = box.querySelector('#lg-qx');
      if (qx) qx.onclick = () => { this.q = ''; this.drawLeague(box); };
      this.renderLeagueTable(box, club);
    },

    renderLeagueTable(box, club) {
      let rows = this.rows || [];
      const q = (this.q || '').trim().toLowerCase();
      const scopesEl = box.querySelectorAll('.lg-scope');
      let subhead;
      if (q) {
        scopesEl.forEach(x => x.classList.add('dim'));
        rows = rows.filter(r =>
          (r.name || '').toLowerCase().includes(q) ||
          (r.city || '').toLowerCase().includes(q) ||
          (r.country || '').toLowerCase().includes(q) ||
          countryName(r.country || '').toLowerCase().includes(q));
        const n = rows.length;
        subhead = `${n} ${en() ? (n === 1 ? 'result' : 'results') : (n === 1 ? 'resultado' : 'resultados')} · “${esc(this.q.trim())}”`;
      } else {
        scopesEl.forEach(x => x.classList.remove('dim'));
        if (this.scope === 'city' && club && club.city)
          rows = rows.filter(r => (r.city || '').toLowerCase() === club.city.toLowerCase());
        else if (this.scope === 'country' && club && club.country)
          rows = rows.filter(r => (r.country || '') === club.country);
        subhead = this.scope === 'city'
          ? (club && club.city ? esc(club.city) : (en() ? 'Set your club city' : 'Pon la ciudad de tu club'))
          : this.scope === 'country'
          ? (club && club.country ? flag(club.country) + ' ' + countryName(club.country) : (en() ? 'Set your club country' : 'Pon el país de tu club'))
          : (en() ? 'Worldwide' : 'Mundial');
      }
      const subEl = box.querySelector('#lg-sub'); if (subEl) subEl.innerHTML = subhead;
      const tblEl = box.querySelector('#lg-tbl'); if (!tblEl) return;
      if (q && !rows.length) {
        tblEl.innerHTML = `<div class="lg-first">
          <span class="lg-first-ic">${ic.trophy || ic.star}</span>
          <h3>${en() ? `No clubs match “${esc(this.q.trim())}”` : `Ningún club coincide con «${esc(this.q.trim())}»`}</h3>
          <p>${en() ? 'Try another city or country — or be the first to register one there.' : 'Prueba otra ciudad o país — o sé el primero en registrar uno allí.'}</p>
        </div>`;
        return;
      }
      tblEl.innerHTML = this.tableRows(rows, club);
      const fc = tblEl.querySelector('#lg-first-cta');
      if (fc) fc.onclick = () => { if (this.demo) { TL.app.toast(en() ? 'Demo mode — sign in to compete for real.' : 'Modo demo — inicia sesión para competir de verdad.'); return; } TL.app.openMatches(); };
    },

    tableRows(rows, club) {
      if (!rows.length) {
        const city = club && club.city ? esc(club.city) : '';
        const cname = club && club.name ? esc(club.name) : (en() ? 'your club' : 'tu club');
        let head, sub;
        if (this.scope === 'city') {
          head = city ? (en() ? `Be the first club in ${city}` : `Sé el primer club de ${city}`)
                      : (en() ? 'Be the first club in your city' : 'Sé el primer club de tu ciudad');
          sub = en() ? `Log a match and put ${cname} on the map. 🏆`
                     : `Registra un partido y pon a ${cname} en el mapa. 🏆`;
        } else if (this.scope === 'country') {
          head = en() ? 'Be the first club in your country' : 'Sé el primer club de tu país';
          sub = en() ? 'Win matches to climb the national ranking.' : 'Gana partidos para subir en el ranking nacional.';
        } else {
          head = en() ? 'The world ranking is just starting' : 'El ranking mundial acaba de empezar';
          sub = en() ? 'Early clubs get the top spots. Log a match!' : 'Los primeros clubes se llevan lo más alto. ¡Registra un partido!';
        }
        return `<div class="lg-first">
          <span class="lg-first-ic">${ic.trophy || ic.star}</span>
          <h3>${head}</h3>
          <p>${sub}</p>
          <button class="btn btn-primary" id="lg-first-cta">${ic.plus || ''}${en() ? 'Log a match' : 'Registrar partido'}</button>
        </div>`;
      };
      return rows.slice(0, 100).map((r, i) => {
        const me = club && r.club_id === club.id;
        const pos = i + 1;
        const podium = pos <= 3 ? 'p' + pos : '';
        return `
        <div class="lg-row ${me ? 'me' : ''}">
          <span class="lg-pos ${podium}">${pos}</span>
          <span class="lg-crest sm" style="--club:${esc(r.color || '#E8703D')}">${esc(r.crest || (r.name || '?').slice(0, 1).toUpperCase())}</span>
          <span class="lg-name">${esc(r.name || '—')}${r.country ? ` <i>${flag(r.country)}</i>` : ''}<small>${esc(r.city || '')}</small></span>
          <span class="lg-pts">${r.points}</span>
        </div>`;
      }).join('');
    },

    // ---- Países ----
    drawCountries(box) {
      const rows = this.rows || [];
      const map = {};
      rows.forEach(r => {
        const c = r.country || ''; if (!c) return;
        if (!map[c]) map[c] = { country: c, points: 0, clubs: 0 };
        map[c].points += r.points; map[c].clubs += 1;
      });
      const list = Object.values(map).sort((a, b) => b.points - a.points);
      const myC = this.myClub() && this.myClub().country;
      if (!list.length) { box.innerHTML = `<div class="lg-empty sm"><p>${en() ? 'No countries ranked yet.' : 'Aún no hay países clasificados.'}</p></div>`; return; }
      box.innerHTML = `
        <div class="lg-subhead">${en() ? 'Country vs country — total points of all their clubs' : 'País contra país — puntos sumados de todos sus clubes'}</div>
        <div class="lg-table">${list.map((c, i) => {
          const me = c.country === myC, pos = i + 1, podium = pos <= 3 ? 'p' + pos : '';
          return `
          <div class="lg-row ${me ? 'me' : ''}">
            <span class="lg-pos ${podium}">${pos}</span>
            <span class="lg-cflag">${flag(c.country)}</span>
            <span class="lg-name">${esc(countryName(c.country))}<small>${c.clubs} ${en() ? (c.clubs === 1 ? 'club' : 'clubs') : (c.clubs === 1 ? 'club' : 'clubes')}</small></span>
            <span class="lg-pts">${c.points}</span>
          </div>`;
        }).join('')}</div>`;
    },
  };

  league.COUNTRIES = COUNTRIES;
  league.flag = flag;
  league.countryName = countryName;
  TL.league = league;
})(window.TL = window.TL || {});
