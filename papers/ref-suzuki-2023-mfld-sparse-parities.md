---
id: ref:suzuki-2023-mfld-sparse-parities
title: "Feature learning via mean-field Langevin dynamics: classifying sparse parities and beyond"
authors: ["Taiji Suzuki", "Denny Wu", "Kazusato Oko", "Atsushi Nitanda"]
year: 2023
venue: "NeurIPS 2023"
links:
  abs: https://proceedings.neurips.cc/paper_files/paper/2023/hash/6cc321baf0a8611b1d1bdbd18822667b-Abstract-Conference.html
  pdf: https://proceedings.neurips.cc/paper_files/paper/2023/file/6cc321baf0a8611b1d1bdbd18822667b-Paper-Conference.pdf
  html: not-available
one_line: "Noisy gradient descent on a mean-field two-layer network learns $k$-sparse parity with sample size linear or quadratic in $d$; $k$ leaves the exponent."
summary: "The paper gives a generalisation analysis of mean-field Langevin dynamics (MFLD) for binary classification with a two-layer tanh network. An annealing scheme that halves the entropy weight removes the exponential dependence of the log-Sobolev constant on that weight, and a local Rademacher complexity bound controls the KL-constrained model class. For $k$-sparse parity on the scaled hypercube the classification error is $O(d/n)$ up to $k$-dependent factors, and exactly zero with exponentially small failure probability once $n\\gtrsim d^2$. This decouples $k$ from the exponent of $d$, unlike kernels, although width and iteration counts stay exponential in $d$. A $d\\le150$ simulation of 2-parity agrees with both regimes."
threads: [mean-field-langevin, parity, lazy-vs-rich]
contribution: theory-experiments
tags: []

learning_rule: [gd]
depth: [one-hidden-layer]
width_limit: [inf-meanfield-fixedP, high-dim]

setting:
  architecture: [mlp]
  activation: [tanh]
  learned_layers: [all]
  parametrisation: [mean-field]
  prior_scale: [mean-field-scaling]
  prior_family: [gaussian-iid]
dials:
  likelihood_scaled: [not-applicable]
  p_vs_n: [other]
  amplitude: [order-one]
  temperature: [not-applicable]
  closure: [not-applicable]
scaling:
  N: [to-infinity]
  L: [fixed]
  P: [to-infinity]
  D: [to-infinity]
  relations: "$n\\gtrsim d$ (polynomial error) or $n\\gtrsim d^2$ (perfect); $N=O(n^2e^{O(d)})$ particles"
  order_of_limits: [joint]
  gd_step_size: [constant]
  gd_time: [other]
data:
  input: [boolean-cube]
  target: [sparse-parity]
  target_params: {k: "$k$ (general); $k=2$ in the experiment", degree: not-applicable, exponent: not-applicable, teacher_width: not-applicable}
  label_noise: [none]
  data_class: [boolean-parity]
method:
  method: [rigorous-probability, mean-field-pde, bounds]
  solver: [gradient-flow]
  approximations: [none]
empirics:
  sampler: [noisy-sgd]
  temperature: not-applicable
  chains: not-applicable
  diagnostics: [none-reported]
  mixing: [none]
  datasets: [synthetic]
  scale: "$d\\le150$, $n\\le2000$, $N=2000$ neurons, 5 trials"

