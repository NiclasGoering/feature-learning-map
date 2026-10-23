---
id: op-03
title: Mixing and phase coverage
rank: 3
status: open
---
**Problem.** No mixing guarantee exists at finite width or low temperature. Log-Sobolev and Poincaré constants degrade like $e^{\text{barrier}/T}$, uniform-in-$N$ constants are $e^{O(d)}$ on parity, constant-step SGLD has a biased invariant law (Brosse, Durmus & Moulines 2018), and no finite set of diagnostics certifies coverage (Matsui Smola 2026). Most physics papers validate with unadjusted Langevin at $T\le10^{-2}$ and declare equilibrium when observables match the theory; where the theory predicts competing phases, this cannot tell the posterior from the basin a chain happened to reach.

**What would settle it.** Planted-versus-random initialisation for every claimed phase transition (as in Pérez Ortiz et al. 2025), multi-chain NUTS or MILE runs with nested $\hat R$, exact rejection baselines where the normaliser is affordable, and one worked network posterior in which a large effective sample size coexists with a missing phase.
