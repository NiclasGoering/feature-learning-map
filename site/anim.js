/* Overview animations. One IIFE, vanilla JS, Canvas 2D. Each of the seven widgets is
   created the first time its panel opens, and stops drawing when the panel is closed,
   scrolled out of view or the tab is hidden. Colours are read from the CSS variables
   of the page (so the dark and light themes both work). */
(function () {
"use strict";

var D = document;
var DPR = Math.min(window.devicePixelRatio || 1, 2);
var MQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
function reduced() { return !!MQ.matches; }

/* ------------------------------------------------------------------ palette */
var PAL = {}, rgbCache = {};
function parseColor(c) {
  c = String(c).trim();
  if (rgbCache[c]) return rgbCache[c];
  var v;
  if (c[0] === "#") {
    if (c.length === 4) c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    v = [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)];
  } else {
    var m = c.match(/[\d.]+/g);
    v = m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
  }
  rgbCache[c] = v;
  return v;
}
function rgba(c, a) { var v = parseColor(c); return "rgba(" + v[0] + "," + v[1] + "," + v[2] + "," + a + ")"; }
function mix(c1, c2, t) {
  var a = parseColor(c1), b = parseColor(c2);
  return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * t) + "," + Math.round(a[1] + (b[1] - a[1]) * t) + "," + Math.round(a[2] + (b[2] - a[2]) * t) + ")";
}
function readPalette() {
  var cs = getComputedStyle(D.documentElement);
  function g(n, fb) { var v = cs.getPropertyValue(n).trim(); return v || fb; }
  PAL = {
    ent: g("--c-ent", "#8ab4f8"), en: g("--c-en", "#f2b366"), kap: g("--c-kap", "#8fd6a2"), gd: g("--c-gd", "#c8a2f0"),
    fg: g("--fg", "#ebe7df"), muted: g("--fg-muted", "#9d988f"), faint: g("--fg-faint", "#6f6b64"),
    line: g("--line", "#262626"), strong: g("--line-strong", "#4a4742"), bg: g("--bg", "#000"), raised: g("--bg-raised", "#0b0b0b")
  };
  PAL.font = getComputedStyle(D.body).fontFamily || "serif";
}

/* ---------------------------------------------------------------- tiny DOM */
function el(tag, props, kids) {
  var n = D.createElement(tag);
  if (props) for (var k in props) {
    if (k === "text") n.textContent = props[k];
    else if (k === "html") n.innerHTML = props[k];
    else if (k === "class") n.className = props[k];
    else if (k === "style") n.style.cssText = props[k];
    else n.setAttribute(k, props[k]);
  }
  (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
  return n;
}
function tex(node, src) {
  if (window.katex) { try { window.katex.render(src, node, { throwOnError: false, strict: false }); return node; } catch (e) { /* fall through */ } }
  node.textContent = src.replace(/[\\{}]/g, "");
  return node;
}
function label(texSrc) { var s = el("span", { class: "an-lab" }); tex(s, texSrc); return s; }

function math(node) {
  if (window.renderMathInElement) {
    try { window.renderMathInElement(node, { delimiters: [{ left: "$", right: "$", display: false }], throwOnError: false, strict: false }); } catch (e) { /* leave the TeX source */ }
  }
}

var uid = 0;
function slider(o) {
  var id = "an-s" + (++uid);
  var inp = el("input", { type: "range", id: id, min: o.min, max: o.max, step: o.step || "any", value: o.value });
  if (o.color) inp.style.accentColor = o.color;
  var out = el("output", { class: "an-out", for: id });
  var lab = el("label", { for: id, class: "an-slide" }, [label(o.tex), inp, out]);
  function show() { out.textContent = o.fmt ? o.fmt(+inp.value) : inp.value; }
  inp.addEventListener("input", function () { show(); o.onInput(+inp.value); });
  show();
  return { row: lab, input: inp, set: function (v) { inp.value = v; show(); }, get: function () { return +inp.value; }, show: show };
}
function segmented(o) {
  var name = "an-g" + (++uid), box = el("span", { class: "an-seg", role: "radiogroup" });
  if (o.tex) box.appendChild(label(o.tex));
  var inputs = [];
  o.options.forEach(function (op, i) {
    var id = name + "-" + i;
    var inp = el("input", { type: "radio", name: name, id: id, value: op.value });
    if (op.value === o.value) inp.checked = true;
    var lab = el("label", { for: id, class: "an-opt" }, [inp]);
    var t = el("span"); if (op.tex) tex(t, op.tex); else t.textContent = op.text; lab.appendChild(t);
    if (op.cls) lab.classList.add(op.cls);
    inp.addEventListener("change", function () { if (inp.checked) o.onChange(op.value); });
    inputs.push(inp); box.appendChild(lab);
  });
  return { row: box, set: function (v) { inputs.forEach(function (i) { i.checked = (i.value === String(v)); }); } };
}
function button(text, fn) { var b = el("button", { type: "button", class: "an-btn", text: text }); b.addEventListener("click", fn); return b; }

/* ------------------------------------------------------------------ canvas */
function Canvas(host, o) {
  var c = el("canvas", { class: "an-cv" + (o.drag ? " an-drag" : ""), "aria-label": o.aria || "", role: "img" });
  host.appendChild(c);
  var self = { el: c, ctx: c.getContext("2d"), w: 300, h: 200, aspect: o.aspect || 0.75, onDraw: o.draw || function () {} };
  self.resize = function () {
    var w = Math.max(120, Math.floor(c.clientWidth || host.clientWidth || 300));
    var h = o.height ? Math.round(o.height(w)) : Math.round(w * self.aspect);
    if (o.maxH) h = Math.min(h, o.maxH);
    if (o.minH) h = Math.max(h, o.minH);
    if (w === self.w && h === self.h && c.width === Math.round(w * DPR)) return false;
    self.w = w; self.h = h;
    c.style.height = h + "px";
    c.width = Math.round(w * DPR); c.height = Math.round(h * DPR);
    return true;
  };
  self.draw = function () {
    self.resize();
    var g = self.ctx;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, self.w, self.h);
    g.fillStyle = PAL.bg; g.fillRect(0, 0, self.w, self.h);
    self.onDraw(g, self.w, self.h);
  };
  return self;
}
/* pointer dragging: hit(x,y) -> token or null; move(token,x,y); end() */
function dragging(cv, o) {
  var tok = null, c = cv.el;
  function pos(e) { var r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  c.addEventListener("pointerdown", function (e) {
    var p = pos(e), t = o.hit(p[0], p[1]);
    if (t === null || t === undefined) return;
    tok = t; c.setPointerCapture(e.pointerId); c.classList.add("grab"); e.preventDefault();
    o.move(tok, p[0], p[1]);
  });
  c.addEventListener("pointermove", function (e) {
    var p = pos(e);
    if (tok !== null) { o.move(tok, p[0], p[1]); return; }
    c.style.cursor = (o.hit(p[0], p[1]) !== null && o.hit(p[0], p[1]) !== undefined) ? "grab" : "default";
  });
  function up(e) { if (tok === null) return; tok = null; c.classList.remove("grab"); try { c.releasePointerCapture(e.pointerId); } catch (x) { /* released */ } if (o.end) o.end(); }
  c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
}

/* ------------------------------------------------------------ drawing help */
function setFont(g, size, o) {
  o = o || {};
  g.font = (o.italic ? "italic " : "") + (o.bold ? "600 " : "") + size + "px " + PAL.font;
}
function text(g, s, x, y, o) {
  o = o || {};
  setFont(g, o.size || 12, o);
  g.fillStyle = o.color || PAL.fg; g.textAlign = o.align || "left"; g.textBaseline = o.base || "alphabetic";
  g.fillText(s, x, y);
}
/* a row of coloured captions that wraps to fit maxW; the last line sits on baseline y */
function legend(g, items, x, y, maxW, lh) {
  lh = lh || 14;
  var pos = [], cx = x, line = 0, i;
  setFont(g, 10.5);
  for (i = 0; i < items.length; i++) {
    var w = g.measureText(items[i].t).width;
    if (cx + w > x + maxW && cx > x) { cx = x; line++; }
    pos.push([cx, line]); cx += w + 14;
  }
  for (i = 0; i < items.length; i++) text(g, items[i].t, pos[i][0], y - (line - pos[i][1]) * lh, { size: 10.5, color: items[i].c });
}
function path(g, pts, close) {
  g.beginPath();
  for (var i = 0; i < pts.length; i++) { if (i) g.lineTo(pts[i][0], pts[i][1]); else g.moveTo(pts[i][0], pts[i][1]); }
  if (close) g.closePath();
}
function stroke(g, color, w, dash) { g.strokeStyle = color; g.lineWidth = w || 1; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]); }
function disc(g, x, y, r, fill, line) {
  g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (line) { g.strokeStyle = line; g.lineWidth = 1.2; g.stroke(); }
}
function arrow(g, x1, y1, x2, y2, color, w, head) {
  var dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy); if (L < 1) return;
  head = head || 6;
  var ux = dx / L, uy = dy / L;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2 - ux * head * 0.6, y2 - uy * head * 0.6); stroke(g, color, w || 1.4);
  g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - ux * head - uy * head * 0.45, y2 - uy * head + ux * head * 0.45);
  g.lineTo(x2 - ux * head + uy * head * 0.45, y2 - uy * head - ux * head * 0.45); g.closePath(); g.fillStyle = color; g.fill();
}
/* a linear map from data to a pixel rectangle */
function Frame(x, y, w, h, x0, x1, y0, y1) {
  var f = { x: x, y: y, w: w, h: h, x0: x0, x1: x1, y0: y0, y1: y1 };
  f.X = function (v) { return f.x + (v - f.x0) / (f.x1 - f.x0) * f.w; };
  f.Y = function (v) { return f.y + f.h - (v - f.y0) / (f.y1 - f.y0) * f.h; };
  f.iX = function (p) { return f.x0 + (p - f.x) / f.w * (f.x1 - f.x0); };
  f.iY = function (p) { return f.y0 + (f.y + f.h - p) / f.h * (f.y1 - f.y0); };
  return f;
}
function niceStep(range, n) {
  var raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}
function fmt(x, d) {
  if (!isFinite(x)) return x > 0 ? "∞" : "−∞";
  var s = Math.abs(x) >= 1e4 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(1) : x.toFixed(d === undefined ? 2 : d);
  return s.replace("-", "−");
}
function axes(g, fr, o) {
  o = o || {};
  g.beginPath(); g.moveTo(fr.x, fr.y); g.lineTo(fr.x, fr.y + fr.h); g.lineTo(fr.x + fr.w, fr.y + fr.h); stroke(g, PAL.strong, 1);
  if (o.xticks) o.xticks.forEach(function (t) {
    var px = fr.X(t.v); g.beginPath(); g.moveTo(px, fr.y + fr.h); g.lineTo(px, fr.y + fr.h + 3); stroke(g, PAL.strong, 1);
    text(g, t.s, px, fr.y + fr.h + 14, { size: 10.5, color: PAL.muted, align: "center" });
  });
  if (o.yticks) o.yticks.forEach(function (t) {
    var py = fr.Y(t.v); g.beginPath(); g.moveTo(fr.x - 3, py); g.lineTo(fr.x, py); stroke(g, PAL.strong, 1);
    text(g, t.s, fr.x - 5, py + 3.5, { size: 10.5, color: PAL.muted, align: "right" });
  });
  if (o.xlabel) text(g, o.xlabel, fr.x + fr.w, fr.y + fr.h + (o.xticks ? 27 : 14), { size: 11.5, color: o.xcolor || PAL.muted, align: "right", italic: true });
  if (o.ylabel) text(g, o.ylabel, fr.x + 2, fr.y - 5, { size: 11.5, color: o.ycolor || PAL.muted, italic: true });
}
function linTicks(lo, hi, n) {
  var st = niceStep(hi - lo, n), out = [], v = Math.ceil(lo / st - 1e-9) * st;
  for (; v <= hi + 1e-9; v += st) out.push({ v: v, s: fmt(Math.abs(v) < 1e-12 ? 0 : v, st < 1 ? (st < 0.1 ? 2 : 1) : 0) });
  return out;
}
/* P x P matrix as a map from bg (low) to fg (high), 0 in the middle */
function heatmap(g, M, x, y, size, vmax, o) {
  o = o || {};
  var n = M.length, m = M[0].length, cw = size / m, ch = size / n;
  for (var i = 0; i < n; i++) for (var j = 0; j < m; j++) {
    var t = Math.max(0, Math.min(1, (M[i][j] / vmax + 1) / 2));
    g.fillStyle = mix(PAL.bg, PAL.fg, t * 0.9 + (o.tint ? 0 : 0));
    g.fillRect(x + j * cw, y + i * ch, cw - 0.5, ch - 0.5);
    if (cw >= 24) text(g, fmt(M[i][j], 2), x + (j + 0.5) * cw, y + (i + 0.5) * ch + 3.5, { size: Math.min(11, cw * 0.36), color: t > 0.62 ? PAL.bg : PAL.fg, align: "center" });
  }
  g.strokeStyle = o.frame || PAL.strong; g.lineWidth = 1; g.strokeRect(x - 0.5, y - 0.5, size + 0.5, size + 0.5);
}
/* ellipse {x : x^T K^{-1} x = s^2} for a 2x2 K, as a closed polyline in data coordinates */
function ellipsePts(K, s, n) {
  var a = K[0][0], b = K[0][1], d = K[1][1], tr = a + d, det = a * d - b * b;
  var disc2 = Math.sqrt(Math.max(0, tr * tr / 4 - det)), l1 = tr / 2 + disc2, l2 = Math.max(tr / 2 - disc2, 1e-12);
  var ang = Math.abs(b) < 1e-14 ? (a >= d ? 0 : Math.PI / 2) : Math.atan2(l1 - a, b);
  var c = Math.cos(ang), sn = Math.sin(ang), r1 = s * Math.sqrt(l1), r2 = s * Math.sqrt(l2), pts = [];
  n = n || 90;
  for (var i = 0; i <= n; i++) { var t = 2 * Math.PI * i / n, u = r1 * Math.cos(t), v = r2 * Math.sin(t); pts.push([c * u - sn * v, sn * u + c * v]); }
  return pts;
}
/* marching squares: calls seg(x1,y1,x2,y2) in grid coordinates for one level */
function contourSegs(F, nx, ny, level, seg) {
  function at(i, j) { return F[j * nx + i]; }
  function lerp(a, b) { return (level - a) / (b - a); }
  for (var j = 0; j < ny - 1; j++) for (var i = 0; i < nx - 1; i++) {
    var a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    var code = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (c > level ? 4 : 0) | (d > level ? 8 : 0);
    if (code === 0 || code === 15) continue;
    var top = [i + lerp(a, b), j], right = [i + 1, j + lerp(b, c)], bottom = [i + lerp(d, c), j + 1], left = [i, j + lerp(a, d)];
    function s(p, q) { seg(p[0], p[1], q[0], q[1]); }
    switch (code) {
      case 1: case 14: s(left, top); break;
      case 2: case 13: s(top, right); break;
      case 3: case 12: s(left, right); break;
      case 4: case 11: s(right, bottom); break;
      case 5: s(left, top); s(right, bottom); break;
      case 6: case 9: s(top, bottom); break;
      case 7: case 8: s(left, bottom); break;
      case 10: s(top, right); s(left, bottom); break;
    }
  }
}

