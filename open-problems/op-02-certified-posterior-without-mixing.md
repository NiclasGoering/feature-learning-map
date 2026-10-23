---
id: op-02
title: Certified posterior statements without mixing
rank: 2
status: open
---
**Problem.** No bound on the posterior probability of large test error is known for an exact network posterior that does not assume a sampler has mixed. Verification methods cover variational Gaussian posteriors only, and evidence estimates are certified only for very small networks.

**What would settle it.** A two-sided bound on the posterior mass of high-error functions that holds for the exact posterior with no mixing assumption, checked against exact rejection sampling at very small $P$.
