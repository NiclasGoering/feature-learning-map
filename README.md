# Feature-learning literature map

A public map of the theory literature on feature learning in neural networks, for two learning rules: Bayesian posteriors and gradient-based training. Every paper is one Markdown file with structured YAML front matter. A static site compiles them into one table grouped by learning rule, depth and width/limit, a mechanisms page (the first version of a feature-learning dictionary) and a list of open problems.

**Site:** https://niclasgoering.github.io/feature-learning-map/

## Layout

| Path | What it holds |
|---|---|
| `papers/<arxiv-id>v<N>.md` | One entry per paper: front matter (setting, dials, scaling, data, method, 1–5 results, FL mechanism, empirics, relations, provenance) and optional notes for checkers. |
| `schema/vocab.yaml` | Every allowed value of every categorical field, with labels and definitions; new mechanism labels may also come from `schema/mechanisms/`. |
| `schema/mechanisms/<slug>.yaml` | Mechanism labels added by ingest sessions, one file each, merged into the `mechanism_label` vocabulary by the validator and the build. |
| `schema/paper.schema.json` | JSON Schema for the front matter. Nodes marked `x-vocab` take their allowed values from `vocab.yaml`. |
| `open-problems/op-NN-*.md` | One file per open problem. Papers point at them by id. |
| `queue.yaml` | Papers waiting to be added, in priority order, with status `queued`, `needs-id`, `added` or `skipped`. |
| `scripts/validate.py` | Checks papers, open problems and the queue against the schema, the vocabulary, the length limits and the public-site rule. |
| `scripts/build.py` | Runs the validator, then builds the static site into `_site/` with one `data.json`. |
| `scripts/flmap.py` | Loading code shared by both scripts. |
| `site/` | The front end: four HTML pages (`overview.html`, published as the landing page; `table.html`; mechanisms; open problems), one stylesheet, two scripts (`app.js`, and `anim.js` for the overview animations). No framework. |
| `.github/workflows/` | `deploy.yml` builds and deploys to GitHub Pages on every push to `main`; `validate.yml` runs the validator and a build on every pull request. |
| `.github/ISSUE_TEMPLATE/add-paper.yml` | Issue form for suggesting a paper (label `add-paper`). |
| `INGEST.md` | Step-by-step instructions for ingest sessions that add papers. |
| `SPEC.md` | The build brief. |
| `DECISIONS.md` | Choices made where the brief left room, one per line. |

## Entries

The key is the arXiv ID with the version that was read (`2302.00375v2`); a DOI only when there is no arXiv version. Paper-level fields are defaults; a result overrides only the fields that differ. Unchecked fields are `unknown`, fields the paper leaves implicit are `not-stated`; nothing is blank.

Entry status: `gold` (hand-written worked examples), `extracted` (written by an ingest session), `verified` (checked against the paper by a team member, who adds their GitHub username to `verified_by`).

## Adding papers

Open an issue with the **Add a paper** form, or add an entry to `queue.yaml`. Ingest sessions follow `INGEST.md`: they read the full paper, write `status: extracted` entries, and open one pull request per run. The allowlist of maintainers whose issues are processed is at the top of `INGEST.md`.

## Running locally

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/validate.py
.venv/bin/python scripts/build.py
python3 -m http.server -d _site 8000
```

`validate.py` also accepts paths to draft files and checks them as if they were in `papers/`.
