/* ============================================================
   CourtLab — Villa narrativa en 3D (Three.js r160)
   Recorrido por scroll:  Pista → Salón (rivales) → Tele → Balcón (club)
   Expone window.__court3d = { progress, act, setProgress(p) }
   ============================================================ */
(function () {
  var cvs = document.getElementById('gl');
  if (!cvs || !window.THREE) { document.documentElement.classList.add('no-gl'); return; }

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  } catch (e) { document.documentElement.classList.add('no-gl'); return; }

  document.documentElement.classList.add('gl-on');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc7e6);
  scene.fog = new THREE.Fog(0xbcd9ef, 60, 165);

  var camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 600);
  camera.position.set(0, 16, 30);

  // ---------- helpers ----------
  function mat(color, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
      color: color, roughness: opts.r == null ? 0.85 : opts.r, metalness: opts.m == null ? 0.0 : opts.m,
      transparent: !!opts.t, opacity: opts.o == null ? 1 : opts.o,
      emissive: opts.e == null ? 0x000000 : opts.e, emissiveIntensity: opts.ei == null ? 1 : opts.ei,
      side: opts.side || THREE.FrontSide
    });
  }
  function box(w, h, d, color, opts) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
    m.castShadow = true; m.receiveShadow = true; return m;
  }
  function cyl(rt, rb, h, color, seg, opts) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 18), mat(color, opts));
    m.castShadow = true; m.receiveShadow = true; return m;
  }
  function sph(r, color, opts) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), mat(color, opts));
    m.castShadow = true; return m;
  }
  function grp(x, y, z) { var g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); return g; }

  // ---------- lights ----------
  var hemi = new THREE.HemisphereLight(0xeaf3ff, 0xbcb09a, 0.8);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xfff2dc, 2.4);
  sun.position.set(-34, 46, 26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 180;
  var sc = 70; sun.shadow.camera.left = -sc; sun.shadow.camera.right = sc; sun.shadow.camera.top = sc; sun.shadow.camera.bottom = -sc;
  sun.shadow.bias = -0.0003;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.16));

  // ---------- ground ----------
  var ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), mat(0xa9a98a, { r: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true;
  scene.add(ground);

  // gran terraza pavimentada bajo la villa, la pista y la piscina (rompe el verde)
  var terrace = new THREE.Mesh(new THREE.PlaneGeometry(80, 66), mat(0xddd7c8, { r: 0.92 }));
  terrace.rotation.x = -Math.PI / 2; terrace.position.set(0, -0.02, -18); terrace.receiveShadow = true; scene.add(terrace);
  // pavimento del complejo de pistas (club) sobre el cesped
  var clubPave = new THREE.Mesh(new THREE.PlaneGeometry(56, 48), mat(0xcfc8b8, { r: 0.95 }));
  clubPave.rotation.x = -Math.PI / 2; clubPave.position.set(0, -0.03, 28); clubPave.receiveShadow = true; scene.add(clubPave);

  // far hills backdrop (suaves y bajas)
  (function () {
    for (var i = 0; i < 5; i++) {
      var h = new THREE.Mesh(new THREE.SphereGeometry(40 + i * 8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        mat([0x9db488, 0xa7bc92, 0x93ad7e][i % 3], { r: 1 }));
      h.position.set(-120 + i * 60, -10, -155 - (i % 2) * 20);
      h.scale.set(1.8, 0.3, 1.2); scene.add(h);
    }
  })();

  // ---------- court texture ----------
  function courtTexture(base, line) {
    var c = document.createElement('canvas'); c.width = 256; c.height = 512;
    var x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 256, 512);
    x.strokeStyle = line; x.lineWidth = 5;
    x.strokeRect(16, 16, 224, 480);                 // singles/outer
    x.beginPath(); x.moveTo(16, 256); x.lineTo(240, 256); x.stroke(); // net line
    x.strokeRect(48, 120, 160, 272);                // service box outer-ish
    x.beginPath(); x.moveTo(128, 120); x.lineTo(128, 392); x.stroke(); // centre
    x.beginPath(); x.moveTo(48, 120); x.lineTo(208, 120); x.stroke();
    x.beginPath(); x.moveTo(48, 392); x.lineTo(208, 392); x.stroke();
    var t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  var clayTex = courtTexture('#c2603a', '#f4e9df');
  var hardTex = courtTexture('#2f7fb5', '#eaf2f7');
  var grassTex = courtTexture('#3f8f54', '#f2f7ef');

  function makeCourt(tex, w, d, padel) {
    var g = grp();
    var surf = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    surf.rotation.x = -Math.PI / 2; surf.position.y = 0.01; surf.receiveShadow = true; g.add(surf);
    // surround
    var sur = new THREE.Mesh(new THREE.PlaneGeometry(w + 4, d + 4), mat(padel ? 0x2f6f9a : 0x9a9586, { r: 1 }));
    sur.rotation.x = -Math.PI / 2; sur.position.y = 0.0; sur.receiveShadow = true; g.add(sur);
    // net
    var net = box(w + 0.4, 1.0, 0.06, 0xf4f4f0, { r: 0.6, t: true, o: 0.85 });
    net.position.set(0, 0.5, 0); g.add(net);
    var p1 = cyl(0.06, 0.06, 1.1, 0x2a2a2a, 8); p1.position.set((w + 0.4) / 2, 0.55, 0); g.add(p1);
    var p2 = p1.clone(); p2.position.x = -(w + 0.4) / 2; g.add(p2);
    if (padel) {
      var glassMat = mat(0x9ecbe6, { t: true, o: 0.18, r: 0.1, m: 0.1, side: THREE.DoubleSide });
      var back1 = new THREE.Mesh(new THREE.PlaneGeometry(w, 3), glassMat); back1.position.set(0, 1.5, d / 2); g.add(back1);
      var back2 = back1.clone(); back2.position.z = -d / 2; g.add(back2);
      var sideL = new THREE.Mesh(new THREE.PlaneGeometry(d, 3), glassMat); sideL.rotation.y = Math.PI / 2; sideL.position.set(w / 2, 1.5, 0); g.add(sideL);
      var sideR = sideL.clone(); sideR.position.x = -w / 2; g.add(sideR);
    }
    return g;
  }

  // ---------- player figure (stylised) ----------
  function player(color) {
    var g = grp();
    var legs = box(0.5, 0.9, 0.3, 0x2c3340, { r: 0.8 }); legs.position.y = 0.45; g.add(legs);
    var torso = cyl(0.26, 0.32, 0.85, color, 10); torso.position.y = 1.28; g.add(torso);
    var head = sph(0.22, 0xe8c4a0); head.position.y = 1.95; g.add(head);
    var arm = cyl(0.07, 0.07, 0.7, color, 8); arm.position.set(0.32, 1.45, 0); arm.rotation.z = -0.5; g.add(arm);
    var racket = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 8, 16), mat(0xf25d2a)); racket.position.set(0.62, 1.7, 0); g.add(racket);
    return g;
  }
  // --- cabeza con cara (ojos, cejas, nariz, boca, peinado), mira a +Z ---
  function faceHead(skin, hairColor, style) {
    var g = grp(); var rH = 0.3;
    var head = sph(rH, skin, { r: 0.85 }); g.add(head);
    var earL = sph(0.07, skin); earL.position.set(rH - 0.02, 0, 0); g.add(earL);
    var earR = earL.clone(); earR.position.x = -(rH - 0.02); g.add(earR);
    function eye(x) {
      var e = grp(x, 0.05, rH - 0.05);
      var w = sph(0.072, 0xffffff); w.scale.set(1, 1, 0.55); e.add(w);
      var iris = sph(0.036, 0x3b2a1c); iris.position.z = 0.05; e.add(iris);
      var hi = sph(0.013, 0xffffff); hi.position.set(0.02, 0.02, 0.075); e.add(hi);
      return e;
    }
    g.add(eye(0.115)); g.add(eye(-0.115));
    var browMat = mat(hairColor, { r: 1 });
    var bL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.028, 0.05), browMat); bL.position.set(0.115, 0.17, rH - 0.03); bL.rotation.z = -0.12; g.add(bL);
    var bR = bL.clone(); bR.position.x = -0.115; bR.rotation.z = 0.12; g.add(bR);
    var nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.17, 8), mat(skin, { r: 0.85 })); nose.position.set(0, -0.02, rH); nose.rotation.x = Math.PI / 2; g.add(nose);
    var mouth = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.02, 8, 16, Math.PI), mat(0x9a4a40)); mouth.position.set(0, -0.14, rH - 0.06); mouth.rotation.x = Math.PI; g.add(mouth);
    if (style === 'band') {
      var cap = new THREE.Mesh(new THREE.SphereGeometry(rH + 0.02, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2.1), mat(hairColor)); cap.position.y = 0.03; g.add(cap);
      var band = new THREE.Mesh(new THREE.TorusGeometry(rH + 0.012, 0.045, 8, 24), mat(0xeae6df)); band.position.y = 0.17; band.rotation.x = Math.PI / 2; g.add(band);
    } else if (style === 'short') {
      var cap2 = new THREE.Mesh(new THREE.SphereGeometry(rH + 0.025, 18, 14, 0, Math.PI * 2, 0, Math.PI / 1.75), mat(hairColor)); cap2.position.y = 0.02; g.add(cap2);
    } else {
      var cap3 = new THREE.Mesh(new THREE.SphereGeometry(rH + 0.055, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.55), mat(hairColor)); cap3.position.y = 0.05; g.add(cap3);
    }
    return g;
  }
  function seatedPerson(o) {
    var g = grp();
    var hips = box(0.55, 0.4, 0.55, 0x2c3340, { r: 0.8 }); hips.position.y = 0.95; g.add(hips);
    var thigh = box(0.5, 0.34, 0.7, 0x2c3340, { r: 0.8 }); thigh.position.set(0, 0.78, 0.4); g.add(thigh);
    var torso = cyl(0.3, 0.36, 0.85, o.shirt, 14); torso.position.y = 1.52; g.add(torso);
    var neck = cyl(0.1, 0.11, 0.18, o.skin, 10); neck.position.y = 1.99; g.add(neck);
    var head = faceHead(o.skin, o.hair, o.style); head.position.y = 2.22; g.add(head);
    var armL = cyl(0.085, 0.085, 0.62, o.shirt, 8); armL.position.set(0.34, 1.5, 0.26); armL.rotation.set(0.95, 0, -0.18); g.add(armL);
    var armR = armL.clone(); armR.position.x = -0.34; armR.rotation.z = 0.18; g.add(armR);
    var handL = sph(0.1, o.skin); handL.position.set(0.36, 1.18, 0.62); g.add(handL);
    var handR = handL.clone(); handR.position.x = -0.36; g.add(handR);
    return g;
  }

  // =====================================================
  //  WORLD
  // =====================================================
  // main court (tennis) at origin
  var mainCourt = makeCourt(clayTex, 11, 24, false);
  scene.add(mainCourt);

  // bouncing ball on main court
  var ball = sph(0.22, 0xe8ff3a, { e: 0x5a6a00, ei: 0.5 }); ball.position.set(0, 0.5, 4); scene.add(ball);

  // two players on main court
  var mp1 = player(0x2f7fb5); mp1.position.set(1.5, 0, 9); mp1.rotation.y = Math.PI; scene.add(mp1);
  var mp2 = player(0xe0573d); mp2.position.set(-1.2, 0, -9); scene.add(mp2);

  // ---------- HOUSE (z negative, faces +Z toward court) ----------
  var house = grp(0, 0, -30);
  scene.add(house);
  // ground-floor salón slab
  var woodC = document.createElement('canvas'); woodC.width = 256; woodC.height = 256;
  (function () { var x = woodC.getContext('2d'); for (var w = 0; w < 8; w++) { x.fillStyle = w % 2 ? '#a8814f' : '#b89058'; x.fillRect(0, w * 32, 256, 32); x.strokeStyle = 'rgba(70,45,22,.35)'; x.lineWidth = 2; x.strokeRect(1, w * 32 + 1, 254, 30); } })();
  var woodTex = new THREE.CanvasTexture(woodC); woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(3, 2.6); woodTex.colorSpace = THREE.SRGBColorSpace;
  var floor = new THREE.Mesh(new THREE.BoxGeometry(24, 0.3, 20), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.62 }));
  floor.position.set(0, 0, 0); floor.receiveShadow = true; house.add(floor);
  // rug
  var rug = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), mat(0x8a4a3a, { r: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.18, -2); house.add(rug);
  // back wall (with TV) z=-9.7 (i.e. world z ≈ -39.7)
  var backWall = box(24, 9, 0.4, 0xf1ede3, { r: 0.95 }); backWall.position.set(0, 4.5, -9.8); house.add(backWall);
  // side walls
  var wallL = box(0.4, 9, 20, 0xece6da, { r: 0.95 }); wallL.position.set(-11.8, 4.5, 0); house.add(wallL);
  var wallR = wallL.clone(); wallR.position.x = 11.8; house.add(wallR);
  // ceiling / upper slab (also balcony floor) at y≈5.4 covering inner part, leaving front open
  var slab = box(24, 0.4, 13, 0xddd3c2, { r: 0.85 }); slab.position.set(0, 5.4, -3.2); house.add(slab);
  // front concrete frame columns (full height, support roof)
  var colL = box(0.7, 9.6, 0.7, 0xe7e3da); colL.position.set(-11.4, 4.8, 9.4); house.add(colL);
  var colR = colL.clone(); colR.position.x = 11.4; house.add(colR);
  // warm interior fill light
  var warm = new THREE.PointLight(0xffd9a8, 0.5, 40); warm.position.set(0, 4.6, -3); house.add(warm);

  // ---- segundo piso + tejado plano voladizo (masa de villa) ----
  var upBack = box(24, 4.2, 0.4, 0xf1ede3, { r: 0.9 }); upBack.position.set(0, 7.5, -9.8); house.add(upBack);
  var upWallL = box(0.4, 4.2, 14, 0xece6da, { r: 0.9 }); upWallL.position.set(-11.8, 7.5, -3); house.add(upWallL);
  var upWallR = upWallL.clone(); upWallR.position.x = 11.8; house.add(upWallR);
  // fachada de cristal del piso superior
  var upGlass = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.8), mat(0xbfe0f5, { t: true, o: 0.4, r: 0.1, m: 0.2, side: THREE.DoubleSide }));
  upGlass.position.set(0, 7.5, 3.9); house.add(upGlass);
  for (var mz = 0; mz < 6; mz++) { var mull = box(0.16, 4, 0.16, 0x2a2018); mull.position.set(-10 + mz * 4, 7.5, 3.95); house.add(mull); }
  // tejado plano con voladizo + peto
  var roof = box(27, 0.5, 24, 0xeeebe3, { r: 0.82 }); roof.position.set(0, 9.7, -1.5); house.add(roof);
  var roofPar = box(27, 0.6, 0.3, 0xded9ce); roofPar.position.set(0, 10.05, 10.4); house.add(roofPar);
  // banda de forjado entre plantas (lee como edificio de 2 alturas)
  var fascia = box(24.6, 0.55, 0.5, 0xf6f3ec, { r: 0.9 }); fascia.position.set(0, 5.45, 9.55); house.add(fascia);
  // panel de madera (revestimiento cálido) en la fachada
  var woodClad = box(0.3, 5.0, 6, 0xb07d4a, { r: 0.7 }); woodClad.position.set(11.45, 2.7, 4); house.add(woodClad);

  // ---- TV on back wall ----
  var tvCanvas = document.createElement('canvas'); tvCanvas.width = 320; tvCanvas.height = 200;
  var tvx = tvCanvas.getContext('2d');
  var tvTex = new THREE.CanvasTexture(tvCanvas); tvTex.colorSpace = THREE.SRGBColorSpace;
  var tvFrame = box(7.4, 4.4, 0.2, 0x14171b, { r: 0.5 }); tvFrame.position.set(0, 4.4, -9.55); house.add(tvFrame);
  var tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(6.9, 3.9), new THREE.MeshBasicMaterial({ map: tvTex }));
  tvScreen.position.set(0, 4.4, -9.43); house.add(tvScreen);
  function drawTV(t) {
    tvx.fillStyle = '#0c5a2f'; tvx.fillRect(0, 0, 320, 200);
    tvx.strokeStyle = 'rgba(255,255,255,.85)'; tvx.lineWidth = 3;
    tvx.strokeRect(24, 18, 272, 164);
    tvx.beginPath(); tvx.moveTo(160, 18); tvx.lineTo(160, 182); tvx.stroke();
    // players
    tvx.fillStyle = '#2f7fb5'; var py = 100 + Math.sin(t * 2) * 40;
    tvx.fillRect(60, py - 12, 10, 24);
    tvx.fillStyle = '#e0573d'; var py2 = 100 + Math.sin(t * 2 + 1.6) * 40;
    tvx.fillRect(250, py2 - 12, 10, 24);
    // ball
    var bx = 160 + Math.sin(t * 3) * 110, by = 100 + Math.cos(t * 2.2) * 55;
    tvx.fillStyle = '#e8ff3a'; tvx.beginPath(); tvx.arc(bx, by, 5, 0, 7); tvx.fill();
    // scorebug
    tvx.fillStyle = 'rgba(0,0,0,.55)'; tvx.fillRect(16, 8, 130, 22);
    tvx.fillStyle = '#fff'; tvx.font = 'bold 14px sans-serif'; tvx.fillText('TÚ 6-4 · 3-2', 24, 24);
    tvTex.needsUpdate = true;
  }

  // ---- salón furniture ----
  // round table
  var tableTop = cyl(1.7, 1.7, 0.18, 0x6b4a32, 28); tableTop.position.set(0, 1.5, -3.2); house.add(tableTop);
  var tableLeg = cyl(0.18, 0.26, 1.4, 0x4f3826, 12);
  tableLeg.position.set(0, 0.75, -3.2); house.add(tableLeg);
  // three rivals seated across (far side, facing +Z toward camera)
  var people = [
    { shirt: 0x3f7f9c, skin: 0xe8c4a0, hair: 0x2b2018, style: 'short', ang: 0.2, z: -5.4 },
    { shirt: 0xe0573d, skin: 0xd9a878, hair: 0x1c1712, style: 'band',  ang: 0.0,  z: -4.9 }, // Leo Vidal (rival)
    { shirt: 0x6a7f3a, skin: 0xf0d2b4, hair: 0x5a3a22, style: 'bushy', ang: -0.2, z: -5.4 }
  ];
  for (var i = 0; i < 3; i++) {
    var pp = people[i], px = -3.2 + i * 3.2;
    var s = seatedPerson(pp);
    s.position.set(px, 0, pp.z); s.rotation.y = pp.ang;
    house.add(s);
    var chair = box(1.0, 0.2, 1.0, 0x3a2c20); chair.position.set(px, 1.0, pp.z); house.add(chair);
    var chairBack = box(1.0, 1.4, 0.16, 0x3a2c20); chairBack.position.set(px, 1.7, pp.z - 0.55); house.add(chairBack);
  }
  // "you" — back of head in foreground (near side)
  var you = grp(-1.9, 0, -2.0); house.add(you);
  var youHead = sph(0.33, 0x2a1f17); youHead.position.set(0, 1.55, 0.1); you.add(youHead);
  var youShoulder = cyl(0.54, 0.64, 0.7, 0x20303f, 14); youShoulder.position.set(0, 1.0, 0.3); you.add(youShoulder);

  // sofa to the side
  var sofa = box(4.2, 0.9, 1.4, 0x4a5560, { r: 0.9 }); sofa.position.set(-7.5, 0.7, -1); house.add(sofa);
  var sofaBack = box(4.2, 1.1, 0.4, 0x4a5560, { r: 0.9 }); sofaBack.position.set(-7.5, 1.2, -1.6); house.add(sofaBack);
  // plant
  var pot = cyl(0.35, 0.28, 0.6, 0x9a6b4a, 12); pot.position.set(8.6, 0.5, -7); house.add(pot);
  for (var p = 0; p < 5; p++) { var leaf = sph(0.5, 0x3f7a3a); leaf.position.set(8.6 + (Math.random() - .5), 1.1 + p * 0.18, -7 + (Math.random() - .5)); leaf.scale.set(1, 1.4, 1); house.add(leaf); }

  // ---- detalle interior ----
  // lámparas colgantes sobre la mesa
  for (var L = -1; L <= 1; L += 2) {
    var cord = box(0.025, 1.3, 0.025, 0x1a1a1a); cord.position.set(L * 0.95, 4.45, -3.2); house.add(cord);
    var bulb = sph(0.2, 0xffe6b0, { e: 0xffcf8a, ei: 1.3 }); bulb.position.set(L * 0.95, 3.75, -3.2); house.add(bulb);
  }
  var dineLight = new THREE.PointLight(0xffd9a0, 0.55, 20); dineLight.position.set(0, 3.6, -3.2); house.add(dineLight);
  // cuadros a los lados de la tele
  var artCol = [0xc96a3a, 0x3f6f8c];
  for (var A = 0; A < 2; A++) {
    var afr = box(2.3, 1.6, 0.12, 0x241a12); afr.position.set(A ? 7.6 : -7.6, 4.8, -9.55); house.add(afr);
    var aim = box(2.0, 1.3, 0.06, artCol[A], { r: 0.9 }); aim.position.set(A ? 7.6 : -7.6, 4.8, -9.46); house.add(aim);
  }
  // estantería con libros (pared derecha)
  var shelf = box(0.5, 0.16, 4.4, 0x6b4a32); shelf.position.set(11.4, 3.0, 2); house.add(shelf);
  var bookCol = [0xb8451d, 0x3f7f9c, 0x6a7f3a, 0xe0a93d, 0xeae3d6];
  for (var bk = 0; bk < 9; bk++) { var bo = box(0.34, 0.5 + Math.random() * 0.32, 0.18, bookCol[bk % 5]); bo.position.set(11.3, 3.38, 0.2 + bk * 0.44); house.add(bo); }
  // mesa de centro + sofá con cojines + lámpara de pie
  var coffee = box(2.4, 0.14, 1.1, 0x4f3826); coffee.position.set(-7.5, 0.78, 1.4); house.add(coffee);
  var cush1 = box(0.72, 0.5, 0.72, 0xdcae6a, { r: 0.9 }); cush1.position.set(-8.5, 1.25, -1); house.add(cush1);
  var cush2 = box(0.72, 0.5, 0.72, 0xb8451d, { r: 0.9 }); cush2.position.set(-6.5, 1.25, -1); house.add(cush2);
  var lampPole = cyl(0.045, 0.045, 2.4, 0x222222, 8); lampPole.position.set(-10.7, 1.2, -3); house.add(lampPole);
  var lampShade = cyl(0.34, 0.22, 0.42, 0xffe6b0, 14, { e: 0xffcf8a, ei: 0.7 }); lampShade.position.set(-10.7, 2.55, -3); house.add(lampShade);
  // ventanal lateral (cristal con luz de día)
  var winMat = mat(0xbfe0f5, { e: 0xbfe0f5, ei: 0.45, t: true, o: 0.5, side: THREE.DoubleSide });
  var winL = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.4), winMat); winL.rotation.y = Math.PI / 2; winL.position.set(-11.74, 4.4, -5); house.add(winL);
  var winFrame = box(0.1, 3.6, 7.2, 0x2a2018); winFrame.position.set(-11.7, 4.4, -5); house.add(winFrame);
  var winBar = box(0.12, 0.1, 7, 0x2a2018); winBar.position.set(-11.7, 4.4, -5); house.add(winBar);

  // ---- balcony (upper) ----
  var balcony = grp(0, 5.6, -22);
  scene.add(balcony);
  var balFloor = box(20, 0.3, 6, 0xcabda3, { r: 0.8 }); balFloor.position.set(0, 0, 3); balcony.add(balFloor);
  var rail = box(20, 1.1, 0.12, 0x9fcfe6, { t: true, o: 0.22, r: 0.1, side: THREE.DoubleSide }); rail.position.set(0, 0.7, 6); balcony.add(rail);
  var railTop = box(20, 0.1, 0.2, 0x2a2a2a); railTop.position.set(0, 1.25, 6); balcony.add(railTop);

  // ---- the club: extra courts with players (visible from balcony, +Z field) ----
  var clubCourts = [];
  function clubCourt(x, z, tex, padel, n) {
    var c = makeCourt(tex, padel ? 8 : 9, padel ? 16 : 18, padel);
    c.position.set(x, 0, z); c.scale.set(0.92, 1, 0.92); scene.add(c);
    var players = [];
    for (var k = 0; k < n; k++) {
      var pl = player(k % 2 ? 0xe0573d : 0x2f7fb5);
      pl.position.set(x + (k % 2 ? 1.5 : -1.5), 0, z + (k % 2 ? 5 : -5));
      if (k % 2) pl.rotation.y = Math.PI;
      pl.userData.base = pl.position.x; pl.userData.ph = Math.random() * 6;
      scene.add(pl); players.push(pl);
    }
    clubCourts.push({ g: c, players: players });
  }
  clubCourt(-12, 16, hardTex, false, 3);
  clubCourt(12, 16, clayTex, false, 3);
  clubCourt(-12, 36, grassTex, true, 4);
  clubCourt(12, 36, clayTex, true, 4);
  // caminos pavimentados (cruz entre las 4 pistas)
  var walkMat = mat(0xbab2a0, { r: 0.95 });
  var walkV = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 44), walkMat); walkV.rotation.x = -Math.PI / 2; walkV.position.set(0, 0.005, 26); scene.add(walkV);
  var walkH = new THREE.Mesh(new THREE.PlaneGeometry(38, 3.2), walkMat); walkH.rotation.x = -Math.PI / 2; walkH.position.set(0, 0.005, 26); scene.add(walkH);
  // club-house detrás de las pistas
  var clubhouse = box(10, 4.6, 7, 0xf0ece2, { r: 0.9 }); clubhouse.position.set(21, 2.3, 31); scene.add(clubhouse);
  var chRoof = box(11.4, 0.5, 8, 0xd0cabb); chRoof.position.set(21, 4.75, 31); scene.add(chRoof);
  var chWood = box(0.2, 4.2, 7, 0xb07d4a, { r: 0.7 }); chWood.position.set(15.9, 2.2, 31); scene.add(chWood);
  var chGlass = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), mat(0xbfe0f5, { t: true, o: 0.4, r: 0.1, side: THREE.DoubleSide })); chGlass.position.set(21, 2.5, 27.45); scene.add(chGlass);
  // valla perimetral (postes) alrededor del complejo
  for (var fx = -26; fx <= 26; fx += 4) { var fp = cyl(0.06, 0.06, 2.2, 0x6b6f74, 6); fp.position.set(fx, 1.1, 6); scene.add(fp); var fp2 = fp.clone(); fp2.position.z = 48; scene.add(fp2); }
  // bancos
  for (var bn = 0; bn < 2; bn++) { var bench = box(2.2, 0.18, 0.5, 0x8a6b46); bench.position.set(0, 0.5, 14 + bn * 24); scene.add(bench); var bbk = box(2.2, 0.5, 0.16, 0x8a6b46); bbk.position.set(0, 0.75, 14 + bn * 24 - 0.2); scene.add(bbk); }

  // trees / cypress
  function tree(x, z, big) {
    var g = grp(x, 0, z);
    var trunk = cyl(0.18, 0.26, big ? 2.4 : 1.6, 0x6b4a30, 8); trunk.position.y = (big ? 1.2 : 0.8); g.add(trunk);
    if (big) { var c1 = sph(1.8, 0x3f7a3a); c1.position.y = 3.4; c1.scale.set(1, 1.1, 1); g.add(c1); }
    else { var cy = cyl(0.05, 1.1, 3.2, 0x356b35, 10); cy.position.y = 2.4; g.add(cy); }
    scene.add(g);
  }
  tree(-26, -6, true); tree(26, -4, true); tree(-30, 18, false); tree(30, 20, false); tree(22, -18, false); tree(-22, -16, false);

  // ---- piscina + zona chill (visible desde el balcón) ----
  var poolRim = box(9, 0.3, 5.2, 0xe6dfce, { r: 0.8 }); poolRim.position.set(10, 0.06, -13); scene.add(poolRim);
  var water = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 4), mat(0x2f9fd0, { r: 0.12, m: 0.3, e: 0x1f7faa, ei: 0.3, t: true, o: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.position.set(10, 0.2, -13); scene.add(water);
  for (var lg = 0; lg < 2; lg++) {
    var lo = box(0.9, 0.22, 2, 0xf2eee4); lo.position.set(14.5, 0.32, -14.4 + lg * 2.4); scene.add(lo);
    var lb = box(0.9, 0.8, 0.16, 0xf2eee4); lb.position.set(14.5, 0.6, -15.4 + lg * 2.4); lb.rotation.x = -0.5; scene.add(lb);
  }
  var parPole = cyl(0.06, 0.06, 2.8, 0x9a8a7a, 8); parPole.position.set(16, 1.4, -13); scene.add(parPole);
  var parTop = cyl(1.7, 0.05, 0.7, 0xe0573d, 14); parTop.position.set(16, 2.9, -13); scene.add(parTop);
  for (var bs = 0; bs < 6; bs++) { var bush = sph(0.7 + Math.random() * 0.3, 0x3a6f38, { r: 1 }); bush.position.set(-22 + bs * 3.4, 0.45, -2 - (bs % 2) * 1.4); bush.scale.y = 0.8; scene.add(bush); }

  // =====================================================
  //  CAMERA PATH
  // =====================================================
  var KF = [
    { p: new THREE.Vector3(0, 13, 22), l: new THREE.Vector3(0, 4, -18) },     // 0 establishing: villa + pista
    { p: new THREE.Vector3(0, 8, 9), l: new THREE.Vector3(0, 4.6, -24) },     // 1 glide over court to house
    { p: new THREE.Vector3(0, 2.25, -29.2), l: new THREE.Vector3(0, 2.05, -35) },// 2 salón close on faces
    { p: new THREE.Vector3(0, 3.2, -31.5), l: new THREE.Vector3(0, 4.3, -40) },// 3 push to TV
    { p: new THREE.Vector3(2, 8, -14), l: new THREE.Vector3(6, 0.5, 24) },// 4 balcony: arrive over club
    { p: new THREE.Vector3(-3, 6.8, -11), l: new THREE.Vector3(-6, 0.3, 30) } // 5 dwell: slow pan across the whole club
  ];
  var SEG = KF.length - 1;

  // curva continua que atraviesa todas las paradas sin frenar (vuelo fluido)
  var posCurve = new THREE.CatmullRomCurve3(KF.map(function (k) { return k.p.clone(); }), false, 'centripetal', 0.5);
  var lookCurve = new THREE.CatmullRomCurve3(KF.map(function (k) { return k.l.clone(); }), false, 'centripetal', 0.5);

  var curP = KF[0].p.clone(), curL = KF[0].l.clone();
  var tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();

  function applyProgress(prog, mx, my) {
    var p = Math.max(0, Math.min(1, prog));
    posCurve.getPoint(p, tmpP);
    lookCurve.getPoint(p, tmpL);
    // en móvil retrato: aleja la cámara del punto de mira para encajar más escena
    if (portraitPull !== 1) { tmpP.sub(tmpL).multiplyScalar(portraitPull).add(tmpL); }
    // mouse parallax (subtle, less on later acts)
    var amt = (1 - p * 0.6);
    tmpP.x += (mx || 0) * 1.4 * amt;
    tmpP.y += (my || 0) * 0.8 * amt;
    curP.lerp(tmpP, 0.12); curL.lerp(tmpL, 0.12);
    camera.position.copy(curP);
    camera.lookAt(curL);
  }

  // =====================================================
  //  SCROLL + LOOP
  // =====================================================
  var track = document.getElementById('tourTrack');
  var progress = 0, targetProg = 0, act = 0;
  function readScroll() {
    if (!track) return;
    var r = track.getBoundingClientRect();
    var total = track.offsetHeight - window.innerHeight;
    var passed = -r.top;
    targetProg = total > 0 ? Math.max(0, Math.min(1, passed / total)) : 0;
    // fade canvas out after the balcony so warm sections below show
    var fade = 1;
    if (targetProg > 0.965) fade = Math.max(0, 1 - (targetProg - 0.965) / 0.035);
    cvs.style.opacity = fade.toFixed(3);
  }
  window.addEventListener('scroll', readScroll, { passive: true });

  var mx = 0, my = 0, tmx = 0, tmy = 0;
  window.addEventListener('pointermove', function (e) {
    tmx = (e.clientX / window.innerWidth - 0.5) * 2;
    tmy = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  var BASE_FOV = 52, portraitPull = 1;
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    var a = w / h; camera.aspect = a;
    // FOV adaptativo: desktop/tablet sin cambios; en móvil/retrato ensancha (tope anti ojo de pez)
    var vfov;
    if (a >= 1.3) { vfov = BASE_FOV; }
    else { vfov = 2 * Math.atan(Math.tan(BASE_FOV * Math.PI / 360) * 1.3 / a) * 180 / Math.PI; }
    camera.fov = Math.min(78, vfov);
    // en pantallas altas retrocede un poco la cámara para no recortar los lados
    portraitPull = a < 1 ? Math.min(1.24, 1 + (1 - a) * 0.42) : 1;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize);
  resize(); readScroll();

  var clock = new THREE.Clock();
  function loop() {
    var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    progress += (targetProg - progress) * 0.08;
    mx += (tmx - mx) * 0.06; my += (tmy - my) * 0.06;
    applyProgress(progress, mx, my);
    act = Math.min(3, Math.round(progress * SEG));

    // ball bounce on main court
    ball.position.z = 4 + Math.sin(t * 0.8) * 7;
    ball.position.x = Math.sin(t * 0.8) * 2.4;
    ball.position.y = 0.5 + Math.abs(Math.sin(t * 3.0)) * 2.2;

    // sway main players
    mp1.position.x = 1.5 + Math.sin(t * 1.1) * 1.2;
    mp2.position.x = -1.2 + Math.sin(t * 1.1 + 1.7) * 1.2;

    // club players oscillate
    for (var c = 0; c < clubCourts.length; c++) {
      var pls = clubCourts[c].players;
      for (var k = 0; k < pls.length; k++) {
        var pl = pls[k];
        pl.position.x = pl.userData.base + Math.sin(t * 1.4 + pl.userData.ph) * 1.3;
      }
    }

    drawTV(t);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();

  window.__court3d = {
    get progress() { return progress; },
    get act() { return act; },
    setProgress: function (p) { targetProg = p; progress = p; applyProgress(p, 0, 0); }
  };
})();
