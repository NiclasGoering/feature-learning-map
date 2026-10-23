---
id: op-01
title: Exact conditioning
rank: 1
status: open
---
**Problem.** No large-deviation or concentration theorem is known for a network posterior at zero noise ($\eta\to0$), where the posterior conditions exactly on fitting the training data. Mean-field Langevin annealing reaches an unregularised minimiser without a KL tie-break between minimisers (Chizat 2022; Hu et al. 2021), and Shang et al. 2026 prove low-temperature concentration of spherical mean-field Langevin dynamics on a multi-spike structure without selecting among minimisers.

**What would settle it.** A Gibbs-conditioning theorem (a Csiszár-type I-projection) for the neuron measure under the non-convex, unbounded constraint $f_\nu(x_i)=y_i$, identifying the law the posterior concentrates on as the noise vanishes.
