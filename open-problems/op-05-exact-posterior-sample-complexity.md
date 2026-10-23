---
id: op-05
title: Sample complexity of the exact posterior
rank: 5
status: open
---
**Problem.** For sparse parity, linear-in-$d$ sample complexities are proved only for surrogate learners: the minimiser of the mean-field Langevin objective (Suzuki et al. 2023) and an $\ell_1$-type differentiable-query model (Joshi, Misiakiewicz & Srebro 2024). No sample-complexity theorem exists for the exact posterior of a wide μP network, and the known $\tilde\Omega(d)$ lower bound relies on rotation equivariance (Glasgow 2024) and has to be reconciled with the SGLD critical-noise law of Göring et al. 2025.

**What would settle it.** Matching upper and lower bounds on the number of samples at which the exact posterior of a wide network concentrates on the parity, compared with the rate for the mean-field Langevin minimiser.
