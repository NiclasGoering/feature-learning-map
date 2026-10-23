---
id: op-10
title: Gradient descent against the posterior
rank: 10
status: open
---
**Problem.** How the solutions gradient descent finds relate to the posterior is unsettled. Prior volume predicts SGD's choice to first order on small Boolean tasks (Mingard et al. 2021), but with proper initialisation and width GD beats guess-and-check (Peleg & Hein 2024); Bayesian and weight-decay adaptive kernels differ (Lauditi, Bordelon & Pehlevan 2025); and GD averaged over initialisations matches the Bayes-optimal error where single runs do not (Maillard et al. 2024). No study compares posterior sampling, guess-and-check and GD on parity.

**What would settle it.** A parity benchmark comparing posterior means and single posterior draws with GD solutions at matched width and data.
