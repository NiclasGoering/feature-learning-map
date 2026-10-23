---
id: op-08
title: Solving the nonlinear saddle at scale
rank: 8
status: open
---
**Problem.** The saddle-point equations of the μP posterior have no controlled solver for nonlinear networks. Importance sampling degrades at large richness $\gamma_0$, normalizing flows are uncontrolled, perturbative closures are chosen to fit sampled histograms, and the equivalent-Wishart ansatz misses the class-block kernel structure that μP networks develop (Baglioni et al. 2026).

**What would settle it.** A solver for the tilted single-site law with error bars, or exact solutions for quadratic activations.
