/* ============================================================
   social.js — perfil público + seguir + ranking de amigos
   Requiere TL.cloud (Supabase) y sesión iniciada.
   Tablas: profiles, follows (ver supabase/social_schema.sql)
   ============================================================ */
(function (TL) {
  const t = (k) => TL.i18n.t(k);
  const ic = TL.icon;
  const AVATARS = ['🎾','🥎','🏆','🔥','⚡','🦁','🐍','🦅','🎯','💪','🌟','🚀'];

  function host(){ let h=document.getElementById('modal-host'); if(!h){h=document.createElement('div');h.id='modal-host';document.body.appendChild(h);} return h; }
  function close(){ host().innerHTML=''; }
  function esc(s){return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  function avatarHtml(av, cls){
    av = av || '🎾';
    // cross-user data: only allow a data:image URL as an <img> (escaped); anything
    // else is treated as plain text (emoji) and escaped — blocks stored-XSS via avatar field.
    if (/^data:image\//.test(av)) return `<img class="${esc(cls||'')}" src="${esc(av)}" alt=""/>`;
    return `<span class="${esc(cls||'')}">${esc(av)}</span>`;
  }
  function client(){ return TL.cloud && TL.cloud.client; }
  function ready(){ return TL.cloud && TL.cloud.enabled && TL.cloud.loggedIn(); }

  // push my rank/xp/sport to my profile row (call on login / when rank changes)
  async function syncProfile() {
    if (!ready()) return;
    const r = TL.store.rank();
    const sport = (TL.extras && TL.extras.sportPref && TL.extras.sportPref()) || 'tennis';
    try {
      await client().from('profiles').update({ xp: r.xp, rank_lvl: r.level, sport, updated_at: new Date().toISOString() })
        .eq('user_id', TL.cloud.user.id);
    } catch (e) {}
  }

  async function myProfile() {
    if (!ready()) return null;
    try {
      const { data } = await client().from('profiles').select('*').eq('user_id', TL.cloud.user.id).maybeSingle();
      return data || null;
    } catch (e) { return null; }
  }

  // ---- gate: must be logged in ----
  function requireLogin() {
    if (ready()) return true;
    TL.app.toast(TL.i18n.lang==='en'?'Sign in to use profiles':'Inicia sesión para el perfil');
    if (TL.cloud && TL.cloud.authModal) TL.cloud.authModal();
    return false;
  }

  // ---- profile modal (view + edit own) ----
  async function profileModal() {
    if (!requireLogin()) return;
    const en = TL.i18n.lang === 'en';
    let p = await myProfile();
    const r = TL.store.rank();
    const isNew = !p;
    p = p || { username:'', avatar:'🎾', sport:(TL.extras.sportPref&&TL.extras.sportPref())||'tennis' };
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal">
      <div class="modal-head"><h2>${en?'Profile':'Perfil'}</h2><button class="x" id="mx">${ic.x}</button></div>
      <div class="modal-body">
        <div class="prof-head">
          <div class="prof-av" id="prof-av">${avatarHtml(p.avatar)}</div>
          <div class="prof-meta">
            <b>${t(r.key)}</b><span>${r.xp} ${t('rank_xp')} · ${en?'Lvl':'Nv'} ${r.level}</span>
          </div>
        </div>
        <div class="avatar-grid" id="av-grid">${AVATARS.map(a=>`<button class="av-opt ${a===(p.avatar||'🎾')?'on':''}" data-a="${a}">${a}</button>`).join('')}</div>
        <button class="photo-link" id="pf-photo-btn" type="button">${en?'📷 Use a photo':'📷 Usar una foto'}</button>
        <input type="file" id="pf-photo-file" accept="image/*" class="hide"/>
        <div class="field"><label>${en?'Username':'Nombre de usuario'}</label>
          <div class="user-in"><span>@</span><input id="pf-user" value="${esc((p.username||'').replace(/^@/,''))}" placeholder="${en?'yourname':'tunombre'}" maxlength="20" autocomplete="off"/></div>
        </div>
        <div class="au-msg" id="pf-msg"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="pf-friends">${ic.user}${en?'Friends':'Amigos'}</button>
        <button class="btn btn-primary" id="pf-save">${ic.check}${en?'Save':'Guardar'}</button>
      </div>
    </div></div>`;
    const h = host();
    let avatar = p.avatar || '🎾';
    h.querySelector('#mx').onclick = close;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') close(); };
    h.querySelectorAll('#av-grid .av-opt').forEach(b => b.onclick = () => { avatar=b.dataset.a; h.querySelector('#prof-av').innerHTML=avatarHtml(avatar); h.querySelectorAll('.av-opt').forEach(x=>x.classList.toggle('on',x===b)); });
    const photoBtn = h.querySelector('#pf-photo-btn'), photoFile = h.querySelector('#pf-photo-file');
    if (photoBtn) photoBtn.onclick = () => photoFile.click();
    if (photoFile) photoFile.onchange = () => {
      const f = photoFile.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { const img = new Image(); img.onload = () => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 96;
        const cx2 = cv.getContext('2d'); const s = Math.min(img.width, img.height);
        cx2.drawImage(img, (img.width-s)/2, (img.height-s)/2, s, s, 0, 0, 96, 96);
        avatar = cv.toDataURL('image/jpeg', 0.7);
        h.querySelector('#prof-av').innerHTML = avatarHtml(avatar);
        h.querySelectorAll('.av-opt').forEach(x=>x.classList.remove('on'));
      }; img.src = rd.result; };
      rd.readAsDataURL(f);
    };
    h.querySelector('#pf-friends').onclick = () => friendsModal();
    h.querySelector('#pf-save').onclick = async () => {
      const raw = h.querySelector('#pf-user').value.trim().replace(/^@/,'').toLowerCase().replace(/[^a-z0-9_]/g,'');
      const msg = h.querySelector('#pf-msg');
      if (raw.length < 3) { msg.textContent = en?'Min 3 chars (a-z, 0-9, _)':'Mínimo 3 caracteres (a-z, 0-9, _)'; return; }
      const btn = h.querySelector('#pf-save'); btn.disabled = true;
      try {
        const row = { user_id: TL.cloud.user.id, username: raw, avatar, sport:(TL.extras.sportPref&&TL.extras.sportPref())||'tennis', xp:r.xp, rank_lvl:r.level, updated_at:new Date().toISOString() };
        const { error } = await client().from('profiles').upsert(row, { onConflict:'user_id' });
        if (error) { msg.textContent = /duplicate|unique/i.test(error.message) ? (en?'That username is taken':'Ese usuario ya existe') : error.message; btn.disabled=false; return; }
        TL.app.toast(en?'Profile saved':'Perfil guardado', true);
        localStorage.setItem('tl_my_avatar', avatar);
        if (TL.app.renderTopbar) TL.app.renderTopbar();
        close();
      } catch (e) { msg.textContent = String(e); btn.disabled=false; }
    };
    setTimeout(()=>h.querySelector('#pf-user').focus(), 50);
  }

  // ---- find + follow + friends ranking ----
  async function friendsModal() {
    if (!requireLogin()) return;
    const en = TL.i18n.lang === 'en';
    host().innerHTML = `
    <div class="modal-scrim" id="ms"><div class="modal modal-lg">
      <div class="modal-head"><h2>${en?'Friends':'Amigos'}</h2><button class="x" id="mx">${ic.x}</button></div>
      <div class="modal-body">
        <div class="user-in find-in"><span>@</span><input id="fr-q" placeholder="${en?'search username…':'buscar usuario…'}" autocomplete="off"/></div>
        <div id="fr-results"></div>
        <div class="kicker" style="margin:18px 0 8px">${en?'Friends ranking':'Ranking de amigos'}</div>
        <div id="fr-rank"><p class="hint-muted">${en?'Loading…':'Cargando…'}</p></div>
      </div>
    </div></div>`;
    const h = host();
    h.querySelector('#mx').onclick = close;
    h.querySelector('#ms').onclick = e => { if (e.target.id==='ms') close(); };
    const q = h.querySelector('#fr-q');
    let tmr;
    q.oninput = () => { clearTimeout(tmr); tmr = setTimeout(()=>search(q.value.trim()), 280); };
    renderRanking();

    async function search(term) {
      const box = h.querySelector('#fr-results');
      if (!term) { box.innerHTML=''; return; }
      try {
        const { data } = await client().from('profiles').select('user_id,username,avatar,sport,xp,rank_lvl')
          .ilike('username', term.replace(/^@/,'')+'%').neq('user_id', TL.cloud.user.id).limit(8);
        const mine = await myFollows();
        box.innerHTML = (data&&data.length) ? data.map(u=>rowHtml(u, mine.includes(u.user_id))).join('') : `<p class="hint-muted">${en?'No users found':'Sin resultados'}</p>`;
        wireRows(box);
      } catch (e) { box.innerHTML = `<p class="hint-muted">${String(e)}</p>`; }
    }
    async function myFollows() {
      try { const { data } = await client().from('follows').select('followed_id').eq('follower_id', TL.cloud.user.id); return (data||[]).map(x=>x.followed_id); }
      catch(e){ return []; }
    }

    function rowHtml(u, following) {
      return `<div class="fr-row" data-uid="${u.user_id}">
        <span class="fr-av">${avatarHtml(u.avatar)}</span>
        <div class="fr-tx"><b>@${esc(u.username)}</b><span>${u.sport==='padel'?'🥎':u.sport==='pickle'?'🏓':'🎾'} ${u.xp||0} ${t('rank_xp')}</span></div>
        <button class="btn ${following?'btn-ghost':'btn-primary'} btn-sm fr-follow" data-following="${following?'1':'0'}">${following?(en?'Following':'Siguiendo'):(en?'Follow':'Seguir')}</button>
      </div>`;
    }
    function wireRows(box) {
      box.querySelectorAll('.fr-row').forEach(row => {
        const btn = row.querySelector('.fr-follow');
        btn.onclick = async () => {
          const uid = row.dataset.uid, following = btn.dataset.following==='1';
          btn.disabled = true;
          try {
            if (following) { await client().from('follows').delete().eq('follower_id',TL.cloud.user.id).eq('followed_id',uid); btn.dataset.following='0'; btn.className='btn btn-primary btn-sm fr-follow'; btn.textContent=en?'Follow':'Seguir'; }
            else { await client().from('follows').insert({ follower_id:TL.cloud.user.id, followed_id:uid }); btn.dataset.following='1'; btn.className='btn btn-ghost btn-sm fr-follow'; btn.textContent=en?'Following':'Siguiendo'; }
          } catch(e){}
          btn.disabled = false; renderRanking();
        };
      });
    }

    async function renderRanking() {
      const box = h.querySelector('#fr-rank');
      try {
        const ids = await myFollows();
        const me = await myProfile();
        const list = [];
        if (me) list.push({ ...me, me:true });
        if (ids.length) {
          const { data } = await client().from('profiles').select('user_id,username,avatar,sport,xp,rank_lvl').in('user_id', ids);
          (data||[]).forEach(u=>list.push(u));
        }
        if (!list.length || (list.length===1 && list[0].me && !me.username)) { box.innerHTML = `<p class="hint-muted">${en?'Follow friends to see the ranking':'Sigue a amigos para ver el ranking'}</p>`; return; }
        list.sort((a,b)=>(b.xp||0)-(a.xp||0));
        box.innerHTML = list.map((u,i)=>`<div class="rk-row ${u.me?'me':''}">
          <span class="rk-pos">${i+1}</span><span class="fr-av">${avatarHtml(u.avatar)}</span>
          <div class="fr-tx"><b>@${esc(u.username||'tú')}${u.me?` · ${en?'you':'tú'}`:''}</b><span>${u.sport==='padel'?'🥎':u.sport==='pickle'?'🏓':'🎾'}</span></div>
          <span class="rk-xp">${u.xp||0}</span>
        </div>`).join('');
      } catch(e){ box.innerHTML = `<p class="hint-muted">${String(e)}</p>`; }
    }
  }

  TL.social = { profileModal, friendsModal, syncProfile, myProfile };
})(window.TL = window.TL || {});
