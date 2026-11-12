/* chart.js: hand-drawn <canvas> charts, devicePixelRatio aware. No library. */
(function () {
  "use strict";
  var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function setup(cv, h) {
    var dpr = window.devicePixelRatio || 1, w = cv.clientWidth || cv.parentNode.clientWidth;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + "px";
    var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); return { g: g, w: w, h: h };
  }
  var COL = { bought: "#0a84ff", sold: "#00d35a", stopped: "#ff453a" };
  /* Home line: #00d35a with gradient fill, dashed start line, marks above the line that never overlap. */
  function line(cv, data, opts) {
    opts = opts || {};
    var H = 220, c = setup(cv, H), g = c.g, W = c.w, pts = (data && data.points) || [], start = data ? data.start_value : null;
    var top = 34, bot = H - 10;
    if (!pts.length || pts.length < 2) {
      g.setLineDash([4, 5]); g.strokeStyle = "rgba(235,235,245,0.3)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke(); g.setLineDash([]); return;
    }
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t; if (t1 === t0) t1 = t0 + 1;
    var lo = Infinity, hi = -Infinity; pts.forEach(function (p) { lo = Math.min(lo, p.v); hi = Math.max(hi, p.v); });
    if (start != null) { lo = Math.min(lo, start); hi = Math.max(hi, start); } if (hi === lo) { hi += 1; lo -= 1; }
    var pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
    var X = function (t) { return (t - t0) / (t1 - t0) * (W - 2) + 1; }, Y = function (v) { return top + (hi - v) / (hi - lo) * (bot - top); };
    var up = pts[pts.length - 1].v >= (start != null ? start : pts[0].v), col = up ? "#00d35a" : "#ff453a";
    var prog = opts.slide && !RM ? opts.slide : 1;
    var n = pts.length, lastX = X(pts[n - 2].t) + (X(pts[n - 1].t) - X(pts[n - 2].t)) * prog;
    g.beginPath();
    pts.forEach(function (p, i) { var x = i === n - 1 ? lastX : X(p.t), y = i === n - 1 ? Y(pts[n - 2].v + (p.v - pts[n - 2].v) * prog) : Y(p.v); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    var grad = g.createLinearGradient(0, top, 0, bot); grad.addColorStop(0, up ? "rgba(0,211,90,0.28)" : "rgba(255,69,58,0.28)"); grad.addColorStop(1, "rgba(0,0,0,0)");
    g.save(); g.lineTo(lastX, bot); g.lineTo(X(pts[0].t), bot); g.closePath(); g.fillStyle = grad; g.fill(); g.restore();
    g.beginPath(); pts.forEach(function (p, i) { var x = i === n - 1 ? lastX : X(p.t), y = i === n - 1 ? Y(pts[n - 2].v + (p.v - pts[n - 2].v) * prog) : Y(p.v); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.strokeStyle = col; g.lineWidth = 2; g.lineJoin = "round"; g.stroke();
    if (start != null) { g.setLineDash([3, 4]); g.strokeStyle = "rgba(235,235,245,0.3)"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, Y(start)); g.lineTo(W, Y(start)); g.stroke(); g.setLineDash([]); }
    // marks: placed above the line, later mark moves up a row when it would overlap
    var placed = [], alpha = opts.markAlpha == null ? 1 : opts.markAlpha;
    g.font = "600 11px -apple-system, 'SF Pro Text', sans-serif"; g.textBaseline = "middle";
    ((data.marks) || []).forEach(function (m) {
      if (m.t < t0 || m.t > t1) return;
      var x = X(m.t), yv = Y(valueAt(pts, m.t)), w = g.measureText(m.label).width + 12, h = 18, row = 0, bx, by;
      do { bx = Math.max(1, Math.min(W - w - 1, x - w / 2)); by = yv - 26 - row * (h + 4);
        var hit = placed.some(function (p) { return bx < p.x + p.w + 2 && bx + w + 2 > p.x && by < p.y + p.h && by + h > p.y; }); row++; } while (hit && row < 8);
      if (by < 0) by = 0;
      placed.push({ x: bx, y: by, w: w, h: h });
      g.globalAlpha = alpha; g.fillStyle = COL[m.kind] || "#0a84ff";
      rr(g, bx, by, w, h, 6); g.fill(); g.fillStyle = m.kind === "sold" ? "#000" : "#fff"; g.fillText(m.label, bx + 6, by + h / 2 + 0.5);
      g.beginPath(); g.arc(x, yv, 3, 0, 7); g.fillStyle = COL[m.kind] || "#0a84ff"; g.fill(); g.globalAlpha = 1;
    });
  }
  function valueAt(pts, t) { for (var i = 1; i < pts.length; i++) if (pts[i].t >= t) return pts[i - 1].v; return pts[pts.length - 1].v; }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  /* Coin candles: 1-minute OHLC + volume bars; orange dashed "Risk trailing stop" at the exit line. */
  function candles(cv, k, exitLine, entry) {
    var H = 260, c = setup(cv, H), g = c.g, W = c.w, vh = 44, top = 10, bot = H - vh - 14;
    if (!k || !k.length) { g.fillStyle = "rgba(235,235,245,0.6)"; g.font = "15px -apple-system, sans-serif"; g.textAlign = "center"; g.fillText("No prices yet", W / 2, H / 2); return; }
    var lo = Infinity, hi = -Infinity, vmax = 0; k.forEach(function (x) { lo = Math.min(lo, x.l); hi = Math.max(hi, x.h); vmax = Math.max(vmax, x.v || 0); });
    [exitLine, entry].forEach(function (v) { if (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    if (hi === lo) { hi *= 1.01; lo *= 0.99; } var pad = (hi - lo) * 0.06; hi += pad; lo -= pad;
    var Y = function (v) { return top + (hi - v) / (hi - lo) * (bot - top); }, step = (W - 8) / Math.max(k.length, 20), bw = Math.max(2, step * 0.62);
    k.forEach(function (x, i) {
      var cx = 4 + i * step + step / 2, upc = x.c >= x.o, col = upc ? "#00d35a" : "#ff453a";
      g.strokeStyle = g.fillStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, Y(x.h)); g.lineTo(cx, Y(x.l)); g.stroke();
      var t = Y(Math.max(x.o, x.c)), b = Y(Math.min(x.o, x.c)); g.fillRect(cx - bw / 2, t, bw, Math.max(1, b - t));
      if (vmax > 0) { var vhh = (x.v || 0) / vmax * vh; g.globalAlpha = 0.45; g.fillRect(cx - bw / 2, H - vhh, bw, vhh); g.globalAlpha = 1; }
    });
    if (entry) { g.setLineDash([2, 3]); g.strokeStyle = "rgba(235,235,245,0.3)"; g.beginPath(); g.moveTo(0, Y(entry)); g.lineTo(W, Y(entry)); g.stroke(); }
    if (exitLine) {
      g.setLineDash([6, 4]); g.strokeStyle = "#ff9f0a"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, Y(exitLine)); g.lineTo(W, Y(exitLine)); g.stroke();
      g.setLineDash([]); g.fillStyle = "#ff9f0a"; g.font = "600 11px -apple-system, sans-serif"; g.textAlign = "right"; g.fillText("Risk trailing stop", W - 4, Y(exitLine) - 6);
    }
    g.setLineDash([]);
  }
  /* Analyst score ring 0-100, green from min (70). */
  function ring(cv, score, min, size) {
    size = size || 120; cv.style.width = size + "px"; var c = setup(cv, size), g = c.g, r = size / 2 - 9, cx = size / 2;
    g.lineWidth = 10; g.lineCap = "round"; g.strokeStyle = "#2c2c2e"; g.beginPath(); g.arc(cx, cx, r, 0, Math.PI * 2); g.stroke();
    if (score != null) { g.strokeStyle = score >= min ? "#00d35a" : "#ff453a"; g.beginPath(); g.arc(cx, cx, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.005, score / 100)); g.stroke(); }
    g.fillStyle = "#fff"; g.font = "700 " + Math.round(size * 0.3) + "px -apple-system, 'SF Pro Display', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(score == null ? "–" : String(score), cx, cx + 1);
  }
  window.DeskChart = { line: line, candles: candles, ring: ring, reduced: RM };
})();