/* ------------------------------------------------------------- numerics */
function rng(seed) {
  var s = seed >>> 0;
  function u() { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  var spare = null;
  function gauss() {
    if (spare !== null) { var v = spare; spare = null; return v; }
    var a = u() || 1e-12, b = u(), r = Math.sqrt(-2 * Math.log(a));
    spare = r * Math.sin(2 * Math.PI * b); return r * Math.cos(2 * Math.PI * b);
  }
  return { u: u, gauss: gauss };
}
function inv2(C) { var d = C[0][0] * C[1][1] - C[0][1] * C[1][0]; return [[C[1][1] / d, -C[0][1] / d], [-C[1][0] / d, C[0][0] / d]]; }
function mv2(M, v) { return [M[0][0] * v[0] + M[0][1] * v[1], M[1][0] * v[0] + M[1][1] * v[1]]; }
function dot2(a, b) { return a[0] * b[0] + a[1] * b[1]; }
function quad2(M, v) { return dot2(v, mv2(M, v)); }
/* Cholesky and solves for small dense SPD matrices (arrays of arrays) */
function chol(A) {
  var n = A.length, L = [], i, j, k, s;
  for (i = 0; i < n; i++) { L.push(new Array(n).fill(0)); }
  for (i = 0; i < n; i++) for (j = 0; j <= i; j++) {
    s = A[i][j]; for (k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
  }
  return L;
}
function solveSPD(A, b) {
  var n = A.length, L = chol(A), y = new Array(n), x = new Array(n), i, k, s;
  for (i = 0; i < n; i++) { s = b[i]; for (k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
  for (i = n - 1; i >= 0; i--) { s = y[i]; for (k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
  return x;
}
function invSPD(A) {
  var n = A.length, out = [], j, e, col, i;
  for (i = 0; i < n; i++) out.push(new Array(n));
  for (j = 0; j < n; j++) { e = new Array(n).fill(0); e[j] = 1; col = solveSPD(A, e); for (i = 0; i < n; i++) out[i][j] = col[i]; }
  return out;
}
function logdetSPD(A) { var L = chol(A), s = 0; for (var i = 0; i < A.length; i++) s += 2 * Math.log(L[i][i]); return s; }
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function frob(A) { var s = 0; A.forEach(function (r) { r.forEach(function (v) { s += v * v; }); }); return Math.sqrt(s); }
function sub(A, B) { return A.map(function (r, i) { return r.map(function (v, j) { return v - B[i][j]; }); }); }

/* ------------------------------------------------------------------------
   Single-site solver for P = 2 and a positively homogeneous activation
   (ReLU, or the identity). A neuron's preactivation h in R^2 has prior
   N(0, C0). In polar form h = r e the radial integrals are exact, so the
   tilted law  nu(h) ∝ N(h;0,C0) exp(kappa/2 (v·phi(h))^2)  needs only a sum over
   the angle of e:  with q(e) = e^T C0^-1 e  and  a(e) = q(e) - kappa (v·phi(e))^2,
       Z = Σ w / a,     K = E_nu[phi phi^T] = (1/Z) Σ w phi phi^T 2 / a^2 .
   The self-consistent kernel solves K(v) v = y; this is the stationarity
   condition of G(v) = kappa v·y - log Z(v), which is concave, so damped
   Newton converges. Then  J = KL(nu || N(0,C0)) = kappa/2 v^T K v - log Z  and
   E = 1/2 y^T K^-1 y = 1/2 y·v.
   ------------------------------------------------------------------------ */
function Site(C0, act, nth) {
  nth = nth || 2880;
  var Ci = inv2(C0), det = C0[0][0] * C0[1][1] - C0[0][1] * C0[1][0], s = this;
  s.C0 = C0; s.act = act; s.n = nth;
  s.p0 = new Float64Array(nth); s.p1 = new Float64Array(nth); s.d0 = new Float64Array(nth); s.d1 = new Float64Array(nth);
  s.q = new Float64Array(nth); s.w = new Float64Array(nth); s.th = new Float64Array(nth);
  var dth = 2 * Math.PI / nth, c = 1 / (2 * Math.PI * Math.sqrt(det));
  for (var k = 0; k < nth; k++) {
    var t = (k + 0.5) * dth, e0 = Math.cos(t), e1 = Math.sin(t), relu = act === "relu";
    s.th[k] = t;
    s.p0[k] = relu ? Math.max(e0, 0) : e0; s.p1[k] = relu ? Math.max(e1, 0) : e1;
    s.d0[k] = relu ? (e0 > 0 ? 1 : 0) : 1; s.d1[k] = relu ? (e1 > 0 ? 1 : 0) : 1;
    s.q[k] = Ci[0][0] * e0 * e0 + 2 * Ci[0][1] * e0 * e1 + Ci[1][1] * e1 * e1;
    s.w[k] = dth * c;
  }
  s.K0 = s.eval(0, [0, 0]).K;
  /* E_0[phi'(h) phi'(h)^T] : radial integral of r exp(-r^2 q/2) is 1/q */
  var m00 = 0, m01 = 0, m11 = 0;
  for (k = 0; k < nth; k++) { var g = s.w[k] / s.q[k]; m00 += g * s.d0[k] * s.d0[k]; m01 += g * s.d0[k] * s.d1[k]; m11 += g * s.d1[k] * s.d1[k]; }
  s.D0 = [[m00, m01], [m01, m11]];
}
Site.prototype.eval = function (kappa, v) {
  var n = this.n, Z = 0, k00 = 0, k01 = 0, k11 = 0, amin = 1e9;
  for (var k = 0; k < n; k++) {
    var p0 = this.p0[k], p1 = this.p1[k], u = v[0] * p0 + v[1] * p1, a = this.q[k] - kappa * u * u;
    if (a < amin) amin = a;
    if (a <= 1e-9) return { ok: false, amin: a };
    var w = this.w[k], ia = 1 / a, g = 2 * w * ia * ia;
    Z += w * ia; k00 += g * p0 * p0; k01 += g * p0 * p1; k11 += g * p1 * p1;
  }
  return { ok: true, Z: Z, K: [[k00 / Z, k01 / Z], [k01 / Z, k11 / Z]], amin: amin };
};
Site.prototype.pack = function (kappa, v, y, ev) {
  ev = ev || this.eval(kappa, v);
  var K = ev.K, Kv = mv2(K, v), vKv = dot2(v, Kv);
  var J = kappa / 2 * vKv - Math.log(ev.Z), E = 0.5 * dot2(y, v);
  return { kappa: kappa, v: v, K: K, Z: ev.Z, J: J, E: E, F: J + kappa * E, res: Math.hypot(Kv[0] - y[0], Kv[1] - y[1]), amin: ev.amin };
};
Site.prototype.solve = function (kappa, y, v0) {
  var Ki = inv2(this.K0), v = v0 ? v0.slice() : mv2(Ki, y);
  if (kappa <= 0) return this.pack(0, mv2(Ki, y), y, { Z: 1, K: this.K0, amin: 0 });
  var ev = this.eval(kappa, v), sc = 1;
  while (!ev.ok && sc > 1e-8) { sc *= 0.6; ev = this.eval(kappa, [v[0] * sc, v[1] * sc]); }
  if (!ev.ok) return this.pack(0, mv2(Ki, y), y, { Z: 1, K: this.K0, amin: 0 });
  v = [v[0] * sc, v[1] * sc];
  function G(e, vv) { return kappa * dot2(vv, y) - Math.log(e.Z); }
  var Gv = G(ev, v), it, n = this.n;
  for (it = 0; it < 60; it++) {
    var K = ev.K, Kv = mv2(K, v), g = [kappa * (y[0] - Kv[0]), kappa * (y[1] - Kv[1])];
    if (Math.abs(g[0]) + Math.abs(g[1]) < 1e-11 * Math.max(kappa, 1e-3)) break;
    var h00 = 0, h01 = 0, h11 = 0, Z = ev.Z;
    for (var k = 0; k < n; k++) {
      var p0 = this.p0[k], p1 = this.p1[k], u = v[0] * p0 + v[1] * p1, ia = 1 / (this.q[k] - kappa * u * u);
      var c = this.w[k] * (2 * kappa * ia * ia + 8 * kappa * kappa * u * u * ia * ia * ia) / Z;
      h00 += c * p0 * p0; h01 += c * p0 * p1; h11 += c * p1 * p1;
    }
    var g0 = kappa * Kv[0], g1 = kappa * Kv[1];
    h00 -= g0 * g0; h01 -= g0 * g1; h11 -= g1 * g1;
    var dt = h00 * h11 - h01 * h01;
    var dv = [(h11 * g[0] - h01 * g[1]) / dt, (-h01 * g[0] + h00 * g[1]) / dt];
    var t = 1, nv = null, ne = null, Gn = 0, b;
    for (b = 0; b < 40; b++) {
      nv = [v[0] + t * dv[0], v[1] + t * dv[1]]; ne = this.eval(kappa, nv);
      if (ne.ok) { Gn = G(ne, nv); if (Gn >= Gv - 1e-13) break; }
      t *= 0.5;
    }
    if (b >= 40) break;
    v = nv; ev = ne; Gv = Gn;
  }
  var r = this.pack(kappa, v, y, ev); r.iters = it; return r;
};
/* tilted density of the single-site law at h (2-vector) */
Site.prototype.density = function (sol, h) {
  var C = this.C0, Ci = inv2(C), det = C[0][0] * C[1][1] - C[0][1] * C[1][0];
  var ph = this.act === "relu" ? [Math.max(h[0], 0), Math.max(h[1], 0)] : h;
  var u = dot2(sol.v, ph);
  return Math.exp(-0.5 * quad2(Ci, h) + sol.kappa / 2 * u * u) / (2 * Math.PI * Math.sqrt(det) * sol.Z);
};
Site.prototype.phi = function (h) { return this.act === "relu" ? [Math.max(h[0], 0), Math.max(h[1], 0)] : [h[0], h[1]]; };


/* density of a single-site law on a square window [-R,R]^2: blue glow plus contours at fractions of the peak */
function DensityView(NG) {
  NG = NG || 96;
  var off = D.createElement("canvas"); off.width = off.height = NG;
  var og = off.getContext("2d"), img = og.createImageData(NG, NG), field = new Float32Array(NG * NG);
  return function (g, fr, site, sol, R, levels) {
    var i, j, dmax = 0;
    for (j = 0; j < NG; j++) for (i = 0; i < NG; i++) {
      var d = site.density(sol, [-R + (i + 0.5) / NG * 2 * R, R - (j + 0.5) / NG * 2 * R]);
      field[j * NG + i] = d; if (d > dmax) dmax = d;
    }
    var c = parseColor(PAL.ent), px = img.data, dark = parseColor(PAL.bg)[0] < 128;
    for (i = 0; i < NG * NG; i++) { px[4 * i] = c[0]; px[4 * i + 1] = c[1]; px[4 * i + 2] = c[2]; px[4 * i + 3] = Math.round(Math.pow(field[i] / dmax, 0.75) * (dark ? 200 : 170)); }
    og.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(off, fr.x, fr.y, fr.w, fr.h);
    (levels || [0.12, 0.3, 0.55, 0.8]).forEach(function (lv) {
      g.beginPath();
      contourSegs(field, NG, NG, lv * dmax, function (x1, y1, x2, y2) { g.moveTo(fr.x + (x1 + 0.5) / NG * fr.w, fr.y + (y1 + 0.5) / NG * fr.h); g.lineTo(fr.x + (x2 + 0.5) / NG * fr.w, fr.y + (y2 + 0.5) / NG * fr.h); });
      stroke(g, rgba(PAL.ent, 0.85), 1);
    });
  };
}

/* ----------------------------------------------------------- widget runtime */
var FACT = {}, RECS = [];
function onPalette() {
  readPalette();
  RECS.forEach(function (r) { r.dirty = true; if (r.inst && r.active()) r.inst.redraw(); });
}
function setupPanel(details) {
  var n = +details.id.replace("anim-", "");
  var rec = { n: n, d: details, body: details.querySelector(".an-body"), inst: null, visible: false, raf: 0, last: 0, dirty: true };
  rec.active = function () { return details.open && rec.visible && !D.hidden; };
  function frame(t) {
    rec.raf = 0;
    if (!rec.active() || !rec.inst) return;
    var dt = Math.min(0.05, (t - rec.last) / 1000); rec.last = t;
    if (rec.inst.step) rec.inst.step(dt);
    rec.inst.redraw();
    if (rec.inst.live && rec.inst.live()) rec.raf = requestAnimationFrame(frame);
  }
  rec.kick = function () { if (rec.active() && rec.inst && !rec.raf) { rec.last = performance.now(); rec.raf = requestAnimationFrame(frame); } };
  function ensure() {
    if (rec.inst || !details.open || !FACT[n]) return;
    try {
      rec.inst = FACT[n](rec.body, { kick: rec.kick, reduced: reduced });
    } catch (e) {
      rec.body.appendChild(el("p", { class: "an-note", text: "This animation could not start: " + e.message }));
      if (window.console) console.error(e);
    }
  }
  function inView() { var r = details.getBoundingClientRect(); return r.bottom > 0 && r.top < (window.innerHeight || D.documentElement.clientHeight); }
  function update() {
    rec.visible = inView();
    ensure();
    if (rec.active() && rec.inst) { rec.inst.redraw(); rec.kick(); }
    else if (rec.raf) { cancelAnimationFrame(rec.raf); rec.raf = 0; }
  }
  details.addEventListener("toggle", update);
  D.addEventListener("visibilitychange", update);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function () { update(); }).observe(details);
  }
  window.addEventListener("scroll", function () { var v = inView(); if (v !== rec.visible) update(); }, { passive: true });
  window.addEventListener("resize", function () { if (rec.active() && rec.inst) rec.inst.redraw(); });
  if ("ResizeObserver" in window) {
    new ResizeObserver(function () { if (rec.active() && rec.inst && !rec.raf) rec.inst.redraw(); }).observe(rec.body);
  }
  RECS.push(rec);
  return rec;
}
function openFromHash(scroll) {
  var m = /^#anim-(\d)$/.exec(location.hash);
  if (!m) return;
  var d = D.getElementById("anim-" + m[1]);
  if (!d) return;
  d.open = true;
  if (scroll) setTimeout(function () { d.scrollIntoView({ block: "start" }); }, 60);
}
function boot() {
  readPalette();
  var panels = D.querySelectorAll("details.ov-anim");
  if (!panels.length) return;
  for (var i = 0; i < panels.length; i++) setupPanel(panels[i]);
  D.querySelectorAll("a.animlink").forEach(function (a) {
    a.addEventListener("click", function () { var d = D.getElementById(a.getAttribute("href").slice(1)); if (d) d.open = true; });
  });
  new MutationObserver(onPalette).observe(D.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  var tb = D.getElementById("theme");
  if (tb) tb.addEventListener("click", function () { setTimeout(onPalette, 30); });
  if (MQ.addEventListener) MQ.addEventListener("change", function () { RECS.forEach(function (r) { if (r.inst && r.active()) r.inst.redraw(); }); });
  window.addEventListener("hashchange", function () { openFromHash(true); });
  openFromHash(true);
  window.addEventListener("load", function () { if (/^#anim-/.test(location.hash)) openFromHash(true); });
}

/* =====================================================================
   1  Setup: sampled finite-width network, kernels K^0 -> K^L, outputs
   ===================================================================== */
FACT[1] = function (root, env) {
  var P = 4, d = 2, NMAX = 10000, S_GN = 24;
  var X = [[1.0, 0.3], [0.25, 1.0], [-0.95, 0.45], [-0.4, -1.0]].map(function (v) { return [v[0] * 2.2, v[1] * 2.2]; });
  var Y = [0.5, 0.4, -0.4, -0.5];
  var st = { gamma: "ntk", N: 1000, g0: 1, L: 2, fit: "readout", t: 0, seed: 7, playing: false };
  var bank, nngp, net, rdo, hid, dirty = true;

  /* ---- exact infinite-width kernels: K^l = E[phi(u) phi(v)], (u,v) ~ N(0, K^{l-1}) ---- */
  function tanhMap(C) {
    var nz = 81, zs = [], ws = [], tot = 0, i, j, out = [[0, 0], [0, 0]];
    for (i = 0; i < nz; i++) { var z = -6 + 12 * i / (nz - 1); zs.push(z); var w = Math.exp(-z * z / 2); ws.push(w); tot += w; }
    for (i = 0; i < nz; i++) ws[i] /= tot;
    var n = C.length, K = [];
    for (var p = 0; p < n; p++) { K.push(new Array(n).fill(0)); }
    for (var p2 = 0; p2 < n; p2++) for (var q = p2; q < n; q++) {
      var a = C[p2][p2], b = C[p2][q], c = C[q][q], sa = Math.sqrt(a), r = b / sa, s2 = Math.sqrt(Math.max(c - r * r, 0)), acc = 0;
      for (i = 0; i < nz; i++) {
        var u = Math.tanh(sa * zs[i]);
        for (j = 0; j < nz; j++) acc += ws[i] * ws[j] * u * Math.tanh(r * zs[i] + s2 * zs[j]);
      }
      K[p2][q] = K[q][p2] = acc;
    }
    return K;
  }
  function gram0() { return X.map(function (a) { return X.map(function (b) { return (a[0] * b[0] + a[1] * b[1]) / d; }); }); }
  nngp = [gram0()];
  for (var l = 1; l <= 3; l++) nngp.push(tanhMap(nngp[l - 1]));

  /* ---- randomness: nested in N, so growing N refines the same network ---- */
  function makeBank(seed) {
    var g = rng(seed), b = { W1: new Float64Array(NMAX * d), Z: [null, null, new Float64Array(NMAX * P), new Float64Array(NMAX * P)], a: new Float64Array(NMAX) }, i;
    for (i = 0; i < NMAX * d; i++) b.W1[i] = g.gauss();
    for (i = 0; i < NMAX * P; i++) { b.Z[2][i] = g.gauss(); b.Z[3][i] = g.gauss(); }
    for (i = 0; i < NMAX; i++) b.a[i] = g.gauss();
    return b;
  }
  function gramPhi(Phi, N) {
    var K = [], p, q, i;
    for (p = 0; p < P; p++) K.push(new Array(P).fill(0));
    for (i = 0; i < N; i++) for (p = 0; p < P; p++) { var v = Phi[i * P + p]; for (q = p; q < P; q++) K[p][q] += v * Phi[i * P + q]; }
    for (p = 0; p < P; p++) for (q = p; q < P; q++) { K[p][q] /= N; K[q][p] = K[p][q]; }
    return K;
  }
  function forward(N, L) {
    var Ks = [nngp[0]], Phi = new Float64Array(N * P), H = new Float64Array(N * P), i, p, q;
    for (i = 0; i < N; i++) for (p = 0; p < P; p++) {
      var h = (bank.W1[i * 2] * X[p][0] + bank.W1[i * 2 + 1] * X[p][1]) / Math.sqrt(d);
      H[i * P + p] = h; Phi[i * P + p] = Math.tanh(h);
    }
    Ks.push(gramPhi(Phi, N));
    var Kprev = Ks[0];
    for (var l = 2; l <= L; l++) {
      var Kp = Ks[l - 1], C = chol(Kp.map(function (r, a) { return r.map(function (v, b) { return v + (a === b ? 1e-9 : 0); }); }));
      for (i = 0; i < N; i++) for (p = 0; p < P; p++) {
        var s = 0; for (q = 0; q <= p; q++) s += C[p][q] * bank.Z[l][i * P + q];
        H[i * P + p] = s; Phi[i * P + p] = Math.tanh(s);
      }
      Kprev = Kp; Ks.push(gramPhi(Phi, N));
    }
    return { N: N, L: L, K: Ks, Phi: Phi, H: H, Kprev: Kprev };
  }
  function outputs(nt, gam) {
    var N = nt.N, f = new Array(P).fill(0), i, p, a2 = 0;
    for (i = 0; i < N; i++) { var ai = bank.a[i]; a2 += ai * ai; for (p = 0; p < P; p++) f[p] += ai * nt.Phi[i * P + p]; }
    for (p = 0; p < P; p++) f[p] /= gam * Math.sqrt(N);
    return { f: f, a2: a2 };
  }
  function ridge(A, e) { return A.map(function (r, i) { return r.map(function (v, j) { return v + (i === j ? e : 0); }); }); }

  /* ---- hidden-layer route: linearised min-norm (Gauss-Newton) steps on W^L ---- */
  function hiddenPath(nt, gam) {
    var N = nt.N, h = Float64Array.from(nt.H), Phi = new Float64Array(N * P), dPhi = new Float64Array(N * P), a = bank.a;
    var Kp = nt.Kprev, path = { f: [], K: [] }, i, p, q, s;
    function refresh() {
      for (i = 0; i < N * P; i++) { var t = Math.tanh(h[i]); Phi[i] = t; dPhi[i] = 1 - t * t; }
      var f = new Array(P).fill(0);
      for (i = 0; i < N; i++) for (p = 0; p < P; p++) f[p] += a[i] * Phi[i * P + p];
      for (p = 0; p < P; p++) f[p] /= gam * Math.sqrt(N);
      path.f.push(f); path.K.push(gramPhi(Phi, N));
    }
    refresh();
    for (s = 0; s < S_GN; s++) {
      var f = path.f[s], r = [], G = [];
      for (p = 0; p < P; p++) r.push((Y[p] - f[p]) / (S_GN - s));
      for (p = 0; p < P; p++) { G.push(new Array(P).fill(0)); }
      for (i = 0; i < N; i++) { var a2 = a[i] * a[i]; for (p = 0; p < P; p++) for (q = p; q < P; q++) G[p][q] += a2 * dPhi[i * P + p] * dPhi[i * P + q]; }
      for (p = 0; p < P; p++) for (q = p; q < P; q++) { G[p][q] = G[p][q] / N * Kp[p][q] / (gam * gam); G[q][p] = G[p][q]; }
      var tr = 0; for (p = 0; p < P; p++) tr += G[p][p];
      var c = solveSPD(ridge(G, 1e-9 * tr), r), sc = 1 / (gam * Math.sqrt(N));
      for (i = 0; i < N; i++) {
        var m = []; for (p = 0; p < P; p++) m.push(c[p] * dPhi[i * P + p]);
        for (q = 0; q < P; q++) { var tq = 0; for (p = 0; p < P; p++) tq += m[p] * Kp[p][q]; h[i * P + q] += sc * a[i] * tq; }
      }
      refresh();
    }
    return path;
  }

  function recompute() {
    var gam = st.gamma === "ntk" ? 1 : st.g0 * Math.sqrt(st.N);
    net = forward(st.N, st.L);
    var o = outputs(net, gam), KL = net.K[st.L], r = Y.map(function (y, i) { return y - o.f[i]; });
    var Ki = invSPD(ridge(KL, 1e-10)), q = 0, i, j;
    for (i = 0; i < P; i++) for (j = 0; j < P; j++) q += r[i] * Ki[i][j] * r[j];
    rdo = { f0: o.f, rel: gam * gam * q / o.a2, gam: gam };
    hid = hiddenPath(net, gam);
    var K0 = hid.K[0], K1 = hid.K[S_GN];
    hid.move = frob(sub(K1, K0)) / frob(K0);
    hid.res = Math.hypot.apply(null, hid.f[S_GN].map(function (v, k) { return v - Y[k]; }));
    dirty = false;
  }
  function state_f() {
    var t = st.t;
    if (st.fit === "readout") return { f: rdo.f0.map(function (v, i) { return v + t * (Y[i] - v); }), K: net.K[st.L], rd: t * t * rdo.rel, km: 0 };
    var x = t * S_GN, s0 = Math.min(S_GN, Math.floor(x)), s1 = Math.min(S_GN, s0 + 1), u = x - s0;
    var f = hid.f[s0].map(function (v, i) { return v + u * (hid.f[s1][i] - v); });
    var K = hid.K[s0].map(function (rw, a) { return rw.map(function (v, b) { return v + u * (hid.K[s1][a][b] - v); }); });
    return { f: f, K: K, rd: 0, km: frob(sub(K, hid.K[0])) / frob(hid.K[0]) };
  }

  /* ---- layout ---- */
  var grid = el("div", { class: "an-grid an-g3" }), ctl = el("div", { class: "an-ctl" }), ctl2 = el("div", { class: "an-ctl" });
  function panel(title) { var p = el("div", { class: "an-panel" }); grid.appendChild(p); return p; }
  var cvIn = Canvas(panel(), { aspect: 1, aria: "Four input points in the plane", draw: drawInputs });
  var cvK = Canvas(panel(), { height: function (w) { var n = st.L + 1, cols = w / n >= 84 ? n : 2, rows = Math.ceil(n / cols), cell = Math.min((w - 12 * (cols + 1)) / cols, 140); return 48 + rows * (cell + 44); }, aria: "Kernel heat maps for each layer", draw: drawKernels });
  var cvOut = Canvas(panel(), { aspect: 1, minH: 260, aria: "Outputs against targets", draw: drawOutputs });
  root.appendChild(grid);

  var gamSeg = segmented({ value: st.gamma, options: [{ value: "ntk", tex: "\\gamma=1\\ \\text{(NTK)}" }, { value: "mup", tex: "\\gamma=\\gamma_0\\sqrt N\\ (\\mu\\text{P})" }], onChange: function (v) { st.gamma = v; st.t = 0; dirty = true; go(); } });
  var nS = slider({ tex: "N", min: 1, max: 4, step: 0.01, value: Math.log10(st.N), fmt: function (v) { return Math.round(Math.pow(10, v)).toLocaleString("en-US"); }, onInput: function (v) { st.N = Math.round(Math.pow(10, v)); st.t = 0; dirty = true; go(); } });
  var gS = slider({ tex: "\\gamma_0", min: 0.3, max: 3, step: 0.05, value: st.g0, fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { st.g0 = v; st.t = 0; dirty = true; go(); } });
  var LSeg = segmented({ tex: "L", value: String(st.L), options: [{ value: "1", text: "1" }, { value: "2", text: "2" }, { value: "3", text: "3" }], onChange: function (v) { st.L = +v; st.t = 0; dirty = true; go(); } });
  var fitSeg = segmented({ value: st.fit, options: [{ value: "readout", text: "fit with readout a", cls: "o-en" }, { value: "hidden", text: "fit with hidden layer W", cls: "o-ent" }], onChange: function (v) { st.fit = v; st.t = 0; tS.set(0); go(); } });
  var tS = slider({ tex: "\\text{fit}", min: 0, max: 1, step: 0.005, value: 0, fmt: function (v) { return Math.round(v * 100) + "%"; }, onInput: function (v) { st.t = v; st.playing = false; go(); } });
  var playBtn = button("▶ Fit", function () { if (env.reduced()) { st.t = 1; tS.set(1); } else { st.t = st.t >= 1 ? 0 : st.t; st.playing = true; } go(); env.kick(); });
  var resBtn = button("Resample", function () { st.seed += 1; bank = makeBank(st.seed); st.t = 0; tS.set(0); dirty = true; go(); });
  [gamSeg.row, nS.row, gS.row, LSeg.row].forEach(function (n) { ctl.appendChild(n); });
  [fitSeg.row, tS.row, playBtn, resBtn].forEach(function (n) { ctl2.appendChild(n); });
  root.appendChild(ctl); root.appendChild(ctl2);
  root.appendChild(el("p", { class: "an-cap", html: "<b>What it shows.</b> One network with $N$ tanh units per hidden layer, iid $\\mathcal N(0,1)$ weights: the input points, the layer kernels $K^0\\to\\dots\\to K^L$ (with their distance from the infinite-width kernel) and the outputs against the targets. With $\\gamma=1$ the readout reaches the interpolating set by an $O(1/N)$ relative change, and the kernels freeze as $N$ grows. With $\\gamma=\\gamma_0\\sqrt N$ the initial output shrinks like $1/\\sqrt N$ and the fit costs either an $O(1)$ readout change (orange) or an $O(1)$ kernel change (blue); the ticks mark each route's final cost." }));
  root.appendChild(el("p", { class: "an-note", html: "<b>Exact:</b> the sampled network (hidden layers $\\ge2$ are drawn from their exact Gaussian law given the layer below), the infinite-width kernels, the minimum-norm readout move $\\|\\Delta a\\|^2=\\gamma^2 r^\\top (K^L)^{-1} r$, and the hidden-layer route as 24 linearised minimum-norm steps on $W^L$. <b>Schematic:</b> nothing; four inputs and targets of my choosing." }));
  math(root);

  function go() { if (dirty) recompute(); if (st.playing) env.kick(); inst.redraw(); }

  /* ---- drawing ---- */
  function drawInputs(g, w, h) {
    var m = 26, fr = Frame(m, 22, w - 2 * m, h - 22 - m, -3.6, 3.6, -3.6, 3.6);
    text(g, "inputs  x_i ∈ ℝ², P = 4", 6, 14, { size: 12, color: PAL.muted });
    g.beginPath(); g.moveTo(fr.X(-3.6), fr.Y(0)); g.lineTo(fr.X(3.6), fr.Y(0)); g.moveTo(fr.X(0), fr.Y(-3.6)); g.lineTo(fr.X(0), fr.Y(3.6)); stroke(g, PAL.line, 1);
    g.strokeStyle = PAL.strong; g.lineWidth = 1; g.strokeRect(fr.x, fr.y, fr.w, fr.h);
    X.forEach(function (x, i) {
      var px = fr.X(x[0]), py = fr.Y(x[1]);
      disc(g, px, py, 6, Y[i] > 0 ? PAL.fg : PAL.bg, PAL.fg);
      text(g, "x" + "₁₂₃₄"[i], px + (x[0] < 0 ? -10 : 10), py - 8, { size: 12, align: x[0] < 0 ? "right" : "left" });
      text(g, "y=" + (Y[i] > 0 ? "+" : "−") + Math.abs(Y[i]).toFixed(1), px + (x[0] < 0 ? -10 : 10), py + 6, { size: 10.5, color: PAL.muted, align: x[0] < 0 ? "right" : "left" });
    });
    text(g, "● y>0   ○ y<0", fr.x + fr.w, h - 8, { size: 10.5, color: PAL.faint, align: "right" });
  }
  function drawKernels(g, w, h) {
    var n = st.L + 1, cols = w / n >= 84 ? n : 2, rows = Math.ceil(n / cols), gap = 12;
    var cell = Math.min((w - gap * (cols + 1)) / cols, 140), s = state_f();
    text(g, "kernels  K^ℓ = φ(h^ℓ)φ(h^ℓ)ᵀ / N", 6, 14, { size: 12, color: PAL.muted });
    text(g, "Δ = ‖K − K∞‖/‖K∞‖, the finite-width fluctuation", 6, h - 6, { size: 10, color: PAL.faint });
    for (var l = 0; l <= st.L; l++) {
      var c = l % cols, r = Math.floor(l / cols);
      var x = gap + c * (cell + gap) + (w - gap * (cols + 1) - cols * cell) / 2, y = 30 + r * (cell + 44);
      var K = l === st.L && st.fit === "hidden" ? s.K : net.K[l], vm = Math.max(0.2, Math.max.apply(null, nngp[l].map(function (rw) { return Math.max.apply(null, rw.map(Math.abs)); })));
      heatmap(g, K, x, y + 14, cell, vm);
      text(g, "K" + "⁰¹²³"[l], x, y + 9, { size: 12.5, color: l ? PAL.ent : PAL.muted, bold: true });
      var dev = l === 0 ? 0 : frob(sub(K, nngp[l])) / frob(nngp[l]);
      text(g, l === 0 ? "from the inputs" : "Δ = " + fmt(dev, dev < 0.1 ? 3 : 2), x, y + cell + 28, { size: 10.5, color: PAL.muted });
    }
  }
  function logBar(g, x, y, w, v, tick, color, name, val) {
    var lo = -4, hi = 1, f = function (a) { return clamp((Math.log10(Math.max(a, 1e-12)) - lo) / (hi - lo), 0, 1); };
    text(g, name, x, y - 5, { size: 11, color: color });
    text(g, val, x + w, y - 5, { size: 11, color: PAL.muted, align: "right" });
    g.fillStyle = PAL.line; g.fillRect(x, y, w, 7);
    if (v > 0) { g.fillStyle = color; g.fillRect(x, y, Math.max(1.5, w * f(v)), 7); }
    var tx = x + w * f(tick); g.beginPath(); g.moveTo(tx, y - 3); g.lineTo(tx, y + 10); stroke(g, PAL.fg, 1.5);
  }
  function drawOutputs(g, w, h) {
    var s = state_f(), top = 24, rowH = 30, m = 34, fr = Frame(m + 6, 0, w - m - 18, 10, -1.5, 1.5, 0, 1);
    text(g, "outputs  f(x_i) against targets y_i", 6, 14, { size: 12, color: PAL.muted });
    var col = st.fit === "readout" ? PAL.en : PAL.ent;
    for (var i = 0; i < P; i++) {
      var y = top + 14 + i * rowH;
      text(g, "x" + "₁₂₃₄"[i], 6, y + 4, { size: 12 });
      g.beginPath(); g.moveTo(fr.X(-1.5), y); g.lineTo(fr.X(1.5), y); stroke(g, PAL.line, 1);
      g.beginPath(); g.moveTo(fr.X(0), y - 5); g.lineTo(fr.X(0), y + 5); stroke(g, PAL.strong, 1);
      var ty = fr.X(Y[i]); g.beginPath(); g.moveTo(ty, y - 8); g.lineTo(ty, y + 8); stroke(g, PAL.fg, 2);
      var fx = fr.X(clamp(s.f[i], -1.5, 1.5)), moved = st.t > 0.001;
      if (moved) { g.beginPath(); g.moveTo(fr.X(clamp(rdo.f0[i], -1.5, 1.5)), y); g.lineTo(fx, y); stroke(g, rgba(col, 0.55), 2); }
      disc(g, fx, y, 5, moved ? col : PAL.muted, null);
    }
    var yb = top + 14 + P * rowH - 6;
    text(g, "▏target   ● output" + (st.fit === "readout" ? " (readout moved)" : " (features moved)"), 6, yb + 4, { size: 10.5, color: PAL.faint });
    var gx = 8, gw = w - 16, y0 = yb + 34;
    logBar(g, gx, y0, gw, s.rd, rdo.rel, PAL.en, "readout moved  ‖Δa‖²/‖a‖²", fmt(s.rd, 3) + " → " + fmt(rdo.rel, 3));
    logBar(g, gx, y0 + 38, gw, s.km, hid.move, PAL.ent, "kernel K^L moved  ‖ΔK‖/‖K‖", fmt(s.km, 3) + " → " + fmt(hid.move, 3));
    text(g, "log scale 10⁻⁴ … 10;  | = value after a full fit by that route", 6, y0 + 62, { size: 10, color: PAL.faint });
    text(g, "initial output scale  rms f = " + fmt(Math.sqrt(rdo.f0.reduce(function (a, v) { return a + v * v; }, 0) / P), 3) + "   (targets: ±0.4–0.5)", 6, y0 + 78, { size: 10.5, color: PAL.muted });
    if (hid.res > 0.05) text(g, "hidden route stopped at residual " + fmt(hid.res, 2), 6, y0 + 93, { size: 10.5, color: PAL.faint });
  }

  var inst = {
    redraw: function () { if (dirty) recompute(); PAL.font = PAL.font; [cvIn, cvK, cvOut].forEach(function (c) { c.draw(); }); },
    step: function (dt) {
      if (st.playing) { st.t = Math.min(1, st.t + dt / 2.6); tS.set(st.t); if (st.t >= 1) st.playing = false; }
    },
    live: function () { return st.playing; }
  };
  bank = makeBank(st.seed);
  recompute();
  return inst;
};

/* =====================================================================
   2  Two learning rules are conditioned priors
      f_theta(x) = th2 tanh(th1 x), one data point (x0, y0), prior N(0, I_2)
   ===================================================================== */
FACT[2] = function (root, env) {
  var X0 = 2, NP = 700, NREF = 4000, DT = 0.01, BINS = 40, LO = -3, HI = 3;
  var st = { y0: 0.6, T: 0.02, speed: 1, playing: !env.reduced(), tau: 0, seed: 11 };
  var SPEEDS = { 1: 10, 2: 60, 3: 300 };
  var A = new Float64Array(NP), B = new Float64Array(NP), done = new Uint8Array(NP);
  var A0 = new Float64Array(NREF), B0 = new Float64Array(NREF);
  var gen = rng(st.seed), noise = rng(99);
  var ref = null, bayes = null, gibbs = null, nearest = 0;

  function Tfrom(v) { return v <= 0 ? 0 : Math.pow(10, -2.5 + 2.5 * (v - 1) / 99); }
  function f(a, b) { return b * Math.tanh(a * X0); }

  function resample() {
    var i;
    gen = rng(st.seed);
    for (i = 0; i < NP; i++) { A[i] = gen.gauss(); B[i] = gen.gauss(); done[i] = 0; }
    for (i = 0; i < NREF; i++) { A0[i] = gen.gauss(); B0[i] = gen.gauss(); }
    st.tau = 0;
  }
  /* gradient flow of L = (f - y0)^2 / 2 from the prior samples, to convergence: landing points on M */
  function computeRef() {
    var hist = new Float64Array(BINS), n = 0, i, it, bw = (HI - LO) / BINS;
    for (i = 0; i < NREF; i++) {
      var a = A0[i], b = B0[i];
      for (it = 0; it < 6000; it++) {
        var t = Math.tanh(a * X0), r = b * t - st.y0;
        if (Math.abs(r) < 1e-4) break;
        var s2 = 1 - t * t;
        a -= DT * r * b * X0 * s2; b -= DT * r * t;
      }
      if (Math.abs(b * Math.tanh(a * X0) - st.y0) < 1e-2) { var k = Math.floor((a - LO) / bw); if (k >= 0 && k < BINS) hist[k]++; n++; }
    }
    for (i = 0; i < BINS; i++) hist[i] /= Math.max(n, 1) * bw;
    return hist;
  }
  /* Bayes (beta -> infinity): density along M in the coordinate th1, p0 / |df/dth2|  (coarea formula) */
  function bayesDensity(th1) { var t = Math.tanh(th1 * X0); if (Math.abs(t) < 1e-6) return 0; var th2 = st.y0 / t; return Math.exp(-(th1 * th1 + th2 * th2) / 2) / Math.abs(t); }
  function computeBayes() {
    var out = new Float64Array(BINS), bw = (HI - LO) / BINS, sub = 8, tot = 0, i, j;
    for (i = 0; i < BINS; i++) { var s = 0; for (j = 0; j < sub; j++) s += bayesDensity(LO + (i + (j + 0.5) / sub) * bw); out[i] = s / sub; tot += out[i] * bw; }
    for (i = 0; i < BINS; i++) out[i] /= tot;
    var best = 1e9, bs = 0;
    for (var s2 = 0.01; s2 < 3; s2 += 0.002) { var t = Math.tanh(s2 * X0), th2 = st.y0 / t, dd = s2 * s2 + th2 * th2; if (dd < best) { best = dd; bs = s2; } }
    nearest = bs;
    return out;
  }
  /* stationary law p_beta(th1) = ∫ dth2 p0 exp(-beta L) / Z, T = 1/beta */
  function computeGibbs() {
    if (st.T <= 0) return null;
    var out = new Float64Array(BINS), bw = (HI - LO) / BINS, beta = 1 / st.T, tot = 0, i, j, k, sub = 4, n2 = 2400, h2 = 12 / n2;
    for (i = 0; i < BINS; i++) {
      var acc = 0;
      for (j = 0; j < sub; j++) {
        var th1 = LO + (i + (j + 0.5) / sub) * bw, t = Math.tanh(th1 * X0), s = 0;
        for (k = 0; k < n2; k++) { var th2 = -6 + (k + 0.5) * h2, r = th2 * t - st.y0; s += Math.exp(-(th2 * th2) / 2 - beta * r * r / 2); }
        acc += s * Math.exp(-th1 * th1 / 2);
      }
      out[i] = acc / sub; tot += out[i] * bw;
    }
    for (i = 0; i < BINS; i++) out[i] /= tot;
    return out;
  }
  function refresh() { ref = computeRef(); bayes = computeBayes(); gibbs = computeGibbs(); }

  /* one block of dynamics: gradient flow (T = 0) or Langevin in the time tau (dtheta = -grad L dt - T theta dt + sqrt(2T) dW) */
  function advance(steps) {
    var T = st.T, sq = Math.sqrt(2 * T * DT), i, s;
    for (s = 0; s < steps; s++) {
      for (i = 0; i < NP; i++) {
        if (done[i]) continue;
        var a = A[i], b = B[i], t = Math.tanh(a * X0), r = b * t - st.y0, s2 = 1 - t * t;
        if (T <= 0) {
          if (Math.abs(r) < 1e-4) { done[i] = 1; continue; }
          A[i] = a - DT * r * b * X0 * s2; B[i] = b - DT * r * t;
        } else {
          A[i] = a - DT * (r * b * X0 * s2 + T * a) + sq * noise.gauss();
          B[i] = b - DT * (r * t + T * b) + sq * noise.gauss();
        }
      }
    }
    st.tau += steps * DT;
  }

  /* ---- layout ---- */
  var grid = el("div", { class: "an-grid an-g2" }), p1 = el("div", { class: "an-panel" }), p2 = el("div", { class: "an-panel" });
  grid.appendChild(p1); grid.appendChild(p2); root.appendChild(grid);
  var cvPlane = Canvas(p1, { aspect: 1, aria: "Parameter plane with the prior, the interpolating set and the particles", draw: drawPlane });
  var cvHist = Canvas(p2, { aspect: 1, aria: "Densities of the first parameter along the interpolating set", draw: drawHist });
  var ctl = el("div", { class: "an-ctl" }), ctl2 = el("div", { class: "an-ctl" });
  var Tsl = slider({ tex: "T=1/\\beta", min: 0, max: 100, step: 1, value: 33, fmt: function (v) { var T = Tfrom(v); return T <= 0 ? "0 (GD)" : T.toFixed(T < 0.01 ? 4 : 3); }, onInput: function (v) { st.T = Tfrom(v); gibbs = computeGibbs(); wake(); } });
  var ySl = slider({ tex: "y_0", min: 0.25, max: 1.3, step: 0.05, value: st.y0, fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { st.y0 = v; resample(); refresh(); wake(); } });
  var spd = segmented({ tex: "\\text{speed}", value: "1", options: [{ value: "1", text: "×1" }, { value: "2", text: "×6" }, { value: "3", text: "×30" }], onChange: function (v) { st.speed = +v; wake(); } });
  var playB = button(env.reduced() ? "▶ Advance" : "❚❚ Pause", function () {
    if (env.reduced()) { advance(3000); inst.redraw(); return; }
    st.playing = !st.playing; playB.textContent = st.playing ? "❚❚ Pause" : "▶ Run"; wake();
  });
  var rs = button("Restart", function () { st.seed += 1; resample(); refresh(); wake(); });
  var gdB = button("T = 0 (gradient flow)", function () { st.T = 0; Tsl.set(0); gibbs = null; resample(); wake(); });
  var lgB = button("T = 0.02 (Langevin)", function () { st.T = 0.02; Tsl.set(33); gibbs = computeGibbs(); resample(); wake(); });
  [Tsl.row, ySl.row, spd.row].forEach(function (n) { ctl.appendChild(n); });
  [playB, rs, gdB, lgB].forEach(function (n) { ctl2.appendChild(n); });
  root.appendChild(ctl); root.appendChild(ctl2);
  var read = el("p", { class: "an-read" }); root.appendChild(read);
  root.appendChild(el("p", { class: "an-cap", html: "<b>What it shows.</b> One data point $(x_0=2,\\,y_0)$ and the model $f_\\theta(x)=\\theta_2\\tanh(\\theta_1x)$, so $\\mathcal M$ is a curve in the $(\\theta_1,\\theta_2)$ plane. The Bayes density along $\\mathcal M$ is $p_0/\\|\\nabla_\\theta f\\|$ (coarea formula), so it does <em>not</em> simply peak at the point of $\\mathcal M$ nearest the origin (tick). Particles started from the prior follow the real gradient flow (purple, $T=0$) or real Langevin dynamics: at fixed small $T$ the histogram first looks like GD ($\\tau T\\ll1$) and only for $\\tau T\\gg1$ settles on the Gibbs law, which tends to Bayes as $T\\to0$: $T\\to0$ first gives GD, $t\\to\\infty$ first gives Bayes." }));
  root.appendChild(el("p", { class: "an-note", html: "<b>Exact:</b> $\\mathcal M$, the Bayes density, the Gibbs marginal (numerical integral over $\\theta_2$), the GD landing histogram (4000 prior samples, gradient flow integrated with step 0.01) and the live particles (Euler&ndash;Maruyama). <b>Schematic:</b> nothing." }));
  math(root);

  /* ---- drawing ---- */
  var RNG = 3.2;
  function drawPlane(g, w, h) {
    var m = 30, side = Math.min(w - m - 10, h - 16 - m), fr = Frame(m + (w - m - 10 - side) / 2, 16, side, side, -RNG, RNG, -RNG, RNG);
    g.save(); g.beginPath(); g.rect(fr.x, fr.y, fr.w, fr.h); g.clip();
    [1, 2, 3].forEach(function (r) { g.beginPath(); g.ellipse(fr.X(0), fr.Y(0), r * fr.w / (2 * RNG), r * fr.h / (2 * RNG), 0, 0, 2 * Math.PI); stroke(g, PAL.line, 1, r === 1 ? [] : [3, 3]); });
    g.beginPath(); g.moveTo(fr.X(-RNG), fr.Y(0)); g.lineTo(fr.X(RNG), fr.Y(0)); g.moveTo(fr.X(0), fr.Y(-RNG)); g.lineTo(fr.X(0), fr.Y(RNG)); stroke(g, PAL.line, 1);
    /* Bayes density as a ribbon around M */
    var pts = [], norms = [], dens = [], pmax = 0, s, k;
    for (s = 0.04; s <= 3.0; s += 0.02) {
      var t = Math.tanh(s * X0), th2 = st.y0 / t; if (Math.abs(th2) > RNG + 0.4) continue;
      var ga = th2 * X0 * (1 - t * t), gb = t, gl = Math.hypot(ga, gb), p = bayesDensity(s);
      pts.push([s, th2]); norms.push([ga / gl, gb / gl]); dens.push(p); if (p > pmax) pmax = p;
    }
    [1, -1].forEach(function (sg) {
      var up = [], dn = [];
      for (k = 0; k < pts.length; k++) { var wd = 0.32 * dens[k] / pmax; up.push([fr.X(sg * (pts[k][0] + norms[k][0] * wd)), fr.Y(sg * (pts[k][1] + norms[k][1] * wd))]); dn.push([fr.X(sg * (pts[k][0] - norms[k][0] * wd)), fr.Y(sg * (pts[k][1] - norms[k][1] * wd))]); }
      path(g, up.concat(dn.reverse()), true); g.fillStyle = rgba(PAL.ent, 0.5); g.fill();
      var line = pts.map(function (q) { return [fr.X(sg * q[0]), fr.Y(sg * q[1])]; });
      path(g, line); stroke(g, PAL.fg, 1.6);
    });
    var tk = [fr.X(nearest), fr.Y(st.y0 / Math.tanh(nearest * X0))]; disc(g, tk[0], tk[1], 3.5, PAL.bg, PAL.fg);
    /* particles */
    var col = st.T <= 0 ? PAL.gd : PAL.fg, i;
    for (i = 0; i < NP; i++) {
      if (A[i] < -RNG || A[i] > RNG || B[i] < -RNG || B[i] > RNG) continue;
      g.fillStyle = rgba(col, st.T <= 0 && done[i] ? 0.85 : 0.5); g.fillRect(fr.X(A[i]) - 1.4, fr.Y(B[i]) - 1.4, 2.8, 2.8);
    }
    g.restore();
    g.strokeStyle = PAL.strong; g.lineWidth = 1; g.strokeRect(fr.x, fr.y, fr.w, fr.h);
    [-2, 0, 2].forEach(function (v) { text(g, String(v).replace("-", "−"), fr.X(v), fr.y + fr.h + 13, { size: 10.5, color: PAL.muted, align: "center" }); text(g, String(v).replace("-", "−"), fr.x - 4, fr.Y(v) + 3.5, { size: 10.5, color: PAL.muted, align: "right" }); });
    text(g, "θ₁", fr.x + fr.w, fr.y + fr.h + 26, { size: 12, color: PAL.muted, align: "right", italic: true });
    text(g, "θ₂", fr.x + 3, fr.y - 4, { size: 12, color: PAL.muted, italic: true });
    text(g, "𝓜", fr.X(2.6), fr.Y(st.y0 / Math.tanh(2.6 * X0)) - 8, { size: 13, color: PAL.fg });
    text(g, "○ point of 𝓜 nearest the origin", fr.x + 6, fr.y + fr.h - 6, { size: 10.5, color: PAL.faint });
  }
  function stairs(g, fr, arr, color, w, fill) {
    var bw = (HI - LO) / BINS, pts = [], i;
    for (i = 0; i < BINS; i++) { pts.push([fr.X(LO + i * bw), fr.Y(arr[i])]); pts.push([fr.X(LO + (i + 1) * bw), fr.Y(arr[i])]); }
    if (fill) { var poly = [[fr.X(LO), fr.Y(0)]].concat(pts, [[fr.X(HI), fr.Y(0)]]); path(g, poly, true); g.fillStyle = fill; g.fill(); }
    path(g, pts); stroke(g, color, w);
  }
  function drawHist(g, w, h) {
    var m = 30, bw = (HI - LO) / BINS, live = new Float64Array(BINS), i;
    for (i = 0; i < NP; i++) { var k = Math.floor((A[i] - LO) / bw); if (k >= 0 && k < BINS) live[k]++; }
    for (i = 0; i < BINS; i++) live[i] /= NP * bw;
    var ymax = 0;
    for (i = 0; i < BINS; i++) ymax = Math.max(ymax, bayes[i], ref[i], gibbs ? gibbs[i] : 0, live[i]);
    ymax *= 1.12;
    var fr = Frame(m, 16, w - m - 10, h - 16 - m, LO, HI, 0, ymax);
    text(g, "density along 𝓜, as a function of θ₁", fr.x, 11, { size: 11.5, color: PAL.muted });
    stairs(g, fr, live, st.T <= 0 ? PAL.gd : PAL.fg, 1, rgba(st.T <= 0 ? PAL.gd : PAL.fg, 0.28));
    stairs(g, fr, ref, PAL.gd, 1.8, null);
    var bwd = bw / 8, th, tot = 0, pts = [];
    for (th = LO + bwd / 2; th < HI; th += bwd) tot += bayesDensity(th) * bwd;
    for (th = LO + bwd / 2; th < HI; th += bwd) pts.push([fr.X(th), fr.Y(bayesDensity(th) / tot)]);
    path(g, pts); stroke(g, PAL.ent, 2.2);
    if (gibbs) { var gp = []; for (i = 0; i < BINS; i++) gp.push([fr.X(LO + (i + 0.5) * bw), fr.Y(gibbs[i])]); path(g, gp); stroke(g, PAL.muted, 1.4, [4, 3]); }
    axes(g, fr, { xticks: linTicks(-3, 3, 6), xlabel: "θ₁", });
    [nearest, -nearest].forEach(function (v) { g.beginPath(); g.moveTo(fr.X(v), fr.y + fr.h); g.lineTo(fr.X(v), fr.y + fr.h - 7); stroke(g, PAL.fg, 1.6); });
    var lx = fr.x + fr.w - 4, ly = fr.y + 6;
    [["Bayes, p₀/‖∇f‖", PAL.ent, 0], ["Gibbs law at this T", PAL.muted, 1], ["GD landing points", PAL.gd, 2], ["particles now", st.T <= 0 ? PAL.gd : PAL.fg, 3]].forEach(function (e) {
      if (e[2] === 1 && !gibbs) return;
      text(g, e[0], lx, ly + e[2] * 14 + 3, { size: 10.5, color: e[1], align: "right" });
    });
  }
  function readout() {
    var T = st.T, s;
    if (T <= 0) s = "T = 0: gradient flow, τ = " + st.tau.toFixed(1) + ";  " + Array.prototype.reduce.call(done, function (a, v) { return a + v; }, 0) + " of " + NP + " particles have reached 𝓜.";
    else { var x = st.tau * T; s = "T = " + T.toFixed(3) + ", τ = " + st.tau.toFixed(0) + ", τ·T = " + x.toFixed(2) + (x < 0.3 ? "  (≪ 1: the histogram still looks like GD)" : x < 3 ? "  (crossing over)" : "  (≫ 1: equilibrated, Gibbs law)"); }
    read.textContent = s;
  }
  function wake() { inst.redraw(); env.kick(); }
  var inst = {
    redraw: function () { readout(); cvPlane.draw(); cvHist.draw(); },
    step: function () { if (st.playing && !env.reduced()) advance(SPEEDS[st.speed]); },
    live: function () { return st.playing && !env.reduced(); }
  };
  resample(); refresh();
  if (env.reduced()) advance(3000);
  return inst;
};

/* =====================================================================
   3  One variational problem: the three costs C_R on one neuron measure
      neuron (h, a): h in R^2 (P = 2 samples), prior N(0, C0) x N(0,1), phi = ReLU,
      output constraint  E_nu[a phi(h)] = sqrt(kappa) y
   ===================================================================== */
FACT[3] = function (root, env) {
  var C0 = [[1, 0.5], [0.5, 1]], Ach = chol(C0), NPT = 260, VR = 3.3;
  var S = new Site(C0, "relu"), Sc = new Site(C0, "relu", 720);
  var st = { kappa: 0.5, y: [0.9, 0.35], mode: "bayes", morph: 1, seed: 5, playing: false };
  var Z = [], AA = [], H = [];
  var res = null, contour = null, hull = null;

  function sample() {
    var g = rng(st.seed), i;
    Z = []; AA = []; H = [];
    for (i = 0; i < NPT; i++) { var z = [g.gauss(), g.gauss()]; Z.push(z); AA.push(g.gauss()); H.push([Ach[0][0] * z[0], Ach[1][0] * z[0] + Ach[1][1] * z[1]]); }
  }
  function relu(v) { return [Math.max(v[0], 0), Math.max(v[1], 0)]; }

  /* atoms of the weight-decay problem: +-phi(A w), |w| = 1, convex hull = unit ball of the variation norm */
  function makeHull() {
    var pts = [], k, n = 720;
    for (k = 0; k < n; k++) {
      var th = 2 * Math.PI * (k + 0.5) / n, w = [Math.cos(th), Math.sin(th)], u = relu([Ach[0][0] * w[0], Ach[1][0] * w[0] + Ach[1][1] * w[1]]);
      pts.push({ x: u[0], y: u[1], k: k, th: th, sg: 1 }); pts.push({ x: -u[0], y: -u[1], k: k, th: th, sg: -1 });
    }
    pts.sort(function (a, b) { return a.x - b.x || a.y - b.y; });
    function cr(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
    var lo = [], up = [], i;
    for (i = 0; i < pts.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], pts[i]) <= 1e-12) lo.pop(); lo.push(pts[i]); }
    for (i = pts.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], pts[i]) <= 1e-12) up.pop(); up.push(pts[i]); }
    lo.pop(); up.pop();
    return lo.concat(up);
  }
  function gauge(y) {
    var n = hull.length, i;
    if (Math.hypot(y[0], y[1]) < 1e-12) return { g: 0, p: hull[0], q: hull[1], lam: 0 };
    for (i = 0; i < n; i++) {
      var p = hull[i], q = hull[(i + 1) % n], e0 = q.x - p.x, e1 = q.y - p.y, det = -y[0] * e1 + e0 * y[1];
      if (Math.abs(det) < 1e-14) continue;
      var s = (-p.x * e1 + e0 * p.y) / det, lam = (y[0] * p.y - y[1] * p.x) / det;
      if (s > 0 && lam >= -1e-9 && lam <= 1 + 1e-9) return { g: 1 / s, s: s, p: p, q: q, lam: clamp(lam, 0, 1) };
    }
    return { g: Infinity, p: hull[0], q: hull[1], lam: 0 };
  }

  function compute() {
    var y = st.y, c = Math.sqrt(st.kappa), i;
    /* Bayes: exact tilt of the single-site law */
    var B = S.solve(st.kappa, y), w = [], wsum = 0, wmax = 0;
    for (i = 0; i < NPT; i++) { var u = dot2(B.v, relu(H[i])); var wi = Math.exp(st.kappa / 2 * u * u); w.push(wi); wsum += wi; wmax = Math.max(wmax, wi); }
    var sw = w.slice().sort(function (a, b) { return a - b; }), w95 = sw[Math.floor(0.95 * (NPT - 1))];
    var ess = wsum * wsum / w.reduce(function (a, v) { return a + v * v; }, 0) / NPT;
    /* cloud second moment of the prior points, for a like-for-like kernel change */
    function cloudK(P) { var k = [[0, 0], [0, 0]]; P.forEach(function (p) { var f = relu(p); k[0][0] += f[0] * f[0]; k[0][1] += f[0] * f[1]; k[1][1] += f[1] * f[1]; }); k[1][0] = k[0][1]; return k.map(function (r) { return r.map(function (v) { return v / NPT; }); }); }
    var Kc = cloudK(H);
    /* lazy GD: linearised minimum-norm displacement of the neuron parameters; G = NTK of the neuron */
    var G = [[S.K0[0][0] + C0[0][0] * S.D0[0][0], S.K0[0][1] + C0[0][1] * S.D0[0][1]], [0, S.K0[1][1] + C0[1][1] * S.D0[1][1]]];
    G[1][0] = G[0][1];
    var lam = solveSPD(G, y), lazyCost = 0.5 * st.kappa * dot2(y, lam), arrows = [], moved = [];
    for (i = 0; i < NPT; i++) {
      var h = H[i], d = [h[0] > 0 ? 1 : 0, h[1] > 0 ? 1 : 0], m = [lam[0] * d[0], lam[1] * d[1]], dh = mv2(C0, m);
      arrows.push([c * AA[i] * dh[0], c * AA[i] * dh[1]]); moved.push([h[0] + c * AA[i] * dh[0], h[1] + c * AA[i] * dh[1]]);
    }
    var Klazy = cloudK(moved), dKl = sub(Klazy, Kc);
    var Klz = [[S.K0[0][0] + dKl[0][0], S.K0[0][1] + dKl[0][1]], [S.K0[1][0] + dKl[1][0], S.K0[1][1] + dKl[1][1]]];
    /* weight decay: variation norm, two atoms */
    var gg = gauge(y), wd = { cost: c * gg.g, p: gg.p, q: gg.q, lam: gg.lam, bp: (1 - gg.lam) * gg.g, bq: gg.lam * gg.g }, Kwd = [[0, 0], [0, 0]];
    [[gg.p, wd.bp], [gg.q, wd.bq]].forEach(function (e) { var a = e[0], b = c * e[1]; Kwd[0][0] += b * a.x * a.x; Kwd[0][1] += b * a.x * a.y; Kwd[1][1] += b * a.y * a.y; });
    Kwd[1][0] = Kwd[0][1];
    var atoms = [[wd.p, wd.bp], [wd.q, wd.bq]].filter(function (e) { return e[1] > 1e-3 * (wd.bp + wd.bq); });
    var rays = atoms.map(function (e) { var a = e[0], wv = [Math.cos(a.th), Math.sin(a.th)]; return { th: a.th, mass: e[1], dir: [Ach[0][0] * wv[0], Ach[1][0] * wv[0] + Ach[1][1] * wv[1]] }; });
    var land = Z.map(function (z) {
      var ang = Math.atan2(z[1], z[0]), r = Math.hypot(z[0], z[1]), best = 0, bd = 9, k;
      for (k = 0; k < rays.length; k++) { var dd = Math.abs(Math.atan2(Math.sin(ang - rays[k].th), Math.cos(ang - rays[k].th))); if (dd < bd) { bd = dd; best = k; } }
      var wv = [Math.cos(rays[best].th), Math.sin(rays[best].th)];
      return [r * (Ach[0][0] * wv[0]), r * (Ach[1][0] * wv[0] + Ach[1][1] * wv[1])];
    });
    res = {
      B: B, w: w, wmax: wmax, w95: w95, ess: ess, Kbayes: B.K, dKb: frob(sub(B.K, S.K0)) / frob(S.K0),
      G: G, lazyCost: lazyCost, arrows: arrows, moved: moved, Klazy: Klz, dKl: frob(dKl) / frob(S.K0),
      wd: wd, Kwd: Kwd, rays: rays, land: land, dKw: frob(sub(Kwd, S.K0)) / frob(S.K0),
      L: B.F
    };
    contour = null;
  }
  /* equal-cost contours in the y-plane, at the level F_B(y) of the current handle */
  function computeContours() {
    var L = res.L, nd = 14, bayes = [], c = Math.sqrt(st.kappa), i, it;
    for (i = 0; i < nd; i++) {
      var al = Math.PI * i / nd, e = [Math.cos(al), Math.sin(al)], lo = 0, hi = 6, v0 = null;
      for (it = 0; it < 9; it++) { var mid = (lo + hi) / 2, r = Sc.solve(st.kappa, [mid * e[0], mid * e[1]], v0); v0 = r.v; if (r.F > L) hi = mid; else lo = mid; }
      bayes.push([lo * e[0], lo * e[1]]);
    }
    var bp = bayes.map(function (p) { return [-p[0], -p[1]]; });
    var Bpts = bayes.concat(bp); Bpts.sort(function (a, b) { return Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]); });
    var lz = ellipsePts(res.G, Math.sqrt(2 * L / st.kappa), 90);
    var wdp = hull.map(function (p) { return [p.x * L / c, p.y * L / c]; });
    contour = { bayes: Bpts, lazy: lz, wd: wdp };
  }

  /* ---- layout ---- */
  var grid = el("div", { class: "an-grid an-g2" }), p1 = el("div", { class: "an-panel" }), p2 = el("div", { class: "an-panel" });
  grid.appendChild(p1); grid.appendChild(p2); root.appendChild(grid);
  var cvH = Canvas(p1, { aspect: 1.12, aria: "Plane of preactivations with the neuron cloud", draw: drawH });
  var cvY = Canvas(p2, { aspect: 1.12, drag: true, aria: "Plane of targets with equal-cost contours; drag the handle", draw: drawY });
  var ctl = el("div", { class: "an-ctl" });
  var modeSeg = segmented({ value: st.mode, options: [{ value: "bayes", text: "Bayes (KL)", cls: "o-ent" }, { value: "lazy", text: "lazy GD", cls: "o-gd" }, { value: "wd", text: "weight decay", cls: "o-gd" }], onChange: function (v) { st.mode = v; replay(); } });
  var kS = slider({ tex: "\\kappa", min: 0.05, max: 3, step: 0.05, value: st.kappa, color: PAL.kap, fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { st.kappa = v; compute(); wake(); } });
  kS.row.classList.add("kap");
  var rep = button("↻ Replay", function () { replay(); });
  var rsB = button("Resample neurons", function () { st.seed++; sample(); compute(); st.morph = 1; wake(); });
  [modeSeg.row, kS.row, rep, rsB].forEach(function (n) { ctl.appendChild(n); });
  root.appendChild(ctl);
  var costs = el("div", { class: "an-costs" });
  var rows = {};
  [["bayes", "Bayes", "c-ent"], ["lazy", "lazy GD", "c-gd"], ["wd", "weight decay", "c-gd"]].forEach(function (r) {
    var bar = el("span", { class: "an-bar " + r[2] }), txt = el("span", { class: "an-costtxt" });
    var row = el("div", { class: "an-costrow" }, [el("span", { class: "an-costname " + r[2], text: r[1] }), el("span", { class: "an-barbox" }, [bar]), txt]);
    costs.appendChild(row); rows[r[0]] = { bar: bar, txt: txt };
  });
  root.appendChild(costs);
  root.appendChild(el("p", { class: "an-cap", html: "<b>What it shows.</b> One neuron $(h,a)$, $h=(h(x_1),h(x_2))\\in\\mathbb R^2$, with $N$ neurons drawn from $\\nu_0=\\mathcal N(0,K)\\otimes\\mathcal N(0,1)$ (left); the output constraint $\\mathbb E_\\nu[a\\varphi(h)]=\\sqrt\\kappa\\,y$ has the target $y$ (right, drag the handle). <span class='c-ent'>Bayes</span> reweights the points (opacity, saturating at the 95th percentile of the weights) at minimum KL. <span class='c-gd'>Lazy GD</span> moves each point by its minimum-norm displacement (arrows). <span class='c-gd'>Weight decay</span> pulls the cloud onto one or two rays, a low-rank kernel. On the right, the three curves are the targets that cost the same as the handle does for Bayes." }));
  root.appendChild(el("p", { class: "an-note", html: "<b>Exact:</b> the Bayes tilt and its KL, $\\tfrac12\\kappa y^\\top G^{-1}y$ with $G$ the neuron's NTK, the variation norm $\\|y\\|_{\\rm var}$ and its atoms (at most two), and the equal-cost curves. <b>Schematic:</b> which neuron goes to which ray, and the lazy path (first-order, $\\varphi=$ ReLU); costs are in different units (nats against parameter norm), so compare their dependence on $y$ and $\\kappa$, not their values." }));
  math(root);

  function replay() { st.morph = 0; if (env.reduced()) st.morph = 1; else st.playing = true; wake(); }
  function wake() { inst.redraw(); env.kick(); }

  /* ---- drawing ---- */
  function ease(t) { return t * t * (3 - 2 * t); }
  function drawH(g, w, h) {
    var m = 28, side = Math.min(w - m - 8, h - 20 - 50), fr = Frame(m + (w - m - 8 - side) / 2, 18, side, side, -VR, VR, -VR, VR), s = ease(st.morph);
    g.save(); g.beginPath(); g.rect(fr.x, fr.y, fr.w, fr.h); g.clip();
    g.fillStyle = rgba(PAL.fg, 0.05); g.fillRect(fr.X(0), fr.Y(VR), fr.w / 2, fr.h / 2);
    g.beginPath(); g.moveTo(fr.X(-VR), fr.Y(0)); g.lineTo(fr.X(VR), fr.Y(0)); g.moveTo(fr.X(0), fr.Y(-VR)); g.lineTo(fr.X(0), fr.Y(VR)); stroke(g, PAL.line, 1);
    var i, col = st.mode === "bayes" ? PAL.ent : PAL.gd;
    if (st.mode === "wd") res.rays.forEach(function (r) { var L = 6 / Math.hypot(r.dir[0], r.dir[1]); g.beginPath(); g.moveTo(fr.X(0), fr.Y(0)); g.lineTo(fr.X(r.dir[0] * L), fr.Y(r.dir[1] * L)); stroke(g, rgba(PAL.gd, 0.35 + 0.45 * s), 2 + 3 * s * r.mass / Math.max(res.wd.bp + res.wd.bq, 1e-9)); });
    for (i = 0; i < NPT; i++) {
      var p = H[i], x = p[0], y = p[1], a = 0.85;
      if (st.mode === "bayes") { a = 0.9 * (1 - s) + s * Math.min(1, res.w[i] / res.w95); a = Math.max(a, 0.07); }
      else if (st.mode === "lazy") { x = p[0] + s * res.arrows[i][0]; y = p[1] + s * res.arrows[i][1]; g.beginPath(); g.moveTo(fr.X(p[0]), fr.Y(p[1])); g.lineTo(fr.X(x), fr.Y(y)); stroke(g, rgba(PAL.gd, 0.5), 1); }
      else { x = p[0] + s * (res.land[i][0] - p[0]); y = p[1] + s * (res.land[i][1] - p[1]); if (s > 0.02) { g.beginPath(); g.moveTo(fr.X(p[0]), fr.Y(p[1])); g.lineTo(fr.X(x), fr.Y(y)); stroke(g, rgba(PAL.gd, 0.18), 1); } }
      disc(g, fr.X(x), fr.Y(y), st.mode === "bayes" ? 3 : 2.6, rgba(st.mode === "bayes" ? PAL.ent : st.mode === "lazy" ? PAL.gd : PAL.gd, a), null);
    }
    /* kernel ellipses (second moment of phi(h)): prior dashed, current rule solid */
    var Kc = st.mode === "bayes" ? res.Kbayes : st.mode === "lazy" ? res.Klazy : res.Kwd;
    path(g, ellipsePts(S.K0, 1, 80).map(function (q) { return [fr.X(q[0]), fr.Y(q[1])]; })); stroke(g, PAL.muted, 1.3, [4, 3]);
    var Ks = [[S.K0[0][0] + s * (Kc[0][0] - S.K0[0][0]), S.K0[0][1] + s * (Kc[0][1] - S.K0[0][1])], [0, S.K0[1][1] + s * (Kc[1][1] - S.K0[1][1])]]; Ks[1][0] = Ks[0][1];
    if (Ks[0][0] * Ks[1][1] - Ks[0][1] * Ks[0][1] > 1e-9) { path(g, ellipsePts(Ks, 1, 80).map(function (q) { return [fr.X(q[0]), fr.Y(q[1])]; })); stroke(g, col, 2); }
    g.restore();
    g.strokeStyle = PAL.strong; g.lineWidth = 1; g.strokeRect(fr.x, fr.y, fr.w, fr.h);
    [-2, 0, 2].forEach(function (v) { var t = String(v).replace("-", "−"); text(g, t, fr.X(v), fr.y + fr.h + 13, { size: 10.5, color: PAL.muted, align: "center" }); text(g, t, fr.x - 4, fr.Y(v) + 3.5, { size: 10.5, color: PAL.muted, align: "right" }); });
    text(g, "h(x₁)", fr.x + fr.w, fr.y + fr.h + 26, { size: 11.5, color: PAL.muted, align: "right", italic: true });
    text(g, "h(x₂)", fr.x + 3, fr.y - 5, { size: 11.5, color: PAL.muted, italic: true });
    legend(g, [{ t: "┅ prior kernel ellipse", c: PAL.muted }, { t: "― " + (st.mode === "bayes" ? "tilted" : st.mode === "lazy" ? "after the lazy move" : "weight decay (" + res.rays.length + (res.rays.length === 1 ? " ray)" : " rays)")), c: col }], fr.x, h - 6, fr.w);
    text(g, "shaded: φ(h)=h  (ReLU, h>0)", fr.x + fr.w - 4, fr.y + 12, { size: 10, color: PAL.faint, align: "right" });
  }
  var YR = 1.8, yfr = null;
  function drawY(g, w, h) {
    var m = 28, side = Math.min(w - m - 8, h - 20 - 50), fr = Frame(m + (w - m - 8 - side) / 2, 18, side, side, -YR, YR, -YR, YR);
    yfr = fr;
    if (!contour) computeContours();
    g.save(); g.beginPath(); g.rect(fr.x, fr.y, fr.w, fr.h); g.clip();
    g.beginPath(); g.moveTo(fr.X(-YR), fr.Y(0)); g.lineTo(fr.X(YR), fr.Y(0)); g.moveTo(fr.X(0), fr.Y(-YR)); g.lineTo(fr.X(0), fr.Y(YR)); stroke(g, PAL.line, 1);
    var px = function (q) { return [fr.X(q[0]), fr.Y(q[1])]; };
    path(g, contour.wd.map(px), true); stroke(g, PAL.gd, 1.6);
    path(g, contour.lazy.map(px), true); stroke(g, PAL.gd, 1.6, [5, 3]);
    path(g, contour.bayes.map(px), true); g.fillStyle = rgba(PAL.ent, 0.1); g.fill(); stroke(g, PAL.ent, 2);
    g.restore();
    g.strokeStyle = PAL.strong; g.lineWidth = 1; g.strokeRect(fr.x, fr.y, fr.w, fr.h);
    var hx = fr.X(st.y[0]), hy = fr.Y(st.y[1]);
    g.beginPath(); g.moveTo(fr.X(0), fr.Y(0)); g.lineTo(hx, hy); stroke(g, PAL.fg, 1);
    disc(g, hx, hy, 6.5, PAL.bg, PAL.fg); disc(g, hx, hy, 2.5, PAL.fg, null);
    text(g, "y", hx + 9, hy - 7, { size: 13, italic: true });
    [-1, 0, 1].forEach(function (v) { var t = String(v).replace("-", "−"); text(g, t, fr.X(v), fr.y + fr.h + 13, { size: 10.5, color: PAL.muted, align: "center" }); text(g, t, fr.x - 4, fr.Y(v) + 3.5, { size: 10.5, color: PAL.muted, align: "right" }); });
    text(g, "y₁", fr.x + fr.w, fr.y + fr.h + 26, { size: 11.5, color: PAL.muted, align: "right", italic: true });
    text(g, "y₂", fr.x + 3, fr.y - 5, { size: 11.5, color: PAL.muted, italic: true });
    legend(g, [{ t: "equal-cost targets:", c: PAL.faint }, { t: "― Bayes", c: PAL.ent }, { t: "┅ lazy GD", c: PAL.gd }, { t: "― weight decay", c: PAL.gd }], fr.x, h - 6, fr.w);
  }
  dragging(cvY, {
    hit: function (x, y) { if (!yfr) return null; return Math.hypot(x - yfr.X(st.y[0]), y - yfr.Y(st.y[1])) < 20 ? 1 : null; },
    move: function (t, x, y) { st.y = [clamp(yfr.iX(x), -YR + 0.05, YR - 0.05), clamp(yfr.iY(y), -YR + 0.05, YR - 0.05)]; compute(); wake(); }
  });

  function showCosts() {
    var mx = Math.max(res.B.F, res.lazyCost, res.wd.cost, 1e-9);
    function put(k, v, t) { rows[k].bar.style.width = Math.min(100, 100 * v / mx) + "%"; rows[k].txt.textContent = t; }
    put("bayes", res.B.F, "KL = J + κE = " + fmt(res.B.F, 3) + "  (J = " + fmt(res.B.J, 3) + ", κE = " + fmt(st.kappa * res.B.E, 3) + ");  kernel moves " + fmt(res.dKb, 3) + ";  effective sample size " + Math.round(100 * res.ess) + "%");
    put("lazy", res.lazyCost, "½E‖θ−θ₀‖² = ½κ yᵀG⁻¹y = " + fmt(res.lazyCost, 3) + ";  kernel moves " + fmt(res.dKl, 3));
    put("wd", res.wd.cost, "½E‖θ‖² = √κ ‖y‖_var = " + fmt(res.wd.cost, 3) + ";  " + (res.rays.length === 1 ? "one ray: the kernel of the solution has rank 1" : "two rays: the kernel of the solution has rank 2"));
  }
  var inst = {
    redraw: function () { showCosts(); cvH.draw(); cvY.draw(); },
    step: function (dt) { if (st.playing) { st.morph = Math.min(1, st.morph + dt / 1.6); if (st.morph >= 1) st.playing = false; } },
    live: function () { return st.playing; }
  };
  hull = makeHull(); sample(); compute();
  return inst;
};

/* =====================================================================
   4  The readout is energy, the kernels are entropy
      last layer, h in R^2 (P = 2), prior N(0, K^{L-1}); the tilted single-site law
      nu*(h) ∝ N(h;0,K^{L-1}) exp(kappa/2 (v.phi(h))^2),  v = (K^L)^{-1} y
   ===================================================================== */
FACT[4] = function (root, env) {
  var C0 = [[1, 0.5], [0.5, 1]], Y = [1.0, 0.3], KMAX = 30, NG = 96;
  var sites = { relu: new Site(C0, "relu"), lin: new Site(C0, "lin") };
  var st = { act: "relu", s: 0.42, playing: false, dir: 1, viewR: 3.4 };
  var sol = null, pred = null, E0 = 1, Fmax = 1, v0n = 1;
  var dview = DensityView(NG);

  function kappaOf(s) { return KMAX * (Math.pow(10, 3 * s) - 1) / 999; }
  function S() { return sites[st.act]; }

  /* small-kappa prediction: K0 + (kappa/2) Cov_0(phi phi^T, (v0.phi)^2); E_0[phi_a phi_b (v.phi)^2] needs the radial integral 8/q^3 */
  function perturbative(site, kappa, v0) {
    var n = site.n, m = [[0, 0], [0, 0]], i;
    for (i = 0; i < n; i++) {
      var p0 = site.p0[i], p1 = site.p1[i], u = v0[0] * p0 + v0[1] * p1, g = site.w[i] * 8 / Math.pow(site.q[i], 3) * u * u;
      m[0][0] += g * p0 * p0; m[0][1] += g * p0 * p1; m[1][1] += g * p1 * p1;
    }
    m[1][0] = m[0][1];
    var vKv = quad2(site.K0, v0), K0 = site.K0;
    return [[K0[0][0] + kappa / 2 * (m[0][0] - K0[0][0] * vKv), K0[0][1] + kappa / 2 * (m[0][1] - K0[0][1] * vKv)], [K0[1][0] + kappa / 2 * (m[1][0] - K0[1][0] * vKv), K0[1][1] + kappa / 2 * (m[1][1] - K0[1][1] * vKv)]];
  }
  function compute() {
    var site = S(), kappa = kappaOf(st.s), r0 = site.solve(0, Y);
    E0 = r0.E; v0n = Math.hypot(r0.v[0], r0.v[1]);
    sol = site.solve(kappa, Y, sol && sol.kappa > 0 && sol.act === st.act ? sol.v : null); sol.act = st.act;
    pred = perturbative(site, kappa, r0.v);
    var kmx = site.solve(KMAX, Y); Fmax = kmx.F;
    var tr = sol.K[0][0] + sol.K[1][1], dt = sol.K[0][0] * sol.K[1][1] - sol.K[0][1] * sol.K[0][1], lm = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - dt));
    st.viewTarget = Math.max(3.3, 2.7 * Math.sqrt(lm));
  }

  /* ---- layout ---- */
  var grid = el("div", { class: "an-grid an-split" }), p1 = el("div", { class: "an-panel" }), p2 = el("div", { class: "an-panel" });
  grid.appendChild(p1); grid.appendChild(p2); root.appendChild(grid);
  var cvA = Canvas(p1, { aspect: 1.08, maxH: 540, aria: "Single-site law of the last layer, tilted toward the residual direction", draw: drawA });
  var cvB = Canvas(p2, { aspect: 1.05, maxH: 520, aria: "Energy and entropy gauges", draw: drawB });
  var ctl = el("div", { class: "an-ctl" });
  var actSeg = segmented({ tex: "\\varphi", value: st.act, options: [{ value: "relu", text: "ReLU" }, { value: "lin", text: "linear" }], onChange: function (v) { st.act = v; sol = null; compute(); wake(); } });
  var kS = slider({ tex: "\\kappa", min: 0, max: 1, step: 0.002, value: st.s, color: PAL.kap, fmt: function () { return fmt(kappaOf(st.s), kappaOf(st.s) < 10 ? 2 : 1); }, onInput: function (v) { st.s = v; st.playing = false; playB.textContent = "▶ Sweep κ"; compute(); wake(); } });
  kS.row.classList.add("kap");
  var playB = button("▶ Sweep κ", function () { if (env.reduced()) return; st.playing = !st.playing; playB.textContent = st.playing ? "❚❚ Pause" : "▶ Sweep κ"; wake(); });
  var presets = [["NTK κ→0", 0], ["κ = 1 (μP, γ₀=1)", Math.log10(1 + 999 / KMAX) / 3]].map(function (p) { return button(p[0], function () { st.s = p[1]; st.playing = false; kS.set(p[1]); compute(); wake(); }); });
  [actSeg.row, kS.row, playB].concat(presets).forEach(function (n) { ctl.appendChild(n); });
  if (env.reduced()) playB.style.display = "none";
  root.appendChild(ctl);
  var read = el("p", { class: "an-read" }); root.appendChild(read);
  root.appendChild(el("p", { class: "an-cap", html: "<b>What it shows.</b> One neuron's preactivation $h=(h(x_1),h(x_2))$ in the last layer; with ReLU, $\\varphi(h)=h$ on the shaded quadrant. As $\\kappa$ rises from 0 the single-site law (blue density) tilts toward the residual direction $v=(K^L)^{-1}y$ (orange), $K^L$ grows along $y$ (solid ellipse $x^\\top (K^L)^{-1}x=1$) and the energy $E(K^L)$ falls. The dashed ellipse is the small-$\\kappa$ prediction $K^0_\\varphi+\\delta K$." }));
  root.appendChild(el("p", { class: "an-note", html: "<b>Exact:</b> the tilted law, $K^L$ from the self-consistency $K^Lv=y$ (damped Newton on a concave dual, residual below $10^{-9}$), $J$, $E$ and $\\delta K$ (angular integrals; the radial ones are closed form for ReLU). $K^{L-1}$ is held at its prior value, so this is the last layer's stationarity condition only. With the linear activation the kernel only grows along $y$; collapse onto rays needs ReLU (see §6)." }));
  math(root);

  function wake() { inst.redraw(); env.kick(); }

  /* ---- drawing ---- */
  function drawA(g, w, h) {
    var m = 30, side = Math.min(w - m - 8, h - 22 - m - 16), fr = Frame(m + (w - m - 8 - side) / 2, 20, side, side, -st.viewR, st.viewR, -st.viewR, st.viewR), R = st.viewR, i, j;
    var site = S(), k = sol.kappa;
    g.save(); g.beginPath(); g.rect(fr.x, fr.y, fr.w, fr.h); g.clip();
    if (st.act === "relu") { g.fillStyle = rgba(PAL.fg, 0.06); g.fillRect(fr.X(0), fr.Y(R), fr.X(R) - fr.X(0), fr.Y(0) - fr.Y(R)); }
    g.beginPath(); g.moveTo(fr.X(-R), fr.Y(0)); g.lineTo(fr.X(R), fr.Y(0)); g.moveTo(fr.X(0), fr.Y(-R)); g.lineTo(fr.X(0), fr.Y(R)); stroke(g, PAL.line, 1);
    dview(g, fr, site, sol, R);
    var P = function (q) { return [fr.X(q[0]), fr.Y(q[1])]; };
    [1, 2].forEach(function (sg) { path(g, ellipsePts(C0, sg, 80).map(P)); stroke(g, PAL.strong, 1, [2, 4]); });
    path(g, ellipsePts(site.K0, 1, 80).map(P)); stroke(g, PAL.muted, 1.3, [5, 3]);
    if (k > 0 && k * 2 * E0 < 2.5) { path(g, ellipsePts(pred, 1, 80).map(P)); stroke(g, PAL.ent, 1.6, [4, 3]); }
    path(g, ellipsePts(sol.K, 1, 80).map(P)); stroke(g, PAL.ent, 2.2);
    /* y direction and v */
    var yl = Math.hypot(Y[0], Y[1]), L = 2 * R;
    g.beginPath(); g.moveTo(fr.X(-Y[0] / yl * L), fr.Y(-Y[1] / yl * L)); g.lineTo(fr.X(Y[0] / yl * L), fr.Y(Y[1] / yl * L)); stroke(g, rgba(PAL.en, 0.45), 1, [3, 4]);
    var vl = Math.hypot(sol.v[0], sol.v[1]), sc = 1.7 * vl / v0n;
    arrow(g, fr.X(0), fr.Y(0), fr.X(sol.v[0] / vl * sc), fr.Y(sol.v[1] / vl * sc), PAL.en, 2.4, 9);
    g.restore();
    g.strokeStyle = PAL.strong; g.lineWidth = 1; g.strokeRect(fr.x, fr.y, fr.w, fr.h);
    var tk = linTicks(-R, R, 4);
    tk.forEach(function (t) { text(g, t.s, fr.X(t.v), fr.y + fr.h + 13, { size: 10.5, color: PAL.muted, align: "center" }); text(g, t.s, fr.x - 4, fr.Y(t.v) + 3.5, { size: 10.5, color: PAL.muted, align: "right" }); });
    text(g, "h(x₁)", fr.x + fr.w, fr.y + fr.h + 26, { size: 11.5, color: PAL.muted, align: "right", italic: true });
    text(g, "h(x₂)", fr.x + 3, fr.y - 6, { size: 11.5, color: PAL.muted, italic: true });
    text(g, "→ v = (K^L)⁻¹y", fr.x + 8, fr.y + 15, { size: 11, color: PAL.en });
    legend(g, [{ t: "┅ K⁰ (prior)", c: PAL.muted }, { t: "┅ small-κ prediction", c: PAL.ent }, { t: "― K^L", c: PAL.ent }], fr.x, h - 6, fr.w);
  }
  function drawB(g, w, h) {
    var top = 24, bot = h - 48, bh = bot - top, k = sol.kappa;
    text(g, "energy and entropy bills", 4, 13, { size: 12, color: PAL.muted });
    var x1 = 22, bw = Math.min(46, (w - 60) / 3);
    /* energy gauge: E / E0 */
    var fe = clamp(sol.E / E0, 0, 1);
    g.strokeStyle = PAL.strong; g.lineWidth = 1; g.strokeRect(x1, top, bw, bh);
    g.fillStyle = PAL.en; g.fillRect(x1, top + bh * (1 - fe), bw, bh * fe);
    g.beginPath(); g.moveTo(x1 - 4, top); g.lineTo(x1 + bw + 4, top); stroke(g, PAL.fg, 1);
    text(g, "E(K^L)", x1 + bw / 2, bot + 14, { size: 11.5, color: PAL.en, align: "center" });
    text(g, fmt(sol.E, 3), x1 + bw / 2, bot + 28, { size: 11, color: PAL.muted, align: "center" });
    text(g, "E(K⁰)=" + fmt(E0, 2), x1 + bw + 6, top + 4, { size: 10, color: PAL.faint });
    /* stacked free energy: J (blue) + kappa E (orange) */
    var x2 = x1 + bw + 52 + 18, sq = function (v) { return Math.sqrt(Math.max(v, 0) / Fmax); }, fJ = clamp(sq(sol.J), 0, 1), fK = clamp(sq(sol.F) - fJ, 0, 1 - fJ);
    g.strokeRect(x2, top, bw, bh);
    g.fillStyle = PAL.ent; g.fillRect(x2, top + bh * (1 - fJ), bw, bh * fJ);
    g.fillStyle = PAL.en; g.fillRect(x2, top + bh * (1 - fJ - fK), bw, bh * fK);
    text(g, "F = J + κE", x2 + bw / 2, bot + 14, { size: 11.5, color: PAL.fg, align: "center" });
    text(g, fmt(sol.F, 3), x2 + bw / 2, bot + 28, { size: 11, color: PAL.muted, align: "center" });
    text(g, "J = " + fmt(sol.J, 3), x2 + bw + 6, top + bh * (1 - fJ / 2) + 4, { size: 11, color: PAL.ent });
    text(g, "κE = " + fmt(k * sol.E, 3), x2 + bw + 6, top + bh * (1 - fJ - fK / 2) + 4, { size: 11, color: PAL.en });
    text(g, "bar heights ∝ √(value / F at κ = " + KMAX + ")", 4, h - 5, { size: 9.5, color: PAL.faint });
  }
  function readout() {
    var K = sol.K, tr = K[0][0] + K[1][1], dt = K[0][0] * K[1][1] - K[0][1] * K[0][1], d = Math.sqrt(Math.max(0, tr * tr / 4 - dt)), l1 = tr / 2 + d;
    var ang = Math.atan2(l1 - K[0][0], K[0][1]) * 180 / Math.PI, ya = Math.atan2(Y[1], Y[0]) * 180 / Math.PI;
    read.textContent = "κ = " + fmt(sol.kappa, 2) + ";  K^L = [" + fmt(K[0][0], 2) + ", " + fmt(K[0][1], 2) + "; " + fmt(K[0][1], 2) + ", " + fmt(K[1][1], 2) + "];  top eigenvector at " + ang.toFixed(0) + "° (y at " + ya.toFixed(0) + "°, prior at 45°);  ‖K^L v − y‖ = " + sol.res.toExponential(0) + (sol.kappa > 0 ? ";  small-κ prediction off by " + fmt(100 * frob(sub(pred, sol.K)) / Math.max(frob(sub(sol.K, S().K0)), 1e-12), 0) + "% of δK (it is first order, good for κ ≪ 1/(2E⁰) = " + fmt(1 / (2 * E0), 2) + ")" : "");
  }
  var inst = {
    redraw: function () { if (env.reduced()) st.viewR = st.viewTarget; st.viewR += (st.viewTarget - st.viewR) * (st.viewR === st.viewTarget ? 0 : 0.35); if (Math.abs(st.viewTarget - st.viewR) < 0.01) st.viewR = st.viewTarget; readout(); cvA.draw(); cvB.draw(); },
    step: function (dt) {
      if (st.playing) { st.s += st.dir * dt / 9; if (st.s >= 1) { st.s = 1; st.dir = -1; } if (st.s <= 0) { st.s = 0; st.dir = 1; } kS.set(st.s); compute(); }
    },
    live: function () { return !env.reduced() && (st.playing || Math.abs(st.viewTarget - st.viewR) > 0.01); }
  };
  compute(); st.viewR = st.viewTarget;
  return inst;
};

