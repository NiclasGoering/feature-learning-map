/* Feature-learning map: renders data.json (built by scripts/build.py) into the
   table, the mechanisms page and the open-problems page. No framework. */
(function () {
  "use strict";

  var PAGE = document.body.dataset.page;
  var D = null; // data.json
  var V = null; // vocabulary fields
  var byKey = {};
  var byBase = {};

  var RULES = ["bayes", "gd"];
  var DEPTHS = ["one-hidden-layer", "deep"];
  var EMPTY_LABEL = { "unknown": "unknown", "not-stated": "not stated", "not-applicable": "n/a" };

  // Every vocabulary field gets a filter, grouped by band.
  var FILTER_BANDS = [
    ["Grouping", ["learning_rule", "depth", "width_limit"]],
    ["Paper", ["contribution", "threads", "tags", "provenance_status"]],
    ["Setting", ["architecture", "activation", "learned_layers", "parametrisation", "prior_scale", "prior_family"]],
    ["Dials", ["likelihood_scaled", "p_vs_n", "amplitude", "temperature", "closure"]],
    ["Scaling", ["N", "L", "P", "D", "order_of_limits", "gd_step_size", "gd_time"]],
    ["Data", ["input", "target", "label_noise", "data_class"]],
    ["Method", ["method", "solver", "approximations"]],
    ["Result", ["quantity", "status", "grade", "compared_other_rule"]],
    ["FL mechanism", ["mechanism_type", "mechanism_label", "moves_mean"]],
    ["Empirics", ["sampler", "diagnostics", "mixing", "datasets"]],
    ["Relations", ["relation_type"]]
  ];

  // ------------------------------------------------------------------ helpers

  function $(sel, root) { return (root || document).querySelector(sel); }

  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (k === "html") n.innerHTML = v; // only HTML produced by the build
        else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? "" : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(n, arguments[i]);
    return n;
  }

  function append(n, kid) {
    if (kid === null || kid === undefined || kid === false || kid === "") return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(n, k); }); return; }
    n.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }

  function lab(field, slug) {
    if (slug in EMPTY_LABEL) return EMPTY_LABEL[slug];
    var f = V[field];
    var v = f && f.values[slug];
    return v ? v.label : String(slug);
  }

  function labs(field, list) {
    if (list === undefined || list === null) return "";
    if (!Array.isArray(list)) list = [list];
    return list.map(function (s) { return lab(field, s); }).join(", ");
  }

  function desc(field, slug) {
    var v = V[field] && V[field].values[slug];
    return v ? v.desc : "";
  }

  function text(v) {
    if (v === undefined || v === null) return "";
    var s = String(v);
    return s in EMPTY_LABEL ? EMPTY_LABEL[s] : s;
  }

  function math(node) {
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(node, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false }
          ],
          throwOnError: false
        });
      } catch (e) { /* leave the TeX source visible */ }
    }
    return node;
  }

  function pill(cls, label, title) {
    return el("span", { class: "pill " + cls, title: title || null }, label);
  }

  function statusPill(s) { return pill("st-" + s, lab("status", s), desc("status", s)); }
  function mixingPill(m) { return pill("mx-" + m, "mixing " + lab("mixing", m), desc("mixing", m)); }

  function authorShort(p) { return p.first_author + (p.authors.length > 1 ? " et al." : ""); }

  function extLink(href, label) { return el("a", { href: href, target: "_blank", rel: "noopener" }, label); }

  function sourceLink(res) {
    return extLink(res.source_url, res.source.loc + " (" + res.source.version + ") ↗");
  }

  function settingLine(view) {
    return [
      labs("learning_rule", view.learning_rule),
      labs("depth", view.depth),
      labs("width_limit", view.width_limit),
      labs("architecture", view.setting.architecture),
      labs("target", view.data.target)
    ].filter(Boolean).join(" · ");
  }

  function setupChrome() {
    var repo = D.repo;
    if (repo) {
      var add = $("#add-paper");
      add.href = repo + "/issues/new?template=add-paper.yml";
      add.hidden = false;
      var gh = $("#repo-link");
      gh.href = repo;
      gh.hidden = false;
    }
    var foot = $("#foot");
    if (foot) {
      var queued = D.queue.queued || 0;
      foot.textContent = "Compiled " + D.generated + " from papers/*.md · " + D.papers.length +
        " paper" + (D.papers.length === 1 ? "" : "s") + " · " + queued + " queued for ingest.";
    }
  }

  function setupTheme() {
    var btn = $("#theme");
    if (!btn) return;
    function current() { return document.documentElement.dataset.theme === "light" ? "light" : "dark"; }
    function show() { btn.textContent = current() === "dark" ? "Light" : "Dark"; }
    btn.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      if (next === "light") document.documentElement.dataset.theme = "light";
      else delete document.documentElement.dataset.theme;
      try {
        if (next === "light") localStorage.setItem("flmap-theme", "light");
        else localStorage.removeItem("flmap-theme");
      } catch (e) { /* storage unavailable: theme lasts for this page only */ }
      show();
    });
    show();
  }

  // ------------------------------------------------------------ table page

  var S = { q: "", filters: {}, collapsed: {}, panel: null };

  function readURL() {
    var u = new URLSearchParams(location.search);
    S.q = u.get("q") || "";
    S.panel = u.get("p");
    S.collapsed = {};
    (u.get("c") || "").split(",").filter(Boolean).forEach(function (k) { S.collapsed[k] = true; });
    S.filters = {};
    u.forEach(function (val, key) {
      if (key.indexOf("f.") === 0 && V[key.slice(2)]) {
        S.filters[key.slice(2)] = val.split(",").filter(Boolean);
      }
    });
  }

  function writeURL() {
    var u = new URLSearchParams();
    if (S.q) u.set("q", S.q);
    Object.keys(S.filters).forEach(function (f) {
      if (S.filters[f].length) u.set("f." + f, S.filters[f].join(","));
    });
    var c = Object.keys(S.collapsed).filter(function (k) { return S.collapsed[k]; });
    if (c.length) u.set("c", c.join(","));
    if (S.panel) u.set("p", S.panel);
    var qs = u.toString();
    history.replaceState(null, "", qs ? "?" + qs : location.pathname);
  }

  function haystack(p) {
    var parts = [p.id, p.title, p.authors.join(" "), p.venue, p.one_line, p.summary, String(p.year)];
    p.results.forEach(function (r) {
      parts.push(r.statement, r.mechanism.paper_term, r.mechanism.explanation, r.source.loc);
    });
    Object.keys(p.agg).forEach(function (f) {
      p.agg[f].forEach(function (s) { parts.push(lab(f, s), s); });
    });
    return parts.join(" \n ").toLowerCase();
  }

  function matches(p) {
    if (S.q) {
      var toks = S.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < toks.length; i++) if (p._hay.indexOf(toks[i]) < 0) return false;
    }
    var fs = Object.keys(S.filters);
    for (var j = 0; j < fs.length; j++) {
      var want = S.filters[fs[j]];
      if (!want.length) continue;
      var have = p.agg[fs[j]] || [];
      if (!want.some(function (w) { return have.indexOf(w) >= 0; })) return false;
    }
    return true;
  }

  // Lines under a cell's main label. Blank and empty-state values are left out.
  function blank(v) {
    return v === "" || v === null || v === undefined || v === "unknown" || v === "not stated" || v === "n/a";
  }

  function subs(rows) {
    return rows.filter(function (r) { return !blank(r[1]); }).map(function (r) {
      return el("div", { class: "sub" }, el("span", { class: "k" }, r[0]), " ", r[1]);
    });
  }

  function td(title, cls) {
    var n = el("td", { class: cls || null, "data-label": title });
    for (var i = 2; i < arguments.length; i++) append(n, arguments[i]);
    return n;
  }

  function main(text) { return el("div", { class: "main" }, blank(text) ? "not stated" : text); }

  function scalingText(p) {
    var inf = [], fixed = [];
    ["N", "L", "P", "D"].forEach(function (k) {
      var v = p.agg[k] || [];
      if (v.indexOf("to-infinity") >= 0) inf.push(k);
      if (v.indexOf("fixed") >= 0 && v.indexOf("to-infinity") < 0) fixed.push(k);
    });
    return [inf.length ? inf.join(", ") + " → ∞" : "", fixed.length ? fixed.join(", ") + " fixed" : ""]
      .filter(Boolean).join("; ");
  }

  var COLUMNS = [
    { title: "Paper", width: 15, render: paperCell },
    {
      title: "Architecture", width: 8, render: function (p) {
        return td("Architecture", null, main(labs("architecture", p.agg.architecture)), subs([
          ["Activation", labs("activation", p.agg.activation)],
          ["Learned", labs("learned_layers", p.agg.learned_layers)]
        ]));
      }
    },
    {
      title: "Parametri\u00adsation / prior", width: 9, render: function (p) {
        return td("Parametrisation / prior", null, main(labs("parametrisation", p.agg.parametrisation)), subs([
          ["Scale", labs("prior_scale", p.agg.prior_scale)],
          ["Prior", labs("prior_family", p.agg.prior_family)],
          ["Likelihood ∝ N", labs("likelihood_scaled", p.agg.likelihood_scaled)],
          ["Temperature", labs("temperature", p.agg.temperature)]
        ]));
      }
    },
    {
      title: "Data", width: 8, render: function (p) {
        return td("Data", null, main(labs("input", p.agg.input)), subs([
          ["Class", labs("data_class", p.agg.data_class)],
          ["Datasets", labs("datasets", p.agg.datasets)],
          ["Label noise", labs("label_noise", p.agg.label_noise)]
        ]));
      }
    },
    {
      title: "Target", width: 8, render: function (p) {
        var tp = p.data.target_params;
        return td("Target", null, main(labs("target", p.agg.target)), subs([
          ["k", text(tp.k)],
          ["Degree", text(tp.degree)],
          ["Exponent", text(tp.exponent)],
          ["Teacher", text(tp.teacher_width)],
          ["Amplitude", labs("amplitude", p.agg.amplitude)]
        ]));
      }
    },
    {
      title: "Method", width: 9, render: function (p) {
        return td("Method", null, main(labs("method", p.agg.method)), subs([
          ["Solver", labs("solver", p.agg.solver)],
          ["Approx.", labs("approximations", p.agg.approximations)],
          ["Closure", labs("closure", p.agg.closure)],
          ["Limit", scalingText(p)],
          ["Order", labs("order_of_limits", p.agg.order_of_limits)],
          ["GD step", labs("gd_step_size", p.agg.gd_step_size)],
          ["GD time", labs("gd_time", p.agg.gd_time)]
        ]));
      }
    },
    { title: "Status", width: 6, render: statusCell },
    { title: "Main result", width: 16, render: resultCell },
    { title: "Empirics", width: 9, render: empiricsCell },
    { title: "FL mechanism", width: 12, render: mechanismCell }
  ];

  function paperCell(p) {
    var flag = p.provenance.status === "verified" ? null :
      el("span", { class: "entry-flag", title: desc("provenance_status", p.provenance.status) }, p.provenance.status);
    return td("Paper", "paper",
      el("button", { class: "title-btn", type: "button", title: "Full entry", onclick: function () { openPanel(p.key); } }, p.title),
      el("div", { class: "paper-meta" },
        authorShort(p), " · ", String(p.year), " · ",
        extLink(p.links.abs, p.id.indexOf("doi:") === 0 ? "doi" : "arXiv"),
        p.links.pdf !== "not-available" ? [" · ", extLink(p.links.pdf, "pdf")] : null,
        flag ? [" · ", flag] : null),
      el("div", { class: "oneline" }, p.one_line));
  }

  function statusCell(p) {
    return td("Status", null, p.results.map(function (r) {
      return el("div", { class: "status-line", title: labs("quantity", r.quantity) },
        el("span", { class: "rid" }, r.id), " ", statusPill(r.status), " ",
        el("span", { class: "grade", title: desc("grade", r.grade) }, lab("grade", r.grade)));
    }));
  }

  function resultCell(p) {
    var r1 = p.results[0];
    var more = p.results.length - 1;
    return td("Main result", null,
      el("div", { class: "qty" }, labs("quantity", r1.quantity)),
      el("div", { class: "stmt" }, r1.statement),
      el("div", { class: "src" }, sourceLink(r1)),
      more ? el("div", { class: "sub" }, el("button", {
        class: "linklike", type: "button", onclick: function () { openPanel(p.key); }
      }, "+ " + more + " more result" + (more === 1 ? "" : "s"))) : null);
  }

  function empiricsCell(p) {
    var mix = (p.agg.mixing || []).filter(function (m) { return !(m in EMPTY_LABEL); });
    return td("Empirics", null, main(labs("sampler", p.agg.sampler)),
      mix.length ? el("div", { class: "pills" }, mix.map(mixingPill)) : null,
      subs([
        ["T", text(p.empirics.temperature)],
        ["Chains", text(p.empirics.chains)],
        ["Diagnostics", labs("diagnostics", p.agg.diagnostics)],
        ["Scale", text(p.empirics.scale)]
      ]));
  }

  function mechLabel(m) { return m.type + " · " + lab("mechanism_label", m.label); }

  function mechanismCell(p) {
    var m = p.results[0].mechanism;
    var others = p.results.slice(1).filter(function (r) {
      return r.mechanism.type !== m.type || r.mechanism.label !== m.label;
    });
    return td("FL mechanism", "mech",
      el("div", { class: "main" }, el("a", { href: "mechanisms.html#" + m.type, title: desc("mechanism_type", m.type) }, mechLabel(m))),
      el("div", { class: "expl" }, m.explanation),
      subs([
        ["Paper's term", text(m.paper_term)],
        ["Moves mean", lab("moves_mean", m.moves_mean)],
        ["Also", others.map(function (r) { return mechLabel(r.mechanism) + " (" + r.id + ")"; }).join("; ")]
      ]));
  }

  function groupRow(level, key, title, meta) {
    var collapsed = !!S.collapsed[key];
    var btn = el("button", {
      class: "g-toggle", type: "button", "aria-expanded": String(!collapsed),
      onclick: function () { S.collapsed[key] = !collapsed; if (!S.collapsed[key]) delete S.collapsed[key]; writeURL(); renderTable(); }
    }, el("span", { class: "caret", "aria-hidden": "true" }, collapsed ? "▸" : "▾"), title);
    return el("tr", { class: "g g" + level }, el("td", { colspan: String(COLUMNS.length) },
      el("div", { class: "g-inner" }, btn, el("span", { class: "g-meta" }, meta))));
  }

  function widthGroups(depth) {
    return Object.keys(V.width_limit.values).filter(function (w) { return w !== "inf-depth" || depth === "deep"; });
  }

  function renderTable() {
    var visible = D.papers.filter(matches);
    var table = $("#map");
    table.textContent = "";
    var colgroup = el("colgroup", null, COLUMNS.map(function (c) { return el("col", { style: "width:" + c.width + "%" }); }));
    var thead = el("thead", null, el("tr", null, COLUMNS.map(function (c) { return el("th", { scope: "col" }, c.title); })));
    var tbody = el("tbody");

    function inGroup(list, prefix) {
      return list.filter(function (p) {
        return p.groups.some(function (g) { return g === prefix || g.indexOf(prefix + "|") === 0; });
      });
    }

    RULES.forEach(function (rule) {
      var k1 = rule;
      var n1 = inGroup(visible, k1).length;
      tbody.appendChild(groupRow(1, k1, lab("learning_rule", rule) === "Bayes" ? "Bayesian posteriors" : "Gradient-based training",
        n1 + " paper" + (n1 === 1 ? "" : "s")));
      if (S.collapsed[k1]) return;
      DEPTHS.forEach(function (depth) {
        var k2 = rule + "|" + depth;
        var n2 = inGroup(visible, k2).length;
        tbody.appendChild(groupRow(2, k2, lab("depth", depth), n2 + " paper" + (n2 === 1 ? "" : "s")));
        if (S.collapsed[k2]) return;
        widthGroups(depth).forEach(function (width) {
          var k3 = k2 + "|" + width;
          var nb = inGroup(visible, "bayes|" + depth + "|" + width).length;
          var ng = inGroup(visible, "gd|" + depth + "|" + width).length;
          tbody.appendChild(groupRow(3, k3, lab("width_limit", width), "Bayes " + nb + " · GD " + ng));
          if (S.collapsed[k3]) return;
          var rows = inGroup(visible, k3);
          if (!rows.length) {
            var total = inGroup(D.papers, k3).length;
            tbody.appendChild(el("tr", { class: "empty" }, el("td", { colspan: String(COLUMNS.length) },
              el("div", { class: "g-inner" }, total ? "no papers match the filters" : "no papers yet"))));
            return;
          }
          rows.forEach(function (p) {
            tbody.appendChild(el("tr", { class: "paper-row", "data-key": p.key }, COLUMNS.map(function (c) { return c.render(p); })));
          });
        });
      });
    });
    table.appendChild(colgroup);
    table.appendChild(thead);
    table.appendChild(tbody);
    math(tbody);
    var n = visible.length;
    $("#result-count").textContent = n === D.papers.length ? n + " papers" : n + " of " + D.papers.length + " papers";
    renderChips();
  }

  function renderFilters() {
    var box = $("#filters");
    box.textContent = "";
    FILTER_BANDS.forEach(function (band) {
      box.appendChild(el("h3", null, band[0]));
      band[1].forEach(function (field) {
        var f = V[field];
        var counts = {};
        D.papers.forEach(function (p) {
          (p.agg[field] || []).forEach(function (s) { counts[s] = (counts[s] || 0) + 1; });
        });
        var slugs = Object.keys(f.values).concat(["unknown", "not-stated", "not-applicable"].filter(function (s) { return counts[s]; }));
        var selected = S.filters[field] || [];
        var det = el("details", { open: selected.length ? true : null },
          el("summary", null, f.label, selected.length ? el("span", { class: "n" }, "(" + selected.length + ")") : null));
        slugs.forEach(function (s) {
          var n = counts[s] || 0;
          var cb = el("input", { type: "checkbox", value: s, checked: selected.indexOf(s) >= 0 ? true : null });
          cb.addEventListener("change", function () {
            var cur = S.filters[field] || [];
            if (cb.checked) cur = cur.concat([s]);
            else cur = cur.filter(function (x) { return x !== s; });
            if (cur.length) S.filters[field] = cur; else delete S.filters[field];
            writeURL();
            renderTable();
            updateFilterCount();
          });
          det.appendChild(el("label", { class: n ? null : "zero", title: desc(field, s) || null },
            cb, el("span", null, lab(field, s)), el("span", { class: "count" }, String(n))));
        });
        box.appendChild(det);
      });
    });
  }

  function updateFilterCount() {
    var n = Object.keys(S.filters).reduce(function (a, f) { return a + S.filters[f].length; }, 0);
    $("#filter-count").textContent = n ? String(n) : "";
  }

  function renderChips() {
    var box = $("#chips");
    box.textContent = "";
    var any = false;
    Object.keys(S.filters).forEach(function (field) {
      S.filters[field].forEach(function (s) {
        any = true;
        box.appendChild(el("span", { class: "chip" }, V[field].label + ": " + lab(field, s),
          el("button", {
            type: "button", "aria-label": "Remove filter",
            onclick: function () {
              S.filters[field] = S.filters[field].filter(function (x) { return x !== s; });
              if (!S.filters[field].length) delete S.filters[field];
              writeURL(); renderFilters(); renderTable(); updateFilterCount();
            }
          }, "×")));
      });
    });
    if (any || S.q) {
      box.appendChild(el("button", {
        class: "chip-clear", type: "button",
        onclick: function () {
          S.filters = {}; S.q = ""; $("#q").value = "";
          writeURL(); renderFilters(); renderTable(); updateFilterCount();
        }
      }, "Clear all"));
    }
  }

  // ------------------------------------------------------------- side panel

  function kv(rows) {
    var dl = el("dl", { class: "kv" });
    rows.forEach(function (r) {
      if (r[1] === "" || r[1] === null || r[1] === undefined) return;
      dl.appendChild(el("dt", null, r[0]));
      dl.appendChild(el("dd", null, r[1]));
    });
    return dl;
  }

  function overridesText(res) {
    var o = res.overrides;
    if (!o) return "";
    var parts = [];
    Object.keys(o).forEach(function (k) {
      if (V[k]) { parts.push(V[k].label + ": " + labs(k, o[k])); return; }
      Object.keys(o[k]).forEach(function (sub) {
        var val = o[k][sub];
        if (V[sub]) parts.push(V[sub].label + ": " + labs(sub, val));
        else if (sub === "target_params") parts.push("Target parameters: " + Object.keys(val).map(function (x) { return x + " " + text(val[x]); }).join(", "));
        else parts.push(sub + ": " + text(val));
      });
    });
    return "Differs from the paper defaults: " + parts.join("; ") + ".";
  }

  function paperRef(target) {
    var p = byBase[target];
    if (p) {
      return el("button", { class: "linklike", type: "button", onclick: function () { openPanel(p.key); } },
        p.title + " (" + authorShort(p) + " " + p.year + ")");
    }
    if (target.indexOf("doi:") === 0) return extLink("https://doi.org/" + target.slice(4), target);
    return extLink("https://arxiv.org/abs/" + target, "arXiv:" + target);
  }

  function renderPanel() {
    var panel = $("#panel");
    var scrim = $("#scrim");
    var p = S.panel && byKey[S.panel];
    if (!p) {
      panel.hidden = true;
      scrim.hidden = true;
      return;
    }
    var body = $("#panel-body");
    body.textContent = "";
    var links = el("div", { class: "links" },
      extLink(p.links.abs, p.id.indexOf("doi:") === 0 ? "DOI page" : "arXiv abstract"),
      p.links.pdf !== "not-available" ? extLink(p.links.pdf, "PDF") : null,
      p.links.html !== "not-available" ? extLink(p.links.html, "HTML") : null,
      D.repo ? extLink(D.repo + "/blob/main/" + p.file, "Edit entry on GitHub") : null);
    append(body, [
      el("h2", { id: "panel-title" }, p.title),
      el("div", { class: "authors" }, p.authors.join(", ")),
      el("div", { class: "authors" }, String(p.year) + " · " + p.venue + " · " + p.id),
      links,
      el("p", { class: "oneline" }, p.one_line),
      el("p", null, p.summary),
      kv([
        ["Contribution", lab("contribution", p.contribution)],
        ["Threads", labs("threads", p.threads)],
        ["Tags", labs("tags", p.tags)]
      ])
    ]);

    body.appendChild(el("h3", null, "Results"));
    p.results.forEach(function (r) {
      var m = r.mechanism;
      body.appendChild(el("div", { class: "result-card" },
        el("div", { class: "result-head" },
          el("span", { class: "rid" }, r.id), statusPill(r.status),
          el("span", { class: "grade" }, "grade " + lab("grade", r.grade)),
          el("span", { class: "muted" }, labs("quantity", r.quantity))),
        el("p", { class: "stmt" }, r.statement),
        el("div", null, sourceLink(r),
          r.compared_other_rule === "yes" ? el("span", { class: "muted" }, " · compares Bayes and GD") : null),
        el("div", { class: "mech" },
          el("a", { href: "mechanisms.html#" + m.type }, mechLabel(m)), ". ", m.explanation,
          el("div", { class: "muted" }, "Paper's term: " + text(m.paper_term) + " · moves the mean predictor: " + lab("moves_mean", m.moves_mean))),
        r.overrides ? el("div", { class: "over" }, overridesText(r)) : null));
    });

    body.appendChild(el("h3", null, "Where it sits"));
    body.appendChild(kv([
      ["Learning rule", labs("learning_rule", p.learning_rule)],
      ["Depth", labs("depth", p.depth)],
      ["Width / limit", labs("width_limit", p.width_limit)]
    ]));
    body.appendChild(el("h3", null, "Setting"));
    body.appendChild(kv(["architecture", "activation", "learned_layers", "parametrisation", "prior_scale", "prior_family"].map(function (f) {
      return [V[f].label, labs(f, p.setting[f])];
    })));
    body.appendChild(el("h3", null, "Dials"));
    body.appendChild(kv(["likelihood_scaled", "p_vs_n", "amplitude", "temperature", "closure"].map(function (f) {
      return [V[f].label, labs(f, p.dials[f])];
    })));
    body.appendChild(el("h3", null, "Scaling details"));
    body.appendChild(kv(["N", "L", "P", "D"].map(function (f) { return [V[f].label, labs(f, p.scaling[f])]; }).concat([
      ["Scaling relations", text(p.scaling.relations)],
      [V.order_of_limits.label, labs("order_of_limits", p.scaling.order_of_limits)],
      [V.gd_step_size.label, labs("gd_step_size", p.scaling.gd_step_size)],
      [V.gd_time.label, labs("gd_time", p.scaling.gd_time)]
    ])));
    body.appendChild(el("h3", null, "Data"));
    var tp = p.data.target_params;
    body.appendChild(kv([
      [V.input.label, labs("input", p.data.input)],
      [V.target.label, labs("target", p.data.target)],
      ["k", text(tp.k)], ["Degree", text(tp.degree)], ["Exponent", text(tp.exponent)], ["Teacher width", text(tp.teacher_width)],
      [V.label_noise.label, labs("label_noise", p.data.label_noise)],
      [V.data_class.label, labs("data_class", p.data.data_class)]
    ]));
    body.appendChild(el("h3", null, "Method"));
    body.appendChild(kv(["method", "solver", "approximations"].map(function (f) { return [V[f].label, labs(f, p.method[f])]; })));
    body.appendChild(el("h3", null, "Empirics and sampler"));
    body.appendChild(kv([
      [V.sampler.label, labs("sampler", p.empirics.sampler)],
      ["Temperature", text(p.empirics.temperature)],
      ["Chains", text(p.empirics.chains)],
      [V.diagnostics.label, labs("diagnostics", p.empirics.diagnostics)],
      [V.mixing.label, el("span", null, (p.empirics.mixing || []).map(function (m) {
        return m in EMPTY_LABEL ? EMPTY_LABEL[m] : mixingPill(m);
      }))],
      [V.datasets.label, labs("datasets", p.empirics.datasets)],
      ["Scale", text(p.empirics.scale)]
    ]));

    body.appendChild(el("h3", null, "Relations"));
    if (p.relations.length) {
      body.appendChild(el("ul", { class: "plain" }, p.relations.map(function (r) {
        var target = r.type === "answers"
          ? el("a", { href: "open-problems.html#" + r.target }, opTitle(r.target))
          : paperRef(r.target);
        return el("li", null, lab("relation_type", r.type) + ": ", target,
          r.note ? el("span", { class: "muted" }, " — " + r.note) : null);
      })));
    } else body.appendChild(el("p", { class: "muted" }, "None recorded."));

    body.appendChild(el("h3", null, "Open problems touched"));
    if (p.open_problems.length) {
      body.appendChild(el("ul", { class: "plain" }, p.open_problems.map(function (id) {
        return el("li", null, el("a", { href: "open-problems.html#" + id }, opTitle(id)));
      })));
    } else body.appendChild(el("p", { class: "muted" }, "None recorded."));

    body.appendChild(el("h3", null, "Provenance"));
    body.appendChild(kv([
      ["Entry status", el("span", { title: desc("provenance_status", p.provenance.status) }, lab("provenance_status", p.provenance.status))],
      ["Added by", p.provenance.added_by + " on " + p.provenance.date_added],
      ["Verified by", p.provenance.verified_by.length ? p.provenance.verified_by.join(", ") : "not yet"],
      ["Version read", p.provenance.version_read]
    ]));
    if (p.notes_html) {
      body.appendChild(el("h3", null, "Extraction notes"));
      body.appendChild(el("div", { class: "notes", html: p.notes_html }));
    }

    math(body);
    panel.hidden = false;
    scrim.hidden = false;
    panel.scrollTop = 0;
    $("#panel-close").focus();
  }

  function opTitle(id) {
    var op = D.open_problems.filter(function (o) { return o.id === id; })[0];
    return op ? op.rank + ". " + op.title : id;
  }

  function openPanel(key) {
    S.lastFocus = document.activeElement;
    S.panel = key;
    writeURL();
    renderPanel();
  }

  function closePanel() {
    S.panel = null;
    writeURL();
    renderPanel();
    if (S.lastFocus && S.lastFocus.focus) S.lastFocus.focus();
  }

  function initTable() {
    readURL();
    D.papers.forEach(function (p) { p._hay = haystack(p); });
    var q = $("#q");
    q.value = S.q;
    var timer = null;
    q.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { S.q = q.value.trim(); writeURL(); renderTable(); }, 120);
    });
    var fb = $("#filters-btn");
    fb.addEventListener("click", function () {
      var box = $("#filters");
      box.hidden = !box.hidden;
      fb.setAttribute("aria-expanded", String(!box.hidden));
    });
    $("#expand-all").addEventListener("click", function () { S.collapsed = {}; writeURL(); renderTable(); });
    $("#collapse-all").addEventListener("click", function () {
      S.collapsed = {};
      RULES.forEach(function (r) { DEPTHS.forEach(function (d) { S.collapsed[r + "|" + d] = true; }); });
      writeURL(); renderTable();
    });
    $("#panel-close").addEventListener("click", closePanel);
    $("#scrim").addEventListener("click", closePanel);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && S.panel) closePanel(); });
    renderFilters();
    updateFilterCount();
    renderTable();
    renderPanel();
  }

  // ---------------------------------------------------------- mechanisms page

  function initMechanisms() {
    var box = $("#mech");
    var types = Object.keys(V.mechanism_type.values);
    var labels = Object.keys(V.mechanism_label.values);
    var all = [];
    D.papers.forEach(function (p) { p.results.forEach(function (r) { all.push({ p: p, r: r }); }); });
    box.appendChild(el("ul", { class: "toc" }, types.map(function (t) {
      var n = all.filter(function (x) { return x.r.mechanism.type === t; }).length;
      return el("li", null, el("a", { href: "#" + t }, lab("mechanism_type", t)), " ", el("span", { class: "n" }, "(" + n + ")"));
    })));
    types.forEach(function (t) {
      var items = all.filter(function (x) { return x.r.mechanism.type === t; });
      var sec = el("section", { id: t },
        el("h2", null, lab("mechanism_type", t)),
        el("p", { class: "type-desc" }, desc("mechanism_type", t)));
      if (!items.length) sec.appendChild(el("p", { class: "muted" }, "No results in the map yet."));
      labels.forEach(function (l) {
        var group = items.filter(function (x) { return x.r.mechanism.label === l; });
        if (!group.length) return;
        sec.appendChild(el("h3", null, lab("mechanism_label", l), " ", el("span", { class: "muted" }, "(" + group.length + ")")));
        sec.appendChild(el("ul", { class: "dict" }, group.map(function (x) {
          return el("li", null,
            el("div", { class: "setting" }, "In: " + settingLine(x.r.view)),
            el("div", { class: "stmt" }, x.r.statement),
            el("div", { class: "cite" },
              el("a", { href: "./?p=" + encodeURIComponent(x.p.key) }, authorShort(x.p) + " " + x.p.year), ", ",
              sourceLink(x.r), " · ", statusPill(x.r.status), " · ",
              "moves the mean predictor: " + lab("moves_mean", x.r.mechanism.moves_mean)));
        })));
      });
      box.appendChild(sec);
    });
    math(box);
    if (location.hash) { var target = document.getElementById(location.hash.slice(1)); if (target) target.scrollIntoView(); }
  }

  // ------------------------------------------------------- open-problems page

  function initOpenProblems() {
    var box = $("#ops");
    box.appendChild(el("ul", { class: "toc" }, D.open_problems.map(function (o) {
      return el("li", null, el("a", { href: "#" + o.id }, o.rank + ". " + o.title));
    })));
    D.open_problems.forEach(function (o) {
      var papers = o.papers.map(function (k) { return byKey[k]; }).filter(Boolean);
      box.appendChild(el("section", { id: o.id },
        el("h2", null, o.rank + ". " + o.title, " ", pill("", o.status)),
        el("div", { class: "op-body", html: o.html }),
        el("div", { class: "op-papers" },
          el("strong", null, "Papers in the map that touch it: "),
          papers.length ? el("ul", null, papers.map(function (p) {
            return el("li", null, el("a", { href: "./?p=" + encodeURIComponent(p.key) }, p.title),
              " (" + authorShort(p) + " " + p.year + ")",
              o.answered_by.indexOf(p.key) >= 0 ? el("span", { class: "muted" }, " · answers part of it") : null);
          })) : el("span", { class: "muted" }, "none yet.")),
        D.repo ? el("p", { class: "muted" }, extLink(D.repo + "/blob/main/" + o.file, "Edit on GitHub")) : null));
    });
    math(box);
    if (location.hash) { var target = document.getElementById(location.hash.slice(1)); if (target) target.scrollIntoView(); }
  }

  // ------------------------------------------------------------------- start

  function start(data) {
    D = data;
    V = data.vocab.fields;
    D.papers.forEach(function (p) { byKey[p.key] = p; byBase[p.base] = p; });
    setupChrome();
    if (PAGE === "table") initTable();
    else if (PAGE === "mechanisms") initMechanisms();
    else if (PAGE === "open-problems") initOpenProblems();
  }

  setupTheme();
  fetch("data.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(start)
    .catch(function (e) {
      var main = $("#content");
      if (main) main.appendChild(el("p", { class: "muted" }, "Could not load data.json (" + e.message + "). Serve the site over HTTP, e.g. python -m http.server -d _site."));
    });
})();
