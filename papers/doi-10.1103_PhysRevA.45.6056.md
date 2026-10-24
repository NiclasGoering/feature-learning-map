---
id: doi:10.1103/PhysRevA.45.6056
title: "Statistical mechanics of learning from examples"
authors: ["H. S. Seung", "H. Sompolinsky", "N. Tishby"]
year: 1992
venue: "Physical Review A 45, 6056"
links:
  abs: https://doi.org/10.1103/PhysRevA.45.6056
  pdf: not-available
  html: not-available
one_line: "Gibbs learning at temperature $T$ yields learning curves with $P\\propto N$ examples, inverse power laws for smooth networks and discontinuous transitions for nonsmooth ones."
summary: "The paper treats training as sampling from a Gibbs distribution over weights at temperature $T$ and studies the generalisation curve $\\epsilon_g(\\alpha)$ with $P=\\alpha N$ examples. It develops the high-temperature limit and the annealed approximation and compares them with the replica theory. For smooth networks the errors approach their optimum as an inverse power law in $\\alpha$. For nonsmooth networks learning realizable rules, such as discrete-weight perceptrons, a discontinuous transition from poor to perfect generalisation can occur, and a classification of curves by the small-error entropy is proposed. For unrealizable rules the approximations fail, the optimal temperature can be nonzero and spin-glass phases appear."
threads: [classical-gibbs, kernel-learning-curves]
contribution: theory-experiments
tags: [R6, first-order-transition]

learning_rule: [bayes]
depth: [one-hidden-layer]
width_limit: [high-dim]

setting:
  architecture: [other]
  activation: [linear, sign]
  learned_layers: [all]
  parametrisation: [other]
  prior_scale: [other]
  prior_family: [spherical, binary]
dials:
  likelihood_scaled: ["no"]
  p_vs_n: [proportional]
  amplitude: [order-one]
  temperature: [fixed]
  closure: [none]
scaling:
  N: [to-infinity]
  L: [fixed]
  P: [to-infinity]
  D: [to-infinity]
  relations: "$P=\\alpha N$, with $N$ the number of independently adjustable weights"
  order_of_limits: [joint]
  gd_step_size: [not-applicable]
  gd_time: [not-applicable]
data:
  input: [isotropic-gaussian]
  target: [teacher-network]
  target_params: {k: not-applicable, degree: not-applicable, exponent: not-applicable, teacher_width: "1 (perceptron teacher)"}
  label_noise: [other]
  data_class: [gaussian-teacher]
method:
  method: [replica, information-theoretic]
  solver: [algebraic]
  approximations: [replica-symmetric, saddle-point, other]
empirics:
  sampler: [other]
  temperature: "$T=0.2$ and $T=1$"
  chains: not-stated
  diagnostics: [none-reported]
  mixing: [low]
  datasets: [synthetic]
  scale: "$N=75$ to $100$ weights; Metropolis Monte Carlo"