/* =====================================================================
   5  Feature learning needs an extensive Z:  -log Z_D = N F_D + o(N)
      three tracks as the width N grows
        A  NTK (gamma = 1), P fixed:    kappa = 1/N
        B  muP, P fixed:                kappa = gamma0^2
        C  NTK, P = alpha N:            kernel moves by a scalar only
   ===================================================================== */
FACT[5] = function (root, env) {
  var C0 = [[1, 0.5], [0.5, 1]], Y = [1.4, 0.49];
  var site = new Site(C0, "relu");
  var st = { lgN: 3, g2: 1, alpha: 0.3, playing: false, dir: 1 };
  var K0 = site.K0, E0 = site.solve(0, Y).E, kd = K0[0][0];
  var q = (Y[0] * Y[0] + Y[1] * Y[1]) / 2;            /* mean square target per sample */
  var curveA = null, B = null, cache = {};

  function trackA(N) { var k = 1 / N, r = site.solve(k, Y); r.N = N; r.logZ = N * r.F; return r; }
  function buildA() {
    var pts = [], v = null, i, M = 70;
    for (i = 0; i < M; i++) { var N = Math.pow(10, 1 + 3 * i / (M - 1)), r = site.solve(1 / N, Y, v); v = r.v; pts.push({ N: N, logZ: N * r.F, F: r.F }); }
    return pts;
  }
  function trackB() { B = site.solve(st.g2, Y); }
  /* track C: K^L = s K0 with the scalar s chosen to minimise -log N(y; 0, s K0) per sample; K0 = k_d I_P for P ~ N samples */
  function logZC(N) { var P = st.alpha * N; return { v: P / 2 * (1 + Math.log(2 * Math.PI * q)), raw: P / 2 * (q / kd + Math.log(2 * Math.PI * kd)) }; }
  var sC = q / kd;

  /* ---- layout ---- */
  var grid = el("div", { class: "an-grid an-g2" }), p1 = el("div", { class: "an-panel" }), p2 = el("div", { class: "an-panel" });
  grid.appendChild(p1); grid.appendChild(p2); root.appendChild(grid);
  var cvL = Canvas(p1, { aspect: 0.82, maxH: 440, aria: "Minus log Z against width, three tracks", draw: function (g, w, h) { drawPlot(g, w, h, "logZ"); } });
  var cvR = Canvas(p2, { aspect: 0.82, maxH: 440, aria: "Free energy per neuron against width, three tracks", draw: function (g, w, h) { drawPlot(g, w, h, "F"); } });
  var grid3 = el("div", { class: "an-grid an-g3" }); root.appendChild(grid3);
  var cvs3 = ["A", "B", "C"].map(function (t) { var p = el("div", { class: "an-panel" }); grid3.appendChild(p); return Canvas(p, { aspect: 0.86, aria: "Kernel on two probe samples, track " + t, draw: function (g, w, h) { drawKernel(g, w, h, t); } }); });
  var ctl = el("div", { class: "an-ctl" });
  var nS = slider({ tex: "N", min: 1, max: 4, step: 0.005, value: st.lgN, fmt: function (v) { return Math.round(Math.pow(10, v)).toLocaleString("en-US"); }, onInput: function (v) { st.lgN = v; stopPlay(); wake(); } });
  var playB = button("▶ Grow N", function () { if (env.reduced()) return; st.playing = !st.playing; playB.textContent = st.playing ? "❚❚ Pause" : "▶ Grow N"; wake(); });
  function stopPlay() { st.playing = false; playB.textContent = "▶ Grow N"; }
  var gS = slider({ tex: "\\gamma_0^2=\\kappa\\ (\\mu\\text{P})", min: 0.1, max: 3, step: 0.05, value: st.g2, color: PAL.kap, fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { st.g2 = v; trackB(); wake(); } });
  gS.row.classList.add("kap");
  var aS = slider({ tex: "P/N", min: 0.1, max: 1, step: 0.05, value: st.alpha, fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { st.alpha = v; wake(); } });
  [nS.row, playB, gS.row, aS.row].forEach(function (n) { ctl.appendChild(n); });
  if (env.reduced()) playB.style.display = "none";
  root.appendChild(ctl);
  var read = el("p", { class: "an-read" }); root.appendChild(read);
  root.appendChild(el("p", { class: "an-cap", html: "<b>What it shows.</b> The width $N$ drives three tracks. <span class='c-en'>NTK, $P$ fixed</span> ($\\kappa=1/N$): $-\\log Z_D$ stays $O(1)$, so $F_D\\to0$ and the kernel stays at the prior. <span class='c-kap'>μP</span> ($\\kappa=\\gamma_0^2$): $-\\log Z_D\\propto N$ with $F_D=O(1)$, and the kernel tilts toward $y$. <span class='c-ent'>NTK, $P=\\alpha N$</span>: $-\\log Z_D\\propto N$ too, through $\\tfrac12\\log\\det K^L$, but the kernel only changes by a scalar: no rotation toward $y$. The lower panels show the kernel on two probe samples (solid) against the prior (dashed)." }));
  root.appendChild(el("p", { class: "an-note", html: "<b>Exact:</b> tracks A and B are $N F_D(\\kappa)$ from the solver of §4 (one hidden layer, ReLU, two samples; $F_D=\\min J+\\kappa\\tfrac12 y^\\top K^{-1}y$, $O(\\log N)$ terms dropped). <b>Schematic:</b> track C is the Gaussian toy $K_0=k\\,I_P$ with $K^L=sK_0$ and $s$ optimised (the scalar renormalisation of linear networks); the claim that nothing but the scale moves is the page's, not computed here. The dashed line in the left panel is track C without renormalisation." }));
  math(root);

  function wake() { inst.redraw(); env.kick(); }

  /* ---- drawing ---- */
  var COL = { A: function () { return PAL.en; }, B: function () { return PAL.kap; }, C: function () { return PAL.ent; } };
  function values(N) {
    var a = trackA(N), c = logZC(N);
    return { A: { logZ: a.logZ, F: a.F, K: a.K, sol: a }, B: { logZ: N * B.F, F: B.F, K: B.K, sol: B }, C: { logZ: c.v, F: c.v / N, raw: c.raw, K: K0.map(function (r) { return r.map(function (v) { return v * sC; }); }) } };
  }
  function drawPlot(g, w, h, what) {
    if (!curveA) curveA = buildA();
    var ml = 54, mr = 12, mt = 20, mb = 36, fr, lo, hi;
    if (what === "logZ") { lo = 0.5; hi = 3e5; } else { lo = 1e-4; hi = 30; }
    fr = Frame(ml, mt, w - ml - mr, h - mt - mb, 1, 4, Math.log10(lo), Math.log10(hi));
    var dec, d;
    for (d = Math.ceil(Math.log10(lo)); d <= Math.floor(Math.log10(hi)); d++) { g.beginPath(); g.moveTo(fr.x, fr.Y(d)); g.lineTo(fr.x + fr.w, fr.Y(d)); stroke(g, PAL.line, 1); text(g, "10" + String(d).replace("-", "⁻").replace(/\d/g, function (c) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[+c]; }), fr.x - 5, fr.Y(d) + 3.5, { size: 10.5, color: PAL.muted, align: "right" }); }
    for (d = 1; d <= 4; d++) { g.beginPath(); g.moveTo(fr.X(d), fr.y); g.lineTo(fr.X(d), fr.y + fr.h); stroke(g, PAL.line, 1); text(g, "10" + "⁰¹²³⁴"[d], fr.X(d), fr.y + fr.h + 14, { size: 10.5, color: PAL.muted, align: "center" }); }
    g.strokeStyle = PAL.strong; g.lineWidth = 1; g.strokeRect(fr.x, fr.y, fr.w, fr.h);
    text(g, what === "logZ" ? "−log Z_D" : "F_D = −(1/N) log Z_D", fr.x + 2, mt - 6, { size: 12, color: PAL.fg, italic: true });
    text(g, "width N", fr.x + fr.w, fr.y + fr.h + 29, { size: 11.5, color: PAL.muted, align: "right", italic: true });
    g.save(); g.beginPath(); g.rect(fr.x, fr.y, fr.w, fr.h); g.clip();
    function ly(v) { return fr.Y(Math.log10(Math.max(v, lo / 100))); }
    var key = what === "logZ" ? "logZ" : "F", i, pts;
    pts = curveA.map(function (r) { return [fr.X(Math.log10(r.N)), ly(r[key])]; }); path(g, pts); stroke(g, PAL.en, 2.2);
    pts = [10, 1e4].map(function (N) { return [fr.X(Math.log10(N)), ly(key === "logZ" ? N * B.F : B.F)]; }); path(g, pts); stroke(g, PAL.kap, 2.2);
    pts = [10, 1e4].map(function (N) { var c = logZC(N); return [fr.X(Math.log10(N)), ly(key === "logZ" ? c.v : c.v / N)]; }); path(g, pts); stroke(g, PAL.ent, 2.2);
    if (what === "logZ") { pts = [10, 1e4].map(function (N) { return [fr.X(Math.log10(N)), ly(logZC(N).raw)]; }); path(g, pts); stroke(g, PAL.ent, 1.2, [4, 3]); }
    var N = Math.pow(10, st.lgN), v = values(N);
    g.beginPath(); g.moveTo(fr.X(st.lgN), fr.y); g.lineTo(fr.X(st.lgN), fr.y + fr.h); stroke(g, PAL.fg, 1, [3, 3]);
    ["A", "B", "C"].forEach(function (t) { disc(g, fr.X(st.lgN), ly(v[t][key]), 4.5, COL[t](), PAL.bg); });
    g.restore();
    var lx = fr.x + 8, ly0 = fr.y + 14;
    [["NTK, P fixed", PAL.en], ["μP, κ = γ₀²", PAL.kap], ["NTK, P = αN", PAL.ent]].forEach(function (e, j) { text(g, "― " + e[0], lx, ly0 + j * 14, { size: 11, color: e[1] }); });
  }
  function drawKernel(g, w, h, t) {
    var N = Math.pow(10, st.lgN), v = values(N), R = 2.7, side = Math.min(w - 16, h - 56), fr = Frame((w - side) / 2, 20, side, side, -R, R, -R, R);
    var names = { A: "NTK, P fixed", B: "μP", C: "NTK, P = αN" };
    text(g, names[t], 6, 13, { size: 12, color: COL[t](), bold: true });
    g.save(); g.beginPath(); g.rect(fr.x, fr.y, fr.w, fr.h); g.clip();
    g.beginPath(); g.moveTo(fr.X(-R), fr.Y(0)); g.lineTo(fr.X(R), fr.Y(0)); g.moveTo(fr.X(0), fr.Y(-R)); g.lineTo(fr.X(0), fr.Y(R)); stroke(g, PAL.line, 1);
    var P = function (qq) { return [fr.X(qq[0]), fr.Y(qq[1])]; };
    var yl = Math.hypot(Y[0], Y[1]); g.beginPath(); g.moveTo(fr.X(-Y[0] / yl * 2 * R), fr.Y(-Y[1] / yl * 2 * R)); g.lineTo(fr.X(Y[0] / yl * 2 * R), fr.Y(Y[1] / yl * 2 * R)); stroke(g, rgba(PAL.en, 0.5), 1, [3, 4]);
    path(g, ellipsePts(K0, 1, 80).map(P)); stroke(g, PAL.muted, 1.3, [5, 3]);
    path(g, ellipsePts(v[t].K, 1, 80).map(P)); stroke(g, COL[t](), 2.2);
    g.restore();
    g.strokeStyle = PAL.strong; g.lineWidth = 1; g.strokeRect(fr.x, fr.y, fr.w, fr.h);
    var K = v[t].K, tr = K[0][0] + K[1][1], dt = K[0][0] * K[1][1] - K[0][1] * K[0][1], d = Math.sqrt(Math.max(0, tr * tr / 4 - dt)), l1 = tr / 2 + d;
    var ang = Math.atan2(l1 - K[0][0], K[0][1]) * 180 / Math.PI;
    text(g, "‖K−K⁰‖/‖K⁰‖ = " + fmt(frob(sub(K, K0)) / frob(K0), 3), 6, h - 22, { size: 10.5, color: PAL.muted });
    text(g, "top axis at " + ang.toFixed(0) + "° (y: " + (Math.atan2(Y[1], Y[0]) * 180 / Math.PI).toFixed(0) + "°, prior: 45°)", 6, h - 8, { size: 10.5, color: PAL.muted });
  }
  function readout() {
    var N = Math.pow(10, st.lgN), v = values(N);
    read.innerHTML = "N = " + Math.round(N).toLocaleString("en-US") + ";&nbsp; <span class='c-en'>A: −log Z_D = " + fmt(v.A.logZ, 2) + ", F_D = " + fmt(v.A.F, 4) + "</span>;&nbsp; <span class='c-kap'>B: −log Z_D = " + fmt(v.B.logZ, 1) + ", F_D = " + fmt(v.B.F, 3) + " (J = " + fmt(B.J, 2) + ", κE = " + fmt(st.g2 * B.E, 2) + ")</span>;&nbsp; <span class='c-ent'>C (P = " + Math.round(st.alpha * N) + "): −log Z_D = " + fmt(v.C.logZ, 1) + ", F_D = " + fmt(v.C.F, 3) + "</span>";
  }
  var inst = {
    redraw: function () { readout(); cvL.draw(); cvR.draw(); cvs3.forEach(function (c) { c.draw(); }); },
    step: function (dt) { if (st.playing) { st.lgN += st.dir * dt / 5; if (st.lgN >= 4) { st.lgN = 4; st.dir = -1; } if (st.lgN <= 1) { st.lgN = 1; st.dir = 1; } nS.set(st.lgN); } },
    live: function () { return st.playing; }
  };
  trackB();
  return inst;
};

