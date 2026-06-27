/* ============================================================
   app.js — controller: topbar, routing, toast, init
   ============================================================ */
(function (TL) {
  const t = (k) => TL.i18n.t(k);
  const ic = TL.icon;
  TL.VERSION = '2.0';

  const app = {
    root: null,

    init() {
      this.root = document.getElementById('root');
      if (!this.root) { requestAnimationFrame(() => this.init()); return; }  // wait for DOM (bundled splash)
      // capture the install prompt so Settings can offer "Install app"
      window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); TL._installPrompt = e; });
      window.addEventListener('appinstalled', () => { TL._installPrompt = null; TL.app.toast(t('install_done'), true); });
      this.renderTopbar();
      this.renderTabbar();
      // ?demo=1 (or #demo) → load example data so the whole app can be reviewed full
      try {
        if (/[?&]demo=1/.test(location.search) || /(^|#)demo$/.test(location.hash)) {
          TL.store && TL.store.seedDemo && TL.store.seedDemo();
          if (TL.league) TL.league.demo = true;
          if (TL.club) TL.club.demo = true;
        }
      } catch (e) {}
      this.route();
      window.addEventListener('hashchange', () => this.route());
      this.hideLoader();
      // --- defer non-critical startup so the home view paints first (faster perceived launch) ---
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
      idle(() => {
        TL.cloud && TL.cloud.init();
        TL.premium && TL.premium.checkReturn && TL.premium.checkReturn();
        TL.premium && TL.premium.trialReminder && TL.premium.trialReminder();
        TL.referrals && TL.referrals.capture && TL.referrals.capture();
        TL.club && TL.club.capture && TL.club.capture();
        TL.club && TL.club.checkBadge && setTimeout(() => TL.club.checkBadge(), 2500);
        TL.extras && TL.extras.bindKeys();
        TL.extras && TL.extras.maybeOnboard();
        if (TL.achievements) { TL.achievements.touchStreak(); TL.achievements.check(true); }
        if (TL.fx) TL.fx.checkRankUp({ silent:true }); // sync baseline, no celebration on boot
        this.notifyUpcomingMatch();
        // installable app: register the service worker only when properly hosted
        if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0 && !/claudeusercontent/.test(location.hostname)) {
          try { navigator.serviceWorker.register('sw.js'); } catch (e) {}
        }
      });
    },

    // fire a browser notification for a match within 2 days (once per day per match, only if granted)
    notifyUpcomingMatch() {
      try {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const today = new Date(); today.setHours(0,0,0,0);
        const up = TL.store.loadMatches().filter(m => !m.played && m.date && new Date(m.date+'T00:00') >= today)
          .sort((a,b) => a.date.localeCompare(b.date));
        if (!up.length) return;
        const m = up[0];
        const days = Math.round((new Date(m.date+'T00:00') - today) / 86400000);
        if (days > 2) return;
        const flag = 'tl_notif_' + m.id + '_' + new Date().toISOString().slice(0,10);
        if (localStorage.getItem(flag)) return;
        localStorage.setItem(flag, '1');
        const r = TL.store.loadRivals().find(x => x.id === m.rivalId);
        const who = r ? r.name : '';
        const dLabel = days === 0 ? (TL.i18n.lang==='en'?'today':'hoy') : days === 1 ? (TL.i18n.lang==='en'?'tomorrow':'mañana') : (days+' '+(TL.i18n.lang==='en'?'days':'días'));
        new Notification(t('notify_match') + (who?` · ${who}`:''), { body: `${dLabel} · ${t('notify_match_body')}`, icon: 'icon.svg', tag: 'courtlab-match' });
      } catch(e){}
    },

    hideLoader() {
      const loader = document.getElementById('loader');
      if (!loader) return;
      const start = window.__tlStart || performance.now();
      const minMs = 1500;  // let the bounce play at least one full cycle
      const finish = () => {
        const wait = Math.max(0, minMs - (performance.now() - start));
        setTimeout(() => { loader.classList.add('gone'); setTimeout(() => loader.remove(), 600); }, wait);
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(finish).catch(finish);
      else finish();
    },

    // ---- topbar ----
    renderTopbar() {
      const bar = document.getElementById('topbar');
      bar.innerHTML = `
        <div class="brand" id="brand">
          <div class="brand-mark">${ballMark()}</div>
          <div class="brand-name">CourtLab<small>${t('tagline')}</small></div>
        </div>
        <div class="spacer"></div>
        <div class="lang-toggle">
          <button data-l="es" class="${TL.i18n.lang==='es'?'on':''}">ES</button>
          <button data-l="en" class="${TL.i18n.lang==='en'?'on':''}">EN</button>
        </div>
        <button class="btn-icon top-gear" id="top-profile" title="${TL.i18n.lang==='en'?'Profile':'Perfil'}">${(function(){var a=localStorage.getItem('tl_my_avatar');return a?(a.indexOf('data:')===0?`<img src="${a}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`:`<span style="font-size:18px">${a}</span>`):ic.user;})()}</button>
        <button class="btn-icon top-gear" id="gear" title="${t('settings')}">${ic.sliders}</button>`;
      bar.querySelector('#brand').onclick = () => this.goHome();
      bar.querySelector('#gear').onclick = () => TL.settings.open();
      const pb = bar.querySelector('#top-profile'); if (pb) pb.onclick = () => this.openProfile();
      bar.querySelectorAll('.lang-toggle button').forEach(b => b.onclick = () => {
        TL.i18n.set(b.dataset.l);
        this.renderTopbar(); this.renderTabbar();
        if (TL.state.view === 'editor' && TL.state.tactic) TL.editor.render();
        else this.rerenderView();
      });
    },

    // ---- bottom tab bar ----
    refreshClubBadge() {
      const dot = document.getElementById('club-dot');
      if (!dot) return;
      const unseen = localStorage.getItem('tl_club_unseen') === '1' && TL.state.view !== 'club';
      dot.classList.toggle('on', unseen);
    },
    renderTabbar() {
      const bar = document.getElementById('tabbar');
      if (!bar) return;
      const tabs = [
        ['home', ic.grid, t('nav_home')],
        ['library', ic.ball, t('nav_tactics')],
        ['__create', ic.plus, t('cta_create')],
        ['rivals', ic.rival, t('nav_rivals')],
        ['club', ic.users || ic.user, t('club_title')],
      ];
      bar.innerHTML = tabs.map(tb => tb[0]==='__create'
        ? `<button class="tab tab-create" data-tab="__create" title="${tb[2]}">${tb[1]}</button>`
        : `<button class="tab" data-tab="${tb[0]}">${tb[0]==='club'?'<i class="tab-dot" id="club-dot"></i>':''}${tb[1]}<span>${tb[2]}</span></button>`
      ).join('');
      this.refreshClubBadge();
      bar.querySelectorAll('.tab').forEach(b => b.onclick = () => {
        const v = b.dataset.tab;
        if (TL.fx) TL.fx.tap();
        if (v === '__create') { this.openEditor(null); return; }
        if (v === 'home') this.goHome();
        else if (v === 'library') this.openLibrary();
        else if (v === 'rivals') this.openRivals();
        else if (v === 'club') this.openClub();
        else if (v === 'profile') this.openProfile();
      });
      this.updateTabbar();
    },

    updateTabbar() {
      const bar = document.getElementById('tabbar');
      if (!bar) return;
      const v = TL.state.view;
      const editing = (v === 'editor');
      document.body.classList.toggle('editing', editing);
      document.body.classList.toggle('in-club', v === 'club');
      bar.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === v));
      const pb = document.getElementById('top-profile');
      if (pb) pb.classList.toggle('on', v === 'profile');
      this.refreshClubBadge();
    },

    rerenderView() {
      const v = TL.state.view;
      if (v === 'library') this.openLibrary();
      else if (v === 'rivals') this.openRivals();
      else if (v === 'matches') this.openMatches();
      else if (v === 'profile') this.openProfile();
      else if (v === 'calendar') this.openCalendar();
      else if (v === 'diary') this.openDiary();
      else if (v === 'goals') this.openGoals();
      else if (v === 'league') this.openLeague();
      else if (v === 'club') this.openClub();
      else this.renderHome();
    },

    // ---- routing ----
    route() {
      const hash = location.hash || '';
      const m = hash.match(/view=([\w-]+)/);
      if (m) { this.openViewer(m[1]); return; }
      if (TL.state.view === 'editor' && TL.state.tactic) return; // stay in editor
      this.renderHome();
    },

    renderHome() {
      TL.state.view = 'home';
      TL.state.tactic = null;
      TL.home.render(this.root);
      this.updateTabbar();
      window.scrollTo(0, 0);
    },

    openLibrary() {
      if (location.hash) history.replaceState(null,'',location.pathname);
      TL.state.view = 'library'; TL.state.tactic = null;
      TL.home.renderLibrary(this.root);
      this.updateTabbar();
      window.scrollTo(0, 0);
    },

    openProfile() {
      if (location.hash) history.replaceState(null,'',location.pathname);
      TL.state.view = 'profile'; TL.state.tactic = null;
      TL.home.renderProfile(this.root);
      this.updateTabbar();
      window.scrollTo(0, 0);
    },

    openEditor(id) {
      const existing = id ? TL.store.get(id) : null;
      let tac = existing || (id === 'demo' ? TL.store.demoTactic() : null);
      const saved = !!existing;
      // free plan: cap number of saved tactics when creating a NEW one
      if (!id && TL.premium && !TL.premium.canCreateTactic()) { TL.app.toast(t('tactic_limit_hit')); TL.premium.upgrade('limit'); return; }
      if (!tac) { TL.extras && TL.extras.templates ? TL.extras.templates() : TL.editor.open(TL.store.newTactic(), { guided: true }); return; }
      // open saved tactics in the normal (guided) mode too — the "Modo avanzado" link is there if needed
      TL.editor.open(tac, { saved, guided: true });
      this.updateTabbar();
    },

    openViewer(id) {
      let tac = TL.store.get(id) || (id === 'demo' ? TL.store.demoTactic() : null);
      if (!tac) { this.renderHome(); return; }
      TL.editor.open(tac, { viewer: true });
      this.updateTabbar();
    },

    openRivals() {
      if (location.hash) history.replaceState(null,'',location.pathname);
      TL.state.view = 'rivals'; TL.state.tactic = null;
      TL.rivals.render(this.root);
      this.updateTabbar();
    },

    openMatches() {
      if (location.hash) history.replaceState(null,'',location.pathname);
      TL.state.view = 'matches'; TL.state.tactic = null;
      TL.matches.render(this.root);
      this.updateTabbar();
    },

    openCalendar() {
      if (location.hash) history.replaceState(null,'',location.pathname);
      TL.state.view = 'calendar'; TL.state.tactic = null;
      TL.planner.renderCalendar(this.root);
      this.updateTabbar();
    },
    openDiary() {
      if (location.hash) history.replaceState(null,'',location.pathname);
      TL.state.view = 'diary'; TL.state.tactic = null;
      TL.planner.renderDiary(this.root);
      this.updateTabbar();
    },
    openGoals() {
      if (location.hash) history.replaceState(null,'',location.pathname);
      TL.state.view = 'goals'; TL.state.tactic = null;
      TL.planner.renderGoals(this.root);
      this.updateTabbar();
    },

    openLeague() {
      if (location.hash) history.replaceState(null,'',location.pathname);
      TL.state.view = 'league'; TL.state.tactic = null;
      if (TL.league) TL.league.render(this.root);
      this.updateTabbar();
    },

    openClub() {
      if (location.hash) history.replaceState(null,'',location.pathname);
      TL.state.view = 'club'; TL.state.tactic = null;
      if (TL.club) TL.club.renderPage(this.root);
      this.updateTabbar();
      window.scrollTo(0, 0);
    },

    goHome() {
      if (location.hash) { history.replaceState(null,'',location.pathname); }
      this.renderHome();
    },

    // ---- toast ----
    toast(msg, ok) {
      let h = document.getElementById('toast-host');
      if (!h) { h = document.createElement('div'); h.id='toast-host'; h.className='toast-host'; document.body.appendChild(h); }
      const el = document.createElement('div');
      el.className = 'toast';
      el.innerHTML = (ok ? ic.check : '') + `<span>${msg}</span>`;
      h.appendChild(el);
      setTimeout(() => { el.style.opacity='0'; el.style.transform='translateY(8px)'; el.style.transition='.3s'; }, 1700);
      setTimeout(() => el.remove(), 2100);
    },
  };

  function ballMark() {
    return `<svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">
      <rect x="9" y="5" width="12" height="20" rx="1.6" fill="none" stroke="#E8703D" stroke-width="1.7"/>
      <line x1="9" y1="15" x2="21" y2="15" stroke="#E8703D" stroke-width="1.7"/>
      <line x1="15" y1="5" x2="15" y2="25" stroke="#E8703D" stroke-width="1.2" opacity=".6"/>
    </svg>`;
  }

  TL.app = app;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => app.init());
  else app.init();
})(window.TL = window.TL || {});
