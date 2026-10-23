# Decisions

One line per choice made where SPEC.md left room.

## Stack and build

- Stack: one Python build script (PyYAML, jsonschema, Markdown) compiles `papers/*.md` into a single `data.json`; the front end is plain HTML, CSS and JavaScript with no framework, npm or bundler.
- The validator and the build share one language and one loader (`scripts/flmap.py`); the build refuses to run if validation fails.
- KaTeX 0.16.11 is loaded from jsDelivr; maths is typeset in the browser when a cell or panel opens.
- `data.json` is published at the site root so others can reuse the data.
- GitHub Actions: `deploy.yml` validates, builds and deploys to Pages on every push to `main`; `validate.yml` validates and test-builds on every pull request.
- YAML is read with YAML-1.2-style scalars: only `true`/`false` are booleans and dates stay strings, so `yes`, `no` and `2026-10-23` survive as text.

## Schema and vocabulary

- `vocab.yaml` is the only list of allowed values; the JSON Schema marks categorical fields with `x-vocab: <field>` and the validator expands those into enums.
- Every band field (setting, dials, scaling, data, method, empirics) and every grouping field is a YAML list, even with one value; result status, grade, compared-with-other-rule, mechanism type/label/moves-mean, contribution and provenance status are single values.
- A third empty state `not-applicable` exists only where it means something: the Bayes dials (likelihood scaled, temperature, closure) in GD-only entries, the GD step-size and time fields in Bayes-only entries, and short free-text fields.
- `unknown`, `not-stated` and `not-applicable` must stand alone in a list.
- Paper-level grouping lists are defaults; a result may override them; the table places a paper in every learning-rule × depth × width group covered by any result (`inf-depth` only under `deep`).
- Overrides replace a field wholesale; lists are not merged.
- Results are numbered `r1`…`r5` in order; `r1` is the primary result and feeds the Status, Main result and FL mechanism columns.
- `version_read` and every result's `source.version` must equal the version in the key.
- Result sources store an HTML anchor id; the site links to `https://arxiv.org/html/<id>#<anchor>`, or to the PDF when there is no HTML version.
- DOI-only papers use id `doi:<DOI>` and file `papers/doi-<DOI with / replaced by _>.md`; old-style arXiv ids replace `/` with `_` in the file name.
- Relation targets are arXiv ids without version, so relations survive version bumps; `answers` targets an open-problem id `op-NN`.
- Open problems touched are a paper-level list `open_problems`; the `answers` relation marks a partial resolution.
- Depth `one-hidden-layer` covers every network with at most one hidden layer (perceptrons, GLMs, committee machines, single attention layers).
- Regime codes are tags `R0`…`R6` plus `R3prime` for R3′; Bayes papers need at least one, each must match a width group of some result, and GD-only papers carry none.
- Mixing dependence of GD papers is `none` (no sampling claim), so no extra value was added.
- At the team's request, ingest sessions add a new mechanism label when a paper explains a mechanism no label covers; each lives in its own file `schema/mechanisms/<slug>.yaml` so back-to-back pull requests never conflict, and the validator merges them into `mechanism_label`, rejecting duplicates of existing label text and labels no paper uses.
- Ingest sessions never add FL types (T0–T6 are the note's taxonomy); a mechanism that fits none is filed under the closest type and flagged in the pull request.
- New values of brief fields: `other` in most categorical fields; input `arbitrary`; target `arbitrary`; data class `data-agnostic` and `other`; method `tensor-programs`; sampler `gd-simulation`; grade `none` (not a prediction).
- Fields the brief named without values got controlled lists: activation, learned layers, prior family, label noise, approximations, datasets, order of limits, GD step size, GD time.
- Free-text fields with limits: scaling relations, target parameters (k, degree, exponent, teacher width), empirics temperature, chains and scale, paper's term, relation note.
- Mechanism labels were seeded with the brief's four examples plus the labels the gold entries needed (`kernel fixed at init`, `weights stay at prior`, `kernel scale renormalised`, `output-block renormalisation`, `per-patch kernel renormalisation`, `deterministic adaptive kernel`, `sparse ridge atoms`, `first-order mixed phase`, `hidden-unit specialisation`, `competing coding schemes`, `kernel evolves in training`, `silent kernel alignment`, `no advantage over kernels`, `mechanism not analysed`, `other`); each lists its usual FL types and the validator warns on a mismatch.
- Properties of few papers became tags: grokking, specialisation, first-order transition, hyperparameter transfer, planted vs random init, exact rejection sampling, multi-output, per-patch blocks, transfer learning, continual learning, rigorous LDP, finite-width fluctuations.
- Threads were seeded with 22 lines of work from the note; only the team adds threads.
- No new top-level grouping and no new table column were added.

## Validator

- Word counts treat each `$…$` span as one word; sentence counts ignore common abbreviations (e.g., et al., Eq., Thm.).
- Summaries above 150 words get a warning (the brief limits only sentences); gold summaries run 100–140 words.
- The public-site rule is enforced mechanically on `papers/`, `open-problems/` and `queue.yaml`: `[[`, `[derived]`, the word "manuscript" and "priority hygiene/discussion" are rejected.
- Status `verified` requires a name in `verified_by`; a result comparing Bayes and GD must be listed under both rules.
- Structural (schema) errors are reported first; semantic checks run once the structure is valid.

## Website

- Clicking a title opens the side panel; the arXiv abstract and PDF links sit under the title, because the brief asks both for the title linked to arXiv and for the title to open the panel.
- At the team's request (2026-10-23) the table fits the window instead of scrolling sideways between pinned columns: fixed layout, percentage column widths, wrapped text; the page is the only scroll area and the header row stays on top.
- At the team's request, cells show their details directly instead of expanding on click; the title still opens the side panel with the full entry.
- Below 900 px each paper is shown as a block of label–value lines, because ten columns cannot fit a phone.
- Academic look at the team's request: one serif family (Source Serif 4 from Google Fonts, serif fallbacks), small caps for headers and group titles, booktabs rules (heavy top and bottom rule, thin rule under the header, hairlines between papers).
- Black background by default at the team's request; a light paper theme is one click away and remembered in local storage.
- Filters exist for every vocabulary field (OR within a field, AND across fields, a paper matches if any result matches); free-text fields are covered by search.
- URL state: `q` (search), `f.<field>` (filters), `c` (collapsed groups), `p` (open paper).
- A cell shows the union of values over a paper's results; empty states are hidden when another result has a real value.
- Group headers count papers matching the current filters; empty width groups show "no papers yet", or "no papers match the filters" when filtering hid them.
- At the team's request (2026-10-23) the site has a third secondary page, Overview: a one-page summary of the variational picture (who pays for interpolation), beyond the two pages SPEC.md allows.
- At the team's explicit request the Overview page publishes the team's own unpublished framing (the bad-completion gap $\Gamma_D$, the energy–entropy reading, the extensivity criterion), overriding SPEC.md section 2 for that page only; paper entries, the queue and open problems still follow section 2.
- Overview citations link to the paper's entry in the map when it has one and to arXiv (or the DOI) otherwise, so they switch to map entries as papers are ingested.
- The Mechanisms page lists every result under its FL type, then its mechanism label, as "In: setting · statement · paper, location".
- Rows flag `gold` or `extracted` entries next to the arXiv links; `verified` entries carry no flag.

## Content

- Repository: public GitHub repository `NiclasGoering/feature-learning-map`; site at https://niclasgoering.github.io/feature-learning-map/.
- Gold entries (9): Hron et al. 2020, Li & Sompolinsky 2021, Hanin & Zlokapa 2023, Seroussi et al. 2023, Rubin et al. 2024, Lauditi et al. 2025, Cui et al. 2023, Yang & Hu 2021, Ba et al. 2022; they cover both rules, both depths, seven width groups and six FL types (all but T4).
- Each gold entry was drafted by a separate Opus agent that read the paper's full arXiv text, then reviewed and harmonised by hand; all 36 anchors were checked against arXiv HTML.
- Hron et al. 2020's NTK curve is a reference line, not a study of GD, so that paper is listed under Bayes only.
- Open problems: items 1–10 of the note's section 7 were kept and item 11 (priority) dropped; settlement routes that relied on the unpublished manuscript or the team's derivations were replaced by neutral statements.
- Open-problem status values: `open`, `partly-solved`, `solved`.
- queue.yaml is ordered by ingest priority: Bayesian feature-learning theory, GD feature learning, generalisation theory, data structure and simplicity bias, representation costs, sampling and mixing, classical work; `needs-id` entries last.
- queue.yaml includes papers the note cites only through vault links (its "Already in the vault" and "Related" lists), resolved to arXiv ids; vault notes that are not papers (the long literature report, the team's own notes) are excluded.
- "Göring 2025" is the public arXiv paper 2510.15174 (Göring, Mingard, Nam, Louis), so it is queued; the unpublished manuscript is not.
- "Csiszár-type I-projection" (open problem 1) names a classical concept rather than a cited paper and is not queued.
- Ambiguous citations were resolved to the best match with alternatives in the entry's note: Baldassi et al. (1509.05753), Aminian et al. (2107.13656), Lauditi et al. 2026 (2507.04448).
- "Nitanda 2024" could be either of two papers and is `needs-id` with both candidates noted.
- Papers with no arXiv version are `needs-id` with the DOI or proceedings URL recorded (17 entries).
- queue.yaml `year` is the year of the first arXiv version, which can differ from the year in the note's citation.
- SPEC.md is the brief verbatim; it therefore mentions that an unpublished manuscript exists and its topic, but nothing from it.

## Ingest

- Allowlisted issues take precedence; the queue is used only when there are no usable issues; at most 10 papers per run.
- If the allowlist still holds the placeholders USER1–USER3, ingest treats it as empty and uses the queue only.
- Ingest sessions may change only new files in `papers/`, new files in `schema/mechanisms/` and `queue.yaml`; other vocabulary proposals go in the pull-request description.
- The pull-request body includes `Closes #n` for every added issue, so issues close when the pull request is merged.
- Issue form: arXiv URL (required) and note (optional), label `add-paper`, which is created in the repository.
