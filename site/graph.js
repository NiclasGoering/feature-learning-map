/* Feature-learning map: the graph page. Each dot is a result: one mechanism
   label (or, for results whose mechanism was not analysed, one computed
   quantity) in one limit, gathering every result in the map that shows it.
   Limits are regions on a schematic plane (data per width across, kernel
   movement up); inside a region, dots cluster by type of feature learning.
   Lines join results that the same paper shows. Clicking a dot lists the
   statements and the papers; clicking a paper lists its results.
   Called from app.js once data.json is loaded: window.FLGraph.init(data, helpers).
   Needs d3 (v7). */
(function () {
  "use strict";

  // Virtual canvas. Columns: P fixed | P ∝ N | high-dim. Rows: κ = O(1) | 1/N | κ → 0 | finite N.
  var W = 1600, H = 1060;
  var COLS = [
    { x: 0, w: 560, label: "P fixed  (P/N → 0)" },
    { x: 560, w: 440, label: "P ∝ N" },
    { x: 1000, w: 600, label: "P ∼ Dᵏ  (high-dimensional)" }
  ];
  var ROWS = [
    { y: 0, h: 340, label: "κ = O(1): mean field, μP" },
    { y: 340, h: 230, label: "1/N corrections" },
    { y: 570, h: 230, label: "κ → 0: kernel" },
    { y: 800, h: 260, label: "finite N" }
  ];
  var REGIONS = [
    { id: "mf", label: "Mean field / μP, fixed P", sub: "R3–R5", x: 0, y: 0, w: 560, h: 340 },
    { id: "mfprop", label: "Mean field / μP, P ∝ N", sub: "R3′ · almost empty: op-07", x: 560, y: 0, w: 440, h: 340, frontier: true },
    { id: "1/N", label: "Large width, 1/N", sub: "R2", x: 0, y: 340, w: 560, h: 230 },
    { id: "prop", label: "Standard scaling, P ∝ N", sub: "R1 · kernel renormalisation", x: 560, y: 340, w: 440, h: 460 },
    { id: "kernel", label: "Infinite width, kernel", sub: "R0 · NNGP, NTK", x: 0, y: 570, w: 560, h: 230 },
    { id: "hd", label: "High-dimensional, P ∼ Dᵏ", sub: "R6 · teacher–student, single- and multi-index", x: 1000, y: 0, w: 600, h: 1060 },
    { id: "exact", label: "Finite width, no limit", sub: "exact or non-asymptotic", x: 0, y: 800, w: 760, h: 260 },
    { id: "depth", label: "Infinite depth", sub: "L → ∞", x: 760, y: 800, w: 240, h: 260 }
  ];
  var REGION = {};
  REGIONS.forEach(function (r) { REGION[r.id] = r; });

  // A result goes to the first of its width/limit values in this order.
  var WIDTH_ORDER = ["inf-meanfield-propP", "finite-proportional", "inf-meanfield-fixedP", "large-width-1/N",
    "inf-depth", "high-dim", "inf-kernel", "finite-exact"];
  var WIDTH_REGION = {
    "inf-meanfield-propP": "mfprop", "finite-proportional": "prop", "inf-meanfield-fixedP": "mf",
    "large-width-1/N": "1/N", "inf-depth": "depth", "high-dim": "hd", "inf-kernel": "kernel", "finite-exact": "exact"
  };
  var NA_CLUSTER = "none";   // results whose mechanism was not analysed
  var HEAD = 46;             // room for a region's title

  var D, h, svg, root, zoom, sim, nodes, links, ops, hubs, papers, byBase;
  var panel, scrim, tip, query = "";

  function regionOf(view) {
    var w = view.width_limit || [];
    for (var i = 0; i < WIDTH_ORDER.length; i++) if (w.indexOf(WIDTH_ORDER[i]) >= 0) return WIDTH_REGION[WIDTH_ORDER[i]];
    return "exact";
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }
  function shortName(p) { return p.first_author + " " + p.year; }
  function cite(p) { return h.authorShort(p) + " " + p.year; }

  function wrap(s, max) {
    var out = [], line = "";
    s.split(" ").forEach(function (w) {
      if (line && (line + " " + w).length > max) { out.push(line); line = w; }
      else line = line ? line + " " + w : w;
    });
    if (line) out.push(line);
    return out;
  }

  // ------------------------------------------------------------- build model

  function model() {
    var byId = {};
    nodes = [];
    papers = {};
    byBase = {};
    D.papers.forEach(function (p) {
      var info = { p: p, nodes: [], hay: (p.title + " " + p.authors.join(" ") + " " + p.id + " " + p.year).toLowerCase() };
      papers[p.key] = info;
      byBase[p.base] = p.key;
      p.results.forEach(function (r) {
        var region = regionOf(r.view);
        var label = r.mechanism.label;
        var analysed = label !== "not-analysed";
        var q = (r.quantity || [])[0] || "unknown";
        var id = region + "|" + (analysed ? label : "q:" + q);
        var n = byId[id];
        if (!n) {
          n = byId[id] = {
            id: id, region: region, analysed: analysed, slug: analysed ? label : q,
            name: cap(analysed ? h.lab("mechanism_label", label) : h.lab("quantity", q)),
            items: [], paperKeys: [], types: {}, bayes: false, gd: false
          };
          nodes.push(n);
        }
        n.items.push({ p: p, r: r });
        if (n.paperKeys.indexOf(p.key) < 0) n.paperKeys.push(p.key);
        n.types[r.mechanism.type] = (n.types[r.mechanism.type] || 0) + 1;
        var rules = r.view.learning_rule || [];
        if (rules.indexOf("bayes") >= 0) n.bayes = true;
        if (rules.indexOf("gd") >= 0) n.gd = true;
        if (info.nodes.indexOf(n) < 0) info.nodes.push(n);
      });
    });
    nodes.forEach(function (n) {
      var best = null;
      Object.keys(n.types).forEach(function (t) { if (best === null || n.types[t] > n.types[best]) best = t; });
      n.type = best;
      n.cluster = n.analysed ? best : NA_CLUSTER;
      n.np = n.paperKeys.length;
      n.r = 5 + 2.9 * Math.sqrt(n.np);
    });

    // Two results are linked when one paper shows both.
    var byPair = {};
    links = [];
    Object.keys(papers).forEach(function (k) {
      var ns = papers[k].nodes;
      for (var i = 0; i < ns.length; i++) {
        for (var j = i + 1; j < ns.length; j++) {
          var a = ns[i], b = ns[j];
          var key = a.id < b.id ? a.id + "~" + b.id : b.id + "~" + a.id;
          var l = byPair[key];
          if (!l) { l = byPair[key] = { source: a, target: b, papers: [] }; links.push(l); }
          l.papers.push(k);
        }
      }
    });

    // Clusters inside a region: type of feature learning, in vocabulary order.
    var typeOrder = Object.keys(h.vocab.mechanism_type.values).concat([NA_CLUSTER]);
    hubs = [];
    REGIONS.forEach(function (reg) {
      var members = nodes.filter(function (n) { return n.region === reg.id; });
      var names = typeOrder.filter(function (t) { return members.some(function (n) { return n.cluster === t; }); });
      var k = names.length;
      if (!k) return;
      var iw = reg.w - 24, ih = reg.h - HEAD - 12;
      var cols = Math.max(1, Math.min(k, Math.round(Math.sqrt(k * iw / ih))));
      var rows = Math.ceil(k / cols);
      names.forEach(function (name, i) {
        var c = i % cols, r = Math.floor(i / cols);
        var cw = iw / cols, ch = ih / rows;
        var label = name === NA_CLUSTER ? "mechanism not analysed" : h.lab("mechanism_type", name);
        var lines = wrap(label, Math.max(12, Math.floor(cw / 7.6)));
        var x0 = reg.x + 12 + cw * c, y0 = reg.y + HEAD + ch * r;
        var hub = {
          region: reg.id, name: name, lines: lines,
          x0: x0, x1: x0 + cw, y0: y0 + 6 + lines.length * 14, y1: y0 + ch,
          x: x0 + cw / 2, top: y0 + 2
        };
        hub.y = (hub.y0 + hub.y1) / 2;
        hubs.push(hub);
        members.filter(function (n) { return n.cluster === name; })
          .sort(function (a, b) { return b.np - a.np; })
          .forEach(function (n, j) {
            n.hub = hub;
            var a = j * 2.39996, d = 14 * Math.sqrt(j + 0.5);
            n.x = hub.x + d * Math.cos(a);
            n.y = hub.y + d * Math.sin(a);
          });
      });
    });

    ops = (D.open_problems || []).map(function (o) {
      var ns = [];
      o.papers.forEach(function (k) {
        (papers[k] ? papers[k].nodes : []).forEach(function (n) { if (ns.indexOf(n) < 0) ns.push(n); });
      });
      return { o: o, members: ns };
    }).filter(function (x) { return x.members.length; });
  }

  // A dot stays inside its cluster's cell, below the cluster label.
  function clamp(n) {
    var c = n.hub, pad = n.r + 3;
    n.x = Math.max(c.x0 + pad, Math.min(c.x1 - pad, n.x));
    n.y = Math.max(c.y0 + pad, Math.min(c.y1 - pad, n.y));
  }

  // An open problem sits among its results in the region that holds most of them.
  function placeOps() {
    ops.forEach(function (op) {
      var count = {}, best = null;
      op.members.forEach(function (n) {
        count[n.region] = (count[n.region] || 0) + 1;
        if (best === null || count[n.region] > count[best]) best = n.region;
      });
      var here = op.members.filter(function (n) { return n.region === best; });
      var x = 0, y = 0;
      here.forEach(function (n) { x += n.x; y += n.y; });
      op.region = best;
      op.x = x / here.length;
      op.y = y / here.length;
    });
    for (var it = 0; it < 30; it++) {
      for (var i = 0; i < ops.length; i++) {
        for (var j = i + 1; j < ops.length; j++) {
          var a = ops[i], b = ops[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          if (d < 40) {
            var push = (40 - d) / 2;
            a.x -= dx / d * push; a.y -= dy / d * push;
            b.x += dx / d * push; b.y += dy / d * push;
          }
        }
      }
    }
    ops.forEach(function (op) {
      var reg = REGION[op.region];
      op.x = Math.max(reg.x + 14, Math.min(reg.x + reg.w - 44, op.x));
      op.y = Math.max(reg.y + HEAD + 8, Math.min(reg.y + reg.h - 12, op.y));
    });
  }

  // ------------------------------------------------------------------ render

  function render(box) {
    sim = d3.forceSimulation(nodes)
      .force("x", d3.forceX(function (n) { return n.hub.x; }).strength(0.06))
      .force("y", d3.forceY(function (n) { return n.hub.y; }).strength(0.06))
      .force("collide", d3.forceCollide(function (n) { return n.r + 7; }).iterations(3))
      .stop();
    for (var i = 0; i < 320; i++) { sim.tick(); nodes.forEach(clamp); }
    placeOps();

    svg = d3.select(box).append("svg")
      .attr("viewBox", [-70, -46, W + 84, H + 56].join(" "))
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("class", "gr-svg")
      .attr("role", "img")
      .attr("aria-label", "Results placed by limit, " + nodes.length + " dots");
    root = svg.append("g");

    var ax = root.append("g").attr("class", "gr-axes");
    COLS.forEach(function (c) {
      ax.append("text").attr("class", "gr-axis").attr("x", c.x + c.w / 2).attr("y", -20).attr("text-anchor", "middle").text(c.label);
    });
    ROWS.forEach(function (r) {
      ax.append("text").attr("class", "gr-axis")
        .attr("transform", "translate(-26," + (r.y + r.h / 2) + ") rotate(-90)")
        .attr("text-anchor", "middle").text(r.label);
    });
    ax.append("text").attr("class", "gr-axis-arrow").attr("x", W / 2).attr("y", -36).attr("text-anchor", "middle").text("more data per width →");
    ax.append("text").attr("class", "gr-axis-arrow").attr("transform", "translate(-52,570) rotate(-90)")
      .attr("text-anchor", "middle").text("kernel moves more →");

    var rg = root.append("g").attr("class", "gr-regions").selectAll("g").data(REGIONS).join("g");
    rg.append("rect").attr("class", function (r) { return "gr-region" + (r.frontier ? " frontier" : ""); })
      .attr("x", function (r) { return r.x + 3; }).attr("y", function (r) { return r.y + 3; })
      .attr("width", function (r) { return r.w - 6; }).attr("height", function (r) { return r.h - 6; });
    rg.append("text").attr("class", "gr-rlabel").attr("x", function (r) { return r.x + 14; }).attr("y", function (r) { return r.y + 23; })
      .text(function (r) { return r.label; });
    rg.append("text").attr("class", "gr-rsub").attr("x", function (r) { return r.x + 14; }).attr("y", function (r) { return r.y + 40; })
      .text(function (r) {
        var nr = nodes.filter(function (x) { return x.region === r.id; }).reduce(function (s, x) { return s + x.items.length; }, 0);
        return r.sub + " · " + plural(nr, "result");
      });

    var hg = root.append("g").attr("class", "gr-hubs");
    hubs.forEach(function (hb) {
      var t = hg.append("text").attr("class", "gr-hub" + (hb.name === NA_CLUSTER ? " na" : "")).attr("text-anchor", "middle");
      hb.lines.forEach(function (line, i) { t.append("tspan").attr("x", hb.x).attr("y", hb.top + 12 + 14 * i).text(line); });
    });

    var lg = root.append("g").attr("class", "gr-links");
    links.forEach(function (l) {
      l.el = lg.append("line").attr("class", "gr-link").attr("stroke-width", Math.min(4, 0.5 + 0.5 * l.papers.length)).node();
    });

    var og = root.append("g").attr("class", "gr-ops");
    ops.forEach(function (op) {
      var g = og.append("g").attr("class", "gr-op").attr("tabindex", 0).attr("role", "button")
        .attr("aria-label", "Open problem " + op.o.rank + ": " + op.o.title);
      g.append("path").attr("d", "M0,-9L9,0L0,9L-9,0Z");
      g.append("text").attr("x", 12).attr("y", 4).text(op.o.id);
      g.on("mouseenter", function (ev) { if (panel.hidden) mark(op.members, null); tipFor(opTip(op), ev); })
        .on("mousemove", function (ev) { moveTip(ev); })
        .on("mouseleave", function () { hideTip(); if (panel.hidden) mark(null); })
        .on("click", function (ev) { ev.stopPropagation(); openOp(op); })
        .on("keydown", function (ev) { if (ev.key === "Enter") openOp(op); });
      op.el = g.node();
    });

    var ng = root.append("g").attr("class", "gr-nodes");
    nodes.forEach(function (n) {
      var cls = "gr-node " + (n.bayes && n.gd ? "r-both" : n.gd ? "r-gd" : "r-bayes") + (n.analysed ? "" : " na");
      var g = ng.append("g").attr("class", cls).attr("tabindex", 0).attr("role", "button")
        .attr("aria-label", n.name + ", " + REGION[n.region].label + ", " + plural(n.np, "paper"));
      g.append("circle").attr("r", n.r);
      if (n.np > 1) g.append("text").attr("class", "gr-count").attr("y", 4).attr("text-anchor", "middle").text(n.np);
      var t = g.append("text").attr("class", "gr-nlabel" + (n.np >= 4 && n.analysed ? " always" : "")).attr("y", 4);
      wrap(n.name, 22).forEach(function (line, i) { t.append("tspan").attr("x", n.r + 4).attr("dy", i ? 13 : 0).text(line); });
      n.el = g.node();
      g.on("mouseenter", function (ev) { if (panel.hidden) mark([n], n); tipFor(nodeTip(n), ev); })
        .on("mousemove", function (ev) { moveTip(ev); })
        .on("mouseleave", function () { hideTip(); if (panel.hidden) mark(null); })
        .on("click", function (ev) { ev.stopPropagation(); openNode(n); })
        .on("keydown", function (ev) { if (ev.key === "Enter") openNode(n); });
    });

    var drag = d3.drag()
      .on("start", function (ev, n) { if (!ev.active) sim.alphaTarget(0.25).restart(); n.fx = n.x; n.fy = n.y; })
      .on("drag", function (ev, n) { n.fx = ev.x; n.fy = ev.y; })
      .on("end", function (ev, n) { if (!ev.active) sim.alphaTarget(0); n.fx = null; n.fy = null; });
    ng.selectAll("g.gr-node").data(nodes).call(drag);
    sim.on("tick", function () { nodes.forEach(clamp); placeOps(); positions(); });

    // Plain scrolling scrolls the page; pinch (or ⌘/Ctrl + scroll) zooms, dragging pans.
    zoom = d3.zoom().scaleExtent([0.6, 10])
      .filter(function (ev) {
        if (ev.type === "wheel") return ev.ctrlKey || ev.metaKey;
        return !ev.ctrlKey && !ev.button;
      })
      .on("zoom", function (ev) {
        root.attr("transform", ev.transform);
        svg.classed("zoomed", ev.transform.k >= 1.8);
      });
    svg.call(zoom).on("dblclick.zoom", null);
    svg.on("click", function () { if (!panel.hidden) closePanel(); });

    positions();
  }

  function positions() {
    nodes.forEach(function (n) { n.el.setAttribute("transform", "translate(" + n.x.toFixed(1) + "," + n.y.toFixed(1) + ")"); });
    links.forEach(function (l) {
      l.el.setAttribute("x1", l.source.x.toFixed(1)); l.el.setAttribute("y1", l.source.y.toFixed(1));
      l.el.setAttribute("x2", l.target.x.toFixed(1)); l.el.setAttribute("y2", l.target.y.toFixed(1));
    });
    ops.forEach(function (op) { op.el.setAttribute("transform", "translate(" + op.x.toFixed(1) + "," + op.y.toFixed(1) + ")"); });
  }

  // ---------------------------------------------------------- highlighting

  // Light up a set of dots; with a centre, also its neighbours and their lines.
  function mark(set, centre) {
    if (!set) {
      svg.classed("focus", false);
      nodes.forEach(function (x) { x.el.classList.remove("hi", "sel"); });
      links.forEach(function (l) { l.el.classList.remove("hi"); });
      return;
    }
    var on = set.slice();
    if (centre) links.forEach(function (l) {
      if (l.source === centre && on.indexOf(l.target) < 0) on.push(l.target);
      if (l.target === centre && on.indexOf(l.source) < 0) on.push(l.source);
    });
    svg.classed("focus", true);
    nodes.forEach(function (x) {
      x.el.classList.toggle("hi", on.indexOf(x) >= 0);
      x.el.classList.toggle("sel", set.indexOf(x) >= 0);
    });
    links.forEach(function (l) {
      var hi = centre ? (l.source === centre || l.target === centre)
        : (set.indexOf(l.source) >= 0 && set.indexOf(l.target) >= 0);
      l.el.classList.toggle("hi", hi);
    });
  }

  function tipFor(kids, ev) {
    if (!tip) { tip = document.createElement("div"); tip.className = "gr-tip"; document.body.appendChild(tip); }
    tip.innerHTML = "";
    kids.forEach(function (k) { tip.appendChild(k); });
    tip.hidden = false;
    moveTip(ev);
  }
  function hideTip() { if (tip) tip.hidden = true; }

  function nodeTip(n) {
    var names = n.paperKeys.slice(0, 4).map(function (k) { return shortName(papers[k].p); }).join(", ");
    return [
      h.el("div", { class: "t" }, n.name),
      h.el("div", { class: "a" }, REGION[n.region].label + " · " + (n.analysed ? h.lab("mechanism_type", n.type) : "mechanism not analysed")),
      h.el("div", null, plural(n.items.length, "result") + " in " + plural(n.np, "paper") + ": " + names + (n.np > 4 ? ", …" : "")),
      h.el("div", { class: "a" }, "Click for the statements and the papers.")
    ];
  }

  function opTip(op) {
    return [h.el("div", { class: "t" }, op.o.rank + ". " + op.o.title),
      h.el("div", { class: "a" }, "Open problem · click for the papers that touch it")];
  }

  function moveTip(ev) {
    if (!tip || tip.hidden || !ev) return;
    var x = ev.clientX + 14, y = ev.clientY + 14;
    var r = tip.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - 14;
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }

  function applyFilters() {
    var showB = document.getElementById("gr-bayes").checked;
    var showG = document.getElementById("gr-gd").checked;
    var showNA = document.getElementById("gr-na").checked;
    var showOps = document.getElementById("gr-ops").checked;
    var q = query.trim().toLowerCase();
    nodes.forEach(function (n) {
      n.visible = ((showB && n.bayes) || (showG && n.gd)) && (showNA || n.analysed);
      n.el.classList.toggle("off", !n.visible);
      n.match = !!q && (n.name.toLowerCase().indexOf(q) >= 0 ||
        n.paperKeys.some(function (k) { return papers[k].hay.indexOf(q) >= 0; }));
      n.el.classList.toggle("match", n.match);
    });
    svg.classed("searching", !!q);
    links.forEach(function (l) { l.el.classList.toggle("off", !l.source.visible || !l.target.visible); });
    ops.forEach(function (op) { op.el.classList.toggle("off", !showOps); });
  }

  // Zoom so that a set of dots fills the view.
  function centreOn(set) {
    if (!set.length) return;
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    set.forEach(function (n) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); });
    var vb = svg.node().viewBox.baseVal, rect = svg.node().getBoundingClientRect();
    var s = Math.min(rect.width / vb.width, rect.height / vb.height);
    var offX = (rect.width - vb.width * s) / 2;
    // On wide screens the side panel covers the right of the graph: centre in what stays visible.
    var right = Math.min(rect.right, window.innerWidth - (window.innerWidth > 900 ? Math.min(704, window.innerWidth) : 0));
    var cx = vb.x + ((rect.left + Math.max(right, rect.left + 200)) / 2 - rect.left - offX) / s;
    var k = Math.max(1, Math.min(2.4, 0.7 * Math.min(vb.width / (x1 - x0 + 200), vb.height / (y1 - y0 + 200))));
    var t = d3.zoomIdentity.translate(cx, vb.y + vb.height / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    svg.transition().duration(500).call(zoom.transform, t);
  }

  // ----------------------------------------------------------------- panel

  function closePanel() {
    panel.hidden = true;
    scrim.hidden = true;
    mark(null);
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

  function showPanel(kids, hash) {
    hideTip();
    panel.innerHTML = "";
    panel.appendChild(h.el("button", { type: "button", class: "panel-close", onclick: closePanel }, "Close ✕"));
    panel.appendChild(h.el("div", { class: "gr-panel-body" }, kids));
    panel.hidden = false;
    panel.scrollTop = 0;
    scrim.hidden = window.innerWidth > 900;
    history.replaceState(null, "", "#" + hash);
    h.math(panel);
  }

  function nodeButton(n) {
    return h.el("button", { type: "button", class: "linklike gr-nbtn", onclick: function () { openNode(n, true); } },
      n.name + " · " + REGION[n.region].label);
  }

  function paperButton(key) {
    return h.el("button", { type: "button", class: "linklike gr-ptitle", onclick: function () { openPaper(key, true); } },
      papers[key].p.title);
  }

  function openNode(n, centre) {
    mark([n], n);
    if (centre) centreOn([n]);
    var el = h.el;
    var byPaper = {};
    n.items.forEach(function (it) { (byPaper[it.p.key] = byPaper[it.p.key] || []).push(it.r); });
    var keys = n.paperKeys.slice().sort(function (a, b) { return papers[a].p.year - papers[b].p.year; });
    var near = links.filter(function (l) { return l.source === n || l.target === n; })
      .map(function (l) { return { n: l.source === n ? l.target : l.source, k: l.papers.length }; })
      .sort(function (a, b) { return b.k - a.k; });
    var what = n.analysed ? h.desc("mechanism_label", n.slug) : "";
    var elsewhere = nodes.filter(function (x) { return x !== n && x.analysed === n.analysed && x.slug === n.slug; })
      .sort(function (a, b) { return b.np - a.np; });
    showPanel([
      el("p", { class: "gr-kind" }, "Result"),
      el("h2", null, n.name),
      el("div", { class: "authors" }, REGION[n.region].label + " · " +
        (n.analysed ? h.lab("mechanism_type", n.type) : "mechanism not analysed, grouped by what the results compute")),
      what ? el("p", { class: "oneline" }, what) : null,
      el("p", { class: "muted" }, plural(n.items.length, "result") + " in " + plural(n.np, "paper") + ", oldest first."),
      el("h3", null, "Papers that show it"),
      keys.map(function (k) {
        var p = papers[k].p;
        return el("div", { class: "gr-pblock" },
          paperButton(k), el("span", { class: "muted" }, " · " + cite(p)),
          byPaper[k].map(function (r) {
            return el("div", { class: "result-card" },
              el("div", { class: "stmt" }, r.statement),
              el("div", { class: "result-head" }, h.statusPill(r.status), el("span", null, "grade " + h.lab("grade", r.grade)),
                h.sourceLink(r)));
          }));
      }),
      elsewhere.length ? el("h3", null, n.analysed ? "The same mechanism in other limits" : "The same quantity in other limits") : null,
      elsewhere.length ? el("ul", { class: "plain" }, elsewhere.map(function (x) {
        return el("li", null, nodeButton(x), el("span", { class: "muted" }, " (" + plural(x.np, "paper") + ")"));
      })) : null,
      near.length ? el("h3", null, "The same papers also show") : null,
      near.length ? el("ul", { class: "plain" }, near.map(function (x) {
        return el("li", null, nodeButton(x.n), el("span", { class: "muted" }, " (" + plural(x.k, "paper") + ")"));
      })) : null
    ], "r:" + encodeURIComponent(n.id));
  }

  function openPaper(key, centre) {
    var info = papers[key], p = info.p, el = h.el;
    mark(info.nodes, null);
    if (centre) centreOn(info.nodes);
    var nodeOf = {};
    info.nodes.forEach(function (n) { n.items.forEach(function (it) { if (it.p === p) nodeOf[it.r.id] = n; }); });
    var out = (p.relations || []).filter(function (r) { return byBase[r.target]; });
    var inc = [];
    Object.keys(papers).forEach(function (k) {
      (papers[k].p.relations || []).forEach(function (r) { if (r.target === p.base) inc.push({ r: r, s: k }); });
    });
    showPanel([
      el("p", { class: "gr-kind" }, "Paper"),
      el("h2", null, p.title),
      el("div", { class: "authors" }, p.authors.join(", ") + " · " + p.year + " · " + p.venue),
      el("div", { class: "links" },
        el("a", { href: "table.html?p=" + encodeURIComponent(p.key) }, "Full entry in the table"),
        h.extLink(p.links.abs, p.id.indexOf("doi:") === 0 ? "Publisher ↗" : p.id.indexOf("ref:") === 0 ? "Source ↗" : "arXiv ↗")),
      el("p", { class: "oneline" }, p.one_line),
      el("h3", null, "Its results: click one to see who else shows it"),
      p.results.map(function (r) {
        var n = nodeOf[r.id];
        return el("div", { class: "result-card" },
          n ? nodeButton(n) : null,
          el("div", { class: "stmt" }, r.statement),
          el("div", { class: "result-head" }, h.statusPill(r.status), h.sourceLink(r),
            n && n.np > 1 ? el("span", { class: "muted" }, "also in " + plural(n.np - 1, "other paper")) : null));
      }),
      out.length || inc.length ? el("h3", null, "Relations in the map") : null,
      out.length ? el("ul", { class: "plain" }, out.map(function (r) {
        return el("li", null, el("em", null, h.lab("relation_type", r.type) + ": "), paperButton(byBase[r.target]),
          r.note ? el("div", { class: "muted" }, r.note) : null);
      })) : null,
      inc.length ? el("ul", { class: "plain" }, inc.map(function (x) {
        return el("li", null, paperButton(x.s), el("em", null, " " + h.lab("relation_type", x.r.type).toLowerCase() + " this paper"));
      })) : null
    ], "p:" + encodeURIComponent(key));
  }

  function openOp(op) {
    mark(op.members, null);
    var el = h.el;
    var keys = op.o.papers.filter(function (k) { return papers[k]; });
    showPanel([
      el("p", { class: "gr-kind" }, "Open problem"),
      el("h2", null, op.o.rank + ". " + op.o.title),
      el("div", { class: "links" }, el("a", { href: "open-problems.html#" + op.o.id }, "Read it on the open-problems page")),
      el("h3", null, "Papers in the map that touch it"),
      el("ul", { class: "plain" }, keys.map(function (k) {
        return el("li", null, paperButton(k), el("span", { class: "muted" }, " · " + cite(papers[k].p)));
      }))
    ], op.o.id);
  }

  // ------------------------------------------------------------------ init

  function init(data, helpers) {
    D = data;
    h = helpers;
    var box = document.getElementById("graph");
    if (!window.d3) {
      box.appendChild(h.el("p", { class: "muted" }, "The graph needs d3, which did not load."));
      return;
    }
    panel = document.getElementById("panel");
    scrim = document.getElementById("scrim");
    model();
    render(box);
    applyFilters();
    ["gr-bayes", "gr-gd", "gr-na", "gr-ops"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", applyFilters);
    });
    var qi = document.getElementById("gr-q");
    qi.addEventListener("input", function () { query = qi.value; applyFilters(); });
    qi.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter") return;
      var q = query.trim().toLowerCase();
      var hits = Object.keys(papers).filter(function (k) { return q && papers[k].hay.indexOf(q) >= 0; });
      if (hits.length === 1) { openPaper(hits[0], true); return; }
      var hit = nodes.filter(function (n) { return n.match && n.visible; })[0];
      if (hit) openNode(hit, true);
    });
    document.getElementById("gr-fit").addEventListener("click", function () {
      svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
    });
    scrim.addEventListener("click", closePanel);
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !panel.hidden) closePanel(); });
    var want = decodeURIComponent(location.hash.slice(1));
    if (want.indexOf("p:") === 0 && papers[want.slice(2)]) openPaper(want.slice(2), true);
    else if (want.indexOf("r:") === 0) {
      var n = nodes.filter(function (x) { return x.id === want.slice(2); })[0];
      if (n) openNode(n, true);
    } else {
      var op = ops.filter(function (x) { return x.o.id === want; })[0];
      if (op) openOp(op);
    }
  }

  window.FLGraph = { init: init };
})();
