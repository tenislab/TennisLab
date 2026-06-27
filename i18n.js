/* ============================================================
   gif.js — codificador GIF89a animado, autónomo y offline.
   Sin dependencias ni workers. Paleta global (cubo 6×7×6 = 252
   colores + brand), LZW estándar. Pensado para clips cortos
   (jugadas de pista, colores planos) → buena calidad y tamaño OK.
   API:  TL.gif.encode({ frames:[ImageData...], delay, width, height }) -> Blob
   ============================================================ */
(function (TL) {
  'use strict';

  // --- paleta global: cubo 6 niveles R, 7 G, 6 B (252) + 4 marca ---
  const RL = 6, GL = 7, BL = 6;
  const PAL = [];
  for (let r = 0; r < RL; r++) for (let g = 0; g < GL; g++) for (let b = 0; b < BL; b++) {
    PAL.push([Math.round(r * 255 / (RL - 1)), Math.round(g * 255 / (GL - 1)), Math.round(b * 255 / (BL - 1))]);
  }
  // colores de marca para bordes nítidos
  PAL.push([232, 112, 61]);   // terracota (jugador/bola)
  PAL.push([203, 242, 74]);   // lima
  PAL.push([18, 19, 16]);     // tinta
  PAL.push([255, 255, 255]);  // blanco líneas
  while (PAL.length < 256) PAL.push([0, 0, 0]);

  function nearest(r, g, b) {
    // candidato rápido por cubo
    const ri = Math.round(r / 255 * (RL - 1));
    const gi = Math.round(g / 255 * (GL - 1));
    const bi = Math.round(b / 255 * (BL - 1));
    let idx = ri * (GL * BL) + gi * BL + bi;
    // refinamos contra los 4 de marca por si están más cerca
    let best = idx, bd = dist(PAL[idx], r, g, b);
    for (let k = 252; k < 256; k++) { const d = dist(PAL[k], r, g, b); if (d < bd) { bd = d; best = k; } }
    return best;
  }
  function dist(p, r, g, b) { const dr = p[0] - r, dg = p[1] - g, db = p[2] - b; return dr * dr + dg * dg + db * db; }

  // --- LZW (GIF) ---
  function lzwEncode(minCode, indices) {
    const out = [];
    let cur = 0, curBits = 0;
    const clear = 1 << minCode;
    const eoi = clear + 1;
    let dict, dictSize, codeSize;
    function reset() { dict = new Map(); for (let i = 0; i < clear; i++) dict.set(String(i), i); dictSize = eoi + 1; codeSize = minCode + 1; }
    function emit(code) { cur |= code << curBits; curBits += codeSize; while (curBits >= 8) { out.push(cur & 0xff); cur >>= 8; curBits -= 8; } }
    reset(); emit(clear);
    let prefix = String(indices[0]);
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const comb = prefix + ',' + k;
      if (dict.has(comb)) { prefix = comb; }
      else {
        emit(dict.get(prefix));
        dict.set(comb, dictSize++);
        if (dictSize > (1 << codeSize) && codeSize < 12) codeSize++;
        if (dictSize >= 4096) { emit(clear); reset(); }
        prefix = String(k);
      }
    }
    emit(dict.get(prefix));
    emit(eoi);
    if (curBits > 0) out.push(cur & 0xff);
    return out;
  }

  function bytes(arr) { return arr; }
  function pushStr(a, s) { for (let i = 0; i < s.length; i++) a.push(s.charCodeAt(i)); }
  function push16(a, n) { a.push(n & 0xff, (n >> 8) & 0xff); }

  function encode(opts) {
    const frames = opts.frames || [];
    const w = opts.width, h = opts.height;
    const delay = Math.max(2, Math.round((opts.delay || 60) / 10)); // centésimas de segundo
    const b = [];
    pushStr(b, 'GIF89a');
    push16(b, w); push16(b, h);
    b.push(0xF7);  // GCT presente, 256 colores
    b.push(0);     // índice de fondo
    b.push(0);     // ratio de aspecto
    for (let i = 0; i < 256; i++) b.push(PAL[i][0], PAL[i][1], PAL[i][2]);
    // bucle infinito (NETSCAPE)
    b.push(0x21, 0xFF, 0x0B); pushStr(b, 'NETSCAPE2.0'); b.push(0x03, 0x01); push16(b, 0); b.push(0);

    for (const frame of frames) {
      const data = frame.data;
      const n = w * h;
      const idx = new Uint8Array(n);
      for (let p = 0, q = 0; p < n; p++, q += 4) idx[p] = nearest(data[q], data[q + 1], data[q + 2]);
      // control gráfico (delay)
      b.push(0x21, 0xF9, 0x04, 0x00); push16(b, delay); b.push(0x00, 0x00);
      // descriptor de imagen
      b.push(0x2C); push16(b, 0); push16(b, 0); push16(b, w); push16(b, h); b.push(0x00);
      const minCode = 8;
      b.push(minCode);
      const lzw = lzwEncode(minCode, idx);
      // sub-bloques de máx 255
      for (let i = 0; i < lzw.length; i += 255) {
        const chunk = lzw.slice(i, i + 255);
        b.push(chunk.length);
        for (let j = 0; j < chunk.length; j++) b.push(chunk[j]);
      }
      b.push(0x00);
    }
    b.push(0x3B);
    return new Blob([new Uint8Array(b)], { type: 'image/gif' });
  }

  TL.gif = { encode };
})(window.TL = window.TL || {});