results:
  - id: r1
    quantity: [generalisation-error]
    statement: "For smooth networks (differentiable training energy, unique optimal weights), generalisation and training errors approach their optimum as an inverse power law in $\\alpha$ at any $T$, with a simple relation between them, also for unrealizable rules."
    status: phys
    grade: A
    source: {loc: "Sec. III, Eqs. (3.12), (3.14)-(3.15)", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "smooth networks"
      moves_mean: unknown
      explanation: "A perturbative expansion around the optimal weights gives fluctuations of order $1/\\alpha$. The paper does not discuss features."
  - id: r2
    quantity: [generalisation-error, phase-diagram]
    statement: "The small-error entropy $s(\\epsilon)\\sim\\epsilon^x\\ln\\epsilon$ classifies realizable learning curves: smooth weights ($x=0$) give an inverse power law, $0<x<1$ a nontrivial power law, $x=1$ an exponential, and $x>1$ a discontinuous transition to perfect learning."
    status: phys
    grade: A
    source: {loc: "Sec. VII E, Eqs. (7.2)-(7.5)", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T5
      label: not-analysed
      paper_term: "discontinuous learning transition"
      moves_mean: unknown
      explanation: "The classification comes from the high-temperature limit and is justified there only; the authors expect it to hold at lower $T$ for many realizable rules. It is not an analysis of features."
  - id: r3
    quantity: [generalisation-error, phase-diagram]
    statement: "For a Boolean perceptron with binary weights and a realizable rule, the generalisation error jumps discontinuously from poor to perfect learning at a critical $\\alpha$, even at high temperature, owing to the singular excitation spectrum above the ground state."
    status: phys
    grade: A
    source: {loc: "Sec. V D, Eqs. (5.62)-(5.63), Fig. 6", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T5
      label: not-analysed
      paper_term: "discontinuous transition to perfect learning"
      moves_mean: unknown
      explanation: "The entropy exponent of this model is $x=2$, so the high-temperature free energy has a first-order jump. Its low-temperature phase structure is treated with replica symmetry breaking."
    overrides:
      setting: {activation: [sign], prior_family: [binary]}
  - id: r4
    quantity: [generalisation-error]
    statement: "For a linear-output perceptron with continuous weights the tail is $T/\\alpha$, while binary weights give $\\exp(-2\\alpha/T)$ and a discontinuous transition at low $T$; annealed and high-$T$ theories track the replica result."
    status: phys
    grade: A
    source: {loc: "Sec. V, Eqs. (5.10), (5.32), Figs. 1, 3", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T5
      label: not-analysed
      paper_term: "constrained weights"
      moves_mean: unknown
      explanation: "Restricting weights to the discrete values of the rule acts as prior knowledge and removes the power-law tail. Replica symmetric theory is compared with Metropolis Monte Carlo at $N=100$."
    overrides:
      setting: {activation: [linear]}
  - id: r5
    quantity: [generalisation-error, optimal-hyperparameter]
    statement: "For unrealizable rules the high-temperature and annealed theories fail at any fixed $T$: replica tails differ, $\\epsilon_g$ need not increase with $T$, a nonzero optimal temperature can appear, and genuine spin-glass phases persist at large $\\alpha$."
    status: phys
    grade: A
    source: {loc: "Sec. VI, Sec. VII F, Eqs. (6.29), (7.6)-(7.7)", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T5
      label: not-analysed
      paper_term: "spin-glass phases"
      moves_mean: unknown
      explanation: "Fitting a particular random sample of examples creates frustration that the approximations ignore. The paper locates the temperature where the entropy vanishes as a bound on the onset of the spin-glass phase."

relations: []
open_problems: []
provenance:
  added_by: claude-sonnet-5-5
  status: extracted
  verified_by: []
  version_read: published
  date_added: "2026-10-24"
---

- Read the abstract, introduction, Sec. II-III, the headings and opening of Sec. V-VI, and Sec. VII (discussion) of the 36-page Physical Review A article; the replica algebra and appendices B onward were not checked. The PDF text layer is OCR with garbled formulas, so equation numbers for r3-r5 were read from cross-references in the discussion rather than from the typeset equations. No HTML exists, so anchors are `none`.
- Models are single-layer perceptrons (linear or Boolean output; continuous, spherical or binary weights; realizable or mismatched rules). The perceptron examples use Gaussian inputs; the paper states multilayer claims only as expectations, so the depth class `one-hidden-layer` is the closest fit.
- The Gibbs distribution at temperature $T$ is the paper's training model, so `bayes`; tag R6 matches $P=\alpha N$. The `first-order-transition` tag reflects the discontinuous learning transitions.
- The paper says its classification (r2) is justified only in the high-$T$ limit and that evaluating $s(\epsilon)$ is hard in general.
- Exponents in Eqs. (7.6)-(7.7) are garbled in the text layer, so r5 does not quote them.
