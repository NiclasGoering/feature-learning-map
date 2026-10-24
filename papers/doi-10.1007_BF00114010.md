---
id: doi:10.1007/BF00114010
title: "Rigorous learning curve bounds from statistical mechanics"
authors: ["David Haussler", "Michael Kearns", "H. Sebastian Seung", "Naftali Tishby"]
year: 1996
venue: "Machine Learning 25, 195-236"
links:
  abs: https://doi.org/10.1007/BF00114010
  pdf: not-available
  html: not-available
one_line: "Error-shell decomposition and a rigorous thermodynamic limit turn entropy-energy competition into learning-curve bounds with phase transitions that VC bounds cannot show."
summary: "The paper gives a mathematically rigorous version of the annealed-approximation and thermodynamic-limit methods of statistical mechanics for finite function classes. Splitting the class into shells of equal generalisation error gives a bound for any consistent learner. In the limit where the sample size is a fixed multiple $\\alpha$ of a scaling function $t(N)$, the bound becomes the rightmost crossing of an entropy curve $s(\\epsilon)$ and an energy curve $-\\alpha\\log(1-\\epsilon)$. For the Ising perceptron this predicts perfect learning above $\\alpha\\approx1.448$, where VC bounds need $m\\sim N^{3/2}$. A matching lower-bound construction and an extension to unrealizable targets with large-$\\alpha$ asymptotics follow."
threads: [classical-gibbs, kernel-learning-curves]
contribution: theory
tags: [R6, first-order-transition]

learning_rule: [bayes]
depth: [one-hidden-layer]
width_limit: [finite-exact]

setting:
  architecture: [other]
  activation: [sign]
  learned_layers: [all]
  parametrisation: [other]
  prior_scale: [other]
  prior_family: [binary]
dials:
  likelihood_scaled: ["no"]
  p_vs_n: [proportional]
  amplitude: [not-stated]
  temperature: [to-zero]
  closure: [none]
scaling:
  N: [fixed]
  L: [fixed]
  P: [fixed]
  D: [fixed]
  relations: "finite classes with $|\\mathcal F_N|\\le2^N$; non-asymptotic shell bounds"
  order_of_limits: [none]
  gd_step_size: [not-applicable]
  gd_time: [not-applicable]
data:
  input: [sphere]
  target: [arbitrary]
  target_params: {k: not-applicable, degree: not-applicable, exponent: not-applicable, teacher_width: not-applicable}
  label_noise: [none]
  data_class: [other]
method:
  method: [bounds, saddle-point-ld, rigorous-probability]
  solver: [algebraic]
  approximations: [none]
empirics:
  sampler: [none]
  temperature: not-applicable
  chains: not-applicable
  diagnostics: [none-reported]
  mixing: [none]
  datasets: [none]
  scale: not-applicable

