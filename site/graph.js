/* Feature-learning map: the graph page. Two views on one limit plane.
   Statements (the default): one dot per statement, a theorem or established
   physics result that several papers state in different notation; arrows are
   "reduces to" with the limit written on them, red marks disagreements,
   diamonds are open problems. All results: each dot is a result: one mechanism
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
  REGION.rg = { id: "rg", label: "Renormalisation-group layer", sub: "" };   // not drawn as a region; labels RG statements

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
  var VIEW = "statements", STMT = [], sById = {}, arrows = [], sops = [], gS, gR;
  var RGS = [], ALLS = [], rglinks = [], gRG;   // the RG layer: statements with family rg, and their links to the main statements

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
      .attr("data-region", function (r) { return r.id; })
      .text(function (r) { return regionSub(r); });

    gR = root.append("g").attr("class", "gr-rview");
    var hg = gR.append("g").attr("class", "gr-hubs");
    hubs.forEach(function (hb) {
      var t = hg.append("text").attr("class", "gr-hub" + (hb.name === NA_CLUSTER ? " na" : "")).attr("text-anchor", "middle");
      hb.lines.forEach(function (line, i) { t.append("tspan").attr("x", hb.x).attr("y", hb.top + 12 + 14 * i).text(line); });
    });

    var lg = gR.append("g").attr("class", "gr-links");
    links.forEach(function (l) {
      l.el = lg.append("line").attr("class", "gr-link").attr("stroke-width", Math.min(4, 0.5 + 0.5 * l.papers.length)).node();
    });

    var og = gR.append("g").attr("class", "gr-ops");
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

    var ng = gR.append("g").attr("class", "gr-nodes");
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

    srender();
    positions();
  }

  function regionSub(r) {
    if (VIEW === "statements") {
      var ns = STMT.filter(function (x) { return x.region === r.id; }).length;
      return r.sub + " · " + plural(ns, "statement");
    }
    var nr = nodes.filter(function (x) { return x.region === r.id; }).reduce(function (s, x) { return s + x.items.length; }, 0);
    return r.sub + " · " + plural(nr, "result");
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
    smark(null);
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
    var inStmt = [];
    p.results.forEach(function (r) {
      var sid = r.canonical && r.canonical.statement;
      if (sid && sById[sid] && inStmt.indexOf(sById[sid]) < 0) inStmt.push(sById[sid]);
    });
    if (VIEW === "statements") { smark(inStmt, null); if (centre && inStmt.length) centreOn(inStmt); }
    else { mark(info.nodes, null); if (centre) centreOn(info.nodes); }
    var nodeOf = {};
    info.nodes.forEach(function (n) { n.items.forEach(function (it) { if (it.p === p) nodeOf[it.r.id] = n; }); });
    var out = (p.relations || []).filter(function (r) { return byBase[r.target]; });
    var inc = [];
    Object.keys(papers).forEach(function (k) {
      (papers[k].p.relations || []).forEach(function (r) { if (r.target === p.base) inc.push({ r: r, s: k }); });
    });
    var placed = p.results.filter(function (r) { return r.canonical && sById[r.canonical.statement]; }).length;
    showPanel([
      el("p", { class: "gr-kind" }, "Paper"),
      el("h2", null, p.title),
      el("div", { class: "authors" }, p.authors.join(", ") + " · " + p.year + " · " + p.venue),
      el("div", { class: "links" },
        el("a", { href: "table.html?p=" + encodeURIComponent(p.key) }, "Full entry in the table"),
        h.extLink(p.links.abs, p.id.indexOf("doi:") === 0 ? "Publisher ↗" : p.id.indexOf("ref:") === 0 ? "Source ↗" : "arXiv ↗")),
      el("p", { class: "oneline" }, p.one_line),
      ALLS.length ? el("p", { class: "muted" }, placed ? placed + " of its " + plural(p.results.length, "result") + (placed === 1 ? " belongs" : " belong") + " to a statement." :
        "None of its results is placed under a statement yet.") : null,
      el("h3", null, "Its results and the statement each belongs to"),
      p.results.map(function (r) {
        var n = nodeOf[r.id], sn = r.canonical ? sById[r.canonical.statement] : null;
        return el("div", { class: "result-card" },
          sn ? stmtButton(sn.id) : null,
          sn ? el("div", { class: "gr-map" }, el("em", null, "Symbols: "), r.canonical.mapping) : null,
          VIEW === "results" && n ? nodeButton(n) : null,
          el("div", { class: "stmt" }, r.statement),
          el("div", { class: "result-head" }, h.statusPill(r.status), h.sourceLink(r),
            sn ? el("span", { class: "muted" }, "written in " + h.lab("canonical_variables", r.canonical.variables) +
              " · " + h.lab("canonical_approximation", r.canonical.approximation)) : null,
            !sn && ALLS.length ? el("span", { class: "muted" }, "not placed under a statement") : null,
            VIEW === "results" && n && n.np > 1 ? el("span", { class: "muted" }, "also in " + plural(n.np - 1, "other paper")) : null));
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

  // ======================================================== statements view
  // One dot per statement, on the same limit plane. Arrows are `reduces_to`,
  // labelled with the limit; a red ring marks disagreements between papers;
  // diamonds are open problems placed in the free space next to their statements.

  var SR = 12, SK = 4.4;     // dot radius = SR + SK * sqrt(papers)
  var KIND = {
    collapse: { short: "collapse", long: "Collapse: the members' results are one formula, shown equivalent under a mapping of symbols." },
    grouping: { short: "grouping", long: "Grouping: the members share an object or a setting; they are placed together, not shown equal." }
  };

  // The RG layer sits in a column to the right of the limit plane (statements view only).
  var RGCOL = { x: W + 44, w: 330, y: 0, h: H };
  var VB_PLAIN = [-70, -46, W + 84, H + 56], VB_RG = [-70, -46, W + 84 + 380, H + 56];
  var REL = {   // how an RG statement relates to a main statement (statement.links[].relation)
    reproduces: { label: "reproduces", rev: "reproduced by", long: "in the stated limit it is the same formula, under the symbol mapping given" },
    extends: { label: "extends", rev: "extended by", long: "it contains the main statement as a special case or adds an ingredient" },
    contradicts: { label: "contradicts", rev: "contradicted by", long: "the two make incompatible claims about the same object" },
    unrelated: { label: "unrelated", rev: "unrelated", long: "a reader might expect a link, but the objects differ" },
    "reduces-to": { label: "reduces to", rev: "reduced to by", long: "in the limit written, it becomes the main statement" }
  };
  var REL_FWD = { "reproduced-by": "reproduces", "extended-by": "extends", "contradicted-by": "contradicts", unrelated: "unrelated" };
  var REL_ORDER = ["reproduces", "extends", "contradicts", "unrelated"];
  function relLabel(r) { return (REL[r] || { label: r.replace(/-/g, " ") }).label; }
  function relRev(r) { return (REL[r] || { rev: r.replace(/-/g, " ") }).rev; }
  function senseLetter(s) { return s.sense ? "(" + s.sense + ")" : ""; }
  function senseText(s) { return s.sense ? h.lab("rg_sense", s.sense) : ""; }

  // LaTeX in a short label (SVG text cannot hold KaTeX) to plain Unicode.
  var TEX = [
    [/\\alpha/g, "α"], [/\\beta/g, "β"], [/\\gamma/g, "γ"], [/\\kappa/g, "κ"], [/\\eta/g, "η"], [/\\rho/g, "ρ"],
    [/\\sigma/g, "σ"], [/\\lambda/g, "λ"], [/\\varphi/g, "φ"], [/\\phi/g, "φ"], [/\\ell/g, "ℓ"], [/\\mu/g, "μ"],
    [/\\nu/g, "ν"], [/\\infty/g, "∞"], [/\\to/g, "→"], [/\\propto/g, "∝"], [/\\sim/g, "∼"], [/\\ll/g, "≪"],
    [/\\gg/g, "≫"], [/\\le(?:q)?\b/g, "≤"], [/\\ge(?:q)?\b/g, "≥"], [/\\cdot/g, "·"], [/\\times/g, "×"],
    [/\\mathrm\{([^}]*)\}/g, "$1"], [/\\text\{([^}]*)\}/g, "$1"], [/\\,/g, " "], [/\;/g, " "], [/\\!/g, ""],
    [/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2"], [/_\{([^}]*)\}/g, "_$1"], [/\^\{([^}]*)\}/g, "^$1"],
    [/\$/g, ""], [/[{}]/g, ""], [/\\/g, ""]
  ];
  function plainTex(s) {
    TEX.forEach(function (t) { s = s.replace(t[0], t[1]); });
    return s.replace(/\s+/g, " ").trim();
  }
  function clip(s, n) { return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; }

  function smodel() {
    sById = {};
    var mkNode = function (s) {
      var n = {
        s: s, id: s.id, region: WIDTH_REGION[s.width_limit] || "exact", np: s.n_papers,
        r: SR + SK * Math.sqrt(s.n_papers), red: (s.disagreements || []).length
      };
      n.name = plainTex(s.title);
      sById[s.id] = n;
      return n;
    };
    STMT = (D.statements || []).filter(function (s) { return s.family !== "rg"; }).map(mkNode);
    RGS = (D.statements || []).filter(function (s) { return s.family === "rg"; }).map(mkNode);
    RGS.sort(function (a, b) { return (a.s.sense || "z").localeCompare(b.s.sense || "z") || a.id.localeCompare(b.id); });
    RGS.forEach(function (n) { n.rg = true; n.region = "rg"; });
    ALLS = STMT.concat(RGS);
    // Each region lays its statements on a grid (label room below every dot).
    REGIONS.forEach(function (reg) {
      var mem = STMT.filter(function (n) { return n.region === reg.id; });
      var k = mem.length;
      if (!k) return;
      var iw = reg.w - 36, ih = reg.h - HEAD - 18;
      var cols = Math.max(1, Math.min(k, Math.round(Math.sqrt(k * iw / ih * 0.9))));
      cols = Math.min(cols, Math.max(1, Math.floor(iw / 138)));
      var maxCols = Math.max(1, Math.floor(iw / 138));
      var rowH = 2 * d3.max(mem, function (n) { return n.r; }) + 84;
      while (Math.ceil(k / cols) * rowH > ih && cols < Math.min(k, maxCols)) cols++;   // widen until the rows fit
      var rows = Math.ceil(k / cols);
      mem.forEach(function (n, i) {
        var c = i % cols, r = Math.floor(i / cols);
        var inRow = r === rows - 1 ? k - cols * (rows - 1) : cols;     // centre a short last row
        var cw = iw / cols, ch = ih / rows;
        var x0 = reg.x + 18 + (iw - inRow * cw) / 2;
        n.x = x0 + cw * (c + 0.5);
        n.y = reg.y + HEAD + 8 + ch * r + n.r + 8;           // the label hangs below the dot, inside its cell
        n.cw = cw;
      });
    });
    arrows = [];
    STMT.forEach(function (n) {
      (n.s.reduces_to || []).forEach(function (r) {
        var t = sById[r.target];
        if (t) arrows.push({ source: n, target: t, limit: r.limit, short: clip(plainTex(r.limit), 30), conj: !!r.conjectural });
      });
    });
    // Curve each arrow; two arrows between the same pair bend opposite ways.
    arrows.forEach(function (a) {
      var twin = arrows.filter(function (b) { return b !== a && b.source === a.target && b.target === a.source; }).length;
      a.bend = twin ? 0.28 : 0.14;
    });
    // The RG column: one row per RG statement, ordered by sense.
    var top = 86, bottom = H - 24, k = RGS.length;
    RGS.forEach(function (n, i) {
      n.x = RGCOL.x + 52;
      n.y = top + (bottom - top) * (k <= 1 ? 0.5 : (i + 0.5) / k);
    });
    rglinks = [];
    RGS.forEach(function (n) {
      (n.s.links || []).forEach(function (l) {
        var t = sById[l.target];
        if (t) rglinks.push({ source: n, target: t, rel: l.relation, note: l.note });
      });
      (n.s.reduces_to || []).forEach(function (r) {
        var t = sById[r.target];
        if (t) rglinks.push({ source: n, target: t, rel: "reduces-to", note: r.limit });
      });
    });
    smodelOps();
  }

  // Open problems: next to the statements they touch, in free space.
  function smodelOps() {
    sops = [];
    (D.open_problems || []).forEach(function (o) {
      var rel = STMT.filter(function (n) {
        return (n.s.open_problems || []).indexOf(o.id) >= 0 ||
          n.s.papers.some(function (k) { return o.papers.indexOf(k) >= 0; });
      });
      var listed = rel.filter(function (n) { return (n.s.open_problems || []).indexOf(o.id) >= 0; });
      if (listed.length) rel = listed;           // an explicit link beats a shared paper
      if (!rel.length) return;
      sops.push({ o: o, rel: rel });
    });
    sops.forEach(function (op) {
      var count = {}, best = null;
      op.rel.forEach(function (n) {
        count[n.region] = (count[n.region] || 0) + 1;
        if (best === null || count[n.region] > count[best]) best = n.region;
      });
      var here = op.rel.filter(function (n) { return n.region === best; });
      var cx = d3.mean(here, function (n) { return n.x; }), cy = d3.mean(here, function (n) { return n.y; });
      op.region = best; op.cx = cx; op.cy = cy;
    });
    var placed = [];
    sops.sort(function (a, b) { return b.rel.length - a.rel.length; }).forEach(function (op) {
      var reg = REGION[op.region], bestPt = null, bestScore = -Infinity;
      for (var rad = 64; rad <= 300; rad += 28) {
        for (var k = 0; k < 20; k++) {
          var ang = (k / 20) * 2 * Math.PI + rad * 0.013;
          var x = op.cx + rad * Math.cos(ang), y = op.cy + rad * Math.sin(ang);
          if (x < reg.x + 22 || x > reg.x + reg.w - 50 || y < reg.y + HEAD + 12 || y > reg.y + reg.h - 16) continue;
          var gap = Infinity;
          STMT.forEach(function (n) {
            var dx = x - n.x, dy = (y - n.y) * 0.8;               // labels hang below the dot
            gap = Math.min(gap, Math.sqrt(dx * dx + dy * dy) - n.r - 30);
          });
          placed.forEach(function (q) { gap = Math.min(gap, Math.hypot(x - q.x, y - q.y) - 36); });
          var score = Math.min(gap, 40) - rad * 0.04;
          if (score > bestScore) { bestScore = score; bestPt = [x, y]; }
        }
      }
      op.x = bestPt ? bestPt[0] : op.cx + 80;
      op.y = bestPt ? bestPt[1] : op.cy;
      placed.push(op);
    });
  }

  function arrowPath(a) {
    var s = a.source, t = a.target, dx = t.x - s.x, dy = t.y - s.y, d = Math.hypot(dx, dy) || 1;
    var ux = dx / d, uy = dy / d;
    var x1 = s.x + ux * (s.r + 3), y1 = s.y + uy * (s.r + 3), x2 = t.x - ux * (t.r + 6), y2 = t.y - uy * (t.r + 6);
    var mx = (x1 + x2) / 2 - uy * d * a.bend, my = (y1 + y2) / 2 + ux * d * a.bend;
    a.lx = 0.25 * x1 + 0.5 * mx + 0.25 * x2;
    a.ly = 0.25 * y1 + 0.5 * my + 0.25 * y2;
    return "M" + x1.toFixed(1) + "," + y1.toFixed(1) + " Q" + mx.toFixed(1) + "," + my.toFixed(1) + " " + x2.toFixed(1) + "," + y2.toFixed(1);
  }

  function srender() {
    var defs = svg.append("defs");
    defs.append("marker").attr("id", "gr-arrowhead").attr("viewBox", "0 0 10 10").attr("refX", 8).attr("refY", 5)
      .attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto-start-reverse")
      .append("path").attr("d", "M0,0L10,5L0,10z").attr("class", "gr-ahead");
    gS = root.append("g").attr("class", "gr-sview");

    var ag = gS.append("g").attr("class", "gr-arrows");
    arrows.forEach(function (a) {
      var g = ag.append("g").attr("class", "gr-arrow" + (a.conj ? " conj" : ""));
      g.append("path").attr("d", arrowPath(a)).attr("marker-end", "url(#gr-arrowhead)");
      var t = g.append("text").attr("x", a.lx).attr("y", a.ly).attr("text-anchor", "middle").text(a.short);
      a.el = g.node();
      g.append("title").text(a.source.id + " → " + a.target.id + ": " + plainTex(a.limit) +
        (a.conj ? " (conjectural: outside the hypotheses of the cited theorems)" : ""));
      t.attr("dy", -3);
    });

    // The RG layer: a column on the right; lines from each RG statement to the main statements it links to.
    gRG = gS.append("g").attr("class", "gr-rg");
    var cg = gRG.append("g").attr("class", "gr-rgcol");
    cg.append("rect").attr("class", "gr-region gr-rgframe").attr("x", RGCOL.x).attr("y", RGCOL.y + 3).attr("width", RGCOL.w).attr("height", RGCOL.h - 6);
    cg.append("text").attr("class", "gr-rlabel").attr("x", RGCOL.x + 14).attr("y", 23).text("Renormalisation group");
    cg.append("text").attr("class", "gr-rsub").attr("x", RGCOL.x + 14).attr("y", 40)
      .text(RGS.length + " RG statements · (a)–(e) by sense · lines: links to S01–S15");
    cg.append("text").attr("class", "gr-rsub").attr("x", RGCOL.x + 14).attr("y", 58)
      .text("fill = maturity: mature → heuristic");
    var lgr = gRG.append("g").attr("class", "gr-rglinks");
    rglinks.forEach(function (l) {
      var rel = REL[l.rel] ? l.rel : "other";
      var g = lgr.append("g").attr("class", "gr-rglink rel-" + rel);
      var tgt = l.target, src = l.source;
      var x1 = src.x - src.r - 2, y1 = src.y, x2 = tgt.rg ? tgt.x : tgt.x + tgt.r + 3, y2 = tgt.y;
      var dx = x1 - x2, c = Math.min(260, Math.abs(dx) * 0.45 + 40);
      g.append("path").attr("d", "M" + x1.toFixed(1) + "," + y1.toFixed(1) + " C" + (x1 - c).toFixed(1) + "," + y1.toFixed(1) +
        " " + (x2 + (tgt.rg ? c : c)).toFixed(1) + "," + y2.toFixed(1) + " " + x2.toFixed(1) + "," + y2.toFixed(1));
      g.append("title").text(src.id + " " + relLabel(l.rel) + " " + tgt.id + ": " + l.note);
      l.el = g.node();
    });
    var rgn = gRG.append("g").attr("class", "gr-rgnodes");
    RGS.forEach(function (n) {
      var s = n.s;
      var g = rgn.append("g").attr("class", "gr-snode gr-rgnode mat-" + s.maturity + (s.kind === "collapse" ? "" : " group") + (n.red ? " red" : ""))
        .attr("transform", "translate(" + n.x.toFixed(1) + "," + n.y.toFixed(1) + ")")
        .attr("tabindex", 0).attr("role", "button")
        .attr("aria-label", s.id + ", " + s.title + ", sense " + s.sense + ", maturity " + s.maturity + ", " + plural(n.np, "paper"));
      if (n.red) g.append("circle").attr("class", "gr-sred").attr("r", n.r + 6);
      g.append("circle").attr("class", "gr-sdot gr-rgdot").attr("r", n.r);
      g.append("text").attr("class", "gr-scount").attr("y", 5).attr("text-anchor", "middle").text(n.np);
      var t = g.append("text").attr("class", "gr-slabel gr-rglabel").attr("text-anchor", "start");
      var lines = wrap(n.name, 27);
      t.append("tspan").attr("class", "id").attr("x", n.r + 10).attr("y", -6).text(s.id + " · " + senseLetter(s) + " · " + s.maturity);
      lines.slice(0, 3).forEach(function (line, i) {
        t.append("tspan").attr("x", n.r + 10).attr("y", 9 + 14 * i).text(i === 2 && lines.length > 3 ? line + "…" : line);
      });
      n.el = g.node();
      g.on("mouseenter", function (ev) { if (panel.hidden) smark([n], n); tipFor(sTip(n), ev); })
        .on("mousemove", function (ev) { moveTip(ev); })
        .on("mouseleave", function () { hideTip(); if (panel.hidden) smark(null); })
        .on("click", function (ev) { ev.stopPropagation(); openStatement(n); })
        .on("keydown", function (ev) { if (ev.key === "Enter") openStatement(n); });
    });

    var og = gS.append("g").attr("class", "gr-sops");
    sops.forEach(function (op) {
      var g = og.append("g").attr("class", "gr-op").attr("tabindex", 0).attr("role", "button")
        .attr("transform", "translate(" + op.x.toFixed(1) + "," + op.y.toFixed(1) + ")")
        .attr("aria-label", "Open problem " + op.o.rank + ": " + op.o.title);
      op.rel.forEach(function (n) {
        og.insert("line", ":first-child").attr("class", "gr-oplink")
          .attr("x1", op.x).attr("y1", op.y).attr("x2", n.x).attr("y2", n.y);
      });
      g.append("path").attr("d", "M0,-9L9,0L0,9L-9,0Z");
      g.append("text").attr("x", 12).attr("y", 4).text(op.o.id);
      g.on("mouseenter", function (ev) { if (panel.hidden) smark(op.rel, null); tipFor(opTip(op), ev); })
        .on("mousemove", function (ev) { moveTip(ev); })
        .on("mouseleave", function () { hideTip(); if (panel.hidden) smark(null); })
        .on("click", function (ev) { ev.stopPropagation(); openOpS(op); })
        .on("keydown", function (ev) { if (ev.key === "Enter") openOpS(op); });
      op.el = g.node();
    });

    var ng = gS.append("g").attr("class", "gr-snodes");
    STMT.forEach(function (n) {
      var s = n.s;
      var g = ng.append("g").attr("class", "gr-snode" + (s.kind === "collapse" ? "" : " group") + (n.red ? " red" : ""))
        .attr("transform", "translate(" + n.x.toFixed(1) + "," + n.y.toFixed(1) + ")")
        .attr("tabindex", 0).attr("role", "button")
        .attr("aria-label", s.id + ", " + s.title + ", " + plural(n.np, "paper"));
      if (n.red) g.append("circle").attr("class", "gr-sred").attr("r", n.r + 6);
      g.append("circle").attr("class", "gr-sdot").attr("r", n.r);
      g.append("text").attr("class", "gr-scount").attr("y", 5).attr("text-anchor", "middle").text(n.np);
      var lines = wrap(n.name, Math.max(16, Math.min(26, Math.floor(n.cw / 7.4))));
      var t = g.append("text").attr("class", "gr-slabel").attr("text-anchor", "middle");
      t.append("tspan").attr("class", "id").attr("x", 0).attr("y", n.r + 17).text(s.id);
      lines.slice(0, 3).forEach(function (line, i) {
        t.append("tspan").attr("x", 0).attr("y", n.r + 17 + 14 * (i + 1)).text(i === 2 && lines.length > 3 ? line + "…" : line);
      });
      n.el = g.node();
      g.on("mouseenter", function (ev) { if (panel.hidden) smark([n], n); tipFor(sTip(n), ev); })
        .on("mousemove", function (ev) { moveTip(ev); })
        .on("mouseleave", function () { hideTip(); if (panel.hidden) smark(null); })
        .on("click", function (ev) { ev.stopPropagation(); openStatement(n); })
        .on("keydown", function (ev) { if (ev.key === "Enter") openStatement(n); });
    });
  }

  function sTip(n) {
    var s = n.s;
    return [
      h.el("div", { class: "t" }, s.id + " · " + n.name),
      n.rg ? h.el("div", { class: "a" }, "RG statement " + senseLetter(s) + " · maturity: " + s.maturity + " · " + KIND[s.kind].short + " · " + h.lab("status", s.status))
        : h.el("div", { class: "a" }, REGION[n.region].label + " · " + KIND[s.kind].short + " · " + h.lab("status", s.status)),
      h.el("div", null, plain(s.claim)),
      h.el("div", { class: "a" }, plural(n.np, "paper") + (n.red ? " · papers disagree" : "") + ". Click for the formula and the papers.")
    ];
  }
  function plain(s) { return plainTex(s); }

  // Light up statements; with a centre, also its neighbours along arrows.
  function smark(set, centre) {
    if (!svg) return;
    if (!set) {
      svg.classed("sfocus", false);
      ALLS.forEach(function (x) { x.el.classList.remove("hi", "sel"); });
      arrows.forEach(function (a) { a.el.classList.remove("hi"); });
      rglinks.forEach(function (l) { l.el.classList.remove("hi"); });
      return;
    }
    var on = set.slice();
    if (centre) {
      arrows.forEach(function (a) {
        if (a.source === centre && on.indexOf(a.target) < 0) on.push(a.target);
        if (a.target === centre && on.indexOf(a.source) < 0) on.push(a.source);
      });
      // RG layer: an RG statement lights the main statements it links to, and a main statement the RG statements that link to it.
      rglinks.forEach(function (l) {
        if (l.rel === "unrelated") return;
        if (l.source === centre && on.indexOf(l.target) < 0) on.push(l.target);
        if (l.target === centre && on.indexOf(l.source) < 0) on.push(l.source);
      });
    }
    svg.classed("sfocus", true);
    ALLS.forEach(function (x) {
      x.el.classList.toggle("hi", on.indexOf(x) >= 0);
      x.el.classList.toggle("sel", set.indexOf(x) >= 0);
    });
    arrows.forEach(function (a) {
      a.el.classList.toggle("hi", centre ? (a.source === centre || a.target === centre)
        : (set.indexOf(a.source) >= 0 && set.indexOf(a.target) >= 0));
    });
    rglinks.forEach(function (l) {
      l.el.classList.toggle("hi", !!centre && (l.source === centre || l.target === centre));
    });
  }

  // The RG statements that link to a main statement: from the RG side, plus links written on the main statement itself.
  function rgViewOf(n) {
    var out = [];
    rglinks.forEach(function (l) {
      if (l.target === n && l.rel !== "reduces-to") out.push({ n: l.source, rel: l.rel, note: l.note });
    });
    (n.s.links || []).forEach(function (l) {
      var t = sById[l.target];
      if (t && t.rg && !out.some(function (o) { return o.n === t; })) out.push({ n: t, rel: REL_FWD[l.relation] || l.relation, note: l.note });
    });
    return out.sort(function (a, b) {
      return REL_ORDER.indexOf(a.rel) - REL_ORDER.indexOf(b.rel) || a.n.id.localeCompare(b.n.id);
    });
  }

  function matPill(s) { return h.el("span", { class: "pill mat mat-" + s.maturity, title: h.desc("maturity", s.maturity) }, s.maturity); }

  function stmtButton(id, extra) {
    var n = sById[id];
    if (!n) return null;
    return h.el("button", { type: "button", class: "linklike gr-nbtn", onclick: function () { openStatement(n, true); } },
      id + " · " + n.name + (extra ? " " + extra : ""));
  }

  function openStatement(n, centre) {
    var s = n.s, el = h.el;
    smark([n], n);
    if (centre) centreOn([n]);
    var byPaper = {};
    s.members.forEach(function (m) { (byPaper[m.paper] = byPaper[m.paper] || []).push(m); });
    var keys = s.papers.slice().sort(function (a, b) { return papers[a].p.year - papers[b].p.year; });
    var down = (s.reduces_to || []).filter(function (r) { return sById[r.target]; });
    var up = [];
    ALLS.forEach(function (x) {
      (x.s.reduces_to || []).forEach(function (r) { if (r.target === s.id) up.push({ n: x, limit: r.limit, conj: !!r.conjectural }); });
    });
    var ops = (s.open_problems || []).map(function (id) {
      return (D.open_problems || []).filter(function (o) { return o.id === id; })[0];
    }).filter(Boolean);
    showPanel([
      el("p", { class: "gr-kind" }, n.rg ? "RG statement " + s.id + " · renormalisation-group layer" : "Statement " + s.id),
      el("h2", null, s.title),
      n.rg ? el("div", { class: "authors" }, senseText(s), " · maturity ", matPill(s)) : null,
      el("div", { class: "authors" }, (n.rg ? "Where it holds: " + h.lab("width_limit", s.width_limit) : REGION[n.region].label) + " · " +
        h.labs("learning_rule", s.learning_rule) + " · " + plural(n.np, "paper")),
      el("p", { class: "oneline gr-claim" }, s.claim),
      el("div", { class: "gr-formula" }, s.formula),
      s.formula_note ? el("p", { class: "muted gr-fnote" }, s.formula_note) : null,
      el("h3", null, "Where it holds"),
      el("p", null, s.conditions),
      el("p", null, h.statusPill(s.status), s.status_note ? " " + s.status_note : ""),
      el("p", { class: "muted gr-fnote" }, el("span", { class: "pill role" }, KIND[s.kind].short), " " + KIND[s.kind].long),
      down.length ? el("h3", null, "Reduces to") : null,
      down.length ? el("ul", { class: "plain" }, down.map(function (r) {
        return el("li", null, stmtButton(r.target), el("div", { class: "muted gr-lim" }, "in the limit: ", limitSpan(r.limit)),
          r.conjectural ? el("div", { class: "gr-conj" }, "conjectural: outside the hypotheses of the cited theorems") : null);
      })) : null,
      up.length ? el("h3", null, "Statements that reduce to it") : null,
      up.length ? el("ul", { class: "plain" }, up.map(function (x) {
        return el("li", null, stmtButton(x.n.id), el("div", { class: "muted gr-lim" }, "in the limit: ", limitSpan(x.limit)),
          x.conj ? el("div", { class: "gr-conj" }, "conjectural: outside the hypotheses of the cited theorems") : null);
      })) : null,
      n.rg ? rgLinksBlock(n) : null,
      n.rg ? null : relatedBlock(n),
      n.rg ? null : rgViewBlock(n),
      (s.disagreements || []).length ? el("h3", { class: "gr-red-h" }, "Where papers disagree") : null,
      (s.disagreements || []).map(function (d) {
        return el("div", { class: "gr-disagree" }, el("div", null, d.note),
          el("div", { class: "muted" }, d.papers.map(function (k, i) {
            return [i ? " vs " : "", paperButton(k)];
          })));
      }),
      ops.length ? el("h3", null, "Open problems next to it") : null,
      ops.length ? el("ul", { class: "plain" }, ops.map(function (o) {
        return el("li", null, el("a", { href: "open-problems.html#" + o.id }, o.rank + ". " + o.title));
      })) : null,
      el("h3", null, "Papers that state it"),
      el("p", { class: "muted" }, plural(s.members.length, "result") + " in " + plural(n.np, "paper") + ", oldest first. Symbols are mapped to this page's."),
      keys.map(function (k) {
        var p = papers[k].p;
        return el("div", { class: "gr-pblock" },
          paperButton(k), el("span", { class: "muted" }, " · " + cite(p)),
          byPaper[k].map(function (m) {
            var r = m.result ? p.results.filter(function (x) { return x.id === m.result; })[0] : null;
            return el("div", { class: "result-card" },
              el("div", { class: "result-head" }, el("span", { class: "pill role" }, roleLabel(m.role)),
                r ? h.statusPill(r.status) : null,
                m.equations ? el("span", { class: "muted" }, m.equations) : null,
                el("a", { href: m.source_url, target: "_blank", rel: "noopener" }, "source ↗")),
              el("div", { class: "stmt" }, m.statement),
              el("div", { class: "gr-map" }, el("em", null, "Symbols: "), m.mapping));
          }));
      })
    ], "s:" + encodeURIComponent(s.id));
  }

  function roleLabel(role) { return h.lab("member_role", role); }

  // Main statement: links to other main statements (links to RG statements go to the RG view).
  function relatedBlock(n) {
    var ls = (n.s.links || []).filter(function (l) { return !(sById[l.target] && sById[l.target].rg); });
    if (!ls.length) return null;
    return h.el("div", null, h.el("h3", null, "Related statements"),
      h.el("ul", { class: "plain" }, ls.map(function (l) {
        return h.el("li", null, stmtButton(l.target), h.el("span", { class: "muted" }, " · " + l.relation.replace(/-/g, " ")), h.el("div", { class: "muted gr-lim" }, l.note));
      })));
  }

  // Main statement: the RG view, i.e. which renormalisation statements say something about it.
  function rgViewBlock(n) {
    if (!RGS.length) return null;
    var v = rgViewOf(n), el = h.el;
    return el("div", { class: "gr-rgview" },
      el("h3", null, "RG view"),
      v.length ? el("p", { class: "muted gr-fnote" }, "Renormalisation-group statements that link to this one, with the exact correspondence. Each is a reading of the RG literature, rated for maturity.")
        : el("p", { class: "muted" }, "No RG statement links to it."),
      v.length ? el("ul", { class: "plain" }, v.map(function (o) {
        return el("li", { class: "gr-rgitem rel-" + o.rel },
          stmtButton(o.n.id), " ", el("span", { class: "pill role" }, senseLetter(o.n.s)), matPill(o.n.s),
          el("div", { class: "gr-rgrel" }, el("strong", null, relLabel(o.rel)), " this statement", o.rel === "unrelated" ? " (objects differ)" : ""),
          el("div", { class: "muted gr-lim" }, o.note));
      })) : null);
  }

  // RG statement: its links to the main statements, grouped by relation.
  function rgLinksBlock(n) {
    var ls = (n.s.links || []), el = h.el;
    if (!ls.length) return null;
    var kids = [el("h3", null, "Links to the main statements"),
      el("p", { class: "muted gr-fnote" }, "Reproduces: the same formula in the stated limit. Extends: contains it or adds an ingredient. Contradicts: incompatible claims. Unrelated: the objects differ. Click to jump; the main statement's panel lists this one under “RG view”.")];
    REL_ORDER.forEach(function (rel) {
      var g = ls.filter(function (l) { return l.relation === rel; });
      if (!g.length) return;
      kids.push(el("div", { class: "gr-relhead rel-" + rel }, el("strong", null, relLabel(rel)), el("span", { class: "muted" }, " · " + REL[rel].long)));
      kids.push(el("ul", { class: "plain" }, g.map(function (l) {
        return el("li", { class: "gr-rgitem rel-" + rel }, stmtButton(l.target), el("div", { class: "muted gr-lim" }, l.note));
      })));
    });
    var other = ls.filter(function (l) { return !REL[l.relation]; });
    if (other.length) kids.push(el("ul", { class: "plain" }, other.map(function (l) {
      return el("li", null, stmtButton(l.target), el("span", { class: "muted" }, " · " + l.relation.replace(/-/g, " ")), el("div", { class: "muted gr-lim" }, l.note));
    })));
    return el("div", { class: "gr-rglinksblock" }, kids);
  }

  // A limit written in LaTeX shows as text with its math rendered in the panel.
  function limitSpan(txt) { return h.el("span", null, txt); }

  function openOpS(op) {
    smark(op.rel, null);
    var el = h.el, keys = op.o.papers.filter(function (k) { return papers[k]; });
    showPanel([
      el("p", { class: "gr-kind" }, "Open problem"),
      el("h2", null, op.o.rank + ". " + op.o.title),
      el("div", { class: "links" }, el("a", { href: "open-problems.html#" + op.o.id }, "Read it on the open-problems page")),
      el("h3", null, "Statements next to it"),
      el("ul", { class: "plain" }, op.rel.map(function (n) { return el("li", null, stmtButton(n.id)); })),
      keys.length ? el("h3", null, "Papers in the map that touch it") : null,
      keys.length ? el("ul", { class: "plain" }, keys.map(function (k) {
        return el("li", null, paperButton(k), el("span", { class: "muted" }, " · " + cite(papers[k].p)));
      })) : null
    ], op.o.id);
  }

  // The RG column widens the canvas; with the layer off (or in the results view) the plane is as before.
  function setViewBox(withRG) {
    var vb = withRG ? VB_RG : VB_PLAIN;
    svg.attr("viewBox", vb.join(" "));
    document.getElementById("graph").style.aspectRatio = vb[2] + " / " + (vb[3] - 10);
  }

  function applySFilters() {
    var q = query.trim().toLowerCase();
    var arrowsOn = document.getElementById("gr-sarrows").checked;
    var opsOn = document.getElementById("gr-sops").checked;
    var rgOn = RGS.length > 0 && document.getElementById("gr-srg").checked;
    ALLS.forEach(function (n) {
      var s = n.s;
      n.match = !!q && ((s.id + " " + s.title + " " + s.claim).toLowerCase().indexOf(q) >= 0 ||
        s.papers.some(function (k) { return papers[k].hay.indexOf(q) >= 0; }));
      n.el.classList.toggle("match", n.match);
    });
    svg.classed("ssearching", !!q);
    svg.classed("noarrows", !arrowsOn).classed("noops", !opsOn).classed("norg", !rgOn);
    if (VIEW === "statements") setViewBox(rgOn);
  }

  function buildIndex() {
    var ol = document.getElementById("gr-slist");
    ol.innerHTML = "";
    STMT.forEach(function (n) {
      ol.appendChild(h.el("li", null,
        h.el("button", { type: "button", class: "linklike gr-nbtn", onclick: function () { openStatement(n, true); } },
          n.id + " · " + n.name),
        h.el("span", { class: "muted" }, " — " + REGION[n.region].label + " · " + plural(n.np, "paper") + " · " + h.lab("status", n.s.status))));
    });
    var rl = document.getElementById("gr-rlist");
    if (rl) {
      rl.innerHTML = "";
      RGS.forEach(function (n) {
        rl.appendChild(h.el("li", null,
          h.el("button", { type: "button", class: "linklike gr-nbtn", onclick: function () { openStatement(n, true); } },
            n.id + " · " + n.name),
          h.el("span", { class: "muted" }, " — " + senseLetter(n.s) + " · " + n.s.maturity + " · " + plural(n.np, "paper") + " · " +
            plural((n.s.links || []).filter(function (l) { return l.relation !== "unrelated"; }).length, "link") + " to other statements")));
      });
      var sec = document.getElementById("gr-rgindex");
      if (sec) sec.hidden = !RGS.length;
    }
  }

  // ------------------------------------------------------------------ init

  function setView(v, keepHash) {
    VIEW = v;
    if (!panel.hidden) closePanel();
    svg.classed("v-statements", v === "statements").classed("v-results", v === "results");
    d3.selectAll(".graph-page [data-view]").each(function () { this.hidden = this.getAttribute("data-view") !== v; });
    ["statements", "results"].forEach(function (x) {
      document.getElementById("gr-v-" + x).setAttribute("aria-selected", x === v ? "true" : "false");
    });
    d3.selectAll(".gr-rsub").text(function (r) { return regionSub(r); });
    if (v === "results") setViewBox(false);
    svg.attr("aria-label", v === "statements" ? "Statements placed by limit, " + ALLS.length + " dots"
      : "Results placed by limit, " + nodes.length + " dots");
    document.getElementById("graph").setAttribute("aria-label", v === "statements" ? "Graph of statements by limit" : "Graph of results by limit");
    document.getElementById("gr-q").placeholder = v === "statements" ? "statement, author, title, arXiv id" : "result, author, title, arXiv id";
    svg.call(zoom.transform, d3.zoomIdentity);
    if (v === "statements") applySFilters(); else applyFilters();
    if (!keepHash && location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

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
    smodel();
    render(box);
    buildIndex();
    var haveStmts = ALLS.length > 0;
    if (!RGS.length) {
      var rgt = document.getElementById("gr-srg-label"); if (rgt) rgt.hidden = true;
      d3.selectAll(".gr-rgleg").remove();
    }
    if (!haveStmts) {
      document.getElementById("gr-v-statements").hidden = true;
      document.getElementById("gr-v-results").hidden = true;
      d3.selectAll(".gr-index").remove();
    }
    ["gr-bayes", "gr-gd", "gr-na", "gr-ops"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", applyFilters);
    });
    ["gr-sarrows", "gr-sops", "gr-srg"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", applySFilters);
    });
    document.getElementById("gr-v-statements").addEventListener("click", function () { if (VIEW !== "statements") setView("statements"); });
    document.getElementById("gr-v-results").addEventListener("click", function () { if (VIEW !== "results") setView("results"); });
    var qi = document.getElementById("gr-q");
    qi.addEventListener("input", function () { query = qi.value; if (VIEW === "statements") applySFilters(); else applyFilters(); });
    qi.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter") return;
      var q = query.trim().toLowerCase();
      var hits = Object.keys(papers).filter(function (k) { return q && papers[k].hay.indexOf(q) >= 0; });
      if (hits.length === 1) { openPaper(hits[0], true); return; }
      if (VIEW === "statements") {
        var sh = ALLS.filter(function (n) { return n.match; })[0];
        if (sh) openStatement(sh, true);
        return;
      }
      var hit = nodes.filter(function (n) { return n.match && n.visible; })[0];
      if (hit) openNode(hit, true);
    });
    document.getElementById("gr-fit").addEventListener("click", function () {
      svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
    });
    scrim.addEventListener("click", closePanel);
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !panel.hidden) closePanel(); });

    var want = decodeURIComponent(location.hash.slice(1));
    var start = haveStmts && want.indexOf("r:") !== 0 ? "statements" : "results";
    if (!haveStmts) start = "results";
    setView(start, true);
    if (want.indexOf("p:") === 0 && papers[want.slice(2)]) openPaper(want.slice(2), true);
    else if (want.indexOf("s:") === 0 && sById[want.slice(2)]) openStatement(sById[want.slice(2)], true);
    else if (want.indexOf("r:") === 0) {
      var n = nodes.filter(function (x) { return x.id === want.slice(2); })[0];
      if (n) openNode(n, true);
    } else {
      var sop = sops.filter(function (x) { return x.o.id === want; })[0];
      var op = ops.filter(function (x) { return x.o.id === want; })[0];
      if (VIEW === "statements" && sop) openOpS(sop);
      else if (op) openOp(op);
    }
  }

  window.FLGraph = { init: init };
})();
