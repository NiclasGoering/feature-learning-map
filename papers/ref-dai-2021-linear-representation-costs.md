---
id: ref:dai-2021-linear-representation-costs
title: "Representation Costs of Linear Neural Networks: Analysis and Design"
authors: ["Zhen Dai", "Mina Karzand", "Nathan Srebro"]
year: 2021
venue: "NeurIPS 2021"
links:
  abs: https://proceedings.neurips.cc/paper/2021/hash/e22cb9d6bbb4c290a94e4fff4d68a831-Abstract.html
  pdf: https://proceedings.neurips.cc/paper/2021/file/e22cb9d6bbb4c290a94e4fff4d68a831-Paper.pdf
  html: not-available
one_line: "For linear networks, $\\ell_2$ weight regularisation induces Schatten, group and Fourier-domain quasi-norms on the predictor, and architectures can be designed to induce chosen norms."
summary: "The representation cost of a predictor is the least squared $\\ell_2$ norm of parameters that realise it. For linear networks the paper computes it exactly: fully connected depth-$d$ networks give the Schatten-$2/d$ quasi-norm, diagonal networks the $\\ell_{2/d,2}$ quasi-norm, and convolutional networks the same quasi-norm on the Fourier domain. A non-homogeneous residual network has the cost of its shallowest branch for small predictors and of its deepest for large ones. In the reverse direction, $\\ell_p$ quasi-norms are induced by some linear network if and only if $2/p$ is an integer. Group quasi-norms and $k$-support norms are induced by designed architectures, while elastic nets and overlapping groups are not."
threads: [representation-costs, deep-linear]
contribution: theory
tags: []

learning_rule: [gd]
depth: [one-hidden-layer, deep]
width_limit: [finite-exact]

setting:
  architecture: [linear, deep-linear, cnn, resnet]
  activation: [linear]
  learned_layers: [all]
  parametrisation: [other]
  prior_scale: [not-stated]
  prior_family: [not-stated]
dials:
  likelihood_scaled: [not-applicable]
  p_vs_n: [other]
  amplitude: [not-stated]
  temperature: [not-applicable]
  closure: [not-applicable]
scaling:
  N: [fixed]
  L: [fixed]
  P: [fixed]
  D: [fixed]
  relations: "non-asymptotic; hidden widths at least $\\min(m,n)$; depth $d$ arbitrary"
  order_of_limits: [none]
  gd_step_size: [not-stated]
  gd_time: [to-convergence]
data:
  input: [arbitrary]
  target: [linear]
  target_params: {k: not-applicable, degree: not-applicable, exponent: not-applicable, teacher_width: not-applicable}
  label_noise: [not-stated]
  data_class: [data-agnostic]
method:
  method: [rigorous-probability, other]
  solver: [none]
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
    quantity: [weight-statistics]
    statement: "For a linear fully connected network of depth $d$ with hidden widths at least $\\min(m,n)$, the representation cost of $\\beta\\in\\mathbb R^{m\\times n}$ is $d\\sum_i\\sigma_i^{2/d}$, a monotone function of the Schatten-$2/d$ quasi-norm of $\\beta$."
    status: thm
    grade: none
    source: {loc: "Thm 1, Sec. 3.1.1", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T4
      label: not-analysed
      paper_term: "induced complexity measure"
      moves_mean: unknown
      explanation: "Weight decay on the factors is a Schatten quasi-norm on their product. The paper identifies the norm and does not discuss which features or directions it selects."
  - id: r2
    quantity: [weight-statistics]
    statement: "Linear diagonal networks of depth $d$ have cost $d\\|\\beta\\|_{2/d,2}^{2/d}$, and linear CNNs with full filter width have the same cost on the Fourier transform $\\hat\\beta$, so regularisation is sparsity-inducing in the Fourier domain."
    status: thm
    grade: none
    source: {loc: "Thm 2, Thm 3, Sec. 3.1.2-3.1.3", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T4
      label: not-analysed
      paper_term: "induced complexity measure"
      moves_mean: unknown
      explanation: "Per-coordinate (or per-Fourier-coefficient) products of $d$ weights give an $\\ell_{2/d}$-type cost over coordinates. The paper does not study the learned features."
    overrides:
      setting: {architecture: [linear, cnn]}
  - id: r3
    quantity: [weight-statistics]
    statement: "For a residual network summing homogeneous branches of increasing depths $d_1<\\dots<d_k$, the representation cost of $\\lambda\\beta$ is asymptotically that of the shallowest branch as $\\lambda\\to0$ and of the deepest as $\\lambda\\to\\infty$."
    status: thm
    grade: none
    source: {loc: "Thm 4, Sec. 3.2", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T4
      label: not-analysed
      paper_term: "non-homogeneous residual network"
      moves_mean: unknown
      explanation: "The cost interpolates between those of the component branches. The paper does not describe the learned features."
    overrides:
      setting: {architecture: [resnet]}
  - id: r4
    quantity: [weight-statistics]
    statement: "Some linear homogeneous feedforward network without shared weights induces the $\\ell_p$ quasi-norm if and only if $2/p$ is a natural number. A diagonal network of depth $2/p$ does so."
    status: thm
    grade: none
    source: {loc: "Thm 7, Sec. 4.1.1", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T4
      label: not-analysed
      paper_term: "architecture design"
      moves_mean: unknown
      explanation: "The result characterises which quasi-norms weight decay can realise through architecture. It gives no feature-level description."
    overrides:
      setting: {architecture: [deep-linear]}
  - id: r5
    quantity: [weight-statistics]
    statement: "Group networks induce $\\ell_{p,q}$ group quasi-norms with $2/p,2/q\\in\\mathbb N$ and $2/p\\ge2/q-1$; $k$-balanced two-layer networks induce the $k$-support norm; elastic nets and overlapping group norms are induced by no linear network."
    status: thm
    grade: none
    source: {loc: "Thm 8, Thm 11, Sec. 4.1.2-4.2", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T4
      label: not-analysed
      paper_term: "architecture design"
      moves_mean: unknown
      explanation: "Connectivity patterns of hidden units decide which groups of inputs are penalised together. The paper does not analyse learned features."
    overrides:
      setting: {architecture: [deep-linear]}

relations: []
open_problems: []
provenance:
  added_by: claude-sonnet-5-5
  status: extracted
  verified_by: []
  version_read: published
  date_added: "2026-10-24"
---

- Read the NeurIPS 2021 main text through Thm 12 and the start of Sec. 5 (homogeneous parameterisations); supplementary proofs and the restricted-filter CNN results are not in the main text and were not read. No HTML version exists, so anchors are `none`.
- Classified `gd` because the paper frames the cost as the regulariser induced by weight decay and by implicit regularisation of gradient descent on homogeneous nets; it contains no dynamics.
- Theorem numbers follow the paper: Thm 1 (fully connected), Thm 2 (diagonal), Thm 3 (CNN), Thm 4 (ResNet), Thm 7 ($\ell_p$), Thm 8 and Thm 11 (group and $k$-support), Thm 12 (ResNet inherits impossibility results). Results are stated for single-output networks in several places, and for multiple outputs in Thms 1-3.
- Depth lists both values because Lemma 5, Thm 11 and Thm 10 concern depth two while the rest hold for any depth $d$.
- Mechanism: every result identifies a norm, not a change in features, so labels are `not-analysed`. The T4 type is used because the paper's cost is a weight-decay norm.
