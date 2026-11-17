// Juge une image : MobileCLIP-S0 sur deux vues (recadrage central + image écrasée), puis la tête MLP de ml/train.py.
// Même chaîne que ml/score.py : bord court à 256, recadrage central 256, /255, sans normalisation.
(function () {
  "use strict";
  var S = 256, session = null, head = null, ready = null;
  var cache = new Map(), MAX = 4000;   // url -> score
  var queue = [], busy = false;        // les dernières demandées passent d'abord : ce sont celles à l'écran

  function load() {
    if (ready) return ready;
    ort.env.wasm.wasmPaths = chrome.runtime.getURL("vendor/ort/");
    // Plusieurs threads seulement si la page est isolée (COOP/COEP du manifest), sinon un seul.
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) >> 1)) : 1;
    ready = Promise.all([
      ort.InferenceSession.create(chrome.runtime.getURL("model/vision.onnx"), { executionProviders: ["wasm"], graphOptimizationLevel: "all" }),
      fetch(chrome.runtime.getURL("model/head.json")).then(function (r) { return r.json(); }),
      fetch(chrome.runtime.getURL("model/head.bin")).then(function (r) { return r.arrayBuffer(); })
    ]).then(function (r) {
      session = r[0];
      var m = r[1], w = new Float32Array(r[2]), D = m.dim, H = m.hidden;
      head = { D: D, H: H, t: m.threshold, W1: w.subarray(0, D * H), b1: w.subarray(D * H, D * H + H), w2: w.subarray(D * H + H, D * H + 2 * H), b2: w[D * H + 2 * H] };
    });
    return ready;
  }

  // Redimensionnement identique au BILINEAR de PIL (filtre triangle élargi quand on réduit, passe horizontale
  // puis verticale, arrondi 8 bits entre les deux). Le canvas filtre autrement et décalait les scores jusqu'à 0,1.
  function coeffs(inSize, outSize) {
    var scale = inSize / outSize, ss = Math.max(scale, 1), support = ss, list = [];
    for (var x = 0; x < outSize; x++) {
      var center = (x + 0.5) * scale, xmin = Math.max(Math.floor(center - support + 0.5), 0), xmax = Math.min(Math.floor(center + support + 0.5), inSize);
      var w = [], sum = 0;
      for (var i = xmin; i < xmax; i++) { var v = Math.max(0, 1 - Math.abs((i - center + 0.5) / ss)); w.push(v); sum += v; }
      for (i = 0; i < w.length; i++) w[i] /= sum || 1;
      list.push({ min: xmin, w: w });
    }
    return list;
  }
  function resize(px, w, h, dw, dh) { // px : RGBA, rend du RGB 8 bits
    var cx = coeffs(w, dw), cy = coeffs(h, dh), tmp = new Uint8ClampedArray(dw * h * 3), out = new Uint8ClampedArray(dw * dh * 3);
    for (var y = 0; y < h; y++) for (var x = 0; x < dw; x++) {
      var c = cx[x], r = 0, g = 0, b = 0;
      for (var k = 0; k < c.w.length; k++) { var p = (y * w + c.min + k) * 4, q = c.w[k]; r += px[p] * q; g += px[p + 1] * q; b += px[p + 2] * q; }
      var o = (y * dw + x) * 3; tmp[o] = Math.round(r); tmp[o + 1] = Math.round(g); tmp[o + 2] = Math.round(b);
    }
    for (y = 0; y < dh; y++) { var cyy = cy[y]; for (x = 0; x < dw; x++) {
      r = 0; g = 0; b = 0;
      for (k = 0; k < cyy.w.length; k++) { p = ((cyy.min + k) * dw + x) * 3; q = cyy.w[k]; r += tmp[p] * q; g += tmp[p + 1] * q; b += tmp[p + 2] * q; }
      o = (y * dw + x) * 3; out[o] = Math.round(r); out[o + 1] = Math.round(g); out[o + 2] = Math.round(b);
    } }
    return out;
  }
  function toCHW(rgb, rw, ox, oy, out, off) { // découpe S x S à (ox, oy), /255, canaux séparés
    var n = S * S;
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var p = ((y + oy) * rw + x + ox) * 3, i = y * S + x;
      out[off + i] = rgb[p] / 255; out[off + n + i] = rgb[p + 1] / 255; out[off + 2 * n + i] = rgb[p + 2] / 255;
    }
  }
  function roundEven(v) { var f = Math.floor(v), d = v - f; return d > 0.5 || (d === 0.5 && f % 2) ? f + 1 : f; } // round() de Python
  function pixels(bmp) {
    var c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(bmp, 0, 0); return g.getImageData(0, 0, bmp.width, bmp.height).data;
  }

  function judge(url) {
    var ac = new AbortController(), timer = null;
    return load().then(function () {
      timer = setTimeout(function () { ac.abort(); }, 8000); // un CDN bloqué (en-têtes ou corps) ne gèle pas la file
      return fetch(url, { credentials: "omit", signal: ac.signal });
    })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.blob(); })
      .finally(function () { clearTimeout(timer); })
      .then(createImageBitmap)
      .then(function (bmp) {
        var w = bmp.width, h = bmp.height, px = pixels(bmp), x = new Float32Array(2 * 3 * S * S);
        bmp.close();
        // Recadrage central : bord court à 256 puis découpe au centre, comme ml/embed.py.
        var s = S / Math.min(w, h), rw = Math.max(S, roundEven(w * s)), rh = Math.max(S, roundEven(h * s));
        toCHW(resize(px, w, h, rw, rh), rw, (rw - S) >> 1, (rh - S) >> 1, x, 0);
        toCHW(resize(px, w, h, S, S), S, 0, 0, x, 3 * S * S); // image entière écrasée
        var feeds = {}; feeds[session.inputNames[0]] = new ort.Tensor("float32", x, [2, 3, S, S]);
        return session.run(feeds);
      })
      .then(function (out) {
        var e = out[session.outputNames[0]].data, D = head.D, H = head.H, half = D / 2;
        var v = new Float32Array(D);
        for (var k = 0; k < 2; k++) { var s = 0, o = k * half; for (var i = 0; i < half; i++) s += e[o + i] * e[o + i]; s = Math.sqrt(s) || 1; for (i = 0; i < half; i++) v[o + i] = e[o + i] / s; }
        var z = head.b2;
        for (var j = 0; j < H; j++) {
          var a = head.b1[j];
          for (var d = 0; d < D; d++) a += v[d] * head.W1[d * H + j];
          if (a > 0) z += a * head.w2[j];
        }
        return 1 / (1 + Math.exp(-z));
      });
  }

  function pump() {
    if (busy || !queue.length) return;
    busy = true;
    var job = queue.pop();
    var done = function (score) {
      if (score !== null) { cache.set(job.url, score); if (cache.size > MAX) cache.delete(cache.keys().next().value); }
      job.cbs.forEach(function (cb) { cb(score); });
      busy = false; pump();
    };
    judge(job.url).then(done, function () { done(null); });
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
    if (!msg || msg.target !== "asv-offscreen") return;
    var cb = function (score) { reply({ score: score, threshold: head ? head.t : null }); };
    if (cache.has(msg.url)) { load().then(function () { cb(cache.get(msg.url)); }); return true; }
    var same = queue.filter(function (j) { return j.url === msg.url; })[0];
    if (same) same.cbs.push(cb); else queue.push({ url: msg.url, cbs: [cb] });
    pump();
    return true;
  });
})();
