---
id: ref:dziugaite-2025-teacher-size
title: "The Size of Teachers as a Measure of Data Complexity: PAC-Bayes Excess Risk Bounds and Scaling Laws"
authors: ["Gintare Karolina Dziugaite", "Daniel M. Roy"]
year: 2025
venue: "AISTATS 2025"
links:
  abs: https://proceedings.mlr.press/v258/dziugaite25a.html
  pdf: https://raw.githubusercontent.com/mlresearch/v258/main/assets/dziugaite25a/dziugaite25a.pdf
  html: not-available
one_line: "A PAC-Bayes oracle inequality bounds Gibbs-posterior network risk by the size and risk of any smaller teacher, giving data complexity and scaling laws."
summary: "The paper gives a short single-sample PAC-Bayes proof that a random network sampled from the posterior given interpolation has risk of order the negative log probability of interpolation divided by $n$. For a quantized gated residual MLP prior, a smaller teacher embeds in a wider, deeper student at a cost linear in the teacher's parameters and the student's extra neurons. A Gibbs posterior with inverse temperature $\\beta\\sim\\sqrt n$ then satisfies an oracle inequality against every teacher. The minimal teacher size $C(\\varepsilon)$ needed for excess risk $\\varepsilon$ is proposed as a data-complexity measure. Polynomial $C(\\varepsilon)$ gives power-law rates, which compared with empirical scaling laws suggest $C(\\varepsilon)$ is at least $\\varepsilon^{-9}$."
threads: [scaling-laws, classical-gibbs, volume-simplicity]
contribution: theory-experiments
tags: [R6]

learning_rule: [bayes]
depth: [deep]
width_limit: [finite-exact]

setting:
  architecture: [mlp, resnet]
  activation: [generic]
  learned_layers: [all]
  parametrisation: [other]
  prior_scale: [other]
  prior_family: [other]
dials:
  likelihood_scaled: ["no"]
  p_vs_n: [other]
  amplitude: [order-one]
  temperature: [to-zero]
  closure: [none]
scaling:
  N: [fixed]
  L: [fixed]
  P: [fixed]
  D: [fixed]
  relations: "Non-asymptotic in $n$; student size may grow with $n$ (at most $n^2$ parameters) in the scaling-law part"
  order_of_limits: [none]
  gd_step_size: [not-applicable]
  gd_time: [not-applicable]
data:
  input: [arbitrary]
  target: [teacher-network, arbitrary]
  target_params: {k: not-applicable, degree: not-applicable, exponent: not-applicable, teacher_width: "$d^*$ (arbitrary, smaller than student)"}
  label_noise: [other]
  data_class: [data-agnostic]
method:
  method: [bounds]
  solver: [none]
  approximations: [none]
empirics:
  sampler: [none]
  temperature: not-applicable
  chains: not-applicable
  diagnostics: [none-reported]
  mixing: [none]
  datasets: [mnist, synthetic]
  scale: "MNIST with a 3-neuron teacher (2388 parameters), $n=50000$; synthetic bounds up to $n\\sim10^{20}$"

