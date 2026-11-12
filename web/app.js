/* Grok Desk app (plan B). Reads JSON at ./d/{DATA_PATH}/ . DATA_PATH comes from the #d= fragment,
   then lives in localStorage only. No FOMO URL is built here: every link comes from the data (links.py). */
(function () {
  "use strict";
  var KEY = "desk_d";
  var m = location.hash.match(/[#&]d=([A-Za-z0-9_-]{16,})/);
  if (m) { try { localStorage.setItem(KEY, m[1]); } catch (e) {} history.replaceState(null, "", location.pathname + location.search); }
  var DP = null; try { DP = localStorage.getItem(KEY); } catch (e) {}
  var BASE = DP ? "d/" + DP + "/" : null;
  var S = { tab: "home", screen: null, state: null, activity: null, chart: null, coin: {}, err: null, last: 0 };
  var NAMES = ["Mint", "Freeze", "Dev", "Top 10", "LP", "Age", "Bundles", "Deleg."];
  var view = document.getElementById("view");

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function usd(x, d) { if (x == null || isNaN(x)) return "–"; var a = Math.abs(x), s = x < 0 ? "-" : "";
    if (a >= 1e6) return s + "$" + (a / 1e6).toFixed(1) + "M"; if (a >= 1e4) return s + "$" + (a / 1e3).toFixed(1) + "K";
    return s + "$" + a.toFixed(d == null ? 2 : d); }
  function pct(x) { return x == null ? "–" : (x >= 0 ? "+" : "") + Number(x).toFixed(1) + "%"; }
  function px(x) { if (x == null) return "–"; return x < 0.01 ? Number(x).toPrecision(4) : Number(x).toFixed(4); }
  function hm(ts) { if (!ts) return ""; var d = new Date(ts * 1000); return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  function ago(ts) { var s = Math.max(0, Date.now() / 1000 - ts); return s < 90 ? Math.round(s) + "s" : s < 5400 ? Math.round(s / 60) + "m" : Math.round(s / 3600) + "h"; }
  function link(l, txt, cls) { return l ? '<a class="' + (cls || "") + '" href="' + esc(l) + '" target="_blank" rel="noopener noreferrer">' + txt + "</a>" : txt; }
  function coinA(name, mint) { return '<a href="#" data-coin="' + esc(mint) + '">' + esc(name || (mint || "").slice(0, 6)) + "</a>"; }

  function get(path) {
    return fetch(BASE + path + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  function load() {
    if (!BASE) { render(); return; }
    Promise.all([get("state.json"), get("activity.json"), get("chart.json")]).then(function (a) {
      S.state = a[0]; S.activity = a[1].items || []; S.chart = a[2]; S.err = null; S.last = Date.now(); render();
    }).catch(function (e) { S.err = e.message || "network error"; render(); });
    if (S.screen && S.screen.type === "coin") loadCoin(S.screen.mint);
  }
  function loadCoin(mint) {
    get("coin/" + mint + ".json").then(function (c) { S.coin[mint] = c; render(); })
      .catch(function () { S.coin[mint] = { _err: true }; render(); });
  }

  /* ---------- pieces ---------- */
  function strips(layers) {
    var out = '<div class="strips">';
    for (var i = 0; i < 8; i++) {
      var l = (layers || [])[i], cls = !l ? "" : l.pass === true ? "ok" : l.pass === false ? "bad" : "";
      out += '<div class="strip ' + cls + '">' + NAMES[i] + "</div>";
    }
    return out + "</div>";
  }
  function ring(score, min) {
    var r = 40, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, score || 0)), col = v >= min ? "var(--green)" : "var(--red)";
    return '<svg class="ring" viewBox="0 0 96 96"><circle cx="48" cy="48" r="' + r + '" stroke="#222838" stroke-width="9" fill="none"/>' +
      '<circle cx="48" cy="48" r="' + r + '" stroke="' + col + '" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="' +
      (c * v / 100) + " " + c + '" transform="rotate(-90 48 48)"/><text x="48" y="55" text-anchor="middle" fill="#e8ecf4" font-size="22" font-weight="700">' +
      (score == null ? "–" : score) + "</text></svg>";
  }
  function disc(layers, running) {
    var s = '<svg class="disc" width="220" height="220" viewBox="0 0 220 220">', cx = 110, cy = 110, R = 100, r0 = 52;
    for (var i = 0; i < 8; i++) {
      var a0 = (i * 45 - 90 + 2) * Math.PI / 180, a1 = ((i + 1) * 45 - 90 - 2) * Math.PI / 180, l = (layers || [])[i];
      var col = !l ? "#222838" : l.pass === true ? "#2fd47a" : l.pass === false ? "#ff5468" : "#2a3040";
      var beam = running && layers && i === layers.length;
      if (beam) col = "#38d9f5";
      var p = "M" + (cx + r0 * Math.cos(a0)) + "," + (cy + r0 * Math.sin(a0)) + " L" + (cx + R * Math.cos(a0)) + "," + (cy + R * Math.sin(a0)) +
        " A" + R + "," + R + " 0 0 1 " + (cx + R * Math.cos(a1)) + "," + (cy + R * Math.sin(a1)) + " L" + (cx + r0 * Math.cos(a1)) + "," + (cy + r0 * Math.sin(a1)) +
        " A" + r0 + "," + r0 + " 0 0 0 " + (cx + r0 * Math.cos(a0)) + "," + (cy + r0 * Math.sin(a0)) + "Z";
      s += '<path d="' + p + '" fill="' + col + '"' + (beam ? ' class="strip run"' : "") + ' opacity="' + (l && l.pass == null ? .5 : .95) + '"/>';
      var am = ((i + .5) * 45 - 90) * Math.PI / 180;
      s += '<text x="' + (cx + 76 * Math.cos(am)) + '" y="' + (cy + 76 * Math.sin(am) + 4) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#0b0d12">' + (i + 1) + "</text>";
    }
    var n = (layers || []).filter(function (l) { return l.pass === true; }).length;
    return s + '<text x="110" y="116" text-anchor="middle" font-size="22" font-weight="700" fill="#e8ecf4">' + n + "/8</text></svg>";
  }
  function spark(eq) {
    if (!eq || eq.length < 2) return "";
    var w = 340, h = 60, vs = eq.map(function (e) { return e.v; }), lo = Math.min.apply(0, vs), hi = Math.max.apply(0, vs); if (hi === lo) { hi += 1; lo -= 1; }
    var pts = eq.map(function (e, i) { return (i / (eq.length - 1) * w).toFixed(1) + "," + (h - (e.v - lo) / (hi - lo) * (h - 6) - 3).toFixed(1); }).join(" ");
    var col = vs[vs.length - 1] >= vs[0] ? "#2fd47a" : "#ff5468";
    return '<svg viewBox="0 0 ' + w + " " + h + '" width="100%" height="60"><polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="2"/></svg>';
  }
  function emptyBox(ico, t, sub) { return '<div class="empty"><div class="ico">' + ico + "</div><b>" + esc(t) + '</b><div class="sm">' + esc(sub || "") + "</div></div>"; }
  function errorCard() {
    return '<div class="card err"><h3>Can\'t reach the desk</h3><div class="sm">' + esc(S.err) + (S.last ? " · last good update " + ago(S.last / 1000) + " ago" : "") +
      '</div><div style="margin-top:10px"><button class="btn ghost" data-act="retry">Retry</button></div></div>';
  }
  function staleLine() { return S.state ? '<div class="stale">Updated ' + ago(S.state.generated) + " ago · " + esc(S.state.plan === "B" ? "refreshes about every minute" : "") + "</div>" : ""; }

  /* ---------- screens ---------- */
  function home() {
    var st = S.state, h = "";
    var pnl = st.night_pnl || 0;
    h += '<div class="card"><h3>' + esc(st.mode) + ' stack<span class="sm mut">free ' + usd(st.free) + "</span></h3>" +
      '<div class="big">' + usd(st.stack) + '</div><div class="' + (pnl >= 0 ? "g" : "r") + '">' + (pnl >= 0 ? "+" : "") + usd(pnl) + " tonight</div>" + spark(S.chart && S.chart.equity) + "</div>";
    h += '<div class="card"><h3>Open positions<span>' + st.positions.length + "</span></h3>";
    if (!st.positions.length) h += '<div class="sm mut">Nothing open. Risk is idle until Executor fills a coin.</div>';
    st.positions.forEach(function (p) {
      h += '<div class="row"><div class="l"><div class="t">' + coinA(p.name, p.mint) + '</div><div class="s">' + usd(p.size) + " · stop -" + p.stop_pct + "%" + (p.trail_active ? " · trailing" : "") +
        '</div></div><div class="rt"><div class="' + (p.pct >= 0 ? "g" : "r") + '">' + pct(p.pct) + "</div>" + link(p.link, "Sell on FOMO", "btn sell") + "</div></div>";
    });
    h += "</div>";
    var a = st.agents;
    h += '<div class="grid2">' +
      mini("Scanner", a.scanner.pools + " pools", a.scanner.waiting + " waiting") + mini("Auditor", a.auditor.taken_apart + " taken apart", a.auditor.rejected + " rejected") +
      mini("Analyst", a.analyst.last ? "score " + a.analyst.last.score : "Scoring", a.analyst.mode === "rules" ? "rules mode" : "Jev") +
      mini("Executor", a.executor.trades + " trades", a.executor.stack_pct + "% of stack") + "</div>";
    h += '<div class="card" style="margin-top:12px"><h3>Latest<a href="#" data-tab="activity" class="sm">all</a></h3>' + actRows((S.activity || []).slice(0, 5)) + "</div>";
    return h;
  }
  function mini(t, b, s) { return '<div class="mini" data-tab="agents"><span>' + esc(t) + "</span><b>" + esc(b) + "</b><span>" + esc(s) + "</span></div>"; }
  function actRows(items) {
    if (!items.length) return '<div class="sm mut">No activity yet tonight.</div>';
    return items.map(function (x) {
      var col = /^(Sold)/.test(x.title) && /^\+/.test(x.r1 || "") ? "g" : /^(Stopped|Rejected|Pulled)/.test(x.title) ? "r" : "";
      return '<div class="row"><div class="l"><div class="t">' + (x.mint ? coinA(x.title, x.mint) : esc(x.title)) + '</div><div class="s">' + esc(x.sub) + " · " + hm(x.ts) +
        '</div></div><div class="rt"><div class="' + col + '">' + esc(x.r1) + '</div><div class="sm mut">' + esc(x.r2) + "</div></div></div>";
    }).join("");
  }
  function agents() {
    var a = S.state.agents, h = "", hb = S.state.health || {};
    function hdr(n, t, key) { var p = hb[key] && hb[key].paused; return "<h3>" + n + " · " + t + (p ? '<span class="pill red">paused</span>' : '<span class="sm mut">' + (hb[key] ? ago(Date.now() / 1000 - hb[key].age_s) : "") + "</span>") + "</h3>"; }
    // Scanner
    h += '<div class="card">' + hdr(1, "Scanner", "scanner") + '<div class="big">' + a.scanner.pools + ' <span class="sm mut">pools</span></div>' +
      '<div class="sm mut">' + a.scanner.waiting + " waiting · " + a.scanner.passed + " passed · " + a.scanner.killed + " killed</div>";
    h += a.scanner.feed.slice(0, 8).map(function (f) {
      return f.verdict === "pass" ? '<div class="row"><div class="l"><div class="t">' + coinA(f.name, f.mint) + " · liq " + usd(f.liq, 0) + ' · <span class="c">→ auditor</span></div></div></div>'
        : '<div class="row killed"><div class="l"><div class="t">' + coinA(f.name, f.mint) + '</div></div><div class="rt r">' + esc(f.reason) + "</div></div>";
    }).join("") + "</div>";
    // Auditor
    var cur = a.auditor.current;
    h += '<div class="card" data-screen="auditor">' + hdr(2, "Auditor", "auditor") + '<div class="big">' + a.auditor.taken_apart + ' <span class="sm mut">taken apart</span></div>' +
      strips(cur && cur.layers) + '<div class="sm">' + (cur ? (cur.running ? '<span class="c">taking apart ' + esc(cur.name) + "...</span>" :
        cur.passed ? '<span class="g">' + esc(cur.name) + " · 8/8 → Executor</span>" : '<span class="r">' + esc(cur.name) + " · " + esc(cur.reason) + "</span>") : '<span class="mut">waiting for Scanner</span>') +
      '</div><div class="sm mut" style="margin-top:4px">' + a.auditor.rejected + ' rejected · <a href="#" data-screen="auditor">open</a></div></div>';
    // Analyst
    var l = a.analyst.last;
    h += '<div class="card">' + hdr(3, "Analyst" + (a.analyst.mode === "rules" ? " (rules)" : ""), "analyst") + '<div class="flex">' + ring(l ? l.score : null, a.analyst.min_score) +
      '<div><div><b>Scoring</b></div><div class="sm mut">' + a.analyst.scored + " scored · " + a.analyst.passed + " passed</div>" +
      (l ? '<div class="sm">' + coinA(l.name, l.mint) + " · " + (l.passed ? '<span class="g">pass</span>' : '<span class="r">' + esc((l.failed || [])[0]) + "</span>") + "</div>" : "") + "</div></div></div>";
    // Executor
    var e = a.executor.last;
    h += '<div class="card">' + hdr(4, "Executor", "executor") + '<div class="big">' + a.executor.trades + ' <span class="sm mut">trades</span></div>' +
      (e ? '<div class="sm">' + coinA(e.name, e.mint) + " · " + usd(e.sizeUsd) + " · " + e.stackPct + "% of stack</div>" +
        '<div class="bar"><i style="width:' + (e.status === "bought" ? 100 : e.status === "sent" ? 60 : 0) + '%"></i></div><div class="sm ' + (e.status === "bought" ? "g" : "mut") + '">' +
        (e.status === "bought" ? "✓ Filled" : e.status === "sent" ? "Executing... waiting for your tap" : esc(e.status + (e.reason ? " · " + e.reason : ""))) + "</div>"
        : '<div class="sm mut">' + a.executor.stack_pct + "% of stack per trade · nothing sized yet</div>") + "</div>";
    // Risk
    var r = a.risk;
    h += '<div class="card">' + hdr(5, "Risk", "risk") + '<div class="big">' + (r.guarding ? "Guarding" : "Idle") + ' <span class="sm mut">' + r.guarding + " open</span></div>" +
      '<div style="margin:6px 0"><span class="pill red">stop -' + r.stop_pct + '%</span> <span class="pill green">trail ' + r.trail_pct + "%</span></div>" +
      '<div class="sm mut">Last exit: ' + esc(r.last_exit || "none yet") + "</div></div>";
    return h;
  }
  function auditorScreen() {
    var a = S.state.agents.auditor, cur = a.current, h = '<button class="back" data-back>‹ Agents</button>';
    h += '<div class="card"><h3>Auditor · 8 layers</h3>';
    if (!cur) h += emptyBox("⬡", "Nothing taken apart yet", "Coins that pass Scanner show up here layer by layer.");
    else {
      h += disc(cur.layers, cur.running) + '<div style="text-align:center;margin-bottom:6px"><b>' + coinA(cur.name, cur.mint) + "</b> " + link(cur.link, "Open on FOMO", "sm") + "</div>";
      for (var i = 0; i < 8; i++) {
        var l = (cur.layers || [])[i], cls = !l ? "nc" : l.pass === true ? "ok" : l.pass === false ? "bad" : "nc";
        h += '<div class="layer ' + cls + '"><div class="n">' + (i + 1) + "</div><div>" + esc(l ? l.name : NAMES[i]) + '</div><div class="v">' + esc(l ? l.value : cur.running ? "…" : "not checked") + "</div></div>";
      }
    }
    h += "</div>";
    h += '<div class="card"><h3>Recent<span>' + a.taken_apart + " · " + a.rejected + " rejected</span></h3>";
    h += a.feed.length ? a.feed.map(function (f) { return '<div class="row"><div class="l"><div class="t">' + coinA(f.name, f.mint) + '</div><div class="s">' + hm(f.ts) + "</div>" + strips(f.layers) +
      '</div><div class="rt ' + (f.passed ? "g" : "r") + '">' + (f.passed ? "8/8" : esc(f.reason)) + "</div></div>"; }).join("") : '<div class="sm mut">No audits yet tonight.</div>';
    return h + "</div>";
  }
  function coinScreen(mint) {
    var c = S.coin[mint], h = '<button class="back" data-back>‹ Back</button>';
    if (!c) return h + '<div class="card">' + emptyBox("…", "Loading coin", "") + "</div>";
    if (c._err) return h + '<div class="card err"><h3>Coin not on the desk</h3><div class="sm">The desk only publishes coins it worked on tonight.</div></div>';
    h += '<div class="card"><h3>' + esc(c.symbol || "") + '<span class="sm mut">' + esc(c.status || "") + '</span></h3><div class="big" style="font-size:24px">' + esc(c.name || mint.slice(0, 8)) +
      '</div><div class="sm mut" style="word-break:break-all">' + esc(mint) + '</div><div style="margin-top:10px">' + link(c.link, (c.position && c.position.status === "open" ? "Sell on FOMO" : "Open on FOMO"), "btn" + (c.position && c.position.status === "open" ? " sell" : "")) + "</div></div>";
    h += '<div class="card"><h3>Price<span class="sm mut">1m candles</span></h3><canvas id="chart" height="200"></canvas>' +
      (c.position && c.position.exit_line ? '<div class="sm" style="color:var(--orange)">- - Risk trailing stop ' + px(c.position.exit_line) + "</div>" : "") + "</div>";
    h += '<div class="grid2">' + mini("Liquidity", usd(c.liq, 0), "") + mini("Market cap", usd(c.mcap, 0), "") + mini("Top 10", c.top10 == null ? "–" : c.top10.toFixed(1) + "%", "pool + curve excluded") +
      mini("Holders", c.holders == null ? "–" : c.holders, "balance > 0") + "</div>";
    if (c.position) h += '<div class="card" style="margin-top:12px"><h3>Position · ' + esc(c.position.status) + "</h3>" + '<div class="sm">In ' + usd(c.position.size) + " at " + px(c.position.entry) + " · stop -" + c.position.stop_pct + "%" +
      (c.position.exit ? " · out " + px(c.position.exit) + " (" + esc(c.position.reason) + ") " + usd(c.position.pnl) : "") + "</div></div>";
    if (c.audit) { h += '<div class="card" style="margin-top:12px"><h3>Auditor</h3>'; c.audit.layers.forEach(function (l) {
      h += '<div class="layer ' + (l.pass === true ? "ok" : l.pass === false ? "bad" : "nc") + '"><div class="n">' + l.n + "</div><div>" + esc(l.name) + '</div><div class="v">' + esc(l.value) + "</div></div>"; }); h += "</div>"; }
    if (c.analysis && c.analysis.answers) { var an = c.analysis.answers; h += '<div class="card"><h3>Analyst · ' + esc(c.analysis.model) + '</h3><div class="flex">' + ring(c.analysis.score, S.state.agents.analyst.min_score) +
      '<div class="sm">alive_6h ' + an.alive_6h + "<br>organic " + an.organic + "<br>flush " + an.flush + "<br>chase " + an.chase + "</div></div></div>"; }
    return h;
  }
  function drawChart(c) {
    var cv = document.getElementById("chart"); if (!cv || !c) return;
    var dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = 200; cv.width = W * dpr; cv.height = H * dpr;
    var g = cv.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
    var k = c.candles || []; if (!k.length) { g.fillStyle = "#8a93a6"; g.font = "13px sans-serif"; g.fillText("No prices yet", 12, 100); return; }
    var lo = Infinity, hi = -Infinity; k.forEach(function (x) { lo = Math.min(lo, x.l); hi = Math.max(hi, x.h); });
    var lines = []; if (c.position) { if (c.position.entry) lines.push([c.position.entry, "#8a93a6", []]); if (c.position.exit_line) lines.push([c.position.exit_line, "#ff9f40", [6, 4]]); }
    lines.forEach(function (l) { lo = Math.min(lo, l[0]); hi = Math.max(hi, l[0]); }); if (hi === lo) { hi *= 1.01; lo *= .99; }
    var y = function (v) { return 8 + (hi - v) / (hi - lo) * (H - 16); }, bw = Math.max(2, Math.min(10, (W - 10) / k.length - 2));
    k.forEach(function (x, i) { var X = 5 + i * (W - 10) / k.length + bw / 2, up = x.c >= x.o; g.strokeStyle = g.fillStyle = up ? "#2fd47a" : "#ff5468";
      g.beginPath(); g.moveTo(X, y(x.h)); g.lineTo(X, y(x.l)); g.stroke(); var t = y(Math.max(x.o, x.c)), b = y(Math.min(x.o, x.c)); g.fillRect(X - bw / 2, t, bw, Math.max(1, b - t)); });
    lines.forEach(function (l) { g.setLineDash(l[2]); g.strokeStyle = l[1]; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y(l[0])); g.lineTo(W, y(l[0])); g.stroke(); });
    g.setLineDash([]);
  }
  function activityTab() { return '<div class="card"><h3>Activity<span>' + (S.activity || []).length + "</span></h3>" + actRows(S.activity || []) + "</div>"; }
  var GROUPS = [["Scanner", "scanner."], ["Auditor", "auditor."], ["Analyst", "analyst."], ["Executor", "executor."], ["Risk", "risk."], ["Desk", "desk."]];
  function account() {
    var st = S.state, ac = st.account, s = st.settings, h = "";
    h += '<div class="card"><h3>FOMO</h3><div class="row"><div class="l"><div class="t">@' + esc(ac.fomo_handle) + '</div><div class="s">your FOMO profile</div></div><div class="rt">' + link(ac.profile_url, "Profile", "btn ghost") + "</div></div>" +
      '<div class="row"><div class="l"><div class="t">Invite a friend</div><div class="s">10% off their fees for life</div></div><div class="rt">' + link(ac.signup_url, "Invite link", "btn ghost") + "</div></div></div>";
    h += '<div class="card"><h3>Desk</h3>' + kv("Mode", st.mode) + kv("Hosting", ac.hosting) + kv("Notifier", ac.notifier) + kv("Web push", ac.webpush) + kv("Analyst", ac.jev) + "</div>";
    h += '<div class="card"><h3>Settings<span class="sm mut">read-only</span></h3><div class="sm mut" style="margin-bottom:6px">Plan B is static hosting, so settings change from Telegram: <b>set stop to -8%</b>.</div>';
    GROUPS.forEach(function (gp) {
      h += '<div style="margin-top:10px" class="sm c">' + gp[0] + (gp[0] === "Analyst" && s["analyst.mode"] === "rules" ? " (rules)" : "") + "</div>";
      Object.keys(s).filter(function (k) { return k.indexOf(gp[1]) === 0; }).forEach(function (k) {
        var v = s[k], name = k.split(".")[1];
        if (typeof v === "number") h += '<div class="setrow"><label>' + esc(name) + '</label><input type="range" disabled value="' + v + '" min="0" max="' + Math.max(v * 2, 1) + '"><input type="number" disabled value="' + v + '"></div>';
        else h += '<div class="setrow"><label>' + esc(name) + '</label><span class="val">' + esc(v) + "</span></div>";
      });
    });
    h += '</div><div class="sm mut" style="text-align:center">New to FOMO? ' + link(ac.signup_url, "Sign up", "") + "</div>";
    return h;
  }
  function kv(k, v) { return '<div class="row"><div class="l"><div class="t">' + esc(k) + '</div></div><div class="rt">' + esc(v) + "</div></div>"; }

  function render() {
    var pill = document.getElementById("modepill");
    document.querySelectorAll("nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === S.tab); });
    if (!BASE) { pill.textContent = "—"; pill.className = "pill"; view.innerHTML = '<div class="card">' + emptyBox("🔒", "Open the desk from your private link", "Use the link from Telegram, it ends in #d=…  This page shows nothing without it.") + "</div>"; return; }
    if (!S.state) { view.innerHTML = S.err ? errorCard() : '<div class="card">' + emptyBox("…", "Loading the desk", "") + "</div>"; return; }
    pill.textContent = S.state.mode; pill.className = "pill " + (S.state.mode === "PAPER" ? "paper" : "live");
    var h = S.err ? errorCard() : "";
    if (S.screen && S.screen.type === "auditor") h += auditorScreen();
    else if (S.screen && S.screen.type === "coin") h += coinScreen(S.screen.mint);
    else h += ({ home: home, agents: agents, activity: activityTab, account: account }[S.tab])();
    view.innerHTML = h + staleLine();
    if (S.screen && S.screen.type === "coin") drawChart(S.coin[S.screen.mint]);
  }
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-tab],[data-coin],[data-screen],[data-back],[data-act]"); if (!t) return;
    if (t.tagName === "A" && t.getAttribute("target") === "_blank") return;
    ev.preventDefault();
    if (t.dataset.coin) { S.screen = { type: "coin", mint: t.dataset.coin, prev: S.screen }; loadCoin(t.dataset.coin); }
    else if (t.dataset.screen) S.screen = { type: t.dataset.screen };
    else if (t.hasAttribute("data-back")) S.screen = S.screen && S.screen.prev || null;
    else if (t.dataset.act === "retry") load();
    else if (t.dataset.tab) { S.tab = t.dataset.tab; S.screen = null; }
    render(); window.scrollTo(0, 0);
  });
  window.__desk = S;
  load(); setInterval(load, 20000);
})();
