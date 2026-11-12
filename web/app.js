/* Grok Desk app (plan B). Opens once as {URL}#d={DATA_PATH}; the path then lives in localStorage only.
   Reads JSON files under d/{DATA_PATH}/ (same shapes as the STEP 7 API). Every FOMO link comes from the
   data (links.py on the desk) and is used exactly as given; this file never builds one. */
(function () {
  "use strict";
  var KEY = "desk_d", SEEN = "desk_push_seen", POLL = 20;
  var m = location.hash.match(/[#&]d=([A-Za-z0-9_-]{16,})/);
  if (m) { try { localStorage.setItem(KEY, m[1]); } catch (e) {} history.replaceState(null, "", location.pathname + location.search); }
  var DP = null; try { DP = localStorage.getItem(KEY); } catch (e) {}
  var BASE = DP ? "d/" + DP + "/" : null, RM = window.DeskChart.reduced;
  var S = { tab: "home", screen: null, range: "LIVE", data: {}, failed: {}, offline: false, lastOk: 0, next: POLL, search: null,
            prevBal: null, prevPts: {}, prevMarks: {}, animated: {}, actPages: 1 };
  var view = document.getElementById("view"), nav = document.getElementById("nav"), off = document.getElementById("offline");
  var LN = ["Mint", "Freeze", "Dev", "Top 10", "LP", "Age", "Bundles", "Deleg."];
  var AG = [["scanner", "Scanner", "#64d2ff"], ["auditor", "Auditor", "#fff"], ["analyst", "Analyst", "#ffd60a"], ["executor", "Executor", "#00d35a"], ["risk", "Risk", "#ff6b9a"]];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(x) { if (x == null || isNaN(x)) return "–"; var s = x < 0 ? "-" : ""; x = Math.abs(x);
    return s + "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function kusd(x) { if (x == null) return "n/a"; var a = Math.abs(x); return a >= 1e6 ? "$" + (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? "$" + (a / 1e3).toFixed(1) + "K" : "$" + a.toFixed(0); }
  function pct(x) { return x == null ? "–" : (x >= 0 ? "+" : "") + Number(x).toFixed(2) + "%"; }
  function px(x) { if (x == null) return "–"; if (x >= 1) return "$" + x.toFixed(4); var s = x.toPrecision(4); return "$" + (s.indexOf("e") > -1 ? Number(x).toFixed(10).replace(/0+$/, "") : s); }
  function hm(ts) { return ts ? new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""; }
  function age(ts) { if (!ts) return ""; var h = (Date.now() / 1000 - ts) / 3600; return h < 1 ? Math.round(h * 60) + "m old" : h < 48 ? Math.round(h) + "h old" : Math.round(h / 24) + "d old"; }
  function ext(url, inner, cls) { return url ? '<a class="' + (cls || "") + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + inner + "</a>" : ""; }
  function st() { return S.data["state.json"]; }

  /* ---------- data ---------- */
  function get(path) {
    return fetch(BASE + path + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
      if (r.status === 404) { S.failed[path] = 404; return null; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json().then(function (j) { S.data[path] = j; delete S.failed[path]; return j; });
    });
  }
  function want() {
    var w = ["state.json", "chart/" + S.range + ".json", "activity/1.json"];
    if (S.tab === "agents" && !S.screen) AG.forEach(function (a) { w.push("agents/" + a[0] + ".json"); });
    if (S.tab === "activity") for (var i = 2; i <= S.actPages; i++) w.push("activity/" + i + ".json");
    if (S.tab === "account" && !S.screen) w.push("account.json", "settings.json");
    if (S.screen && S.screen.type === "coin") w.push("coin/" + S.screen.mint + ".json", "audit/" + S.screen.mint + ".json");
    if (S.screen && S.screen.type === "auditor" && S.screen.mint) w.push("audit/" + S.screen.mint + ".json");
    return w;
  }
  function load() {
    if (!BASE) return render();
    Promise.all(want().map(get)).then(function () { S.offline = false; S.lastOk = Date.now(); render(); })
      .catch(function () { S.offline = true; render(); });
    S.next = POLL;
  }
  setInterval(function () { S.next--; if (S.offline) offRow(); if (S.next <= 0) load(); }, 1000);
  function offRow() {
    off.hidden = !S.offline;
    if (S.offline) off.textContent = "Desk offline · retrying in " + Math.max(0, S.next) + "s · last update " + (S.lastOk ? new Date(S.lastOk).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "never");
  }

  /* ---------- pieces ---------- */
  function skel(hs) { return hs.map(function (h) { return '<div class="skel" style="height:' + h + 'px;margin:12px 16px"></div>'; }).join(""); }
  function odo(txt, prev) {
    // each changed digit rolls 600ms ease-out, 30ms stagger right to left
    var out = '<span class="odo" data-odo="' + esc(txt) + '" data-prev="' + esc(prev || txt) + '">';
    for (var i = 0; i < txt.length; i++) {
      var ch = txt[i];
      if (/\d/.test(ch)) { out += '<span class="d"><span class="col">'; for (var k = 0; k <= 9; k++) out += "<span>" + k + "</span>"; out += "</span></span>"; }
      else out += "<span>" + esc(ch) + "</span>";
    }
    return out + "</span>";
  }
  function runOdo() {
    document.querySelectorAll("[data-odo]").forEach(function (el) {
      var to = el.dataset.odo, from = el.dataset.prev, cols = el.querySelectorAll(".col"), digits = to.replace(/\D/g, ""), fd = from.replace(/\D/g, "");
      while (fd.length < digits.length) fd = "0" + fd; fd = fd.slice(-digits.length);
      var n = cols.length;
      cols.forEach(function (c, i) {
        var a = +fd[i], b = +digits[i];
        c.style.transition = "none"; c.style.transform = "translateY(" + (-a * 1.02) + "em)";
        if (a !== b && !RM) {
          var delay = (n - 1 - i) * 30;
          requestAnimationFrame(function () { requestAnimationFrame(function () {
            c.style.transition = "transform 600ms cubic-bezier(.16,1,.3,1) " + delay + "ms"; c.style.transform = "translateY(" + (-b * 1.02) + "em)"; }); });
        } else c.style.transform = "translateY(" + (-b * 1.02) + "em)";
      });
    });
  }
  function strips(layers, running) {
    var o = '<div class="strips">';
    for (var i = 0; i < 8; i++) { var l = (layers || [])[i], cl = !l ? (running && i === (layers || []).length ? "run" : "") : l.pass === true ? "ok" : l.pass === false ? "bad" : "";
      o += '<div class="strip ' + cl + '">' + LN[i] + "</div>"; }
    return o + "</div>";
  }
  function frow(d, kill) {
    return '<div class="frow' + (kill ? " kill" : "") + '"><div class="l"><a href="#" data-coin="' + esc(d.mint) + '">' + esc(d.coin) + "</a>" + (d.extra || "") + '</div><div class="r">' + esc(d.r) + "</div></div>";
  }

  /* ---------- agent cards (Home carousel) ---------- */
  function agentCard(key, a) {
    var name = { scanner: "Scanner", auditor: "Auditor", analyst: "Analyst", executor: "Executor", risk: "Risk" }[key], h = "", col = { scanner: "#64d2ff", analyst: "#ffd60a", executor: "#00d35a", risk: "#ff6b9a", auditor: "#fff" }[key];
    h += '<div class="acard" data-agent="' + key + '"><div class="nm"><i class="' + (a.running ? "" : "off") + '"></i><span style="color:' + col + '">' + name + (key === "analyst" && a.mode === "rules" ? " (rules)" : "") + "</span></div>";
    if (key === "scanner") {
      h += '<div class="head">' + a.count + ' pools</div><div class="sub">' + (a.count ? a.waiting + " waiting · " + a.killed + " killed" : "Listening for graduations") + '</div><div class="feed">';
      h += a.decisions.map(function (d) { return d.verdict === "pass" ? frow({ mint: d.mint, coin: d.coin, r: "→ auditor", extra: '<span class="sec"> · liq ' + kusd(d.liq) + "</span>" }) : frow({ mint: d.mint, coin: d.coin, r: d.reason }, true); }).slice(0, 5).join("");
      h += "</div>";
    } else if (key === "auditor") {
      var c = a.current;
      h += '<div class="head">' + a.count + ' taken apart</div>' + strips(c && c.layers, c && c.running) + '<div class="sub">' +
        (!c ? "Waiting for Scanner" : c.running ? "taking apart..." : c.pass ? '<span class="up">' + esc(c.name) + " · 8/8 → Executor</span>" : '<span class="dn">' + esc(c.name) + " · " + esc(c.reason) + "</span>") +
        '</div><div class="feed sub">' + a.rejected + " rejected</div>";
    } else if (key === "analyst") {
      h += '<div class="head">Scoring</div><div style="display:flex;align-items:center;gap:16px;margin-top:8px"><canvas class="ringc" data-ring="' + (a.last ? a.last.score : "") + '" data-min="' + a.min_score + '"></canvas><div class="sub">' +
        a.count + " scored" + (a.last ? '<br><a href="#" data-coin="' + esc(a.last.mint) + '" style="color:#fff">' + esc(a.last.coin) + "</a><br>" + (a.last.pass ? '<span class="up">pass</span>' : '<span class="dn">' + esc(a.last.reason) + "</span>") : "") + "</div></div>";
    } else if (key === "executor") {
      var e = a.last, p = !e ? 0 : e.status === "bought" ? 100 : e.status === "sent" ? 60 : 0;
      h += '<div class="head">' + a.count + ' trades</div><div class="sub">' + (e && e.size ? money(e.size) + " · " + e.stack_pct + "% of stack" : a.stack_pct + "% of stack per trade") + "</div>" +
        '<div class="feed"><div class="bar"><i style="width:' + p + '%"></i></div><div class="sub mt">' + (!e ? "Nothing sized yet" : e.status === "bought" ? '<span class="up">✓ Filled</span>' : e.status === "sent" ? "Executing... " + p + "%" : esc(e.status + (e.reason ? " · " + e.reason : ""))) + "</div></div>";
    } else {
      h += '<div class="head">' + (a.guarding ? "Guarding" : "Idle") + '</div><div class="sub">' + (a.last_exit || "No exits yet") + '</div><div class="feed"><span class="pill r">stop -' + a.stop_pct + '%</span><span class="pill g">trail ' + a.trail_pct + "%</span></div>";
    }
    return h + "</div>";
  }

  /* ---------- screens ---------- */
  function home() {
    var s = st(), ch = S.data["chart/" + S.range + ".json"], hasTrade = (s.positions || []).length || (ch && ch.marks && ch.marks.length);
    var bal = money(s.balance), h = '<div class="bal"><div class="big">' + odo(bal, S.prevBal) + "</div>" + (s.mode === "PAPER" ? '<span class="paper">PAPER</span>' : "") + "</div>";
    S.prevBal = bal;
    h += '<div class="today"><span class="' + (s.today_pct >= 0 ? "up" : "dn") + '">' + pct(s.today_pct) + '</span><span class="sec" style="font-weight:400">today</span><span class="mult">' + Number(s.multiplier).toFixed(2) + "×</span></div>";
    h += '<div class="chartwrap"><canvas id="line"></canvas>' + (hasTrade ? "" : '<div class="emp">Waiting for the first trade</div>') + "</div>";
    h += '<div class="ranges">' + ["LIVE", "1H", "4H", "1D", "1W", "ALL"].map(function (r) { return '<button data-range="' + r + '" class="' + (r === S.range ? "on" : "") + '">' + r + "</button>"; }).join("") + "</div>";
    var running = AG.filter(function (a) { return s.agents[a[0]].running; }).length;
    h += '<div class="sech">Agents · ' + running + ' running</div><div class="car">' + AG.map(function (a) { return agentCard(a[0], s.agents[a[0]]); }).join("") + "</div>";
    var act = (S.data["activity/1.json"] || { items: [] }).items.slice(0, 5);
    h += '<div class="sech">Activity<button data-tab="activity">See all</button></div>' + actList(act);
    return h;
  }
  function actList(items) {
    if (!items.length) return '<div class="list"><div class="empty">Nothing yet tonight</div></div>';
    return '<div class="list">' + items.map(function (a) {
      var col = a.kind === "sold" && /^\+/.test(a.value || "") ? "up" : a.kind === "stopped" || (a.kind === "sold" && /^-/.test(a.value || "")) ? "dn" : "";
      var tgt = a.kind === "rejected" ? 'data-audit="' + esc(a.mint) + '"' : 'data-coin="' + esc(a.mint) + '"';
      return '<a href="#" class="li" ' + tgt + '><div class="l"><div class="t">' + esc(a.title) + '</div><div class="s">' + esc(a.subtitle) + (a.kind === "bought" ? "" : " · " + hm(a.ts)) +
        '</div></div><div class="r ' + col + '">' + esc(a.value) + (a.value2 ? "<small>" + esc(a.value2) + "</small>" : "") + "</div></a>";
    }).join("") + "</div>";
  }
  function agentsTab() {
    var s = st(), h = "";
    AG.forEach(function (a) {
      var c = s.agents[a[0]], d = S.data["agents/" + a[0] + ".json"], locked = a[0] === "risk" && c.locked;
      h += '<div class="card"><h4><span style="display:flex;align-items:center;gap:8px"><i style="width:8px;height:8px;border-radius:50%;background:' + (c.running ? "#00d35a" : "rgba(235,235,245,.3)") + '"></i><span style="color:' + a[2] + '">' + a[1] + (a[0] === "analyst" && c.mode === "rules" ? " (rules)" : "") + "</span></span>" +
        '<span class="sw' + (c.paused ? " off" : "") + '" title="' + (locked ? "Locked while a position is open" : "Pause or resume from Telegram") + '"></span></h4>' +
        '<div class="sec sm">' + (c.paused ? "paused" : c.running ? "running" : "starting") + " · " + c.count + " today" + (locked ? " · locked while a position is open" : "") + " · switch via Telegram (pause " + a[1] + ")</div>";
      var rows = d ? d.decisions : null;
      if (!rows) h += skel([40, 40]);
      else if (!rows.length) h += '<div class="empty">' + (a[0] === "scanner" ? "Listening for graduations" : "Nothing yet tonight") + "</div>";
      else h += '<div class="mt">' + rows.map(function (r) { return '<div class="frow' + (r.verdict === "kill" || r.verdict === "rejected" ? " kill" : "") + '"><div class="l"><span class="sec">' + hm(r.ts) + "</span> " +
        '<a href="#" data-coin="' + esc(r.mint) + '">' + esc(r.coin) + "</a> " + ext(r.coin_url, "FOMO ›", "sec sm") + '</div><div class="r">' + esc(r.verdict === "pass" ? "→ auditor" : r.reason) + "</div></div>"; }).join("") + "</div>";
      h += '<a href="#" class="sec sm" data-settings="' + a[0] + '" style="display:inline-flex;min-height:44px;align-items:center;color:var(--blue)">Settings ›</a></div>';
    });
    return h;
  }
  function activityTab() {
    var items = []; for (var i = 1; i <= S.actPages; i++) { var p = S.data["activity/" + i + ".json"]; if (p) items = items.concat(p.items); }
    var p1 = S.data["activity/1.json"];
    var more = p1 && S.actPages < p1.pages ? '<button class="btnw" style="background:var(--c1);color:#fff" data-more>Load more</button>' : "";
    return '<div class="sech">Activity</div>' + actList(items) + more;
  }
  function auditorScreen() {
    var mint = S.screen.mint || (st().agents.auditor.current || {}).mint, a = mint ? S.data["audit/" + mint + ".json"] : null, h = '<button class="back" data-back>‹ Back</button>';
    if (!mint) return h + '<div class="sech">Auditor</div><div class="card"><div class="empty">No coin taken apart yet</div></div>';
    if (!a) return h + (S.failed["audit/" + mint + ".json"] ? '<div class="card"><div class="empty">No coin taken apart yet</div></div>' : skel([300, 380]));
    var shown = S.animated[mint] == null ? (RM ? a.layers.length : 0) : S.animated[mint];
    h += '<div class="sech">' + esc(a.name || mint.slice(0, 6)) + '<span class="sec" style="font:400 15px var(--text)">' + esc(a.symbol || "") + "</span></div>";
    h += '<div class="discs" id="discs">' + [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { var l = a.layers[i], cl = l && i < shown ? (l.pass === null ? "skip" : l.pass ? "ok" : "bad") : "";
      return '<div class="disc ' + cl + '" data-i="' + i + '">' + (cl === "ok" ? "✓" : cl === "bad" ? "✕" : i + 1) + "</div>"; }).join("") + "</div>";
    var done = a.pass != null && shown >= a.layers.length;
    h += '<div class="verdict" id="verdict">' + (!done ? '<b class="sec">taking apart...</b>' : a.pass ? '<b class="up">Cleared · 8/8 parts</b><div>' + (a.sent_size ? "Sent to Executor · " + money(a.sent_size) : "Sent to Executor") + "</div>"
      : '<b class="dn">Rejected · ' + esc(a.reason) + "</b><div>Grok Bot won't buy " + esc(a.name || "this coin") + "</div>") + "</div>";
    h += '<div class="list">' + [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { var l = a.layers[i], ok = l && i < shown;
      return '<div class="vrow ' + (!l ? "nc" : !ok ? "nc" : l.pass ? "ok" : l.pass === false ? "bad" : "nc") + '" data-v="' + i + '"><div class="k">' + (i + 1) + "</div><div>" + esc(l ? l.name : LN[i]) + '</div><div class="v">' + esc(l && ok ? l.value : l ? "…" : "not checked") + "</div></div>"; }).join("") + "</div>";
    h += '<div class="card mt" style="display:flex;align-items:center;justify-content:space-between"><span>Take apart before buying</span><span class="sw' + (a.enabled ? "" : " off") + '" title="Change via Telegram: set auditor enabled to on/off"></span></div>';
    h += ext(a.coin_url, "Open on FOMO", "btnw");
    return h;
  }
  function beam() {
    // cyan beam 350ms per layer top to bottom, then 150ms to green/red; only layers the desk has sent
    if (!S.screen || S.screen.type !== "auditor") return;
    var mint = S.screen.mint || (st().agents.auditor.current || {}).mint, a = S.data["audit/" + mint + ".json"]; if (!a) return;
    if (S.animated[mint] == null) S.animated[mint] = RM ? a.layers.length : 0;
    if (S.beaming) return;
    (function step() {
      var i = S.animated[mint]; if (i >= a.layers.length || !document.getElementById("discs")) { S.beaming = false; if (i >= a.layers.length) render(); return; }
      S.beaming = true; var d = document.querySelector('.disc[data-i="' + i + '"]'); if (d) d.className = "disc beam";
      setTimeout(function () { var l = a.layers[i]; if (d) { d.className = "disc " + (l.pass === null ? "skip" : l.pass ? "ok" : "bad"); d.textContent = l.pass === null ? String(i + 1) : l.pass ? "✓" : "✕"; }
        var v = document.querySelector('.vrow[data-v="' + i + '"]'); if (v) { v.className = "vrow " + (l.pass ? "ok" : "bad"); v.querySelector(".v").textContent = l.value; }
        setTimeout(function () { S.animated[mint] = i + 1; step(); }, 150); }, 350);
    })();
  }
  function coinScreen() {
    var mint = S.screen.mint, c = S.data["coin/" + mint + ".json"], h = '<button class="back" data-back>‹ Back</button>', s = st();
    if (!c) {
      if (S.failed["coin/" + mint + ".json"]) { var k = (s.coins || []).filter(function (x) { return x.mint === mint; })[0];
        return h + '<div class="sech">' + esc((k && k.name) || mint.slice(0, 8)) + '</div><div class="card"><div class="empty">The desk hasn\'t worked on this coin tonight</div></div>' + (k ? ext(k.coin_url, "Buy on FOMO", "btnw") : ""); }
      return h + skel([60, 50, 260, 120, 52]);
    }
    var p = c.position && c.position.status !== "closed" ? c.position : null;
    h += '<div class="sech" style="padding-bottom:2px">' + esc(c.name || mint.slice(0, 8)) + (s.mode === "PAPER" ? '<span class="paper" style="margin-top:0">PAPER</span>' : "") + "</div>";
    h += '<div class="pad sec" style="display:flex;align-items:center;gap:8px;font-size:15px">' + esc(c.symbol || "") + " · " + esc(c.chain) + " · " + age(c.migrated_at) +
      (c.shield != null ? '<span class="chip' + (c.shield < 8 ? " bad" : "") + '">🛡 ' + c.shield + "/8</span>" : "") + "</div>";
    h += '<div class="price">' + px(c.price) + "</div>";
    if (p) h += '<div class="pad ' + (p.pct >= 0 ? "up" : "dn") + '" style="font-weight:600">' + (p.pct >= 0 ? "▲ " : "▼ ") + Math.abs(p.pct).toFixed(2) + "% since entry</div>";
    h += '<div class="chartwrap pad"><canvas id="candles"></canvas></div>';
    h += '<div class="stats"><div><span>Market cap</span><b>' + kusd(c.stats.mcap) + "</b></div><div><span>Liquidity</span><b>" + kusd(c.stats.liq) + "</b></div><div><span>24h volume</span><b>" + kusd(c.stats.vol_h24) +
      "</b></div><div><span>Holders</span><b>" + (c.stats.holders == null ? "n/a" : c.stats.holders) + "</b></div></div>";
    if (p) {
      h += '<div class="card mt"><h4>Your position<span class="sec" style="font-weight:400">' + money(p.size) + " in · Executor</span></h4>" + '<div class="sec sm">Entry ' + px(p.entry) + " · now " + pct(p.pct) + "</div></div>";
      var tl = p.timeout_left_s, tls = Math.floor(tl / 3600) + "h " + Math.floor(tl % 3600 / 60) + "m";
      h += '<div class="card"><h4>Exit</h4><div class="frow"><div class="l">Stop line · -' + p.stop_pct + '%</div><div class="r">' + px(p.stop_line) + '</div></div><div class="frow"><div class="l">Trail line</div><div class="r">' +
        (p.trail_line ? px(p.trail_line) : "arms at " + px(p.trail_start_line)) + '</div></div><div class="frow"><div class="l">Time left to timeout</div><div class="r">' + tls + "</div></div></div>";
    } else if (c.position && c.position.status === "closed") {
      h += '<div class="card mt"><h4>Closed<span class="' + (c.position.pnl_closed >= 0 ? "up" : "dn") + '">' + money(c.position.pnl_closed) + "</span></h4><div class=\"sec sm\">" + esc(c.position.reason) + " · " + pct(c.position.pct_closed) + "</div></div>";
    }
    h += ext(c.coin_url, p ? "Sell on FOMO" : "Buy on FOMO", "btnw" + (p ? " sell" : ""));
    return h;
  }
  function accountTab() {
    var a = S.data["account.json"], g = S.data["settings.json"];
    if (!a) return skel([60, 120, 300]);
    var h = '<div class="sech">Account</div><div class="list">' +
      '<div class="li"><div class="l"><div class="t">Mode</div></div><div class="r">' + (a.mode === "PAPER" ? '<span class="paper" style="margin:0">PAPER</span>' : "LIVE") + "</div></div>" +
      '<div class="li"><div class="l"><div class="t">Stack</div><div class="s">free ' + money(a.free) + '</div></div><div class="r">' + money(a.stack) + "</div></div>" +
      (a.profile_url ? '<a class="li" href="' + esc(a.profile_url) + '" target="_blank" rel="noopener"><div class="l"><div class="t">Your FOMO profile</div><div class="s">@' + esc(a.fomo_handle) + '</div></div><span class="chev">›</span></a>' : "") +
      '<a class="li" href="#" data-invite="' + esc(a.signup_url) + '"><div class="l"><div class="t">Invite a friend</div><div class="s">10% off their fees for life</div></div><span class="chev">›</span></a>' +
      '<div class="li"><div class="l"><div class="t">Telegram</div><div class="s">' + esc(a.telegram.bot) + '</div></div><div class="r ' + (a.telegram.connected ? "up" : "dn") + '">' + (a.telegram.connected ? "connected" : "not connected") + "</div></div>" +
      '<div class="li"><div class="l"><div class="t">Web push</div></div><div class="r sec">' + esc(a.webpush) + "</div></div>" +
      '<div class="li"><div class="l"><div class="t">Hosting</div></div><div class="r sec">' + esc(a.hosting) + "</div></div></div>";
    if (!g) return h + skel([300]);
    h += '<div class="grp">Settings are read-only on plan B. Change them in Telegram, e.g. “set stop to -8%”.</div>';
    var GN = { scanner: "Scanner", auditor: "Auditor", analyst: "Analyst", executor: "Executor", risk: "Risk", desk: "Desk" };
    Object.keys(GN).forEach(function (k) {
      var rows = g.groups[k] || []; if (!rows.length) return;
      h += '<div class="grp" id="set-' + k + '">' + GN[k] + "</div><div class=\"list\">" + rows.map(function (r) {
        var v = r.value, num = typeof v === "number";
        return '<div class="set"><label>' + esc(r.name) + "</label>" + (num && r.min != null ? '<input type="range" disabled min="' + r.min + '" max="' + r.max + '" step="any" value="' + v + '">' : "") +
          '<span class="val">' + esc(typeof v === "boolean" ? (v ? "on" : "off") : v) + "</span></div>"; }).join("") + "</div>";
    });
    return h;
  }
  function pushesScreen() {
    var ps = st().pushes || [];
    return '<button class="back" data-back>‹ Back</button><div class="sech">Pushes</div>' + (ps.length ? '<div class="list">' + ps.map(function (p) {
      return '<div class="li"><div class="l"><div class="t" style="white-space:normal">' + esc(p.text) + '</div><div class="s">' + hm(p.ts) + "</div></div>" + ext(p.link, "FOMO ›", "sec sm") + "</div>"; }).join("") + "</div>" : '<div class="list"><div class="empty">Nothing yet tonight</div></div>');
  }
  function searchResults() {
    var q = (S.search || "").trim().toLowerCase(); if (!q) return '<div class="empty">Search by name, symbol or mint</div>';
    var r = (st().coins || []).filter(function (c) { return (c.name || "").toLowerCase().indexOf(q) > -1 || (c.symbol || "").toLowerCase().indexOf(q) > -1 || c.mint.toLowerCase() === q; }).slice(0, 30);
    return r.length ? '<div class="list">' + r.map(function (c) { return '<a href="#" class="li" data-coin="' + esc(c.mint) + '"><div class="l"><div class="t">' + esc(c.name || c.mint.slice(0, 8)) + '</div><div class="s">' + esc(c.symbol || "") + " · " + esc(c.mint.slice(0, 6)) + "…</div></div><span class=\"chev\">›</span></a>"; }).join("") + "</div>"
      : '<div class="empty">No coin on the desk matches “' + esc(S.search) + "”</div>";
  }

  function navbar() {
    var s = st(), a = S.data["account.json"], seen = +(localStorage.getItem(SEEN) || 0), unread = s && (s.pushes || []).some(function (p) { return p.id > seen; });
    if (S.search != null) {
      nav.innerHTML = '<input id="q" type="search" placeholder="Name, symbol or mint" value="' + esc(S.search) + '" autocomplete="off"><button class="ic" data-act="closesearch" style="width:auto;color:var(--blue)">Cancel</button>';
      var q = document.getElementById("q"); q.oninput = function () { S.search = q.value; view.innerHTML = searchResults(); }; return;
    }
    var letter = ((a && a.fomo_handle) || "G").replace("@", "")[0].toUpperCase();
    nav.innerHTML = '<button class="av" data-tab="account" aria-label="Account">' + esc(letter) + '</button><button class="ttl" data-tab="home">Grok Bot<span>›</span></button>' +
      '<button class="ic" data-act="search" aria-label="Search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>' +
      '<button class="ic" data-act="bell" aria-label="Pushes"><svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>' + (unread ? '<span class="dot"></span>' : "") + "</button>";
  }
  function render() {
    offRow();
    document.querySelectorAll("#tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === S.tab && !S.screen); });
    if (!BASE) { nav.innerHTML = '<div class="ttl">Grok Bot</div>'; view.innerHTML = '<div class="card mt"><div class="empty">Open the desk once from your private link (it ends in #d=…). It stays on this phone after that.</div></div>'; return; }
    navbar();
    if (S.search != null) { view.innerHTML = searchResults(); return; }
    if (!st()) { view.innerHTML = skel([80, 30, 220, 36, 300, 200]); return; }
    var h;
    if (S.screen) h = { coin: coinScreen, auditor: auditorScreen, pushes: pushesScreen }[S.screen.type]();
    else h = { home: home, agents: agentsTab, activity: activityTab, account: accountTab }[S.tab]();
    view.innerHTML = h;
    runOdo(); draw(); beam();
  }
  function draw() {
    var cv = document.getElementById("line");
    if (cv) {
      var ch = S.data["chart/" + S.range + ".json"], n = ch ? ch.points.length : 0, prev = S.prevPts[S.range], newMarks = ch && S.prevMarks[S.range] != null && ch.marks.length > S.prevMarks[S.range];
      S.prevPts[S.range] = n; S.prevMarks[S.range] = ch ? ch.marks.length : 0;
      var t0 = performance.now(), slide = prev != null && n > prev && !RM;
      (function f(t) { var k = Math.min(1, (t - t0) / 250), ma = newMarks && !RM ? Math.min(1, (t - t0) / 200) : 1;
        window.DeskChart.line(cv, ch, { slide: slide ? k : 1, markAlpha: ma }); if ((slide && k < 1) || ma < 1) requestAnimationFrame(f); })(t0);
    }
    var cc = document.getElementById("candles");
    if (cc) { var c = S.data["coin/" + S.screen.mint + ".json"], p = c && c.position && c.position.status === "open" ? c.position : null; window.DeskChart.candles(cc, c && c.candles, p && p.exit_line, p && p.entry); }
    document.querySelectorAll("canvas[data-ring]").forEach(function (r) { var v = r.dataset.ring; window.DeskChart.ring(r, v === "" ? null : +v, +r.dataset.min, 120); });
  }
  function toast(t) { var el = document.getElementById("toast"); el.textContent = t; el.hidden = false; setTimeout(function () { el.hidden = true; }, 1800); }

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-tab],[data-coin],[data-audit],[data-agent],[data-back],[data-act],[data-range],[data-more],[data-invite],[data-settings]"); if (!t) return;
    ev.preventDefault();
    var ds = t.dataset;
    if (ds.coin) { S.search = null; S.screen = { type: "coin", mint: ds.coin, prev: S.screen }; }
    else if (ds.audit) S.screen = { type: "auditor", mint: ds.audit, prev: S.screen };
    else if (ds.agent) { if (ds.agent === "auditor") S.screen = { type: "auditor", mint: null, prev: S.screen }; else { S.tab = "agents"; S.screen = null; } }
    else if (t.hasAttribute("data-back")) S.screen = S.screen && S.screen.prev || null;
    else if (ds.range) S.range = ds.range;
    else if (t.hasAttribute("data-more")) S.actPages++;
    else if (ds.settings) { S.tab = "account"; S.screen = null; setTimeout(function () { var el = document.getElementById("set-" + ds.settings); if (el) el.scrollIntoView(); }, 600); }
    else if (ds.invite) {
      var u = ds.invite;   // SIGNUP_URL exactly as links.py returned it
      if (navigator.share) navigator.share({ title: "FOMO", url: u }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { toast("Link copied"); });
      return;
    }
    else if (ds.act === "search") S.search = "";
    else if (ds.act === "closesearch") S.search = null;
    else if (ds.act === "bell") { var ps = st() && st().pushes || []; if (ps.length) localStorage.setItem(SEEN, String(ps[0].id)); S.screen = { type: "pushes", prev: S.screen }; }
    else if (ds.tab) { S.tab = ds.tab; S.screen = null; S.search = null; }
    render(); window.scrollTo(0, 0); load();
  });
  window.addEventListener("resize", draw);
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
  window.__desk = S;
  render(); load();
})();
