---
id: doi:10.1038/s41467-018-03101-6
title: "Input–output maps are strongly biased towards simple outputs"
authors: ["Kamaludin Dingle", "Chico Q. Camargo", "Ard A. Louis"]
year: 2018
venue: "Nature Communications 9, 761"
links:
  abs: https://doi.org/10.1038/s41467-018-03101-6
  pdf: https://www.nature.com/articles/s41467-018-03101-6.pdf
  html: not-available
one_line: "For limited-complexity discrete maps, the probability that random inputs give output $x$ is bounded by $2^{-a\\tilde K(x)-b}$, tested on RNA, ODEs and other maps."
summary: "The paper adapts the algorithmic-information coding theorem to computable input-output maps. Describing each output by its Shannon-Fano-Elias code gives $P(x)\\le2^{-K(x|f,n)+O(1)}$, and for maps of limited complexity that are redundant, nonlinear and well behaved this suggests the ansatz $P(x)\\lesssim2^{-a\\tilde K(x)-b}$ with $\\tilde K$ a compression-based complexity. The slope $a\\approx\\log_2N_O/\\max\\tilde K$ is predicted from the number of outputs and $b\\approx0$ by default. The bound is tested on RNA folding, a coarse-grained circadian-rhythm ODE, an Ornstein-Uhlenbeck trading model and L-systems. A random matrix map shows bias without simplicity bias."
threads: [volume-simplicity]
contribution: theory-experiments
tags: [R6]

learning_rule: [bayes]
depth: [one-hidden-layer]
width_limit: [finite-exact]

setting:
  architecture: [other]
  activation: [sign]
  learned_layers: [not-stated]
  parametrisation: [not-stated]
  prior_scale: [not-stated]
  prior_family: [other]
dials:
  likelihood_scaled: ["no"]
  p_vs_n: [not-stated]
  amplitude: [not-stated]
  temperature: [not-stated]
  closure: [none]
scaling:
  N: [fixed]
  L: [fixed]
  P: [fixed]
  D: [fixed]
  relations: "input length $n$; $N_I\\ge N_O\\gg1$ inputs and outputs; bound derived for large output complexity"
  order_of_limits: [single-limit]
  gd_step_size: [not-applicable]
  gd_time: [not-applicable]
data:
  input: [other]
  target: [other]
  target_params: {k: not-applicable, degree: not-applicable, exponent: not-applicable, teacher_width: not-applicable}
  label_noise: [none]
  data_class: [other]
method:
  method: [information-theoretic, other]
  solver: [none]
  approximations: [other]
empirics:
  sampler: [other]
  temperature: not-applicable
  chains: not-applicable
  diagnostics: [none-reported]
  mixing: [none]
  datasets: [synthetic]
  scale: "RNA $n=55$; circadian ODE with 15 parameters; $32\\times32$ matrix maps"

results:
  - id: r1
    quantity: [posterior-predictive]
    statement: "For a computable map $f$ on $n$ inputs, the probability that a random input yields output $x$ satisfies $P(x)\\le2^{-K(x|f,n)+O(1)}$, and for limited-complexity maps $K(x|f,n)\\le K(x)+O(1)$."
    status: thm
    grade: none
    source: {loc: "Eq. (2), Results", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "coding theorem for computable functions"
      moves_mean: unknown
      explanation: "The bound follows from describing each output by a Shannon-Fano-Elias code of length $1-\\log_2P(x)$ given the map. It concerns the prior over outputs, not features."
  - id: r2
    quantity: [posterior-predictive]
    statement: "Ansatz: for maps that are limited-complexity, redundant, nonlinear and well behaved, $P(x)\\lesssim2^{-a\\tilde K(x)-b}$ with $a>0$ and $b$ map-dependent constants; the bound is tight for most inputs but weak for many outputs."
    status: conjecture
    grade: A
    source: {loc: "Eq. (3), Results", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "simplicity bias"
      moves_mean: unknown
      explanation: "Simple outputs are exponentially more likely under random input sampling than complex ones. The paper does not relate this to the features of any network."
  - id: r3
    quantity: [posterior-predictive]
    statement: "The slope can be predicted as $a\\approx\\log_2N_O/\\max\\tilde K(x)$ with $b\\approx0$ by default; for RNA $n=55$ it gives $a=0.32$, and the bound matches the sampled data well for RNA, ODE, trading and L-system maps."
    status: num
    grade: A
    source: {loc: "Eq. (4), Fig. 1a-d", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "simplicity bias"
      moves_mean: unknown
      explanation: "The slope uses only the number of outputs and the largest complexity, which makes the bound predictive from minimal knowledge of the map. Features are not discussed."
    overrides:
      width_limit: [high-dim]
      scaling: {N: [to-infinity], D: [to-infinity], order_of_limits: [joint], relations: "RNA length $n=55$; complexity $\\tilde K$ estimated by a Lempel-Ziv measure"}
  - id: r4
    quantity: [posterior-predictive]
    statement: "A thresholded random $\\pm1$ matrix map is strongly biased but $P(x)$ does not correlate with output complexity. A circulant matrix map shows simplicity bias only when the complexity of its defining row is small."
    status: num
    grade: none
    source: {loc: "Fig. 1e-f, Fig. 2", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "bias but not simplicity bias"
      moves_mean: unknown
      explanation: "With independent matrix entries the map's own complexity grows with $n$, violating the limited-complexity condition, so the output pattern reflects the matrix and not output simplicity. The thresholding step resembles a simple neural network unit."
    overrides:
      setting: {architecture: [linear]}

relations: []
open_problems: []
provenance:
  added_by: claude-sonnet-5-5
  status: extracted
  verified_by: []
  version_read: published
  date_added: "2026-10-24"
---

- Read the open-access Nature Communications article (main text and Methods up to the RNA example); the Supplementary Notes, which hold the derivations of the bound and of $a$ and $b$ (Notes 2-8), were not available and are not checked. No HTML copy was read, so anchors are `none`.
- The paper is not about neural networks. It is included as the origin of the simplicity-bias bound used in the volume-simplicity thread; fields such as architecture and activation are only filled for the thresholded matrix map and are `other` or `not-stated` elsewhere.
- Learning rule `bayes` is the closest class for "probability under random sampling of inputs", i.e. a prior over outputs. Tag R6 follows other prior-volume papers, with the `high-dim` override on r3.
- Eq. (3) is an ansatz argued from the coding theorem, not a theorem: the paper itself says only that it expects the bound to hold, and r2 is marked `conjecture` for that reason.
- Complexity $\tilde K$ is a Lempel-Ziv based estimate, not the true Kolmogorov complexity; the paper says other compression measures give the same results (Supplementary Note 7).