/* =====================================================================
   6  NTK <-> muP: kappa is the exchange rate. Energy-entropy Pareto front
      E(J) = min { E(K) : J(K | K0) <= J } for one hidden layer, two samples
   ===================================================================== */
FACT[6] = function (root, env) {
  var C0 = [[1, 0.5], [0.5, 1]], Y = [1.0, 0.3], KTOP = 2000, NF = 130;
  var sites = { relu: new Site(C0, "relu"), lin: new Site(C0, "lin") };
  var fronts = {};
  var st = { act: "relu", s: 0.06, playing: false, dir: 1, xmax: 3, ymax: 1.2, viewR: 3.2 };
  var sol = null, E0 = 1;
  var dview = DensityView(88);

  function kappaOf(s) { return KTOP * (Math.pow(10, 3 * s) - 1) / 999; }
  function sOf(k) { return Math.log10(1 + 999 * k / KTOP) / 3; }
  /* the front: sweep kappa (convex E(J) is traced out completely by the Lagrange parameter) */
  function front(act) {
    if (fronts[act]) return fronts[act];
    var site = sites[act], pts = [], v = null, i, k;
    pts.push(site.solve(0, Y));
    for (i = 0; i < NF; i++) { k = 1e-3 * Math.pow(KTOP / 1e-3, i / (NF - 1)); var r = site.solve(k, Y, v); v = r.v; pts.push(r); }
    fronts[act] = pts; return pts;
  }
  function compute() {
    var site = sites[st.act], fr = front(st.act);
    E0 = fr[0].E;
    sol = site.solve(kappaOf(st.s), Y, null);
    var tr = sol.K[0][0] + sol.K[1][1], dt = sol.K[0][0] * sol.K[1][1] - sol.K[0][1] * sol.K[0][1], lm = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - dt));
    st.viewTarget = Math.max(3.2, 2.7 * Math.sqrt(lm));
    st.xTarget = Math.max(2.6, 1.45 * sol.J);
    var tz = clamp((Math.log10(Math.max(sol.kappa, 1e-9)) - 1) / 1.3, 0, 1);
    st.yTarget = E0 * 1.06 * (1 - tz) + Math.max(2.4 * sol.E, 0.06 * E0) * tz;
    /* kernel weight (trace of phi phi^T per angle) within +-5 degrees of the main ray */
    var n = site.n, k = sol.kappa, mx = 0, mi = 0, tot = 0, w = new Float64Array(n), i;
    for (i = 0; i < n; i++) { var u = sol.v[0] * site.p0[i] + sol.v[1] * site.p1[i], a = site.q[i] - k * u * u; w[i] = site.w[i] / (a * a) * (site.p0[i] * site.p0[i] + site.p1[i] * site.p1[i]); tot += w[i]; if (w[i] > mx) { mx = w[i]; mi = i; } }
    var win = 0, th0 = site.th[mi];
    for (i = 0; i < n; i++) { var dd = Math.abs(Math.atan2(Math.sin(site.th[i] - th0), Math.cos(site.th[i] - th0))); if (dd < 5 * Math.PI / 180) win += w[i]; }
    sol.peak = th0; sol.conc = win / tot;
  }

  /* ---- layout ---- */
  var grid = el("div", { class: "an-grid an-split" }), p1 = el("div", { class: "an-panel" }), p2 = el("div", { class: "an-panel an-stack" });
  grid.appendChild(p1); grid.appendChild(p2); root.appendChild(grid);
  var cvA = Canvas(p1, { aspect: 0.78, maxH: 520, aria: "Energy against entropy: the Pareto front with a tangent of slope minus one over kappa", draw: drawA });
  var cvK = Canvas(p2, { height: function (w) { return Math.min(w * 0.42, 140) + 72; }, aria: "Heat map of the last-layer kernel", draw: drawK });
  var cvN = Canvas(p2, { aspect: 1, aria: "Single-site density", draw: drawN });
  var ctl = el("div", { class: "an-ctl" });
  var actSeg = segmented({ tex: "\\varphi", value: st.act, options: [{ value: "relu", text: "ReLU" }, { value: "lin", text: "linear" }], onChange: function (v) { st.act = v; compute(); st.xmax = st.xTarget; st.ymax = st.yTarget; st.viewR = st.viewTarget; wake(); } });
  var kS = slider({ tex: "\\kappa", min: 0, max: 1, step: 0.001, value: st.s, color: PAL.kap, fmt: function () { var k = kappaOf(st.s); return fmt(k, k < 10 ? 2 : k < 100 ? 1 : 0); }, onInput: function (v) { st.s = v; stopPlay(); compute(); wake(); } });
  kS.row.classList.add("kap");
  var playB = button("▶ Sweep κ", function () { if (env.reduced()) return; st.playing = !st.playing; playB.textContent = st.playing ? "❚❚ Pause" : "▶ Sweep κ"; wake(); });
  function stopPlay() { st.playing = false; playB.textContent = "▶ Sweep κ"; }
  function setK(k) { st.s = sOf(k); kS.set(st.s); stopPlay(); compute(); wake(); }
  var presets = [["NTK: κ → 0", 0], ["μP: κ = γ₀² = 1", 1], ["κ → ∞", KTOP]].map(function (p) { return button(p[0], function () { setK(p[1]); }); });
  [actSeg.row, kS.row, playB].concat(presets).forEach(function (n) { ctl.appendChild(n); });
  if (env.reduced()) playB.style.display = "none";
  root.appendChild(ctl);
  var read = el("p", { class: "an-read" }); root.appendChild(read);
  root.appendChild(el("p", { class: "an-cap", html: "<b>What it shows.</b> The Pareto front $\\mathcal E(J)$ of a one-hidden-layer, two-sample toy: entropy $J$ spent on the hidden layer (blue axis) against the readout energy $E(K^L)$ it buys (orange axis). The green handle sets $\\kappa$; the optimum is where the tangent has slope $-1/\\kappa$. $\\kappa\\to0$ is the $J=0$ corner (NNGP, all energy); $\\kappa=\\gamma_0^2$ an interior point; as $\\kappa\\to\\infty$ the contact point slides right, $K^L$ aligns with $yy^\\top$ and, for ReLU, the single-site law concentrates on a ray. With the linear activation the kernel only grows along $y$ and nothing collapses." }));
  root.appendChild(el("p", { class: "an-note", html: "<b>Exact:</b> the front (a sweep of the solver of §4, 130 values of $\\kappa$; $J(K)$ and $E(K)$ are convex, so the sweep traces the whole front), the tangent, $K^L$ and $\\nu^\\star$ at the handle. <b>Schematic:</b> one hidden layer, so $\\sum_\\ell J_\\ell$ is a single $J$; $K^0$, $y$ are my choices; slow collapse onto atoms is real and needs $\\kappa\\sim10^4$ to be near-complete." }));
  math(root);

  function wake() { inst.redraw(); env.kick(); }

  /* ---- drawing ---- */
  var plotFr = null;
  function drawA(g, w, h) {
    var fr0 = front(st.act), ymax = st.ymax, ml = 46, mb = 34, mt = 22, mr = 12;
    var fr = Frame(ml, mt, w - ml - mr, h - mt - mb, 0, st.xmax, 0, ymax); plotFr = fr;
    var xt = linTicks(0, st.xmax, 6), yt = linTicks(0, ymax, 4);
    xt.forEach(function (t) { g.beginPath(); g.moveTo(fr.X(t.v), fr.y); g.lineTo(fr.X(t.v), fr.y + fr.h); stroke(g, PAL.line, 1); });
    yt.forEach(function (t) { g.beginPath(); g.moveTo(fr.x, fr.Y(t.v)); g.lineTo(fr.x + fr.w, fr.Y(t.v)); stroke(g, PAL.line, 1); });
    g.save(); g.beginPath(); g.rect(fr.x, fr.y, fr.w, fr.h); g.clip();
    var curve = fr0.map(function (r) { return [fr.X(r.J), fr.Y(r.E)]; });
    /* the attainable region lies above and to the right of the front */
    var poly = curve.concat([[fr.X(st.xmax * 2), fr.Y(0)], [fr.X(st.xmax * 2), fr.Y(ymax * 2)], [fr.X(0), fr.Y(ymax * 2)]]);
    path(g, poly, true); g.fillStyle = rgba(PAL.fg, 0.05); g.fill();
    path(g, curve); stroke(g, PAL.fg, 2.2);
    /* tangent of slope -1/kappa through the handle: the level line J + kappa E = F */
    var k = sol.kappa, x0 = sol.J, y0 = sol.E, ends;
    if (k < 1e-9) ends = [[x0, 0], [x0, ymax]];
    else { ends = [[0, y0 + x0 / k], [st.xmax, y0 - (st.xmax - x0) / k]]; }
    g.beginPath(); g.moveTo(fr.X(ends[0][0]), fr.Y(ends[0][1])); g.lineTo(fr.X(ends[1][0]), fr.Y(ends[1][1])); stroke(g, PAL.kap, 1.5, [6, 4]);
    /* mu-P marker (kappa = 1) */
    var smu = sites[st.act].solve(1, Y); g.beginPath(); g.arc(fr.X(smu.J), fr.Y(smu.E), 3.5, 0, 2 * Math.PI); stroke(g, PAL.fg, 1.3);
    g.restore();
    axes(g, fr, { xticks: xt, yticks: yt, xlabel: "entropy  J = Σ J_ℓ  (hidden layers)", xcolor: PAL.ent, ylabel: "energy  E = ½ yᵀ(K^L)⁻¹y", ycolor: PAL.en });
    /* handle */
    var hx = fr.X(x0), hy = fr.Y(y0);
    disc(g, hx, hy, 8, rgba(PAL.kap, 0.25), PAL.kap); disc(g, hx, hy, 3.5, PAL.kap, null);
    text(g, "κ = " + fmt(k, k < 10 ? 2 : k < 100 ? 1 : 0), Math.min(hx + 12, fr.x + fr.w - 70), Math.max(hy - 10, fr.y + 12), { size: 12, color: PAL.kap, bold: true });
    text(g, "NTK corner", fr.X(0) + 7, fr.Y(E0) + 15, { size: 10.5, color: PAL.muted });
    if (Math.abs(smu.J - sol.J) > 0.06 * st.xmax || Math.abs(smu.E - sol.E) > 0.06 * ymax) text(g, "μP (κ=1)", fr.X(smu.J) + 7, fr.Y(smu.E) - 6, { size: 10.5, color: PAL.muted });
    text(g, "slope −1/κ", fr.x + fr.w - 6, fr.y + 14, { size: 10.5, color: PAL.kap, align: "right" });
    text(g, "F = J + κE = " + fmt(sol.F, 2), fr.x + fr.w - 6, fr.y + 28, { size: 10.5, color: PAL.muted, align: "right" });
  }
  dragging(cvA, {
    hit: function (x, y) { if (!plotFr) return null; return Math.hypot(x - plotFr.X(sol.J), y - plotFr.Y(sol.E)) < 18 ? 1 : null; },
    move: function (t, x, y) {
      /* nearest point of the front in pixel distance */
      var fr0 = front(st.act), best = 1e12, bi = 0;
      fr0.forEach(function (r, i) { var d = Math.pow(plotFr.X(r.J) - x, 2) + Math.pow(plotFr.Y(r.E) - y, 2); if (d < best) { best = d; bi = i; } });
      setK(fr0[bi].kappa);
    }
  });
  function drawK(g, w, h) {
    text(g, "K^L at the handle", 6, 14, { size: 12, color: PAL.ent, bold: true });
    var K = sol.K, vm = Math.max(Math.abs(K[0][0]), Math.abs(K[1][1]), Math.abs(K[0][1])), size = Math.min(h - 72, w * 0.42), x0 = 10, y0 = 24;
    heatmap(g, K, x0, y0, size, vm);
    /* small ellipse next to the heat map, in its own axes */
    var cx = x0 + size + 18 + (w - x0 - size - 28) / 2, cy = y0 + size / 2, rad = Math.min((w - x0 - size - 28) / 2, size / 2) - 2;
    var lm = Math.max(K[0][0], K[1][1]) * 1.2 + Math.abs(K[0][1]), sc2 = rad / Math.sqrt(lm * 1.3);
    g.beginPath(); g.moveTo(cx - rad, cy); g.lineTo(cx + rad, cy); g.moveTo(cx, cy - rad); g.lineTo(cx, cy + rad); stroke(g, PAL.line, 1);
    path(g, ellipsePts(sites[st.act].K0, 1, 70).map(function (q) { return [cx + q[0] * sc2, cy - q[1] * sc2]; })); stroke(g, PAL.muted, 1, [3, 3]);
    path(g, ellipsePts(K, 1, 70).map(function (q) { return [cx + q[0] * sc2, cy - q[1] * sc2]; })); stroke(g, PAL.ent, 1.8);
    var yl = Math.hypot(Y[0], Y[1]); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Y[0] / yl * rad, cy - Y[1] / yl * rad); stroke(g, PAL.en, 1.4, [3, 3]);
    var tr = K[0][0] + K[1][1], dt = K[0][0] * K[1][1] - K[0][1] * K[0][1], d = Math.sqrt(Math.max(0, tr * tr / 4 - dt)), l1 = tr / 2 + d, l2 = tr / 2 - d;
    text(g, "λ₂/λ₁ = " + fmt(l2 / l1, 3), 10, y0 + size + 16, { size: 11, color: PAL.muted });
    text(g, "top eigenvector " + (Math.atan2(l1 - K[0][0], K[0][1]) * 180 / Math.PI).toFixed(0) + "° · y at " + (Math.atan2(Y[1], Y[0]) * 180 / Math.PI).toFixed(0) + "°", 10, y0 + size + 31, { size: 11, color: PAL.muted });
  }
  function drawN(g, w, h) {
    var m = 26, side = Math.min(w - m - 8, h - 58), fr = Frame(m + (w - m - 8 - side) / 2, 20, side, side, -st.viewR, st.viewR, -st.viewR, st.viewR), R = st.viewR, site = sites[st.act];
    text(g, "single-site law  ν*(h)", 6, 13, { size: 12, color: PAL.ent, bold: true });
    g.save(); g.beginPath(); g.rect(fr.x, fr.y, fr.w, fr.h); g.clip();
    if (st.act === "relu") { g.fillStyle = rgba(PAL.fg, 0.06); g.fillRect(fr.X(0), fr.Y(R), fr.X(R) - fr.X(0), fr.Y(0) - fr.Y(R)); }
    g.beginPath(); g.moveTo(fr.X(-R), fr.Y(0)); g.lineTo(fr.X(R), fr.Y(0)); g.moveTo(fr.X(0), fr.Y(-R)); g.lineTo(fr.X(0), fr.Y(R)); stroke(g, PAL.line, 1);
    dview(g, fr, site, sol, R);
    var ex = Math.cos(sol.peak), ey = Math.sin(sol.peak); g.beginPath(); g.moveTo(fr.X(0), fr.Y(0)); g.lineTo(fr.X(ex * 3 * R), fr.Y(ey * 3 * R)); stroke(g, rgba(PAL.fg, 0.55), 1, [2, 4]);
    g.restore();
    g.strokeStyle = PAL.strong; g.lineWidth = 1; g.strokeRect(fr.x, fr.y, fr.w, fr.h);
    linTicks(-R, R, 4).forEach(function (t) { text(g, t.s, fr.X(t.v), fr.y + fr.h + 12, { size: 10, color: PAL.muted, align: "center" }); text(g, t.s, fr.x - 3, fr.Y(t.v) + 3.5, { size: 10, color: PAL.muted, align: "right" }); });
    text(g, "kernel weight within ±5° of the main ray: " + Math.round(100 * sol.conc) + "%", 6, h - 5, { size: 10.5, color: PAL.muted });
  }
  function readout() {
    var k = sol.kappa;
    read.textContent = "κ = " + fmt(k, k < 10 ? 2 : 1) + ";  J = " + fmt(sol.J, 3) + " (entropy);  E = " + fmt(sol.E, 3) + " (energy; " + fmt(E0, 2) + " at κ = 0);  F = J + κE = " + fmt(sol.F, 3) + ";  slope of the front at the handle = −1/κ = " + (k > 0 ? fmt(-1 / k, 3) : "−∞");
  }
  var inst = {
    redraw: function () {
      if (env.reduced()) { st.xmax = st.xTarget; st.ymax = st.yTarget; st.viewR = st.viewTarget; }
      st.xmax += (st.xTarget - st.xmax) * 0.3; st.ymax += (st.yTarget - st.ymax) * 0.3; st.viewR += (st.viewTarget - st.viewR) * 0.3;
      if (Math.abs(st.xTarget - st.xmax) < 0.005) st.xmax = st.xTarget; if (Math.abs(st.yTarget - st.ymax) < 0.002) st.ymax = st.yTarget; if (Math.abs(st.viewTarget - st.viewR) < 0.005) st.viewR = st.viewTarget;
      readout(); cvA.draw(); cvK.draw(); cvN.draw();
    },
    step: function (dt) {
      if (st.playing) { st.s += st.dir * dt / 10; if (st.s >= 1) { st.s = 1; st.dir = -1; } if (st.s <= 0) { st.s = 0; st.dir = 1; } kS.set(st.s); compute(); }
    },
    live: function () { return !env.reduced() && (st.playing || Math.abs(st.xTarget - st.xmax) > 0.005 || Math.abs(st.yTarget - st.ymax) > 0.002 || Math.abs(st.viewTarget - st.viewR) > 0.005); }
  };
  compute(); st.xmax = st.xTarget; st.ymax = st.yTarget; st.viewR = st.viewTarget;
  return inst;
};