results:
  - id: r1
    quantity: [generalisation-error]
    statement: "For a finite class, with probability $1-\\delta$ every hypothesis consistent with $m$ examples has error at most the smallest shell error $\\epsilon_i$ with $\\sum_{j\\ge i}Q_j(1-\\epsilon_j)^m\\le\\delta$, where $Q_j$ is the number of functions with error $\\epsilon_j$."
    status: thm
    grade: none
    source: {loc: "Thm 1, Thm 3, Eq. (6)", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "error shells"
      moves_mean: unknown
      explanation: "A union bound is applied shell by shell instead of using the total cardinality. The analysis counts hypotheses at each error and does not describe learned features."
  - id: r2
    quantity: [generalisation-error, phase-diagram]
    statement: "With $m=\\alpha\\,t(N)$ and a permissible entropy bound $s(\\epsilon)$, consistent hypotheses have error at most $\\epsilon^*$ in the limit, where $\\epsilon^*(\\alpha)$ is the rightmost crossing of $s(\\epsilon)$ and $-\\alpha\\log(1-\\epsilon)$."
    status: thm
    grade: A
    source: {loc: "Thm 4, Sec. 2.4-2.5, Eq. (16)", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T5
      label: not-analysed
      paper_term: "entropy-energy competition"
      moves_mean: unknown
      explanation: "The learning curve is the competition between the log-count of hypotheses at each error (entropy) and their survival probability (energy). A jump of the rightmost crossing gives a sudden transition of the bound, which the paper says need not be a transition of the true curve."
    overrides:
      width_limit: [high-dim]
      scaling: {N: [to-infinity], P: [to-infinity], order_of_limits: [joint], relations: "$m/t(N)\\to\\alpha$, with $t(N)=N$ for perceptrons"}
  - id: r3
    quantity: [generalisation-error, phase-diagram]
    statement: "For Ising perceptrons ($\\pm1$ weights) with spherically symmetric inputs and $t(N)=N$, the entropy bound is $\\mathcal H(\\sin^2(\\pi\\epsilon/2))$ and the bound jumps to zero error at $\\alpha\\approx1.448$, whereas VC bounds require $m\\sim N^{3/2}$."
    status: thm
    grade: A
    source: {loc: "Sec. 2.6, Eqs. (18)-(19), Fig. 3-4", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T5
      label: not-analysed
      paper_term: "phase transition to perfect generalisation"
      moves_mean: unknown
      explanation: "Beyond the critical $\\alpha$ the energy curve no longer meets the entropy curve away from the target, so only the target remains. This critical value was known from Gardner and Derrida by the replica method."
    overrides:
      width_limit: [high-dim]
      scaling: {N: [to-infinity], P: [to-infinity], D: [to-infinity], order_of_limits: [joint], relations: "$m/N\\to\\alpha$"}
  - id: r4
    quantity: [generalisation-error]
    statement: "For any continuous $s$ bounded away from 1 with $s(0)=s(1)=0$ there are classes and targets for which $s$ is a permissible entropy bound and a consistent hypothesis of error above the crossing of $s(\\epsilon)$ and $2\\alpha\\epsilon$ survives with constant probability."
    status: thm
    grade: none
    source: {loc: "Thm 5, Sec. 2.8", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "thermodynamic limit lower bound"
      moves_mean: unknown
      explanation: "The construction gives each error level the required number of unique parity functions on a subset of the input space. It shows the entropy-energy picture is tight given only the entropy bound."
    overrides:
      width_limit: [high-dim]
      scaling: {N: [to-infinity], P: [to-infinity], order_of_limits: [joint], relations: "$m=\\alpha N$, $|\\mathcal F_N|=2^N$"}
      data: {input: [boolean-cube]}
  - id: r5
    quantity: [generalisation-error, phase-diagram]
    statement: "For unrealizable targets, empirical-error minimisers have error at most the rightmost crossing of $s(\\epsilon)$ and $\\alpha u(\\epsilon)$. At large $\\alpha$, an exponent $x$ in $s\\,v\\sim(\\Delta\\epsilon)^x$ gives a first-order transition for $x>2$ and power-law decay for $1<x<2$."
    status: thm
    grade: A
    source: {loc: "Thm 8, Sec. 3.3, Sec. 3.5, Eqs. (45), (54)-(56)", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T5
      label: not-analysed
      paper_term: "first-order phase transition"
      moves_mean: unknown
      explanation: "The unrealizable Ising perceptron has a line of first-order transitions that ends at a finite $\\alpha$ as the minimal error grows (Fig. 21). Features are not analysed."
    overrides:
      width_limit: [high-dim]
      scaling: {N: [to-infinity], P: [to-infinity], D: [to-infinity], order_of_limits: [joint], relations: "$m/t(N)\\to\\alpha$"}
      data: {label_noise: [other]}

relations:
  - {type: extends, target: "doi:10.1007/BF00993163", note: "Same authors' framework: Bayes and Gibbs learning curves related to VC theory (Sec. 1 discusses the connection)."}
  - {type: uses-method-of, target: "doi:10.1103/PhysRevA.45.6056", note: "The annealed approximation and thermodynamic limit are taken from the statistical mechanics of learning (Sec. 1)."}
open_problems: []
provenance:
  added_by: claude-sonnet-5-5
  status: extracted
  verified_by: []
  version_read: published
  date_added: "2026-10-24"
---

- Read a PDF copy of the Machine Learning 25 version (pp. 195-236) covering Secs. 1-3, 4's opening, the conclusion and the appendix statements; Secs. 4-5 (infinite classes, distribution learning) were read only at heading level. The text layer is OCR with some garbled formulas, so equation numbers and the exact form of the Ising entropy bound in r3 were taken from the surrounding text. The year is the printed 1996; Crossref lists the volume as 1997.
- Learning rule: consistent hypotheses are drawn from the version space (zero-temperature Gibbs), so `bayes` with R6 and the `high-dim` override on the thermodynamic-limit results. The tag `first-order-transition` is used because r3 and r5 report such transitions.
- The paper stresses that a transition in the bound is not necessarily a transition in the true learning curve. It also gives an upper bound only; r4 shows tightness relative to the entropy bound alone.
- Grade A for r2, r3 and r5 because the bounds are explicit functions of the entropy bound; r1 and r4 have no numbers.
- The relation to the HKS paper is hedged: the paper cites it and discusses the same connection, but does not state that it extends it.
