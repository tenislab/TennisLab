/* ============================================================
   club.js — MODO CLUB (entrenador + jugadores, biblioteca compartida)
   ------------------------------------------------------------
   Requiere TL.cloud (Supabase) con sesión iniciada y las tablas de
   supabase/club_schema.sql ejecutadas. Es función PREMIUM.

   Vista principal: TL.club.open() — muestra tu club (o crear/unirse),
   la biblioteca compartida y, si eres entrenador, la lista de jugadores.
   ============================================================ */
(function (TL) {
  const t = (k) => TL.i18n.t(k);
  const ic = TL.icon;
  const esc = (s) => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function db() { return TL.cloud && TL.cloud.client; }
  function uid() { return TL.cloud && TL.cloud.user ? TL.cloud.user.id : null; }

  const FREE_PLAYERS = 4;   // jugadores gratis por club (sin contar al entrenador)

  const club = {
    current: null,     // {id,name,invite_code,owner_id,plan}
    role: null,        // 'coach' | 'player'
    demo: false,       // modo demostración (datos de ejemplo, sin nube)
    pageMode: false,   // true => render como página (pestaña), false => modal
    _pageRoot: null,
    FREE_PLAYERS,

    // ---- datos de ejemplo (modo demo) ----
    demoClub() {
      return { id: 'demo-myclub', name: 'Club Indoor Madrid', invite_code: 'MAD7TL',
               owner_id: 'me', plan: 'pro', city: 'Madrid', country: 'ES', crest: '🎾', color: '#E8703D' };
    },
    demoMembers() {
      return [
        { user_id: 'me', email: 'entrenador@clubindoor.es', role: 'coach', points: 86, wins: 7, played: 11, streak: 3 },
        { user_id: 'p1', email: 'carlos.ruiz@gmail.com', role: 'player', points: 124, wins: 11, played: 15, streak: 5 },
        { user_id: 'p2', email: 'lucia.mendez@gmail.com', role: 'player', points: 98, wins: 8, played: 12, streak: 2 },
        { user_id: 'p3', email: 'javier.soler@gmail.com', role: 'player', points: 72, wins: 6, played: 10, streak: 0 },
        { user_id: 'p4', email: 'marta.gil@gmail.com', role: 'player', points: 140, wins: 13, played: 16, streak: 6 },
        { user_id: 'p5', email: 'diego.romero@gmail.com', role: 'player', points: 44, wins: 3, played: 7, streak: 1 },
      ];
    },
    demoTactics() {
      const T = TL.store;
      const mk = (id, kind, padel, note, assigned) => {
        let tac;
        try { tac = padel ? T.templatePadel(kind) : T.templateTactic(kind); }
        catch (e) { tac = T.newTactic(padel ? 'padel' : 'tennis'); }
        tac._note = note || ''; tac._assigned = !!assigned;
        return { id, name: tac.name || (padel ? 'Pádel' : 'Táctica'), author_id: 'me', data: tac };
      };
      return [
        mk('dt1', 'serve_volley', false, TL.i18n.lang === 'en' ? 'Practise for Saturday' : 'A practicar para el sábado', true),
        mk('dt2', 'return', false, '', false),
        mk('dt3', 'p_vibora', true, TL.i18n.lang === 'en' ? 'Work the glass exit' : 'Repasad la salida de pared', true),
        mk('dt4', 'p_bandeja', true, '', false),
      ];
    },

    available() { return !!(TL.cloud && TL.cloud.enabled); },
    ready() { return this.available() && TL.cloud.loggedIn(); },

    // ---- plan del club ----
    plan() { return (this.current && this.current.plan) || 'free'; },
    isPro() { return this.plan() !== 'free'; },

    genCode() {
      const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let s = ''; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
      return s;
    },

    // ---- campos de identidad (crear/editar club) ----
    CLUB_COLORS: ['#E8703D', '#2A6FDB', '#1F8A5B', '#C0392B', '#8E44AD', '#16A085', '#E1A100'],
    identityFields(v) {
      v = v || {};
      const en = TL.i18n.lang === 'en';
      const countries = (TL.league ? TL.league.COUNTRIES : [])
        .map(c => `<option value="${c[0]}" ${v.country === c[0] ? 'selected' : ''}>${c[1]}</option>`).join('');
      const colors = this.CLUB_COLORS.map(c =>
        `<button type="button" class="club-color ${(v.color || '#E8703D') === c ? 'on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('');
      return `
        <input id="club-name" placeholder="${t('club_name_ph')}" value="${esc(v.name || '')}"/>
        <div class="club-id-row">
          <input id="club-city" placeholder="${en ? 'City' : 'Ciudad'}" value="${esc(v.city || '')}"/>
          <select id="club-country"><option value="">${en ? 'Country…' : 'País…'}</option>${countries}</select>
        </div>
        <div class="club-id-row">
          <input id="club-crest" maxlength="2" placeholder="${en ? 'Crest (emoji/letter)' : 'Escudo (emoji/letra)'}" value="${esc(v.crest || '')}"/>
          <div class="club-colors" id="club-colors">${colors}</div>
        </div>`;
    },
    bindColors(scope) {
      const box = scope.querySelector('#club-colors'); if (!box) return;
      box.querySelectorAll('.club-color').forEach(b => b.onclick = () => {
        box.querySelectorAll('.club-color').forEach(x => x.classList.toggle('on', x === b));
      });
    },
    readIdentity(scope) {
      const cc = scope.querySelector('.club-color.on');
      return {
        name: (scope.querySelector('#club-name').value || '').trim(),
        city: (scope.querySelector('#club-city') ? scope.querySelector('#club-city').value : '').trim(),
        country: scope.querySelector('#club-country') ? scope.querySelector('#club-country').value : '',
        crest: (scope.querySelector('#club-crest') ? scope.querySelector('#club-crest').value : '').trim(),
        color: cc ? cc.dataset.color : '#E8703D',
      };
    },

    // cargar el club del usuario (si pertenece a alguno)
    async load() {
      if (this.demo) { this.current = this.demoClub(); this.role = 'coach'; return this.current; }
      if (!this.ready()) return null;
      try {
        const { data: mem } = await db().from('club_members')
          .select('club_id, role').eq('user_id', uid()).limit(1).maybeSingle();
        if (!mem) { this.current = null; this.role = null; return null; }
        const { data: c } = await db().from('clubs').select('*').eq('id', mem.club_id).maybeSingle();
        this.current = c; this.role = mem.role;
        return c;
      } catch (e) { console.warn('club load', e); return null; }
    },

    // chequeo silencioso en segundo plano: ¿hay tácticas del club sin ver? → punto rojo
    async checkBadge() {
      try {
        if (!this.ready || !this.ready()) return;
        if (!this.current) { await this.load(); }
        if (!this.current) { localStorage.setItem('tl_club_unseen','0'); TL.app && TL.app.refreshClubBadge && TL.app.refreshClubBadge(); return; }
        await this.tactics(); // setea el flag y refresca el badge internamente
      } catch (e) {}
    },

    async createClub(meta) {
      if (!this.ready()) return { error: 'auth' };
      const code = this.genCode();
      const { data, error } = await db().from('clubs')
        .insert({ owner_id: uid(), name: meta.name, invite_code: code,
                  city: meta.city || null, country: meta.country || null,
                  crest: meta.crest || null, color: meta.color || null })
        .select().maybeSingle();
      if (error) return { error: error.message };
      this.current = data; this.role = 'coach';
      return { ok: true };
    },

    // editar identidad del club (nombre, ciudad, país, escudo, color)
    async updateIdentity(meta) {
      if (!this.current) return { error: 'no club' };
      const { error } = await db().from('clubs').update({
        name: meta.name, city: meta.city || null, country: meta.country || null,
        crest: meta.crest || null, color: meta.color || null }).eq('id', this.current.id);
      if (error) return { error: error.message };
      Object.assign(this.current, meta); return { ok: true };
    },

    async joinClub(code) {
      if (!this.ready()) return { error: 'auth' };
      const { data: c, error } = await db().from('clubs')
        .select('*').eq('invite_code', (code || '').trim().toUpperCase()).maybeSingle();
      if (error || !c) return { error: t('club_not_found') };
      // si es tu propio club (eres el dueño) → entra como entrenador, no como jugador
      if (c.owner_id === uid()) { this.current = c; this.role = 'coach'; return { ok: true }; }
      // si ya perteneces a otro club, no te dejes unir a un segundo (rompe la vista)
      const { data: mine } = await db().from('club_members')
        .select('club_id').eq('user_id', uid()).limit(1).maybeSingle();
      if (mine && mine.club_id && mine.club_id !== c.id) return { error: 'already_in_club' };
      const { error: e2 } = await db().from('club_members')
        .insert({ club_id: c.id, user_id: uid(), email: TL.cloud.email(), role: 'player' });
      if (e2 && !/duplicate|conflict/i.test(e2.message)) {
        if (/CLUB_FULL/i.test(e2.message || '')) return { error: 'club_full' };
        return { error: e2.message };
      }
      this.current = c; this.role = 'player';
      return { ok: true };
    },

    async leaveClub() {
      if (!this.current) return;
      await db().from('club_members').delete().eq('club_id', this.current.id).eq('user_id', uid());
      this.current = null; this.role = null;
    },

    // entrenador (dueño): eliminar el club entero (cascada borra miembros y tácticas)
    async deleteClub() {
      if (!this.current) return { error: 'no club' };
      const { error } = await db().from('clubs').delete().eq('id', this.current.id);
      if (error) return { error: error.message };
      this.current = null; this.role = null;
      return { ok: true };
    },

    // ---- invitación por enlace ----
    inviteLink() {
      const code = this.current ? this.current.invite_code : '';
      return location.origin + location.pathname + '?club=' + code;
    },
    async shareInvite() {
      const en = TL.i18n.lang === 'en';
      if (!this.current) return;
      const code = this.current.invite_code;
      const link = this.inviteLink();
      const text = (en ? `Join my club "${this.current.name}" on CourtLab — code ${code}: `
                       : `Únete a mi club "${this.current.name}" en CourtLab — código ${code}: `) + link;
      if (navigator.share) {
        try { await navigator.share({ title: 'CourtLab', text }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(link); TL.app.toast(en ? 'Invite link copied' : 'Enlace de invitación copiado', true); }
      catch (e) { TL.app.toast(link); }
    },
    // capturar ?club=CODE al abrir la app (lo deja preparado para unirse)
    capture() {
      try {
        const m = (location.search || '').match(/[?&]club=([A-Za-z0-9]+)/);
        if (m) {
          localStorage.setItem('tl_club_pending', m[1].toUpperCase());
          const u = new URL(location.href); u.searchParams.delete('club');
          history.replaceState(null, '', u.pathname + u.search + u.hash);
        }
      } catch (e) {}
    },
    pendingInvite() { return localStorage.getItem('tl_club_pending') || ''; },
    clearPending() { try { localStorage.removeItem('tl_club_pending'); } catch (e) {} },

    // ---- entrenador: gestionar club ----
    async removeMember(userId) {
      if (!this.current) return { error: 'no club' };
      const { error } = await db().from('club_members').delete()
        .eq('club_id', this.current.id).eq('user_id', userId);
      return error ? { error: error.message } : { ok: true };
    },
    async renameClub(name) {
      if (!this.current) return { error: 'no club' };
      const { error } = await db().from('clubs').update({ name }).eq('id', this.current.id);
      if (error) return { error: error.message };
      this.current.name = name; return { ok: true };
    },
    async regenCode() {
      if (!this.current) return { error: 'no club' };
      const code = this.genCode();
      const { error } = await db().from('clubs').update({ invite_code: code }).eq('id', this.current.id);
      if (error) return { error: error.message };
      this.current.invite_code = code; return { ok: true };
    },

    async members() {
      if (this.demo) return this.demoMembers();
      if (!this.current) return [];
      // intenta leer las columnas de puntos (mini-liga); si no existen, cae a lo básico
      let res = await db().from('club_members')
        .select('user_id,email,role,joined_at,points,wins,played').eq('club_id', this.current.id);
      if (res.error) {
        res = await db().from('club_members')
          .select('user_id,email,role,joined_at').eq('club_id', this.current.id);
      }
      return res.data || [];
    },

    // nombre legible a partir del email (parte antes de la @, capitalizada)
    displayName(m) {
      if (!m) return '—';
      const e = m.email || '';
      const base = e.split('@')[0].replace(/[._-]+/g, ' ').trim();
      if (!base) return e || '—';
      return base.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
    },

    // mini-liga interna: miembros ordenados por puntos
    memberLeague(mem) {
      return (mem || []).map(m => ({
        ...m,
        points: m.points || 0, wins: m.wins || 0, played: m.played || 0, streak: m.streak || 0,
        me: m.user_id === (this.demo ? 'me' : uid()),
      })).sort((a, b) => (b.points - a.points) || (b.wins - a.wins));
    },

    async sharedTactics() {
      if (this.demo) return this.demoTactics();
      if (!this.current) return [];
      const { data } = await db().from('club_tactics')
        .select('id,name,data,author_id,updated_at').eq('club_id', this.current.id)
        .order('updated_at', { ascending: false });
      const list = data || [];
      this._tactics = list;
      // marca "nuevo" en la pestaña Club si hay algo del club sin ver (y no es tuyo)
      try {
        const me = uid();
        const unseen = list.some(row => row.author_id !== me && !this.isSeen(row.id));
        localStorage.setItem('tl_club_unseen', unseen ? '1' : '0');
        TL.app && TL.app.refreshClubBadge && TL.app.refreshClubBadge();
      } catch (e) {}
      return list;
    },

    // entrenador: publicar una táctica propia al club
    async share(tac, note) {
      if (!this.current) return { error: 'no club' };
      const copy = JSON.parse(JSON.stringify(tac)); delete copy.id; delete copy.fav;
      if (note && note.trim()) copy._note = note.trim();
      const { error } = await db().from('club_tactics')
        .insert({ club_id: this.current.id, author_id: uid(), name: tac.name || '', data: copy });
      if (error) return { error: error.message };
      return { ok: true };
    },

    async unshare(id) {
      await db().from('club_tactics').delete().eq('id', id);
    },

    // ---- coach mode: assign (required viewing) + per-device "seen" mark ----
    // assigned flag lives inside the tactic's data blob (no schema change needed)
    isAssigned(row) { return !!(row && row.data && row.data._assigned); },
    async setAssigned(row, on) {
      const data = JSON.parse(JSON.stringify(row.data || {}));
      data._assigned = !!on;
      const { error } = await db().from('club_tactics').update({ data, updated_at: new Date().toISOString() }).eq('id', row.id);
      if (!error) row.data = data;
      return { error: error && error.message };
    },
    seenKey(id) { return 'tl_club_seen_' + id; },
    isSeen(id) { return localStorage.getItem(this.seenKey(id)) === '1'; },
    markSeen(id) { try { localStorage.setItem(this.seenKey(id), '1'); this._recheckUnseen(); } catch (e) {} },
    _recheckUnseen() {
      try {
        const cache = this._tactics || [];
        const me = uid();
        const unseen = cache.some(row => row.author_id !== me && !this.isSeen(row.id));
        localStorage.setItem('tl_club_unseen', unseen ? '1' : '0');
        TL.app && TL.app.refreshClubBadge && TL.app.refreshClubBadge();
      } catch (e) {}
    },

    // jugador: copiar una táctica del club a su biblioteca personal
    importToMine(row) {
      const tac = JSON.parse(JSON.stringify(row.data));
      tac.id = TL.store.uid();
      tac.name = (row.name || tac.name || '') + ' ' + (TL.i18n.lang === 'en' ? '(club)' : '(club)');
      tac.createdAt = tac.updatedAt = Date.now();
      const list = TL.store.loadAll(); list.unshift(tac); TL.store.saveAll(list);
      return tac;
    },

    // ---------- UI ----------
    host() {
      if (this.pageMode && this._pageRoot) return this._pageRoot;
      let h = document.getElementById('modal-host'); if (!h) { h = document.createElement('div'); h.id = 'modal-host'; document.body.appendChild(h); } return h;
    },
    close() { if (this.pageMode) return; this.host().innerHTML = ''; },

    // abrir como MODAL (desde ajustes u otros sitios)
    async open() {
      this.pageMode = false; this._pageRoot = null;
      // competir es gratis: solo requiere sesión
      if (!this.demo && !this.ready()) { TL.app.toast(t('club_need_login')); if (TL.cloud.authModal) TL.cloud.authModal(); return; }
      this.host().innerHTML = `<div class="modal-scrim" id="ms"><div class="modal club-modal"><div class="club-loading">${t('loading')||'…'}</div></div></div>`;
      await this.load();
      this.draw();
    },

    // abrir como PÁGINA (pestaña de la barra inferior)
    async renderPage(root) {
      this.pageMode = true; this._pageRoot = root;
      const en = TL.i18n.lang === 'en';
      if (!this.demo && !this.ready()) {
        root.innerHTML = `<div class="club-page"><div class="club-page-gate">
          <span class="club-ic">${ic.users || ic.user}</span>
          <h2>${t('club_title')}</h2>
          <p>${en ? 'Train as a team and climb the Club League. Sign in to create or join a club.' : 'Entrena en equipo y sube en la Liga de Clubes. Inicia sesión para crear o unirte a un club.'}</p>
          <button class="btn btn-primary" id="club-gate-login">${en ? 'Sign in' : 'Iniciar sesión'}</button>
        </div></div>`;
        const b = root.querySelector('#club-gate-login');
        if (b) b.onclick = () => { if (TL.cloud.authModal) TL.cloud.authModal(); };
        return;
      }
      root.innerHTML = `<div class="club-page"><div class="club-loading">${t('loading')||'…'}</div></div>`;
      await this.load();
      this.draw();
    },

    draw() {
      const en = TL.i18n.lang === 'en';
      let body;
      if (!this.current) {
        const pend = this.pendingInvite();
        body = `
          <div class="club-hero">
            <span class="club-ic">${ic.users || ic.user}</span>
            <h2>${t('club_title')}</h2>
            <p>${en ? 'Train as a team. Coaches share tactics with all their players.' : 'Entrena en equipo. El entrenador comparte tácticas con todos sus jugadores.'}</p>
          </div>
          <div class="club-two">
            <div class="club-card">
              <h3>${t('club_create')}</h3>
              <p>${en ? 'You are a coach' : 'Eres entrenador'}</p>
              ${this.identityFields({})}
              <button class="btn btn-primary" id="club-create-btn">${t('club_create')}</button>
            </div>
            <div class="club-card ${pend ? 'club-card-hot' : ''}">
              <h3>${t('club_join')}</h3>
              <p>${pend ? (en ? 'You have an invite — tap Join' : 'Tienes una invitación — pulsa Unirse') : (en ? 'You are a player' : 'Eres jugador')}</p>
              <input id="club-code" placeholder="${t('club_code_ph')}" style="text-transform:uppercase" value="${esc(pend)}"/>
              <button class="btn ${pend ? 'btn-primary' : 'btn-line'}" id="club-join-btn">${t('club_join')}</button>
            </div>
          </div>`;
      } else {
        const coach = this.role === 'coach';
        const accent = this.current.color || '#E8703D';
        const crest = esc(this.current.crest || (this.current.name || '?').slice(0,1).toUpperCase());
        const geo = (this.current.city || this.current.country)
          ? `${this.current.city ? '📍 ' + esc(this.current.city) : ''}${this.current.country && TL.league ? (this.current.city ? ' · ' : '') + TL.league.flag(this.current.country) + ' ' + esc(TL.league.countryName(this.current.country)) : ''}` : '';
        body = `
          <div class="club-world-hero">
            <div class="club-world-crest">${crest}</div>
            <div class="club-world-id">
              <span class="club-world-role">${coach ? t('club_role_coach') : t('club_role_player')}</span>
              <h2>${esc(this.current.name)}${coach ? ` <button class="club-rename-btn" id="club-rename" title="${en ? 'Rename club' : 'Renombrar club'}">${ic.edit}</button>` : ''}</h2>
              <div class="club-world-meta">
                <span class="club-plan-tag ${this.isPro() ? 'pro' : 'free'}">${this.isPro() ? (en ? 'CLUB PLAN' : 'PLAN CLUB') : (en ? 'FREE' : 'GRATIS')}</span>
                ${geo ? `<span class="club-geo">${geo}</span>` : ''}
              </div>
            </div>
          </div>
          ${coach ? `<div class="club-code-box">
              <span>${t('club_code')}</span><b id="club-code-val">${esc(this.current.invite_code)}</b>
              <button class="btn btn-ghost btn-sm" id="club-copy" title="${t('copy') || 'Copiar'}">${ic.copy}</button>
              <button class="btn btn-ghost btn-sm" id="club-regen" title="${en ? 'Generate new code' : 'Generar código nuevo'}">↻</button>
              <button class="btn btn-primary btn-sm" id="club-invite">${ic.share}${en ? 'Invite' : 'Invitar'}</button>
            </div>` : ''}
          ${this.noticeBlock(coach, en)}
          <button class="btn btn-line club-league-btn" id="club-league">${ic.trophy || ic.star} ${en ? 'View League ranking' : 'Ver ranking de la Liga'}</button>
          <div class="club-grid">
          <div class="club-section club-mini-section">
            <div class="club-sec-head">
              <h3>${ic.trophy || ic.star} ${en ? 'Club leaderboard' : 'Clasificación del club'}</h3>
              <span class="club-mini-sub">${en ? 'this season' : 'esta temporada'}</span>
            </div>
            <div id="club-mini" class="club-mini-list"><div class="club-loading">…</div></div>
          </div>
          <div class="club-section club-tac-section">
            <div class="club-sec-head"><h3>${t('club_shared')}</h3>${coach ? `<button class="btn btn-primary btn-sm" id="club-share">${ic.plus}${t('club_share_tactic')}</button>` : ''}</div>
            <div id="club-tactics" class="club-tac-list"><div class="club-loading">…</div></div>
          </div>
          ${coach ? `<div class="club-section club-players-section"><div class="club-sec-head"><h3>${t('club_players')}</h3></div><div id="club-members" class="club-mem-list"></div></div>` : ''}
          </div>
          <div class="club-foot"><button class="btn btn-ghost btn-sm" id="club-leave">${coach ? (en ? 'Delete club' : 'Eliminar club') : t('club_leave')}</button></div>`;
      }
      const accentVar = this.current ? `--club-accent:${esc(this.current.color || '#E8703D')}` : '';
      if (this.current) { try { document.body.style.setProperty('--club-world', this.current.color || '#E8703D'); } catch (e) {} }
      if (this.pageMode) {
        this.host().innerHTML = `<div class="club-page${this.current ? ' has-club' : ''}" style="${accentVar}">${body}</div>`;
      } else {
        this.host().innerHTML = `<div class="modal-scrim" id="ms"><div class="modal club-modal" style="${accentVar}">
          <div class="modal-head"><h2>${t('club_title')}</h2><button class="x" id="mx">${ic.x}</button></div>
          <div class="modal-body">${body}</div></div></div>`;
      }
      this.bind();
      if (this.current) { this.fillMiniLeague(); this.fillTactics(); if (this.role === 'coach') this.fillMembers(); }
    },

    bind() {
      const h = this.host();
      const mx = h.querySelector('#mx'); if (mx) mx.onclick = () => this.close();
      const ms = h.querySelector('#ms'); if (ms) ms.onclick = e => { if (e.target.id === 'ms') this.close(); };
      const cb = h.querySelector('#club-create-btn');
      if (cb) {
        this.bindColors(h);
        cb.onclick = async () => {
          const meta = this.readIdentity(h);
          if (!meta.name) { TL.app.toast(t('club_name_ph')); return; }
          cb.disabled = true;
          const r = await this.createClub(meta);
          if (r.error) { TL.app.toast(r.error); cb.disabled = false; return; }
          TL.app.toast(t('club_created'), true); this.draw();
        };
      }
      const jb = h.querySelector('#club-join-btn');
      if (jb) jb.onclick = async () => {
        const code = h.querySelector('#club-code').value.trim();
        if (!code) { TL.app.toast(t('club_code_ph')); return; }
        jb.disabled = true;
        const r = await this.joinClub(code);
        if (r.error) {
          const en = TL.i18n.lang === 'en';
          const msg = r.error === 'club_full'
            ? (en ? 'This club is full (free plan). Ask the coach to upgrade.' : 'Este club está lleno (plan gratis). Pide al entrenador que lo amplíe.')
            : r.error === 'already_in_club'
            ? (en ? 'You are already in a club. Leave it first to join another.' : 'Ya perteneces a un club. Sal de él antes de unirte a otro.')
            : r.error;
          TL.app.toast(msg); jb.disabled = false; return;
        }
        this.clearPending();
        TL.app.toast(t('club_joined'), true); this.draw();
      };
      const cp = h.querySelector('#club-copy');
      if (cp) cp.onclick = () => { try { navigator.clipboard.writeText(this.current.invite_code); TL.app.toast(t('copied') || 'Copiado', true); } catch (e) {} };
      const sh2 = h.querySelector('#club-invite');
      if (sh2) sh2.onclick = () => this.shareInvite();
      const lg = h.querySelector('#club-league');
      if (lg) lg.onclick = () => { this.close(); TL.app.openLeague(); };
      const rn = h.querySelector('#club-rename');
      if (rn) rn.onclick = () => this.editIdentity();
      const nadd = h.querySelector('#club-notice-add'); if (nadd) nadd.onclick = () => this.editNotice();
      const nedit = h.querySelector('#club-notice-edit'); if (nedit) nedit.onclick = () => this.editNotice();
      const rg = h.querySelector('#club-regen');
      if (rg) rg.onclick = async () => {
        const en = TL.i18n.lang === 'en';
        const ok = await TL.ui.confirm({ message: en ? 'Generate a new invite code? The old one stops working.' : '¿Generar un código nuevo? El anterior dejará de funcionar.', ok: en ? 'New code' : 'Nuevo código' });
        if (!ok) return;
        const r = await this.regenCode();
        if (r.error) { TL.app.toast(r.error); return; }
        TL.app.toast(en ? 'New code generated' : 'Código nuevo generado', true); this.draw();
      };
      const sh = h.querySelector('#club-share');
      if (sh) sh.onclick = () => this.pickToShare();
      const lv = h.querySelector('#club-leave');
      if (lv) lv.onclick = async () => {
        const en = TL.i18n.lang === 'en';
        if (this.role === 'coach') {
          // el entrenador es el dueño: salir = eliminar el club (si no, queda huérfano)
          const ok = await TL.ui.confirm({ message: en ? 'Delete this club? All shared tactics and players will be removed. This cannot be undone.' : '¿Eliminar este club? Se borrarán las tácticas compartidas y los jugadores. No se puede deshacer.', danger: true, ok: en ? 'Delete club' : 'Eliminar club' });
          if (!ok) return;
          const r = await this.deleteClub();
          if (r.error) { TL.app.toast(r.error); return; }
          TL.app.toast(en ? 'Club deleted' : 'Club eliminado'); this.draw();
        } else {
          const ok = await TL.ui.confirm({ message: t('club_leave_confirm'), danger: true, ok: en ? 'Leave' : 'Salir' });
          if (!ok) return;
          await this.leaveClub(); TL.app.toast(t('club_left')); this.draw();
        }
      };
    },

    // ---- TABLÓN del club (aviso fijado por el entrenador) ----
    noticeBlock(coach, en) {
      const notice = (this.current && this.current.notice) ? esc(this.current.notice) : '';
      if (!notice && !coach) return '';
      if (!notice && coach) {
        return `<button class="club-notice add" id="club-notice-add">
            <span class="cn-ic">📌</span>
            <span class="cn-tx">${en ? 'Pin a notice for your players…' : 'Fija un aviso para tus jugadores…'}</span>
          </button>`;
      }
      return `<div class="club-notice">
          <span class="cn-ic">📌</span>
          <div class="cn-body"><span class="cn-label">${en ? 'CLUB BOARD' : 'TABLÓN'}</span><p class="cn-tx">${notice}</p></div>
          ${coach ? `<button class="cn-edit" id="club-notice-edit" title="${en ? 'Edit' : 'Editar'}">${ic.edit}</button>` : ''}
        </div>`;
    },
    // ---- vistas de tácticas (coach ve quién las vió) ----
    async recordView(tacticId) {
      if (this.demo || !this.current) return;
      try {
        await db().from('club_tactic_views')
          .upsert({ club_id: this.current.id, tactic_id: tacticId, user_id: uid(), seen_at: new Date().toISOString() }, { onConflict: 'tactic_id,user_id' });
      } catch (e) {}
    },
    async viewCountsFor(ids) {
      const out = {};
      if (this.demo) { (ids||[]).forEach((id,i) => out[id] = (i*2) % 5); return out; }
      if (!this.current || !ids || !ids.length) return out;
      try {
        const { data } = await db().from('club_tactic_views')
          .select('tactic_id, user_id').eq('club_id', this.current.id).in('tactic_id', ids);
        (data || []).forEach(r => { out[r.tactic_id] = (out[r.tactic_id] || 0) + 1; });
      } catch (e) {}
      return out;
    },

    async setNotice(text) {
      if (this.demo) { this.current.notice = text; return { ok: true }; }
      const { error } = await db().from('clubs').update({ notice: text || null, notice_at: new Date().toISOString() }).eq('id', this.current.id);
      if (!error) this.current.notice = text;
      return { error: error && error.message };
    },
    async editNotice() {
      const en = TL.i18n.lang === 'en';
      const cur = (this.current && this.current.notice) || '';
      const val = await TL.ui.prompt({
        title: en ? 'Club board' : 'Tablón del club',
        message: en ? 'This message shows to all your players when they open Club.' : 'Este mensaje lo ven todos tus jugadores al abrir Club.',
        value: cur, placeholder: en ? 'e.g. Training Thu 7pm — bring water' : 'p. ej. Entreno jueves 19h — traed agua',
        multiline: true, ok: en ? 'Pin' : 'Fijar',
      });
      if (val === null) return;
      const r = await this.setNotice(val.trim());
      if (r && r.error) { TL.app.toast(r.error); return; }
      TL.app.toast(val.trim() ? (en ? 'Notice pinned' : 'Aviso fijado') : (en ? 'Notice removed' : 'Aviso quitado'), true);
      this.renderPage(this._pageRoot || this.host());
    },

    async fillMiniLeague() {
      const box = this.host().querySelector('#club-mini'); if (!box) return;
      const en = TL.i18n.lang === 'en';
      const mem = await this.members();
      const list = this.memberLeague(mem);
      const anyPoints = list.some(m => m.points > 0);
      if (!list.length) { box.innerHTML = `<div class="club-empty">${en ? 'No members yet.' : 'Aún no hay miembros.'}</div>`; return; }
      if (!anyPoints) {
        box.innerHTML = `<div class="club-mini-empty">${ic.trophy || ic.star}
          <p>${en ? 'No points yet this season. When members log matches, they climb here — win +10, played +2.' : 'Aún no hay puntos esta temporada. Cuando los miembros registren partidos, subirán aquí — ganar +10, jugar +2.'}</p></div>`;
        return;
      }
      const top = list[0].points || 1;
      box.innerHTML = list.map((m, i) => {
        const pos = i + 1;
        const podium = pos <= 3 ? 'p' + pos : '';
        const pct = Math.max(6, Math.round((m.points / top) * 100));
        const name = this.displayName(m);
        const isCoach = m.role === 'coach';
        return `
        <div class="club-mini-row ${m.me ? 'me' : ''}">
          <span class="club-mini-pos ${podium}">${pos <= 3 ? ['🥇','🥈','🥉'][pos-1] : pos}</span>
          <span class="club-mini-av">${esc(name.slice(0,1).toUpperCase())}</span>
          <div class="club-mini-tx">
            <b>${esc(name)}${m.me ? ` <span class="club-mini-you">${en ? 'YOU' : 'TÚ'}</span>` : ''}${isCoach ? ` <span class="club-mini-coach">${en ? 'COACH' : 'COACH'}</span>` : ''}</b>
            <div class="club-mini-bar"><i style="width:${pct}%"></i></div>
            <small>${m.wins} ${en ? 'wins' : 'vict.'} · ${m.played} ${en ? 'played' : 'jug.'}${m.streak >= 2 ? ` · 🔥 ${m.streak}` : ''}</small>
          </div>
          <span class="club-mini-pts">${m.points}<span>${en ? 'pts' : 'pts'}</span></span>
        </div>`;
      }).join('');
    },

    async fillTactics() {
      const box = this.host().querySelector('#club-tactics'); if (!box) return;
      let rows = await this.sharedTactics();
      const coach = this.role === 'coach';
      const en = TL.i18n.lang === 'en';
      if (!rows.length) { box.innerHTML = `<div class="club-empty">${t('club_no_tactics')}</div>`; return; }
      // assigned plays float to the top
      rows = rows.slice().sort((a,b) => (this.isAssigned(b)?1:0) - (this.isAssigned(a)?1:0));
      // entrenador: cuántos jugadores han visto cada jugada (lectura best-effort)
      let views = {};
      if (coach) { try { views = await this.viewCountsFor(rows.map(r=>r.id)); } catch(e){} }
      // coach summary: how many plays are assigned
      const nAssigned = rows.filter(r => this.isAssigned(r)).length;
      const summary = coach
        ? (nAssigned ? `<div class="club-coach-note">${ic.flag||ic.star} ${nAssigned} ${en?'play(s) assigned to your players':'jugada(s) asignada(s) a tus jugadores'}</div>` : '')
        : (nAssigned ? `<div class="club-coach-note">${ic.flag||ic.star} ${en?'Your coach assigned plays — watch them below.':'Tu entrenador asignó jugadas — míralas abajo.'}</div>` : '');
      box.innerHTML = summary + rows.map(r => {
        const assigned = this.isAssigned(r);
        const seen = this.isSeen(r.id);
        const steps = (r.data && r.data.steps ? r.data.steps.length : 0);
        const sport = (r.data && r.data.sport === 'padel') ? '🥎' : '🎾';
        const note = (r.data && r.data._note) ? `<div class="club-tac-note">${ic.flag} ${esc(r.data._note)}</div>` : '';
        return `
        <div class="club-tac ${assigned?'assigned':''} ${(assigned&&!coach&&!seen)?'todo':''}" data-id="${r.id}">
          <div class="club-tac-tt">
            <b>${sport} ${esc(r.name || t('untitled'))}
              ${assigned ? `<span class="ct-tag plan">${en?'PLAN':'PLAN'}</span>` : ''}
              ${(assigned && !coach) ? (seen ? `<span class="ct-tag seen">${en?'SEEN':'VISTA'} ✓</span>` : `<span class="ct-tag todo">${en?'TO WATCH':'POR VER'}</span>`) : ''}
              ${coach ? `<span class="ct-tag views" title="${en?'players who watched':'jugadores que la vieron'}">👁 ${views[r.id]||0}</span>` : ''}
            </b>
            <span>${steps} ${en ? (steps===1?'step':'steps') : (steps===1?'paso':'pasos')}</span>
            ${note}
          </div>
          <div class="club-tac-act">
            <button class="btn btn-line btn-sm act-watch">${ic.play}${en?'Watch':'Ver'}</button>
            <button class="btn btn-ghost btn-sm act-import">${ic.copy || ''}${t('club_import')}</button>
            ${coach ? `<button class="btn ${assigned?'btn-primary':'btn-ghost'} btn-sm act-assign" title="${en?'Assign as required play':'Asignar como jugada obligatoria'}">${assigned?(en?'Assigned':'Asignada'):(en?'Assign':'Asignar')}</button>` : ''}
            ${coach ? `<button class="btn btn-ghost btn-sm act-unshare" title="${t('delete')}">${ic.trash}</button>` : ''}
          </div>
        </div>`;
      }).join('');
      box.querySelectorAll('.club-tac').forEach(el => {
        const row = rows.find(r => r.id === el.dataset.id);
        if (!row) return;
        const openWatch = () => {
          const tac = JSON.parse(JSON.stringify(row.data)); tac.id = tac.id || ('club_' + row.id);
          this.markSeen(row.id);
          if (!coach) this.recordView(row.id);
          this.close();
          TL.editor.open(tac, { viewer: true });
        };
        el.querySelector('.act-watch').onclick = openWatch;
        el.querySelector('.act-import').onclick = () => { this.importToMine(row); TL.app.toast(t('club_imported'), true); };
        const as = el.querySelector('.act-assign');
        if (as) as.onclick = async () => {
          as.disabled = true;
          const r = await this.setAssigned(row, !this.isAssigned(row));
          if (r.error) { TL.app.toast(r.error); as.disabled = false; return; }
          TL.app.toast(this.isAssigned(row) ? (en?'Assigned to players':'Asignada a jugadores') : (en?'Assignment removed':'Asignación quitada'), true);
          this.fillTactics();
        };
        const un = el.querySelector('.act-unshare');
        if (un) un.onclick = async () => {
          const en = TL.i18n.lang === 'en';
          const ok = await TL.ui.confirm({ message: en ? 'Remove this play from the club?' : '¿Quitar esta jugada del club?', danger: true, ok: t('delete') });
          if (!ok) return;
          await this.unshare(row.id); this.fillTactics();
        };
      });
    },

    async fillMembers() {
      const box = this.host().querySelector('#club-members'); if (!box) return;
      const en = TL.i18n.lang === 'en';
      const mem = await this.members();
      const ownerId = this.current && this.current.owner_id;
      const players = mem.filter(m => m.role !== 'coach').length;
      const count = `<div class="club-mem-count">${mem.length} ${en ? (mem.length === 1 ? 'member' : 'members') : (mem.length === 1 ? 'miembro' : 'miembros')} · ${players} ${en ? (players === 1 ? 'player' : 'players') : (players === 1 ? 'jugador' : 'jugadores')}</div>`;
      // barra de uso del plan (solo entrenador)
      let usage = '';
      if (this.role === 'coach') {
        if (this.isPro()) {
          usage = `<div class="club-usage pro"><span class="club-usage-tx">${ic.check || '✓'} ${en ? 'Club Plan · unlimited players' : 'Plan Club · jugadores ilimitados'}</span></div>`;
        } else {
          const pct = Math.min(100, Math.round(players / FREE_PLAYERS * 100));
          const full = players >= FREE_PLAYERS;
          usage = `<div class="club-usage ${full ? 'full' : ''}">
            <div class="club-usage-row">
              <span class="club-usage-tx">${players} / ${FREE_PLAYERS} ${en ? 'players (free plan)' : 'jugadores (plan gratis)'}</span>
              <button class="btn btn-primary btn-sm" id="club-upgrade">${en ? 'Upgrade' : 'Ampliar'}</button>
            </div>
            <div class="club-usage-bar"><i style="width:${pct}%"></i></div>
            ${full ? `<div class="club-usage-warn">${en ? 'Club is full — upgrade to add more players.' : 'Club lleno — amplía para añadir más jugadores.'}</div>` : ''}
          </div>`;
        }
      }
      box.innerHTML = count + usage + mem.map(m => {
        const isOwner = m.user_id === ownerId;
        const canKick = this.role === 'coach' && !isOwner && m.user_id !== uid();
        return `
        <div class="club-mem" data-uid="${m.user_id}">
          <span class="club-mem-av">${esc((m.email || '?').slice(0, 1).toUpperCase())}</span>
          <span class="club-mem-tx">${esc(m.email || '—')}</span>
          <span class="club-mem-role ${m.role}">${m.role === 'coach' ? t('club_role_coach') : t('club_role_player')}</span>
          ${canKick ? `<button class="btn btn-ghost btn-sm club-mem-kick" title="${en ? 'Remove player' : 'Quitar jugador'}">${ic.trash}</button>` : ''}
        </div>`;
      }).join('');
      const up = box.querySelector('#club-upgrade');
      if (up) up.onclick = () => this.upgradeClubPlan();
      box.querySelectorAll('.club-mem-kick').forEach(btn => {
        btn.onclick = async () => {
          const row = btn.closest('.club-mem'); const userId = row && row.dataset.uid;
          if (!userId) return;
          const ok = await TL.ui.confirm({ message: en ? 'Remove this player from the club?' : '¿Quitar a este jugador del club?', danger: true, ok: en ? 'Remove' : 'Quitar' });
          if (!ok) return;
          const r = await this.removeMember(userId);
          if (r.error) { TL.app.toast(r.error); return; }
          TL.app.toast(en ? 'Player removed' : 'Jugador quitado', true);
          this.fillMembers();
        };
      });
    },

    pickToShare() {
      const en = TL.i18n.lang === 'en';
      const all = TL.store.loadAll().filter(tc => !tc.demo);
      if (!all.length) { TL.app.toast(t('no_tactics_yet')); return; }
      const h = this.host();
      const opts = all.map(tc => `<option value="${tc.id}">${(tc.sport === 'padel' ? '🥎 ' : '🎾 ')}${esc(tc.name || t('untitled'))}</option>`).join('');
      const ov = document.createElement('div');
      ov.className = 'modal-scrim'; ov.id = 'ms2';
      ov.innerHTML = `<div class="modal"><div class="modal-head"><h2>${t('club_share_tactic')}</h2><button class="x" id="mx2">${ic.x}</button></div>
        <div class="modal-body">
          <div class="field"><label>${t('sec_tactics')}</label><select id="share-sel">${opts}</select></div>
          <div class="field"><label>${en ? 'Note for players (optional)' : 'Nota para jugadores (opcional)'}</label><textarea id="share-note" rows="2" placeholder="${en ? 'e.g. Practise this for Saturday' : 'p. ej. A practicar para el sábado'}"></textarea></div>
        </div>
        <div class="modal-foot"><button class="btn btn-ghost" id="share-cancel">${t('cancel')}</button><button class="btn btn-primary" id="share-go">${t('club_share_tactic')}</button></div></div>`;
      document.body.appendChild(ov);
      const done = () => ov.remove();
      ov.querySelector('#mx2').onclick = done; ov.querySelector('#share-cancel').onclick = done;
      ov.onclick = e => { if (e.target.id === 'ms2') done(); };
      ov.querySelector('#share-go').onclick = async () => {
        const tac = all.find(x => x.id === ov.querySelector('#share-sel').value);
        const note = ov.querySelector('#share-note').value;
        const r = await this.share(tac, note); done();
        if (r && r.error) TL.app.toast(r.error); else { TL.app.toast(t('club_shared_ok'), true); this.fillTactics(); }
      };
    },

    // ---- Plan Club (monetización) ----
    // ---- Plan Club (monetización) ----
    editIdentity() {
      const en = TL.i18n.lang === 'en';
      const ov = document.createElement('div');
      ov.className = 'modal-scrim'; ov.id = 'msid';
      ov.innerHTML = `<div class="modal">
        <div class="modal-head"><h2>${en ? 'Edit club' : 'Editar club'}</h2><button class="x" id="mxid">${ic.x}</button></div>
        <div class="modal-body"><div class="club-card" id="id-form">${this.identityFields(this.current)}</div></div>
        <div class="modal-foot"><button class="btn btn-ghost" id="id-cancel">${t('cancel')}</button><button class="btn btn-primary" id="id-save">${t('save') || (en ? 'Save' : 'Guardar')}</button></div></div>`;
      this.host().appendChild(ov);
      const form = ov.querySelector('#id-form');
      this.bindColors(form);
      const done = () => ov.remove();
      ov.querySelector('#mxid').onclick = done;
      ov.querySelector('#id-cancel').onclick = done;
      ov.onclick = e => { if (e.target.id === 'msid') done(); };
      ov.querySelector('#id-save').onclick = async () => {
        const meta = this.readIdentity(form);
        if (!meta.name) { TL.app.toast(t('club_name_ph')); return; }
        const r = await this.updateIdentity(meta);
        if (r.error) { TL.app.toast(r.error); return; }
        done(); TL.app.toast(en ? 'Club updated' : 'Club actualizado', true); this.draw();
      };
    },

    upgradeClubPlan() {
      const en = TL.i18n.lang === 'en';
      const ov = document.createElement('div');
      ov.className = 'modal-scrim'; ov.id = 'msplan';
      const feats = en
        ? ['Unlimited players', 'Shared tactics library', 'Assign required plays to the team', 'Coach controls & invite links']
        : ['Jugadores ilimitados', 'Biblioteca de tácticas compartida', 'Asignar jugadas obligatorias al equipo', 'Controles de entrenador y enlaces de invitación'];
      ov.innerHTML = `<div class="modal club-plan-modal">
        <div class="modal-head"><h2>${en ? 'Club Plan' : 'Plan Club'}</h2><button class="x" id="mxp">${ic.x}</button></div>
        <div class="modal-body">
          <div class="plan-hero"><span class="plan-badge">${en ? 'CLUB' : 'CLUB'}</span>
            <p>${en ? 'Your free club fits up to ' : 'Tu club gratis admite hasta '}<b>${FREE_PLAYERS} ${en ? 'players' : 'jugadores'}</b>. ${en ? 'Go unlimited for your whole academy.' : 'Pásate a ilimitado para toda tu academia.'}</p>
          </div>
          <ul class="plan-feats">${feats.map(f => `<li>${ic.check || '✓'} ${f}</li>`).join('')}</ul>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="plan-cancel">${t('cancel') || (en ? 'Close' : 'Cerrar')}</button>
          <button class="btn btn-primary" id="plan-go">${en ? 'Get Club Plan' : 'Quiero el Plan Club'}</button>
        </div></div>`;
      this.host().appendChild(ov);
      const done = () => ov.remove();
      ov.querySelector('#mxp').onclick = done;
      ov.querySelector('#plan-cancel').onclick = done;
      ov.onclick = e => { if (e.target.id === 'msplan') done(); };
      const go = ov.querySelector('#plan-go');
      if (go) go.onclick = () => {
        // dueño del club + pago real de Stripe (Plan Club, jugadores ilimitados)
        if (this.demo || !this.current || !this.current.id) {
          TL.app && TL.app.toast(en ? 'Available in your real club' : 'Disponible en tu club real'); return;
        }
        if (TL.premium && TL.premium.startCheckout) {
          go.classList.add('is-loading');
          TL.premium.startCheckout('club', { club_id: this.current.id });
        }
      };
    },
  };

  TL.club = club;
})(window.TL = window.TL || {});
