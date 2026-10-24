---
id: doi:10.1007/BF00993163
title: "Bounds on the sample complexity of Bayesian learning using information theory and the VC dimension"
authors: ["David Haussler", "Michael Kearns", "Robert E. Schapire"]
year: 1994
venue: "Machine Learning 14, 83-113"
links:
  abs: https://doi.org/10.1007/BF00993163
  pdf: https://www.cis.upenn.edu/~mkearns/papers/HKS.pdf
  html: not-available
one_line: "Bayes and Gibbs learning curves are bracketed by Shannon information gain, bounded via partition entropy and VC dimension, linking statistical physics to VC theory."
summary: "The paper studies a Bayesian concept-learning model in which the target is drawn from a prior and the learner is either the Bayes-optimal predictor or the Gibbs algorithm, which outputs a random consistent hypothesis. The probability of a mistake on the next label is bracketed between a function of the expected information gain and a constant multiple of it, so the two algorithms differ by at most a logarithmic factor. Cumulative information is the entropy of the partition of the concept class induced by the instances, which gives cumulative-mistake bounds, including the case of a wrong prior through a KL penalty. Bounding this entropy by Sauer's lemma recovers VC-dimension bounds of order $\\dim/m$ for Bayes and Gibbs, and extends them to classes of infinite dimension."
threads: [classical-gibbs, kernel-learning-curves]
contribution: theory
tags: [R6]

learning_rule: [bayes]
depth: [one-hidden-layer]
width_limit: [finite-exact]

setting:
  architecture: [other]
  activation: [generic]
  learned_layers: [all]
  parametrisation: [other]
  prior_scale: [other]
  prior_family: [other]
dials:
  likelihood_scaled: ["no"]
  p_vs_n: [other]
  amplitude: [not-stated]
  temperature: [to-zero]
  closure: [none]
scaling:
  N: [fixed]
  L: [fixed]
  P: [to-infinity]
  D: [fixed]
  relations: "$m$ examples against VC dimension $d$; bounds are non-asymptotic, with $o(1)$ terms as $m/d\\to\\infty$"
  order_of_limits: [none]
  gd_step_size: [not-applicable]
  gd_time: [not-applicable]
data:
  input: [arbitrary]
  target: [arbitrary]
  target_params: {k: not-applicable, degree: not-applicable, exponent: not-applicable, teacher_width: not-applicable}
  label_noise: [none]
  data_class: [data-agnostic]
method:
  method: [information-theoretic, bounds]
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
    quantity: [generalisation-error]
    statement: "For a fixed instance sequence, the probability of a mistake on the next label, for both the Bayes and Gibbs algorithms, lies between $H^{-1}$ of the expected information gain and a constant times it, tight up to a logarithmic factor."
    status: thm
    grade: none
    source: {loc: "Sec. 5, Eq. (9)", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "volume ratio"
      moves_mean: unknown
      explanation: "Both mistake probabilities are expressed through the volume ratio of successive version spaces, so the analysis is information-theoretic. No network features are considered."
  - id: r2
    quantity: [sample-complexity, free-energy-evidence]
    statement: "The expected information from the first $m$ labels equals the entropy $H^m_P$ of the partition of the concept class induced by the instances, and the expected number of mistakes of Bayes and Gibbs is bracketed by functions of this entropy."
    status: thm
    grade: none
    source: {loc: "Sec. 6, Eqs. (12)-(13)", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "partition entropy"
      moves_mean: unknown
      explanation: "Additivity of information turns the sum of instantaneous gains into one entropy. This is a statement about the concept class, not about features."
  - id: r3
    quantity: [generalisation-error]
    statement: "If the target is drawn from a true prior $Q$ but the learner uses a perceived prior $P$, cumulative mistakes of both algorithms are bounded by a constant times the partition entropy under $Q$ plus the divergence $I_m(Q\\|P)$."
    status: thm
    grade: none
    source: {loc: "Sec. 7", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "incorrect prior"
      moves_mean: unknown
      explanation: "The penalty is the relative entropy between true and perceived prior over the partition. It carries no feature-level interpretation."
  - id: r4
    quantity: [generalisation-error, sample-complexity]
    statement: "Bounding the partition entropy with Sauer's lemma gives, for any prior and distribution, error at most $d/m$ for the Bayes algorithm and at most $2d/m$ for the Gibbs algorithm, with $d$ the VC dimension; cumulative mistakes grow like $d\\log(m/d)$."
    status: thm
    grade: A
    source: {loc: "Sec. 9, Eqs. (17)-(22)", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "VC dimension"
      moves_mean: unknown
      explanation: "The VC bounds come from the 1-inclusion graph algorithm of Haussler, Littlestone and Warmuth and from Sauer's lemma. For homogeneous perceptrons the paper quotes statistical-mechanics values from Opper and Haussler and from Gyorgyi and Tishby, which lie within a constant factor of the bounds."
    overrides:
      width_limit: [high-dim]
  - id: r5
    quantity: [generalisation-error]
    statement: "With a nondegenerate perceived prior $P$ and any true prior $Q$, the Gibbs algorithm, or any algorithm predicting with a hypothesis consistent with the data, errs with probability at most $(1+o(1))\\,d/t$ after $t$ examples; Bayes at most twice this."
    status: thm
    grade: A
    source: {loc: "Sec. 10, Thm 1 (Appendix)", version: published, anchor: none}
    compared_other_rule: "no"
    mechanism:
      type: T0
      label: not-analysed
      paper_term: "incorrect priors and VC dimension"
      moves_mean: unknown
      explanation: "The proof averages the partition-size bound over randomly chosen subsequences. The paper says the leading constant cannot be improved below $1-1/e$."
    overrides:
      width_limit: [high-dim]

relations:
  - {type: uses-method-of, target: "doi:10.1103/PhysRevA.45.6056", note: "Places the statistical-mechanics learning-curve theories (Gibbs algorithm as zero temperature) in a common Bayesian framework (Sec. 1)."}
open_problems: []
provenance:
  added_by: claude-sonnet-5-5
  status: extracted
  verified_by: []
  version_read: published
  date_added: "2026-10-24"
---

- Read the full text from the authors' hosted copy of the Machine Learning version (pp. 83-113), including the appendix proof of Thm 1. The text layer of the PDF is OCR and many displayed equations were unreadable, so statements were taken from the surrounding prose; the exact constants in Eqs. (9), (13) and (22) were not checked against the typeset formulas.
- The model is average-case concept learning, not a neural network; the entry uses `one-hidden-layer` and `generic` as the closest classes (the paper's examples are linear threshold functions, axis-parallel rectangles and unions of intervals).
- Tag R6 follows other finite-exact classical Gibbs papers. The two results stated in terms of $m/\dim(\mathcal F)\to\infty$ (r4, r5) carry the `high-dim` override.
- The relation to the Seung-Sompolinsky-Tishby paper is the "uses-method-of" link in the sense of a common framework; the paper itself states that it unites the two theories.
- The VC bound for the Bayes algorithm uses the 1-inclusion graph algorithm of Haussler, Littlestone and Warmuth (1990), which the paper cites and does not reprove.