results:
  - id: r1
    quantity: [sample-complexity]
    statement: "For $n$ above a threshold of order $1/\\lambda_K^2$, the MFLD estimator classifies perfectly, $P(Yf_{\\hat\\mu}>0)=1$, with probability $1-\\exp(-n\\lambda_K^2Q/(32\\bar R^4))$, where $Q>0$ is an explicit expression."
    status: thm
    grade: none
    source: {loc: "Thm 1, Sec. 4.2.1", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T3
      label: not-analysed
      paper_term: "feature learning"
      moves_mean: unknown
      explanation: "The proof compares the learned measure with a margin-$c_0$ solution through KL and an $L^\\infty$ bound, and does not describe which features the neurons learn."
  - id: r2
    quantity: [sample-complexity]
    statement: "With probability $1-e^{-t}$ the classification error of $f_{\\mu^{(K)}}$ is at most a constant times $(4+t+\\log\\log n)\\bar R^2/(n\\lambda_K)$ plus smaller terms, so $n$ linear in the dimension suffices for small error."
    status: thm
    grade: none
    source: {loc: "Thm 2, Sec. 4.2.2", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T3
      label: not-analysed
      paper_term: "feature learning"
      moves_mean: unknown
      explanation: "The bound uses only convergence of the loss through local Rademacher complexity. Which features are learned is not examined."
  - id: r3
    quantity: [sample-complexity]
    statement: "For $k$-sparse parity, error is $O(k^2\\log(k)^2 d/n)$ up to log factors, and exactly zero when $n=\\Omega(k^6\\log(k)^4d^2)$. Cost is $e^{O(k^2\\log(k)^2 d)}$ iterations and particles; kernels need $n=\\Omega(d^k)$."
    status: thm
    grade: none
    source: {loc: "Cor 1, Table 1, Sec. 4.2", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T3
      label: not-analysed
      paper_term: "feature learning"
      moves_mean: "yes"
      explanation: "The paper credits feature learning with the gain over kernels, whose sample complexity is $\\Omega(d^k)$. Prop 3 only shows that a network with small KL cost and margin exists, so the learned features themselves are not characterised."
  - id: r4
    quantity: [mixing-convergence, time-to-learn]
    statement: "Annealing the entropy weight, $\\lambda^{(\\kappa)}=2^{-\\kappa}\\lambda^{(0)}$, keeps the log-Sobolev constant $\\alpha\\ge\\lambda_1\\exp(-8c_L\\bar R(R+2))$ independent of the current $\\lambda$, removing its exponential dependence on the final regularisation."
    status: thm
    grade: none
    source: {loc: "Sec. 4.1, Remark 1", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T3
      label: not-analysed
      paper_term: "annealing procedure"
      moves_mean: unknown
      explanation: "The argument rests on the loss-dependent bound $\\|\\delta L/\\delta\\mu\\|_\\infty\\le c_L\\bar R L(\\mu)$, which shrinks as training loss falls. It concerns optimisation, not features."
    overrides:
      scaling: {relations: "$N$ particles, step $\\eta$, rounds $K=\\log_2(R/(\\lambda^{(0)}\\epsilon^*))$"}

relations:
  - {type: uses-method-of, target: "2201.10469", note: "Entropy-sandwich convergence of MFLD (Proposition 2 cites Nitanda et al. 2022 and Chizat 2022)."}
  - {type: uses-method-of, target: "2306.07221", note: "Discretised MFLD convergence (Suzuki et al. 2023b) is applied in Sec. 3."}
open_problems: []
provenance:
  added_by: claude-sonnet-5-5
  status: extracted
  verified_by: []
  version_read: published
  date_added: "2026-10-24"
---

- Read the NeurIPS 2023 proceedings PDF (main text; appendices with the proofs of Props 3-4 and Thms 1-2 not read in detail). Locations are as printed; no HTML exists, so all anchors are `none`.
- Classified `gd` because the paper analyses the noisy-GD dynamics (convergence, discretisation, annealing), not the stationary law as a posterior.
- `width_limit` lists both the mean-field group (theory is for the particle-approximated mean-field network) and `high-dim` (the parity application with $n\sim d$ or $d^2$). Width and iterations are exponential in $d$, which the authors list as a limitation.
- Mechanism: the paper says feature learning "zooms in" on the relevant subspace but proves only existence of a good measure (Prop 3), so labels are `not-analysed`.
- The paper's Table 1 compares with NTK rates $d^2/n$ and mean-field gradient flow rates from other works; those comparisons are quoted, not re-derived.