/* =====================================================================
   7  Generalisation is a variational quantity: the bad-completion gap
      one hidden layer with the identity activation, so the entropy J of a kernel is a
      Gaussian KL and every quantity below is closed form:
        E_kappa(f) = min_u { (u - 1 - log u)/2 + a u/2 + kappa r /(2u) },   a = D^2/(s0 r),
      D = f(x*) - f*(x*),  r = y^T A0^-1 y,  s0 = conditional prior variance at x*.
   ===================================================================== */
FACT[7] = function (root, env) {
  var XT = [-0.85, -0.35, 0.2, 0.8], ELL = 0.35, NX = 4;
  function yTrue(x) { return 0.9 * Math.sin(4.4 * x + 0.2); }
  var YT = XT.map(yTrue);
  function rbf(a, b, l) { return Math.exp(-(a - b) * (a - b) / (2 * l * l)); }
  function k0(a, b) { return rbf(a, b, ELL); }
  function kT(a, b) { return k0(a, b) + 0.6 * rbf(a, b, 0.8); }      /* toy NTK = NNGP + the first-layer term */
  function gram(k) { return XT.map(function (a) { return XT.map(function (b) { return k(a, b) + (a === b ? 1e-10 : 0); }); }); }
  var A0 = gram(k0), AT = gram(kT);
  var w0 = solveSPD(A0, YT), wT = solveSPD(AT, YT), r = 0;
  YT.forEach(function (y, i) { r += y * w0[i]; });
  var st = { kappa: 0.5, lgN: 2, xs: 0.5, dlt: -0.3, gd: "off" };
  var model = null;

  function fPrior(x) { var s = 0; for (var i = 0; i < NX; i++) s += k0(x, XT[i]) * w0[i]; return s; }
  function fNTK(x) { var s = 0; for (var i = 0; i < NX; i++) s += kT(x, XT[i]) * wT[i]; return s; }
  function cond(k, A, x, z) { var a = XT.map(function (t) { return k(x, t); }), b = XT.map(function (t) { return k(z, t); }), sa = solveSPD(A, a), s = k(x, z); for (var i = 0; i < NX; i++) s -= sa[i] * b[i]; return s; }
  function build() {
    var xs = st.xs;
    model = { xs: xs, s0: Math.max(cond(k0, A0, xs, xs), 1e-5), sT: Math.max(cond(kT, AT, xs, xs), 1e-5), fs: fPrior(xs), fT: fNTK(xs), yst: yTrue(xs) };
  }
  /* cost of completing with D = f(x*) - f*(x*) */
  function parts(D) {
    var a = D * D / (model.s0 * r), u = (1 + Math.sqrt(1 + 4 * (1 + a) * st.kappa * r)) / (2 * (1 + a));
    return { S: 0.5 * (u - 1 - Math.log(u)) + 0.5 * a * u, Eg: st.kappa * r / (2 * u), u: u };
  }
  function tot(D) { var p = parts(D); return p.S + p.Eg; }
  var gamB = function (f) { return tot(f - model.fs) - tot(0); };
  var gamRO = function (f) { var a = Math.pow(f - model.fs, 2) / (model.s0 * r); return 0.5 * Math.log(1 + a); };
  var gamNTK = function (f) { return st.kappa * Math.pow(f - model.fT, 2) / (2 * model.sT); };
  var RICH = { shift: 0.45, scale: 1.7 };
  var gamRich = function (f) { var c = model.fs + RICH.shift * (model.yst - model.fs); return RICH.scale * (tot(f - model.fs - (c - model.fs)) - tot(0)); };
  function gdFn() { return st.gd === "readout" ? { g: gamRO, c: model.fs } : st.gd === "ntk" ? { g: gamNTK, c: model.fT } : st.gd === "rich" ? { g: gamRich, c: model.fs + RICH.shift * (model.yst - model.fs) } : null; }
  /* Gamma(eps) = inf{ cost(f) : eps_gen(f) >= eps } : flat below the typical error, then the cheaper of the two branches f = y* +- sqrt(eps) */
  function envelope(g, c, eps) {
    var s = Math.sqrt(eps);
    if (eps <= Math.pow(c - model.yst, 2)) return { v: 0, f: c };
    var fp = model.yst + s, fm = model.yst - s, a = g(fp), b = g(fm);
    return a <= b ? { v: a, f: fp } : { v: b, f: fm };
  }

  /* ---- layout ---- */
  var grid = el("div", { class: "an-grid an-g2" }), p1 = el("div", { class: "an-panel" }), p2 = el("div", { class: "an-panel" });
  grid.appendChild(p1); grid.appendChild(p2); root.appendChild(grid);
  var cvF = Canvas(p1, { aspect: 0.86, maxH: 460, drag: true, aria: "Interpolant with pinned training points and a draggable test point", draw: drawF });
  var cvG = Canvas(p2, { aspect: 0.86, maxH: 460, aria: "Cost of completions against generalisation error, with the gap Gamma", draw: drawG });
  var ctl = el("div", { class: "an-ctl" }), ctl2 = el("div", { class: "an-ctl" });
  var kS = slider({ tex: "\\kappa", min: 0, max: 3, step: 0.02, value: st.kappa, color: PAL.kap, fmt: function (v) { return v.toFixed(2); }, onInput: function (v) { st.kappa = v; wake(); } });
  kS.row.classList.add("kap");
  var nS = slider({ tex: "N", min: 1, max: 3, step: 0.01, value: st.lgN, fmt: function (v) { return Math.round(Math.pow(10, v)); }, onInput: function (v) { st.lgN = v; wake(); } });
  var gdSeg = segmented({ tex: "\\text{GD}", value: st.gd, options: [{ value: "off", text: "off" }, { value: "readout", text: "lazy, readout only", cls: "o-gd" }, { value: "ntk", text: "lazy, all layers (NTK)", cls: "o-gd" }, { value: "rich", text: "rich (schematic)", cls: "o-gd" }], onChange: function (v) { st.gd = v; wake(); } });
  var rst = button("Reset", function () { st.dlt = -0.3; st.xs = 0.5; build(); wake(); });
  [kS.row, nS.row, rst].forEach(function (n) { ctl.appendChild(n); }); ctl2.appendChild(gdSeg.row);
  root.appendChild(ctl); root.appendChild(ctl2);
  var read = el("p", { class: "an-read" }); root.appendChild(read);
  var gdNote = el("p", { class: "an-note" }); root.appendChild(gdNote);
  root.appendChild(el("p", { class: "an-cap", html: "<b>What it shows.</b> Left: four pinned training points, the optimal interpolant $f^\\star$ and a draggable test point $x_\\ast$; pulling $f(x_\\ast)$ away from the truth bends $f$ near $x_\\ast$ and nowhere else it is pinned. Right: the cost $\\mathcal E_\\kappa(f)$ against $\\varepsilon_{\\rm gen}=(f(x_\\ast)-y(x_\\ast))^2$; the bracket is $\\Gamma_D(\\varepsilon)$, split into entropy (blue) and $\\kappa\\times$energy (orange), and the meter is $p_B(B_\\varepsilon\\mid D)\\asymp e^{-N\\Gamma_D}$. Purple: gradient descent, in three precisely labelled cases." }));
  root.appendChild(el("p", { class: "an-note", html: "<b>Exact:</b> everything for Bayes (identity activation, one hidden layer, RBF prior kernel; $\\mathcal E_\\kappa$ is closed form), the lazy readout-only curve ($\\tfrac12\\log(1+a)$: features sampled from the prior, readout optimised), and the all-layers lazy curve $\\kappa\\Delta^2/2s_\\Theta$ with a toy NTK $\\Theta=K_0+0.6\\,K_{0.8}$. <b>Schematic:</b> the rich-regime curve, which only shows that it splits. The readout's own Gaussian fluctuation is not included, as on the page." }));
  math(root);

  function wake() { inst.redraw(); env.kick(); }

  /* ---- left: function space ---- */
  var ff = null;
  function curY() { return model.fs + st.dlt; }
  function drawF(g, w, h) {
    var ml = 34, mr = 10, mt = 20, mb = 30, fr = Frame(ml, mt, w - ml - mr, h - mt - mb, -1.1, 1.1, -1.6, 1.6); ff = fr;
    g.strokeStyle = PAL.strong; g.lineWidth = 1; g.strokeRect(fr.x, fr.y, fr.w, fr.h);
    linTicks(-1, 1, 4).forEach(function (t) { text(g, t.s, fr.X(t.v), fr.y + fr.h + 13, { size: 10.5, color: PAL.muted, align: "center" }); });
    linTicks(-1.5, 1.5, 4).forEach(function (t) { text(g, t.s, fr.x - 5, fr.Y(t.v) + 3.5, { size: 10.5, color: PAL.muted, align: "right" }); });
    g.beginPath(); g.moveTo(fr.x, fr.Y(0)); g.lineTo(fr.x + fr.w, fr.Y(0)); stroke(g, PAL.line, 1);
    text(g, "x", fr.x + fr.w, fr.y + fr.h + 26, { size: 11.5, color: PAL.muted, align: "right", italic: true });
    text(g, "function space", fr.x + 2, mt - 7, { size: 11.5, color: PAL.muted });
    var xs = [], i; for (i = 0; i <= 160; i++) xs.push(-1.1 + 2.2 * i / 160);
    var tgt = xs.map(function (x) { return [fr.X(x), fr.Y(yTrue(x))]; }); path(g, tgt); stroke(g, PAL.muted, 1.2, [2, 3]);
    var D = st.dlt, cs = XT.map(function (t) { return t; });
    var pr = xs.map(function (x) { return [fr.X(x), fr.Y(fPrior(x))]; });
    if (Math.abs(D) > 1e-3) { path(g, pr); stroke(g, PAL.muted, 1.2, [5, 3]); }
    var fx = xs.map(function (x) { var gx = cond(k0, A0, x, model.xs) / model.s0; return [fr.X(x), fr.Y(clamp(fPrior(x) + D * gx, -3, 3))]; });
    path(g, fx); stroke(g, PAL.fg, 2.4);
    var gd = gdFn();
    if (gd && st.gd === "ntk") { path(g, xs.map(function (x) { return [fr.X(x), fr.Y(fNTK(x))]; })); stroke(g, PAL.gd, 1.6, [5, 3]); }
    XT.forEach(function (x, j) { disc(g, fr.X(x), fr.Y(YT[j]), 5, PAL.fg, PAL.bg); });
    /* test point: truth (cross), completion (handle) */
    var px = fr.X(model.xs), pyT = fr.Y(model.yst), pyF = fr.Y(curY());
    g.beginPath(); g.moveTo(px, fr.y); g.lineTo(px, fr.y + fr.h); stroke(g, PAL.line, 1, [2, 3]);
    g.beginPath(); g.moveTo(px, pyT); g.lineTo(px, pyF); stroke(g, PAL.fg, 1.6);
    g.beginPath(); g.moveTo(px - 5, pyT - 5); g.lineTo(px + 5, pyT + 5); g.moveTo(px - 5, pyT + 5); g.lineTo(px + 5, pyT - 5); stroke(g, PAL.fg, 1.6);
    disc(g, px, pyF, 7.5, PAL.bg, PAL.fg); disc(g, px, pyF, 3, PAL.fg, null);
    text(g, "x*", px + 8, fr.y + fr.h - 6, { size: 12, italic: true });
    text(g, "×  y(x*)", fr.x + 6, fr.y + 14, { size: 10.5, color: PAL.muted });
    text(g, "● pinned data", fr.x + 66, fr.y + 14, { size: 10.5, color: PAL.muted });
    text(g, "drag the ring", fr.x + fr.w - 6, fr.y + 14, { size: 10.5, color: PAL.faint, align: "right" });
    if (gd && st.gd === "ntk") text(g, "┅ NTK interpolant", fr.x + fr.w - 6, fr.y + 28, { size: 10.5, color: PAL.gd, align: "right" });
  }
  dragging(cvF, {
    hit: function (x, y) { return ff && Math.hypot(x - ff.X(model.xs), y - ff.Y(curY())) < 22 ? 1 : null; },
    move: function (t, x, y) {
      var D0 = st.dlt, nx = clamp(ff.iX(x), -0.98, 0.98);
      /* keep clear of the training points: the bending cost diverges there */
      XT.forEach(function (xt) { if (Math.abs(nx - xt) < 0.06) nx = xt + (nx >= xt ? 0.06 : -0.06); });
      st.xs = nx; build();
      st.dlt = clamp(ff.iY(y) - model.fs, -1.8, 1.8);
      wake();
    }
  });

  /* ---- right: cost against eps_gen ---- */
  var EMAX = 1.0;
  function drawG(g, w, h) {
    var ml = 46, mr = 12, mt = 20, mb = 104, base = tot(0), gd = gdFn(), gmax = 0, i, eps;
    for (i = 0; i <= 60; i++) { eps = EMAX * i / 60; gmax = Math.max(gmax, envelope(gamB, model.fs, eps).v, gd ? envelope(gd.g, gd.c, eps).v : 0); }
    gmax = Math.max(gmax, 0.05);
    var fr = Frame(ml, mt, w - ml - mr, h - mt - mb, 0, EMAX, base - 0.08 * gmax, base + 1.12 * gmax);
    var yt = linTicks(fr.y0, fr.y1, 4), xt = linTicks(0, EMAX, 5);
    yt.forEach(function (t) { g.beginPath(); g.moveTo(fr.x, fr.Y(t.v)); g.lineTo(fr.x + fr.w, fr.Y(t.v)); stroke(g, PAL.line, 1); });
    axes(g, fr, { xticks: xt, yticks: yt, xlabel: "ε_gen = (f(x*) − y(x*))²", ylabel: "cost  𝓔_κ(f)" });
    g.save(); g.beginPath(); g.rect(fr.x, fr.y, fr.w, fr.h); g.clip();
    g.beginPath(); g.moveTo(fr.x, fr.Y(base)); g.lineTo(fr.x + fr.w, fr.Y(base)); stroke(g, PAL.muted, 1, [4, 3]);
    function branch(sign) { var pts = []; for (var j = 0; j <= 80; j++) { var e = EMAX * j / 80, f = model.yst + sign * Math.sqrt(e); pts.push([fr.X(e), fr.Y(base + gamB(f))]); } return pts; }
    path(g, branch(1)); stroke(g, PAL.muted, 1, [2, 3]); path(g, branch(-1)); stroke(g, PAL.muted, 1, [2, 3]);
    var env = [], genv = [];
    for (i = 0; i <= 120; i++) { eps = EMAX * i / 120; env.push([fr.X(eps), fr.Y(base + envelope(gamB, model.fs, eps).v)]); if (gd) genv.push([fr.X(eps), fr.Y(base + envelope(gd.g, gd.c, eps).v)]); }
    if (gd) { path(g, genv); stroke(g, PAL.gd, 2.4, st.gd === "rich" ? [5, 3] : []); }
    path(g, env); stroke(g, PAL.fg, 2.2);
    var ec = Math.pow(curY() - model.yst, 2), here = envelope(gamB, model.fs, Math.min(ec, EMAX)), p = parts(here.f - model.fs), p0 = parts(0);
    var dS = p.S - p0.S, dE = p.Eg - p0.Eg, bx = fr.X(Math.min(ec, EMAX)) + 9;
    var yb = fr.Y(base), yS = fr.Y(base + dS), yT = fr.Y(base + dS + dE);
    g.fillStyle = PAL.ent; g.fillRect(bx, Math.min(yb, yS), 6, Math.abs(yS - yb));
    g.fillStyle = PAL.en; g.fillRect(bx, Math.min(yS, yT), 6, Math.abs(yT - yS));
    var cur = tot(curY() - model.fs) - base;
    disc(g, fr.X(Math.min(ec, EMAX)), fr.Y(base + cur), 5, PAL.bg, PAL.fg); disc(g, fr.X(Math.min(ec, EMAX)), fr.Y(base + cur), 2, PAL.fg, null);
    g.restore();
    text(g, "Γ_D", bx + 10, (yb + yT) / 2 + 4, { size: 11.5, color: PAL.fg });
    var ets = Math.pow(model.fs - model.yst, 2);
    g.beginPath(); g.moveTo(fr.X(Math.min(ets, EMAX)), fr.y + fr.h); g.lineTo(fr.X(Math.min(ets, EMAX)), fr.y + fr.h - 8); stroke(g, PAL.fg, 1.8);
    text(g, "ε_gen(f*)", fr.X(Math.min(ets, EMAX)), fr.y + fr.h - 12, { size: 10, color: PAL.muted, align: ets > 0.6 ? "right" : "left" });
    /* meter */
    var NG = Math.pow(10, st.lgN), nat = NG * here.v, dec = nat / Math.LN10, my = h - 48, mw = w - ml - mr;
    function pw(x) { return "10" + String(-Math.round(x)).replace("-", "⁻").replace(/\d/g, function (c) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[+c]; }); }
    text(g, "p_B(B_ε | D) ≍ e^(−NΓ_D) ≈ " + pw(dec), ml, my - 6, { size: 11.5, color: PAL.fg });
    g.fillStyle = PAL.line; g.fillRect(ml, my, mw, 7); g.fillStyle = PAL.fg; g.fillRect(ml, my, mw * clamp(dec / 20, 0, 1), 7);
    text(g, "1", ml, my + 20, { size: 10, color: PAL.muted }); text(g, "10⁻²⁰", ml + mw, my + 20, { size: 10, color: PAL.muted, align: "right" });
    if (gd) {
      var hg = envelope(gd.g, gd.c, Math.min(ec, EMAX)), dg = NG * hg.v / Math.LN10;
      text(g, "p_GD ≈ " + pw(dg), ml + mw / 2, my + 20, { size: 11, color: PAL.gd, align: "center" });
      g.fillStyle = PAL.gd; g.fillRect(ml, my + 9, mw * clamp(dg / 20, 0, 1), 3);
    }
  }
  var GDTXT = {
    off: "",
    readout: "Lazy, readout only: the features keep their prior law and only the readout is optimised (sample-then-optimise). Its cost is Bayes with the tilt κE switched off, so it coincides with Bayes as κ → 0 and separates as κ grows.",
    ntk: "Lazy, all layers: GD moves every weight a little, so the relevant kernel is the NTK, Θ ≠ K⁰ (the NNGP kernel); the curve is a parabola centred on the NTK interpolant, not on f*.",
    rich: "Rich regime (schematic): C_GD is not known in closed form here. The curve only illustrates that the typical function and the cost of bad completions differ from Bayes."
  };
  function gapNow() {
    var ec = Math.pow(curY() - model.yst, 2), here = envelope(gamB, model.fs, Math.min(ec, EMAX)), p = parts(here.f - model.fs), p0 = parts(0);
    return { v: here.v, dS: p.S - p0.S, dE: p.Eg - p0.Eg, ec: ec };
  }
  function readout() {
    var p0 = parts(0), u0 = p0.u, gp = gapNow();
    read.innerHTML = "<b>Γ<sub>D</sub>(ε) = " + fmt(gp.v, 3) + "</b> at ε = " + gp.ec.toFixed(3) + ": <span class='c-ent'>entropy " + fmt(gp.dS, 3) + "</span> + <span class='c-en'>κ·energy " + fmt(gp.dE, 3) + "</span>.&nbsp; κ = " + st.kappa.toFixed(2) + ";  x* = " + model.xs.toFixed(2) + ";  f*(x*) = " + model.fs.toFixed(2) + ",  y(x*) = " + model.yst.toFixed(2) + ",  f(x*) = " + curY().toFixed(2) + ";  r = yᵀK⁰⁻¹y = " + r.toFixed(2) + ";  typical error ε_gen(f*) = " + Math.pow(model.fs - model.yst, 2).toFixed(3) + ";  the optimal kernel is K⁰ + τyyᵀ with 1 + τr = " + u0.toFixed(2) + ".";
    gdNote.textContent = GDTXT[st.gd];
    gdNote.style.display = st.gd === "off" ? "none" : "";
  }
  var inst = {
    redraw: function () { readout(); cvF.draw(); cvG.draw(); },
    live: function () { return false }
  };
  build();
  return inst;
};

if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot); else boot();
})();
