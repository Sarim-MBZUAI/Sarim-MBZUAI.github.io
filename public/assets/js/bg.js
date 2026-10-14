/* Subtle animated backdrop: a proximity graph with slow "walkers" that trace
   paths across it (evokes graph traversal / pointer chasing). Very low opacity,
   theme-aware clay palette (light/dark), respects prefers-reduced-motion, and
   pauses when the tab is hidden.

   The graph is laid out over the FULL document height and the drawing is
   offset by the scroll position each frame, so the backdrop scrolls with the
   page (at 40% speed) while the canvas itself stays viewport-sized. */
(function () {
  'use strict';
  if (!document.body && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  function boot() {
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduce = mq ? mq.matches : false;

    var canvas = document.createElement('canvas');
    canvas.className = 'cs-bg';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
    document.body.insertBefore(canvas, document.body.firstChild);

    var ctx = canvas.getContext('2d');
    var W = 0, VH = 0, DOC = 0, DPR = 1;
    var nodes = [], edges = [], walkers = [], pulses = [];
    var raf = null, lastT = 0;

    /* Theme-aware colours (Sarim's clay palette). EDGE = lines/nodes,
       GLOW = walker glow (slightly deeper/brighter for contrast). */
    /* ALPHA scales every stroke/fill opacity. Dark backgrounds crush faint
       strokes on real displays, so dark mode draws noticeably stronger. */
    var PALETTE = {
      light: { edge: '201, 168, 128', glow: '222, 190, 142', alpha: 1 },   /* soft sand / pale gold */
      dark:  { edge: '214, 190, 158', glow: '236, 214, 180', alpha: 1.6 } /* lighter, less saturated */
    };
    var EDGE = PALETTE.light.edge, GLOW = PALETTE.light.glow, ALPHA = 1;
    function applyColors() {
      var t = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      EDGE = PALETTE[t].edge; GLOW = PALETTE[t].glow; ALPHA = PALETTE[t].alpha;
      if (reduce) drawStatic();   /* static frame won't repaint on its own */
    }
    applyColors();

    var PARALLAX = 0.4;         /* backdrop scrolls at 40% of page speed */

    function docHeight() {
      var b = document.body, e = document.documentElement;
      return Math.max(b ? b.scrollHeight : 0, e ? e.scrollHeight : 0,
                      b ? b.offsetHeight : 0, e ? e.offsetHeight : 0, window.innerHeight);
    }
    function scrollY() {
      return window.pageYOffset || document.documentElement.scrollTop || 0;
    }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; VH = window.innerHeight; DOC = docHeight();
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(VH * DPR);
      build();
      if (reduce) drawStatic();
    }

    function build() {
      nodes = []; edges = []; walkers = []; pulses = [];
      var LH = PARALLAX * Math.max(0, DOC - VH) + VH;   /* span the graph must cover under parallax */
      var count = Math.max(14, Math.min(130, Math.round((W * LH) / 44000)));
      var cols = Math.max(3, Math.round(Math.sqrt(count * W / LH)));
      var rows = Math.max(3, Math.ceil(count / cols));
      var cw = W / cols, ch = LH / rows;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols && nodes.length < count; c++) {
          nodes.push({
            bx: (c + 0.5) * cw + (Math.random() - 0.5) * cw * 0.7,
            by: (r + 0.5) * ch + (Math.random() - 0.5) * ch * 0.7,
            ph: Math.random() * Math.PI * 2,
            heat: 0, adj: [], x: 0, y: 0
          });
        }
      }
      var maxD = Math.min(cw, ch) * 2.2;
      for (var i = 0; i < nodes.length; i++) {
        var near = [];
        for (var j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          var dx = nodes[i].bx - nodes[j].bx, dy = nodes[i].by - nodes[j].by;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < maxD) near.push({ j: j, d: d });
        }
        near.sort(function (a, b) { return a.d - b.d; });
        for (var m = 0; m < Math.min(3, near.length); m++) addEdge(i, near[m].j);
      }
      edges.forEach(function (e, idx) {
        nodes[e.a].adj.push({ node: e.b, edge: idx });
        nodes[e.b].adj.push({ node: e.a, edge: idx });
        var dx = nodes[e.a].bx - nodes[e.b].bx, dy = nodes[e.a].by - nodes[e.b].by;
        e.len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      });
      var wc = Math.max(2, Math.min(7, Math.round(nodes.length / 13)));
      for (var w = 0; w < wc; w++) spawnWalker();
    }

    function addEdge(a, b) {
      for (var e = 0; e < edges.length; e++) {
        if ((edges[e].a === a && edges[e].b === b) || (edges[e].a === b && edges[e].b === a)) return;
      }
      edges.push({ a: a, b: b, heat: 0 });
    }

    /* start: node index to begin at (random if omitted). life: number of
       hops before the walker expires (permanent if omitted). */
    function spawnWalker(start, life) {
      if (!nodes.length) return;
      var s = start === undefined ? Math.floor(Math.random() * nodes.length) : start;
      if (!nodes[s].adj.length) return;
      var step = nodes[s].adj[Math.floor(Math.random() * nodes[s].adj.length)];
      var spd = life === undefined ? 0.09 + Math.random() * 0.08 : 0.16 + Math.random() * 0.08;
      walkers.push({ from: s, to: step.node, edge: step.edge, t: 0, speed: spd, life: life });
    }

    /* Geometric shortest-path distance from one node to every other node,
       used so a click pulse travels along the graph rather than as a disc. */
    function graphDistances(seeds) {   /* seeds: [{ node, d }] */
      var n = nodes.length, dist = new Array(n), done = new Array(n), i;
      for (i = 0; i < n; i++) { dist[i] = Infinity; done[i] = false; }
      for (i = 0; i < seeds.length; i++) dist[seeds[i].node] = Math.min(dist[seeds[i].node], seeds[i].d);
      for (var it = 0; it < n; it++) {
        var u = -1, best = Infinity;
        for (i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
        if (u < 0) break;
        done[u] = true;
        var adj = nodes[u].adj;
        for (var k = 0; k < adj.length; k++) {
          var v = adj[k].node, L = edges[adj[k].edge].len;
          if (dist[u] + L < dist[v]) dist[v] = dist[u] + L;
        }
      }
      return dist;
    }

    /* Click/tap: a signal spreads outward from the nearest node along the
       edges, lighting each one as the wavefront passes, plus a couple of
       short-lived walkers set off from the same spot. */
    function pulseAt(cx, cy) {
      if (!nodes.length) return;
      var gx = cx, gy = cy + scrollY() * PARALLAX, near = [];
      for (var i = 0; i < nodes.length; i++) {
        var dx = nodes[i].bx - gx, dy = nodes[i].by - gy;
        near.push({ node: i, d: Math.sqrt(dx * dx + dy * dy) });
      }
      near.sort(function (a, b) { return a.d - b.d; });
      /* "spokes": rays from the click point itself to the 3 nearest nodes.
         The graph wave then continues from those nodes, offset by spoke length,
         so the whole thing visibly starts under the cursor. */
      var spokes = [];
      for (var k = 0; k < near.length && spokes.length < 3; k++) {
        if (k > 0 && near[k].d > 320) break;
        spokes.push({ node: near[k].node, len: Math.max(1, near[k].d) });
      }
      pulses.push({ x: gx, y: gy, spokes: spokes, dist: graphDistances(spokes.map(function (sp) { return { node: sp.node, d: sp.len }; })), r: 0, age: 0,
                    speed: 520, maxR: Math.max(420, Math.min(W, VH) * 0.75) });
      if (pulses.length > 4) pulses.shift();
      spawnWalker(spokes[0].node, 24); spawnWalker(spokes[0].node, 24);
    }

    function step(w, dt) {
      w.t += w.speed * dt;
      var e = edges[w.edge]; if (e) e.heat = Math.min(1, e.heat + dt * 1.1);
      if (w.t >= 1) {
        w.t = 0;
        var nd = nodes[w.to];
        nd.heat = Math.min(1, nd.heat + 0.9);
        if (w.life !== undefined && --w.life <= 0) { walkers.splice(walkers.indexOf(w), 1); return; }
        var opts = nd.adj.filter(function (a) { return a.node !== w.from; });
        var pool = opts.length ? opts : nd.adj;
        var nx = pool[Math.floor(Math.random() * pool.length)];
        if (!nx) { walkers.splice(walkers.indexOf(w), 1); if (w.life === undefined) spawnWalker(); return; }
        w.from = w.to; w.to = nx.node; w.edge = nx.edge;
      }
    }

    function frame(ts) {
      var dt = Math.min(0.05, (ts - lastT) / 1000 || 0); lastT = ts;
      var s = ts / 1000;
      var off = scrollY() * PARALLAX;
      var top = off - 60, bot = off + VH + 60;

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, VH);
      ctx.setTransform(DPR, 0, 0, DPR, 0, -off * DPR);

      for (var n = 0; n < nodes.length; n++) {
        var nd = nodes[n];
        nd.x = nd.bx + Math.sin(s * 0.2 + nd.ph) * 3;
        nd.y = nd.by + Math.cos(s * 0.17 + nd.ph) * 3;
      }
      for (var i = 0; i < edges.length; i++) {
        var e = edges[i], a = nodes[e.a], b = nodes[e.b];
        if ((a.by < top && b.by < top) || (a.by > bot && b.by > bot)) {
          if (e.heat > 0.01) e.heat = Math.max(0, e.heat - dt * 0.35);
          continue;
        }
        ctx.strokeStyle = 'rgba(' + EDGE + ',' + (0.05 * ALPHA) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (e.heat > 0.01) {
          ctx.strokeStyle = 'rgba(' + GLOW + ',' + (e.heat * 0.20 * ALPHA) + ')'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          e.heat = Math.max(0, e.heat - dt * 0.35);
        }
      }
      for (var m = 0; m < nodes.length; m++) {
        var p = nodes[m];
        if (p.by >= top && p.by <= bot) {
          ctx.fillStyle = 'rgba(' + EDGE + ',' + ((0.10 + p.heat * 0.45) * ALPHA) + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 + p.heat * 1.5, 0, Math.PI * 2); ctx.fill();
        }
        if (p.heat > 0.01) p.heat = Math.max(0, p.heat - dt * 0.5);
      }
      for (var q = pulses.length - 1; q >= 0; q--) {
        var pu = pulses[q];
        pu.age += dt; pu.r += pu.speed * dt;
        var k = 1 - pu.r / pu.maxR;              /* fades as it spreads */
        if (k <= 0) { pulses.splice(q, 1); continue; }
        var band = pu.speed * dt * 2;
        /* soft bloom at the click point for the first half second */
        var bl = Math.max(0, 1 - pu.age / 0.5);
        if (bl > 0 && pu.y >= top && pu.y <= bot) {
          var br = 16 + 28 * (1 - bl);
          var bg = ctx.createRadialGradient(pu.x, pu.y, 0, pu.x, pu.y, br);
          bg.addColorStop(0, 'rgba(' + GLOW + ',' + Math.min(1, 0.22 * bl * ALPHA) + ')');
          bg.addColorStop(1, 'rgba(' + GLOW + ',0)');
          ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(pu.x, pu.y, br, 0, Math.PI * 2); ctx.fill();
        }
        for (var si = 0; si < pu.spokes.length; si++) {
          var sp = pu.spokes[si], tn = nodes[sp.node];
          if ((pu.y < top && tn.by < top) || (pu.y > bot && tn.by > bot)) continue;
          var sf = Math.min(1, pu.r / sp.len);
          var sx = pu.x + (tn.x - pu.x) * sf, sy = pu.y + (tn.y - pu.y) * sf;
          ctx.strokeStyle = 'rgba(' + GLOW + ',' + Math.min(1, (sf < 1 ? 0.42 : 0.26) * k * ALPHA) + ')';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(pu.x, pu.y); ctx.lineTo(sx, sy); ctx.stroke();
          if (sf < 1) {
            var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 5);
            sg.addColorStop(0, 'rgba(' + GLOW + ',' + Math.min(1, 0.48 * k * ALPHA) + ')');
            sg.addColorStop(1, 'rgba(' + GLOW + ',0)');
            ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
          }
        }
        for (var ei = 0; ei < edges.length; ei++) {
          var ed = edges[ei], da = pu.dist[ed.a], db = pu.dist[ed.b];
          if (da === Infinity && db === Infinity) continue;
          var fromN = da <= db ? nodes[ed.a] : nodes[ed.b], toN = da <= db ? nodes[ed.b] : nodes[ed.a];
          var d0 = Math.min(da, db);
          if (pu.r < d0) continue;
          var f = (pu.r - d0) / ed.len;
          if (f >= 1) { if (f < 1.5) ed.heat = Math.max(ed.heat, 0.85 * k); continue; }
          if ((fromN.by < top && toN.by < top) || (fromN.by > bot && toN.by > bot)) continue;
          var hx = fromN.x + (toN.x - fromN.x) * f, hy = fromN.y + (toN.y - fromN.y) * f;
          ctx.strokeStyle = 'rgba(' + GLOW + ',' + Math.min(1, 0.42 * k * ALPHA) + ')'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(fromN.x, fromN.y); ctx.lineTo(hx, hy); ctx.stroke();
          var hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 5);
          hg.addColorStop(0, 'rgba(' + GLOW + ',' + Math.min(1, 0.48 * k * ALPHA) + ')');
          hg.addColorStop(1, 'rgba(' + GLOW + ',0)');
          ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
        }
        for (var ni = 0; ni < nodes.length; ni++) {
          var dn = pu.dist[ni];
          if (dn <= pu.r && dn > pu.r - band) nodes[ni].heat = Math.max(nodes[ni].heat, k);
        }
      }
      for (var w = 0; w < walkers.length; w++) {
        var wk = walkers[w]; step(wk, dt);
        var fa = nodes[wk.from], tb = nodes[wk.to];
        if (!fa || !tb) continue;
        var wy0 = fa.by + (tb.by - fa.by) * wk.t;
        if (wy0 < top || wy0 > bot) continue;
        var wx = fa.x + (tb.x - fa.x) * wk.t, wy = fa.y + (tb.y - fa.y) * wk.t;
        var g = ctx.createRadialGradient(wx, wy, 0, wx, wy, 6);
        g.addColorStop(0, 'rgba(' + GLOW + ',' + Math.min(1, 0.42 * ALPHA) + ')');
        g.addColorStop(1, 'rgba(' + GLOW + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(wx, wy, 6, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    function drawStatic() {
      var off = scrollY() * PARALLAX, top = off - 60, bot = off + VH + 60;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, VH);
      ctx.setTransform(DPR, 0, 0, DPR, 0, -off * DPR);
      for (var i = 0; i < edges.length; i++) {
        var e = edges[i], a = nodes[e.a], b = nodes[e.b];
        if ((a.by < top && b.by < top) || (a.by > bot && b.by > bot)) continue;
        ctx.strokeStyle = 'rgba(' + EDGE + ',' + (0.05 * ALPHA) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.bx, a.by); ctx.lineTo(b.bx, b.by); ctx.stroke();
      }
      for (var n = 0; n < nodes.length; n++) {
        var p = nodes[n];
        if (p.by < top || p.by > bot) continue;
        ctx.fillStyle = 'rgba(' + EDGE + ',' + (0.10 * ALPHA) + ')';
        ctx.beginPath(); ctx.arc(p.bx, p.by, 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }

    function start() { if (reduce) return; if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    resize();
    if (reduce) drawStatic(); else start();

    var rt;
    function onResize() { clearTimeout(rt); rt = setTimeout(resize, 200); }
    window.addEventListener('resize', onResize);
    window.addEventListener('load', onResize);
    // In reduced-motion mode nothing redraws on its own, so keep the static
    // backdrop aligned with the page as it scrolls.
    window.addEventListener('scroll', function () {
      if (reduce) drawStatic();
      // If the document grew (lazy content), rebuild to cover the new height.
      else if (Math.abs(docHeight() - DOC) > VH) onResize();
    }, { passive: true });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    // Click / tap anywhere: send a signal through the graph from that spot.
    window.addEventListener('pointerdown', function (ev) {
      if (reduce) return;
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      pulseAt(ev.clientX, ev.clientY);
      start();
    }, { passive: true });
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', function (ev) {
        reduce = ev.matches; stop();
        if (reduce) drawStatic(); else start();
      });
    }
    // Re-colour live when the theme toggles. ThemeToggle only flips the
    // data-theme attribute on <html> (no custom event), so observe that.
    if (window.MutationObserver) {
      new MutationObserver(applyColors).observe(document.documentElement, {
        attributes: true, attributeFilter: ['data-theme']
      });
    }
  }
})();