results:
  - id: r1
    quantity: [generalisation-error, sample-complexity]
    statement: "For a sample from the posterior conditioned on interpolation, with probability $1-\\delta$ the risk is at most $\\frac1n\\left[\\log\\frac1\\delta+\\log\\frac1{I(S)}\\right]$, with $I(S)$ the prior probability of interpolating; this improves Buzaglo et al.'s bound."
    status: thm
    grade: none
    source: {loc: "Thm 3.2, Eq. (3)-(4)", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "fast-rate PAC-Bayes bound"
      moves_mean: unknown
      explanation: "The bound follows from Catoni's single-sample deviation bound with zero empirical risk, because $d\\rho/d\\pi=1/I(S)$. It does not describe the weights or features."
  - id: r2
    quantity: [sample-complexity]
    statement: "For a quantized uniform prior on gated residual networks, a teacher with $(L^*,d^*)\\le(L,d)$ has prior probability at least $\\exp(-[C^{L^*,d^*}+B^{L^*,d^*}_{L,d}]\\log Q)$ of being computed by the student; the penalty is linear in teacher parameters and extra student neurons."
    status: thm
    grade: none
    source: {loc: "Thm 4.2, Thm 4.3, Eq. (8)-(9)", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T4
      label: not-analysed
      paper_term: "student-teacher equivalence"
      moves_mean: unknown
      explanation: "Switching off superfluous neurons and layers with zeros in the gates embeds the teacher in the student, which gives a lower bound on the interpolation probability. The paper does not claim the posterior concentrates on such embeddings."
  - id: r3
    quantity: [generalisation-error, optimal-hyperparameter]
    statement: "Without realizability, a Gibbs posterior with a tuned inverse temperature $\\beta=\\lambda$ has risk at most $\\inf_{\\theta^*}[r_{\\theta^*}+\\tilde O(c_{\\theta^*}/n+\\sqrt{c_{\\theta^*}r_{\\theta^*}/n})]$, where $c_{\\theta^*}=\\log1/\\pi(E_{\\theta^*})$ is a teacher-size cost."
    status: thm
    grade: none
    source: {loc: "Thm 5.2, Cor 5.3, Eq. (13)", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "oracle inequality"
      moves_mean: unknown
      explanation: "The Gibbs normaliser $Z^\\pi_\\beta(S)$ is bounded below by the mass of networks equal to the teacher, which makes the posterior risk compete with every small teacher. No feature-level analysis is given."
    overrides:
      dials: {temperature: [fixed]}
  - id: r4
    quantity: [generalisation-error, sample-complexity]
    statement: "Define data complexity $C(\\varepsilon)$ as the minimal teacher size with excess risk at most $\\varepsilon$. If $C(\\varepsilon)\\in O(\\varepsilon^{-p})$, the Gibbs excess-risk bound decays as $n^{-1/(p+1)}$ up to $n^{-1/(p+2)}$, and as $n^{-1/2}$ for polylogarithmic $C$."
    status: thm
    grade: A
    source: {loc: "Thm 6.2, Lemma 7.1, Eq. (16)-(17)", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "data complexity"
      moves_mean: unknown
      explanation: "The rates come from balancing teacher excess risk $\\varepsilon$ against the cost term, an optimisation over $\\varepsilon$. The paper does not discuss features."
    overrides:
      width_limit: [high-dim]
      scaling: {N: [to-infinity], L: [to-infinity], P: [to-infinity], order_of_limits: [other], relations: "Student parameters $m\\propto n$ (compute-optimal); $C(\\varepsilon)\\in O(\\varepsilon^{-p})$"}
      dials: {temperature: [fixed]}
  - id: r5
    quantity: [generalisation-error]
    statement: "Matching the bound to the empirical scaling rate $-0.1$ of Hoffmann et al. under $m\\propto n$ requires $p=9$ with zero Bayes error, so the data behind those scaling laws is at least as hard as $C(\\varepsilon)=\\varepsilon^{-9}$."
    status: num
    grade: none
    source: {loc: "Sec. 7.3, Fig. 2", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "lower bound on data complexity"
      moves_mean: unknown
      explanation: "Numerical evaluation of the bound is compared with a reported empirical exponent. The paper calls the comparison suggestive and lists coarse approximations, including the Gibbs model of SGD and quantisation."
    overrides:
      width_limit: [high-dim]
      scaling: {N: [to-infinity], L: [to-infinity], P: [to-infinity], order_of_limits: [other], relations: "Student parameters $m\\propto n$; $C(\\varepsilon)=\\varepsilon^{-p}$"}

relations:
  - {type: extends, target: "2402.06323", note: "Improves Buzaglo et al.'s Thm 3.2 and extends Thm 5.3 to teachers and students of different depth (Sec. 1.1)."}
open_problems: []
provenance:
  added_by: claude-sonnet-5-5
  status: extracted
  verified_by: []
  version_read: published
  date_added: "2026-10-24"
---

- Read the PMLR (AISTATS 2025) PDF in full, including Appendix C (MNIST) and the statement of Lemma 7.1; proofs in Appendices D-F were not checked. No HTML version exists, so anchors are `none`.
- Bayes with tag R6 follows the precedent of other finite-exact Gibbs-posterior bound papers in the map; the compute-optimal scaling results r4 and r5 (parameters $\propto n$) carry the `high-dim` override that the tag requires. The prior is a uniform quantized one over gated residual networks, so prior fields use `other`.
- Temperature: the hard posterior (interpolation, $\beta\to\infty$) is the default; the Gibbs results use $\beta$ growing like $\sqrt n$, hence the `fixed` override on r3 and r4. The main text states $\beta=\sqrt n$ in the discussion, while Thm 5.2 says only that some $\lambda>0$ exists.
- Grade is `none` for the bounds with unspecified $\tilde O$ factors; r4 is graded A because Lemma 7.1 gives explicit exponents. The data class is data-agnostic since bounds hold for any distribution.
- The paper warns that the bounds are vacuous when student parameters grow faster than $n^2$, and that the rate cannot beat $n^{-1/2}$ for overparametrised students (Sec. 7.3, Sec. 8).
