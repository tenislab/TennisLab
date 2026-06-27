/* ============================================================
   cloud.js — Supabase: cuentas + sincronización en la nube (ACTIVO)
   ------------------------------------------------------------
   Modelo "snapshot": cada usuario tiene UNA fila en user_state con
   todos sus datos en JSON. La app sigue siendo offline-first
   (localStorage es la caché); al guardar se sincroniza con la nube
   y al iniciar sesión en otro dispositivo se recupera todo.

   Requiere, en el HTML y ANTES de este archivo:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   y haber ejecutado supabase/schema.sql en el SQL Editor de Supabase.
   ============================================================ */
(function (TL) {
  const t = (k) => TL.i18n.t(k);
  const ic = TL.icon;

  // claves de contenido que se sincronizan
  const DATA_KEYS = ['tl_tactics_v1','tl_folders_v1','tl_rivals_v1','tl_matches_v1','tl_diary_v1','tl_goals_v1','tl_sessions_v1','tl_lang','tl_theme','tl_accent','tl_sound','tl_logo'];
  // solo el CONTENIDO del usuario (no las preferencias del dispositivo)
  const CONTENT_KEYS = ['tl_tactics_v1','tl_folders_v1','tl_rivals_v1','tl_matches_v1','tl_diary_v1','tl_goals_v1','tl_sessions_v1'];

  function host(){ let h=document.getElementById('modal-host'); if(!h){h=document.createElement('div');h.id='modal-host';document.body.appendChild(h);} return h; }
  function closeModal(){ host().innerHTML=''; }

  // cuenta de demostración (funciona sin Supabase)
  const DEMO_EMAIL = 'demo@tennislab.app';
  const DEMO_PASS = 'demo1234';

  const cloud = {
    enabled: true,
    config: {
      url: 'https://kgnfmebprdqebpuhljat.supabase.co',
      anonKey: 'sb_publishable_e_LcRebqnNn0g36nwO_S8w_claGl-NV',
    },
    client: null,
    user: null,
    demo: false,       // sesión de cuenta demo (todo local, sin red)
    DATA_KEYS,
    _set: null,        // setter original de localStorage (sin patch)
    _syncTimer: null,
    _pulling: false,
    _pendingPush: false,   // hay cambios sin subir a la nube
    _retryTimer: null,     // reintento programado
    _retryDelay: 0,        // backoff actual (ms)
    _warnedOffline: false, // ya avisamos "guardado en local" esta racha

    init() {
      if (typeof supabase === 'undefined' || !this.enabled) { this.enabled = false; return false; }
      try {
        this.client = supabase.createClient(this.config.url, this.config.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
      } catch (e) { this.enabled = false; return false; }
      this.patchStorage();
      // recuperación de contraseña: el enlace del email vuelve con #type=recovery
      const _hp = new URLSearchParams((location.hash || '').replace(/^#/, ''));
      if (_hp.get('type') === 'recovery' && _hp.get('access_token')) {
        history.replaceState(null, '', location.pathname);
        this.client.auth.setSession({
          access_token: _hp.get('access_token'),
          refresh_token: _hp.get('refresh_token') || ''
        }).then(({ data }) => {
          if (data && data.session) this.user = data.session.user;
          this.resetPasswordModal();
        }).catch(() => {});
      }
      // enlace público de solo lectura: app#share=<token>
      const _sm = (location.hash || '').match(/[#&]share=([A-Za-z0-9_-]+)/);
      if (_sm) this.openSharedTactic(_sm[1]);
      // restaurar sesión existente
      this.client.auth.getSession().then(({ data }) => {
        if (data && data.session) { this.user = data.session.user; this.onLogin(true); }
        TL.app && TL.app.renderTopbar && TL.app.renderTopbar();
      }).catch(()=>{});
      this.client.auth.onAuthStateChange((_e, session) => {
        this.user = session ? session.user : null;
      });
      // al recuperar conexión, reintentar la subida pendiente de inmediato
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
          if (this.user && this._pendingPush) { this._retryDelay = 0; this.push(); }
        });
      }
      return true;
    },

    loggedIn() { return !!this.user; },
    email() { return this.user ? this.user.email : ''; },
    isCloudPremium() { return localStorage.getItem('tl_cloud_premium') === '1'; },
    hasSubscription() { return localStorage.getItem('tl_has_sub') === '1'; },

    // ---- snapshot helpers ----
    snapshot() {
      const o = {};
      DATA_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v != null) o[k] = v; });
      return o;
    },
    applySnapshot(o) {
      if (!o) return;
      const set = this._set || localStorage.setItem.bind(localStorage);
      DATA_KEYS.forEach(k => { if (o[k] != null) set(k, o[k]); });
      TL.store && TL.store.invalidate && TL.store.invalidate(); // cloud overwrote storage → drop stale parse cache
      if (o.tl_theme) document.documentElement.dataset.theme = o.tl_theme;
      if (o.tl_lang && TL.i18n) TL.i18n.lang = o.tl_lang;
      if (o.tl_accent && TL.settings) TL.settings.applyAccent(o.tl_accent);
    },
    // fusiona dos listas JSON [{id, updatedAt|createdAt}] → unión por id, gana el más reciente.
    // evita que la nube (posiblemente vieja) borre tácticas locales sin subir todavía.
    _mergeList(localStr, cloudStr) {
      let L = [], R = [];
      try { L = JSON.parse(localStr || '[]') || []; } catch (e) { L = []; }
      try { R = JSON.parse(cloudStr || '[]') || []; } catch (e) { R = []; }
      if (!Array.isArray(L) || !Array.isArray(R)) {
        const str = cloudStr != null ? cloudStr : (localStr != null ? localStr : '[]');
        return { str, changed: false };
      }
      const ts = x => (x && (x.updatedAt || x.createdAt)) || 0;
      const map = new Map();
      R.forEach(it => { if (it && it.id != null) map.set(it.id, it); });
      let localExtra = false;
      L.forEach(it => {
        if (!it || it.id == null) return;
        const ex = map.get(it.id);
        if (!ex) { map.set(it.id, it); localExtra = true; }            // solo en local → conservar
        else if (ts(it) > ts(ex)) { map.set(it.id, it); localExtra = true; } // local más nuevo → gana
      });
      const merged = Array.from(map.values());
      const changed = localExtra || merged.length !== R.length;
      return { str: JSON.stringify(merged), changed };
    },
    // como applySnapshot pero FUSIONANDO el contenido (no machaca). Devuelve true si lo
    // local aportaba elementos que la nube no tenía (→ conviene volver a subir).
    mergeSnapshot(o) {
      if (!o) return false;
      const set = this._set || localStorage.setItem.bind(localStorage);
      let localContributed = false;
      DATA_KEYS.forEach(k => {
        const isContent = CONTENT_KEYS.indexOf(k) >= 0;
        if (o[k] == null) {
          // la nube no trae esta clave; si local la tiene, local aporta
          if (isContent && localStorage.getItem(k) != null) localContributed = true;
          return;
        }
        if (isContent) {
          const res = this._mergeList(localStorage.getItem(k), o[k]);
          set(k, res.str);
          if (res.changed) localContributed = true;
        } else {
          set(k, o[k]); // preferencias (idioma/tema/acento…) → la nube manda, como antes
        }
      });
      TL.store && TL.store.invalidate && TL.store.invalidate();
      if (o.tl_theme) document.documentElement.dataset.theme = o.tl_theme;
      if (o.tl_lang && TL.i18n) TL.i18n.lang = o.tl_lang;
      if (o.tl_accent && TL.settings) TL.settings.applyAccent(o.tl_accent);
      return localContributed;
    },

    // ---- auth ----
    async signUp(email, password) {
      const { data, error } = await this.client.auth.signUp({ email, password });
      if (error) return { error: error.message };
      if (data.session) { this.user = data.user; await this.onLogin(false); return { ok: true }; }
      // sin sesión = requiere confirmar email
      return { ok: true, confirm: true };
    },
    async signIn(email, password) {
      // ---- cuenta DEMO: entra sin tocar Supabase, modo demostración completo ----
      if ((email || '').trim().toLowerCase() === DEMO_EMAIL && (password || '') === DEMO_PASS) {
        return this.startDemo();
      }
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      this.user = data.user; await this.onLogin(false); return { ok: true };
    },
    // ---- modo DEMO (cuenta de demostración, todo local) ----
    startDemo() {
      this.demo = true;
      this.user = { id: 'demo-user', email: DEMO_EMAIL, demo: true };
      try {
        TL.store && TL.store.seedDemo && TL.store.seedDemo();
        if (TL.club) TL.club.demo = true;
        if (TL.league) TL.league.demo = true;
        localStorage.removeItem('tl_cloud_premium');   // demo NO es premium
        localStorage.removeItem('tl_has_sub');
      } catch (e) { console.warn('demo seed', e); }
      TL.app && TL.app.renderHome && TL.app.renderHome();
      TL.app && TL.app.renderTopbar && TL.app.renderTopbar();
      const en = TL.i18n && TL.i18n.lang === 'en';
      TL.app && TL.app.toast && TL.app.toast(en ? 'Demo account — explore everything!' : '¡Cuenta demo — explora todo!', true);
      return { ok: true };
    },

    async signOut() {
      // cuenta demo: salir sin red, limpiar datos de ejemplo
      if (this.demo) {
        this.demo = false; this.user = null;
        localStorage.removeItem('tl_cloud_premium');
        if (TL.club) { TL.club.demo = false; TL.club.current = null; }
        if (TL.league) TL.league.demo = false;
        try { TL.store && TL.store.clearSeed && TL.store.clearSeed(); } catch (e) {}
        TL.app && TL.app.toast(t('signed_out'));
        TL.app && TL.app.renderHome && TL.app.renderHome();
        return;
      }
      // Antes de borrar el contenido local, asegúrate de que la nube lo tiene:
      // si había cambios sin subir, intenta una última subida.
      const offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
      if (this._pendingPush && !offline) { try { await this.push(true); } catch (e) {} }
      try { await this.client.auth.signOut(); } catch (e) {}
      this.user = null;
      localStorage.removeItem('tl_cloud_premium');
      localStorage.removeItem('tl_has_sub');
      // ¿siguen quedando datos sin sincronizar? entonces NO los borres: se perderían.
      const stillUnsynced = this._pendingPush || (typeof navigator !== 'undefined' && navigator.onLine === false);
      if (!stillUnsynced) {
        // pantalla limpia al cerrar sesión: el contenido sigue a salvo en la nube
        CONTENT_KEYS.forEach(k => localStorage.removeItem(k));
        TL.store && TL.store.invalidate && TL.store.invalidate(); // limpiar caché → no mostrar datos del usuario anterior
        TL.app && TL.app.toast(t('signed_out'));
      } else {
        const en = TL.i18n && TL.i18n.lang === 'en';
        TL.app && TL.app.toast(en
          ? 'Signed out — unsynced data kept on this device'
          : 'Sesión cerrada — datos sin sincronizar conservados en este dispositivo');
      }
      TL.app && TL.app.renderHome && TL.app.renderHome();
    },

    // primer arranque de sesión: traer de la nube (o subir si está vacía)
    async onLogin(silent) {
      if (this.demo) return;
      if (!this.user) return;
      this._pulling = true;
      try {
        let { data, error } = await this.client.from('user_state')
          .select('data,is_premium,stripe_subscription_id').eq('user_id', this.user.id).maybeSingle();
        if (error) { console.warn('cloud pull', error.message); this._pulling = false; return; }
        if (!data) {
          // sin fila aún → crearla con lo que haya en local
          await this.client.from('user_state').insert({ user_id: this.user.id, data: this.snapshot() });
        } else {
          localStorage.setItem('tl_cloud_premium', data.is_premium ? '1' : '0');
          // ¿tiene suscripción real de Stripe? (para mostrar "Gestionar" solo a clientes de pago)
          localStorage.setItem('tl_has_sub', data.stripe_subscription_id ? '1' : '0');
          const hasCloud = data.data && Object.keys(data.data).length > 0;
          const hasLocal = (TL.store.loadAll().length + TL.store.loadMatches().length + TL.store.loadRivals().length) > 0;
          if (hasCloud) {
            // FUSIONA nube+local (no machaca). Antes la nube ganaba siempre y borraba
            // tácticas locales recién creadas que aún no se habían subido.
            const localContributed = this.mergeSnapshot(data.data);
            // si lo local aportaba elementos que la nube no tenía, sube el resultado fusionado
            if (localContributed) { try { await this.push(true); } catch (e) {} }
          } else if (hasLocal) {
            await this.push(true);
          }
        }
      } catch (e) { console.warn(e); }
      this._pulling = false;
      TL.app && TL.app.renderHome && TL.app.renderHome();
      TL.social && TL.social.syncProfile && TL.social.syncProfile();
      if (!silent) TL.app && TL.app.toast(t('synced_ok'), true);
    },

    async push(force) {
      if (this.demo) return;
      if (!this.user || (this._pulling && !force)) return;
      // sin conexión: ni intentarlo, queda pendiente y reintenta al volver
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.markPending(); return;
      }
      try {
        const { error } = await this.client.from('user_state')
          .upsert({ user_id: this.user.id, data: this.snapshot(), updated_at: new Date().toISOString() });
        if (error) throw error;
        this.onPushOk();
      } catch (e) {
        console.warn('cloud push', e && e.message || e);
        this.markPending();
      }
    },

    // la subida funcionó: limpiar estado de "pendiente" y avisar si veníamos de un fallo
    onPushOk() {
      clearTimeout(this._retryTimer);
      this._retryDelay = 0;
      if (this._pendingPush) {
        this._pendingPush = false;
        const en = TL.i18n && TL.i18n.lang === 'en';
        TL.app && TL.app.toast && TL.app.toast(en ? 'Synced — all changes saved.' : 'Sincronizado — todo guardado en la nube.', true);
      }
      this._warnedOffline = false;
    },

    // hubo un fallo de red al subir: los datos SIGUEN a salvo en local (offline-first)
    markPending() {
      this._pendingPush = true;
      if (!this._warnedOffline) {
        this._warnedOffline = true;
        const en = TL.i18n && TL.i18n.lang === 'en';
        TL.app && TL.app.toast && TL.app.toast(
          en ? 'No connection — saved on this device. Will sync automatically.'
             : 'Sin conexión — guardado en este dispositivo. Se sincronizará solo.');
      }
      this.scheduleRetry();
    },

    // reintento con backoff exponencial (2s → 4s → … → máx 60s)
    scheduleRetry() {
      if (!this.user) return;
      clearTimeout(this._retryTimer);
      this._retryDelay = this._retryDelay ? Math.min(this._retryDelay * 2, 60000) : 2000;
      this._retryTimer = setTimeout(() => {
        if (this._pendingPush) this.push();
      }, this._retryDelay);
    },

    scheduleSync() {
      if (!this.user) return;
      clearTimeout(this._syncTimer);
      this._syncTimer = setTimeout(() => this.push(), 1400);
    },

    // detectar cambios en datos → sincronizar (no invasivo)
    patchStorage() {
      const orig = localStorage.setItem.bind(localStorage);
      this._set = orig;
      const self = this;
      localStorage.setItem = function (k, v) {
        orig(k, v);
        if (self.user && !self._pulling && DATA_KEYS.indexOf(k) >= 0) self.scheduleSync();
      };
    },

    // ---- recuperar contraseña ----
    async sendReset(email) {
      try {
        const redirectTo = location.origin + location.pathname;
        const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo });
        return error ? { error: error.message } : { ok: true };
      } catch (e) { return { error: String(e && e.message || e) }; }
    },
    async setNewPassword(password) {
      try {
        const { error } = await this.client.auth.updateUser({ password });
        return error ? { error: error.message } : { ok: true };
      } catch (e) { return { error: String(e && e.message || e) }; }
    },

    // ---- enlaces públicos de solo lectura (token) + OG dinámico ----
    // sube la imagen de previsualización al bucket 'shares' y crea la fila pública.
    async publishShare(tac, imageBlob) {
      if (!this.user) return { error: 'no auth' };
      try {
        const token = (Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6));
        let imageUrl = '';
        if (imageBlob) {
          const up = await this.client.storage.from('shares')
            .upload(token + '.png', imageBlob, { contentType: 'image/png', upsert: true });
          if (!up.error) {
            const pub = this.client.storage.from('shares').getPublicUrl(token + '.png');
            imageUrl = pub && pub.data ? pub.data.publicUrl : '';
          }
        }
        const row = {
          token, user_id: this.user.id,
          name: tac.name || '', description: tac.description || '',
          surface: tac.surface || '', sport: tac.sport || 'tennis',
          steps: (tac.steps || []).length, image_url: imageUrl,
          data: tac,
        };
        const { error } = await this.client.from('shares').insert(row);
        if (error) return { error: error.message };
        const url = this.config.url + '/functions/v1/share?t=' + token;
        return { ok: true, token, url };
      } catch (e) { return { error: String(e && e.message || e) }; }
    },

    // recupera una táctica compartida por su token (lectura anónima)
    async loadShare(token) {
      try {
        const { data, error } = await this.client.from('shares')
          .select('data').eq('token', token).maybeSingle();
        if (error || !data) return null;
        return data.data || null;
      } catch (e) { return null; }
    },

    // abre en modo visor la táctica de un enlace público
    async openSharedTactic(token) {
      const tac = await this.loadShare(token);
      if (!tac) { TL.app && TL.app.toast && TL.app.toast(t('share_not_found')); return; }
      tac.__shared = true;
      TL.editor && TL.editor.open && TL.editor.open(tac, { viewer: true });
    },

    // ---- UI: modal de login / registro ----
    authModal() {
      if (!this.enabled) { TL.app.toast(t('cloud_off')); return; }
      const en = TL.i18n.lang === 'en';
      let mode = 'in'; // 'in' | 'up'
      const draw = () => {
        host().innerHTML = `
        <div class="modal-scrim" id="ms"><div class="modal au-modal">
          <div class="modal-head"><h2>${mode==='in'?t('sign_in'):t('sign_up')}</h2><button class="x" id="mx">${ic.x}</button></div>
          <div class="modal-body">
            <p class="au-sub">${en?'Your tactics, on every device.':'Tus tácticas, en todos tus dispositivos.'}</p>
            <div class="field"><label>${t('email')}</label><input id="au-email" type="email" autocomplete="email" placeholder="tu@email.com"/></div>
            <div class="field"><label>${t('password')}</label><input id="au-pass" type="password" autocomplete="${mode==='in'?'current-password':'new-password'}" placeholder="••••••••"/></div>
            <div class="au-msg" id="au-msg"></div>
            ${mode==='in'?`<button type="button" id="au-forgot" style="background:none;border:0;color:var(--ball);font-size:13px;cursor:pointer;margin-top:12px;padding:0;text-decoration:underline;font-family:inherit">${t('forgot_pass')}</button>`:''}
            ${mode==='in'?`<div class="au-demo"><span>${en?'Just want to look around?':'¿Solo quieres echar un vistazo?'}</span><button type="button" class="btn btn-line btn-sm" id="au-demo">${en?'Try demo mode':'Probar en modo demo'}</button></div>`:''}
          </div>
          <div class="modal-foot au-foot">
            <button class="btn btn-ghost btn-sm" id="au-switch">${mode==='in'?t('need_account'):t('have_account')}</button>
            <button class="btn btn-primary" id="au-go">${mode==='in'?t('sign_in'):t('create_account')}</button>
          </div>
        </div></div>`;
        const h = host();
        h.querySelector('#mx').onclick = closeModal;
        h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') closeModal(); };
        h.querySelector('#au-switch').onclick = () => { mode = mode==='in'?'up':'in'; draw(); };
        const fg = h.querySelector('#au-forgot'); if (fg) fg.onclick = () => this.resetRequestModal(h.querySelector('#au-email').value.trim());
        const dm = h.querySelector('#au-demo'); if (dm) dm.onclick = () => { closeModal(); this.startDemo(); };
        const go = async () => {
          const email = h.querySelector('#au-email').value.trim();
          const pass = h.querySelector('#au-pass').value;
          const msg = h.querySelector('#au-msg');
          if (!email || pass.length < 6) { msg.textContent = en?'Enter email and a 6+ char password.':'Pon tu email y una contraseña de 6+ caracteres.'; return; }
          const btn = h.querySelector('#au-go'); btn.disabled = true; btn.textContent = en?'…':'…';
          const r = mode==='in' ? await this.signIn(email, pass) : await this.signUp(email, pass);
          if (r.error) { msg.textContent = r.error; btn.disabled = false; btn.textContent = mode==='in'?t('sign_in'):t('create_account'); return; }
          if (r.confirm) { msg.style.color='var(--ball)'; msg.textContent = en?'Check your email to confirm your account.':'Revisa tu correo para confirmar la cuenta.'; btn.disabled=false; btn.textContent=t('sign_in'); mode='in'; return; }
          closeModal();
        };
        h.querySelector('#au-go').onclick = go;
        h.querySelector('#au-pass').addEventListener('keydown', e => { if (e.key==='Enter') go(); });
        setTimeout(()=>h.querySelector('#au-email').focus(), 50);
      };
      draw();
    },

    // pedir enlace de recuperación por email
    resetRequestModal(prefill) {
      const en = TL.i18n.lang === 'en';
      host().innerHTML = `
      <div class="modal-scrim" id="ms"><div class="modal au-modal">
        <div class="modal-head"><h2>${t('reset_title')}</h2><button class="x" id="mx">${ic.x}</button></div>
        <div class="modal-body">
          <p class="au-sub">${en?'Enter your email and we will send you a reset link.':'Escribe tu email y te enviaremos un enlace para restablecerla.'}</p>
          <div class="field"><label>${t('email')}</label><input id="rs-email" type="email" autocomplete="email" placeholder="tu@email.com" value="${(prefill||'').replace(/"/g,'&quot;')}"/></div>
          <div class="au-msg" id="rs-msg"></div>
        </div>
        <div class="modal-foot au-foot">
          <button class="btn btn-ghost btn-sm" id="rs-back">${en?'Back':'Volver'}</button>
          <button class="btn btn-primary" id="rs-go">${t('reset_send')}</button>
        </div>
      </div></div>`;
      const h = host();
      h.querySelector('#mx').onclick = closeModal;
      h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') closeModal(); };
      h.querySelector('#rs-back').onclick = () => this.authModal();
      const go = async () => {
        const email = h.querySelector('#rs-email').value.trim();
        const msg = h.querySelector('#rs-msg');
        if (!email) { msg.textContent = t('reset_email_first'); return; }
        const btn = h.querySelector('#rs-go'); btn.disabled = true; btn.textContent = '…';
        const r = await this.sendReset(email);
        if (r.error) { msg.textContent = r.error; btn.disabled = false; btn.textContent = t('reset_send'); return; }
        msg.style.color = 'var(--ball)'; msg.textContent = t('reset_sent');
        btn.disabled = false; btn.textContent = t('reset_send');
      };
      h.querySelector('#rs-go').onclick = go;
      h.querySelector('#rs-email').addEventListener('keydown', e => { if (e.key==='Enter') go(); });
      setTimeout(()=>h.querySelector('#rs-email').focus(), 50);
    },

    // fijar nueva contraseña (al volver desde el enlace del email)
    resetPasswordModal() {
      const en = TL.i18n.lang === 'en';
      host().innerHTML = `
      <div class="modal-scrim" id="ms"><div class="modal au-modal">
        <div class="modal-head"><h2>${t('reset_title')}</h2><button class="x" id="mx">${ic.x}</button></div>
        <div class="modal-body">
          <p class="au-sub">${en?'Choose a new password for your account.':'Elige una nueva contraseña para tu cuenta.'}</p>
          <div class="field"><label>${t('new_pass')}</label><input id="np-pass" type="password" autocomplete="new-password" placeholder="••••••••"/></div>
          <div class="au-msg" id="np-msg"></div>
        </div>
        <div class="modal-foot au-foot">
          <button class="btn btn-primary" id="np-go" style="width:100%">${t('save_pass')}</button>
        </div>
      </div></div>`;
      const h = host();
      h.querySelector('#mx').onclick = closeModal;
      const go = async () => {
        const pass = h.querySelector('#np-pass').value;
        const msg = h.querySelector('#np-msg');
        if (pass.length < 6) { msg.textContent = en?'Use 6+ characters.':'Usa 6+ caracteres.'; return; }
        const btn = h.querySelector('#np-go'); btn.disabled = true; btn.textContent = '…';
        const r = await this.setNewPassword(pass);
        if (r.error) { msg.textContent = r.error; btn.disabled = false; btn.textContent = t('save_pass'); return; }
        closeModal();
        TL.app && TL.app.toast(t('pass_updated'), true);
        await this.onLogin(true);
        TL.app && TL.app.renderTopbar && TL.app.renderTopbar();
      };
      h.querySelector('#np-go').onclick = go;
      h.querySelector('#np-pass').addEventListener('keydown', e => { if (e.key==='Enter') go(); });
      setTimeout(()=>h.querySelector('#np-pass').focus(), 50);
    },
  };

  TL.cloud = cloud;
})(window.TL = window.TL || {});
