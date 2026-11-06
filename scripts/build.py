#!/usr/bin/env python3
"""Build the static site into _site/.

    python scripts/build.py

Runs the validator first and stops if it fails. Then copies site/ (publishing
overview.html also as the landing page index.html) and writes
_site/data.json, compiled from papers/*.md, open-problems/*.md and queue.yaml.
Results about gradient descent alone are left out of the site for now; results
that compare Bayes with GD stay. Statements (statements/S<NN>-*.yaml) are emitted as
data.statements (every statement is public). The map's own experiments
(experiments/<id>.yaml) are emitted as data.experiments, their figures copied to
_site/experiments/<id>/.
CITATION.cff is emitted as data.citation (plain text and BibTeX, stamped with the
build date and commit), shown as the "How to cite" block at the foot of every page.
Preview locally with:  python -m http.server -d _site 8000
"""

import datetime
import html
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import markdown

sys.path.insert(0, str(Path(__file__).resolve().parent))
import flmap  # noqa: E402
import validate  # noqa: E402

SITE = flmap.ROOT / "site"
OUT = flmap.ROOT / "_site"
CITATION = flmap.ROOT / "CITATION.cff"
PARTICLES = {"van", "von", "de", "der", "den", "di", "da", "du", "le", "la", "del", "Ben", "Van", "De", "Von"}


def md_to_html(text):
    """Markdown to HTML with $...$ math passed through untouched and raw HTML escaped."""
    spans = []

    def keep(m):
        spans.append(m.group(0))
        return f"\x00{len(spans) - 1}\x00"

    t = validate.MATH.sub(keep, text).replace("<", "&lt;")
    out = markdown.markdown(t, extensions=["extra", "sane_lists"])
    return re.sub(r"\x00(\d+)\x00", lambda m: html.escape(spans[int(m.group(1))], quote=False), out)


def surname(name):
    parts = name.split()
    if not parts:
        return name
    out = [parts[-1]]
    for p in reversed(parts[:-1]):
        if p in PARTICLES:
            out.insert(0, p)
        else:
            break
    return " ".join(out)


def repo_url():
    slug = os.environ.get("GITHUB_REPOSITORY")
    if not slug:
        try:
            url = subprocess.run(["git", "remote", "get-url", "origin"], cwd=flmap.ROOT,
                                 capture_output=True, text=True, check=True).stdout.strip()
            m = re.search(r"github\.com[:/](.+?)(?:\.git)?$", url)
            slug = m.group(1) if m else None
        except (OSError, subprocess.CalledProcessError):
            slug = None
    return f"https://github.com/{slug}" if slug else ""


def source_url(meta, res):
    pid = meta["id"]
    if pid.startswith(("doi:", "ref:")):
        return meta["links"]["abs"]
    anchor = res["source"]["anchor"]
    if meta["links"]["html"] != "not-available" and anchor != "none":
        return f"https://arxiv.org/html/{pid}#{anchor}"
    return f"https://arxiv.org/pdf/{pid}"


def gd_only(meta, res):
    """A result about gradient descent alone (no posterior side). Results placed under
    a main statement stay: mean-field Langevin results describe the Gibbs posterior
    the dynamics converges to, which is a statement about the posterior (S05)."""
    if (res.get("canonical") or {}).get("statement"):
        return False
    return flmap.merged_view(meta, res).get("learning_rule") == ["gd"]


def load_statements():
    """[(path, meta)] for statements/*.yaml, in id order (the validator has checked them)."""
    return [(path, flmap.load_yaml(path.read_text(encoding="utf-8"))) for path in flmap.statement_files()]


def compile_paper(path, vocab):
    """The site record of a paper, or None when the site hides all its results.

    For now the site shows Bayesian results and the results that compare Bayes with
    GD; results about GD alone stay in papers/ but are left out (DECISIONS.md)."""
    meta, body = flmap.split_front_matter(path.read_text(encoding="utf-8"))
    hidden = sum(1 for res in meta["results"] if gd_only(meta, res))
    meta = dict(meta, results=[res for res in meta["results"] if not gd_only(meta, res)])
    if not meta["results"]:
        return None, hidden
    rec = dict(meta)
    rec["key"] = path.stem
    rec["base"] = flmap.base_id(meta["id"])
    rec["file"] = f"papers/{path.name}"
    rec["first_author"] = surname(meta["authors"][0])
    rec["groups"] = flmap.group_keys(meta)
    rec["agg"] = {name: flmap.field_values(meta, name) for name in vocab["fields"] if name in flmap.FIELD_PATHS}
    rec["results"] = []
    for res in meta["results"]:
        r = dict(res)
        r["view"] = flmap.merged_view(meta, res)
        r["source_url"] = source_url(meta, res)
        rec["results"].append(r)
    rec["notes_html"] = md_to_html(body) if body else ""
    return rec, hidden


def compile_statements(stmts, papers):
    """Site records of the statements: members resolved to the compiled papers."""
    by_base = {p["base"]: p for p in papers}
    out = []
    for _, m in stmts:
        members = []
        for mem in m["members"]:
            p = by_base.get(mem["paper"])
            if p is None:
                print(f"note: {m['id']} member {mem['paper']} has no result on the site; left out", file=sys.stderr)
                continue
            res = next((r for r in p["results"] if r["id"] == mem.get("result")), None)
            if mem.get("result") and res is None:
                print(f"note: {m['id']} member {mem['paper']} {mem['result']} is hidden; left out", file=sys.stderr)
                continue
            rec = {"paper": p["key"], "base": p["base"], "statement": mem["statement"], "mapping": mem["mapping"],
                   "role": mem["role"], "source_url": res["source_url"] if res else p["links"]["abs"]}
            if res:
                rec["result"] = res["id"]
            if mem.get("equations"):
                rec["equations"] = mem["equations"]
            members.append(rec)
        keys = {mem["paper"] for mem in members}
        rec = {
            "id": m["id"], "slug": m["slug"], "title": m["title"], "kind": m["kind"], "claim": m["claim"], "formula": m["formula"],
            "width_limit": m["regime"]["width_limit"], "learning_rule": m["regime"]["learning_rule"],
            "conditions": m["regime"]["conditions"], "status": m["status"], "members": members,
            "papers": sorted(keys), "n_papers": len(keys),
            "reduces_to": list(m.get("reduces_to") or []),
            "disagreements": [], "open_problems": m.get("open_problems") or [], "links": list(m.get("links") or []),
        }
        for key in ("formula_note", "status_note", "family", "sense", "maturity"):
            if m.get(key):
                rec[key] = m[key]
        for d in m.get("disagreements") or []:
            ds = [by_base[b]["key"] for b in d["papers"] if b in by_base]
            if len(ds) >= 2:
                rec["disagreements"].append({"papers": ds, "note": d["note"]})
        out.append(rec)
    return out


def compile_experiments():
    """Site records of the map's own experiments (the validator has checked them)."""
    out = []
    for path in flmap.experiment_files():
        m = flmap.load_yaml(path.read_text(encoding="utf-8"))
        rec = {k: m[k] for k in ("id", "title", "date", "regime", "regime_id", "tests", "claim", "verdict", "caveats")}
        rec["slot"] = m.get("slot", "nonlinear")
        for key in ("formula", "status_note"):
            if m.get(key):
                rec[key] = m[key]
        rec["setup_html"] = md_to_html(m["setup"])
        rec["numbers_html"] = md_to_html(m["numbers"])
        rec["figures"] = [{"src": f"experiments/{m['id']}/{f['file']}", "caption": f["caption"]} for f in m.get("figures") or []]
        out.append(rec)
    return sorted(out, key=lambda x: (x["date"], x["id"]))


def compile_open_problems(papers):
    out = []
    for path in flmap.open_problem_files():
        meta, body = flmap.split_front_matter(path.read_text(encoding="utf-8"))
        touching, answering = [], []
        for p in papers:
            if meta["id"] in p["open_problems"]:
                touching.append(p["key"])
            if any(r["type"] == "answers" and r["target"] == meta["id"] for r in p["relations"]):
                answering.append(p["key"])
                if p["key"] not in touching:
                    touching.append(p["key"])
        out.append({"id": meta["id"], "title": meta["title"], "rank": meta["rank"], "status": meta["status"],
                    "file": f"open-problems/{path.name}", "html": md_to_html(body),
                    "papers": touching, "answered_by": answering})
    return sorted(out, key=lambda o: o["rank"])


TEX_ACCENTS = {"ä": r'{\"a}', "ö": r'{\"o}', "ü": r'{\"u}', "Ä": r'{\"A}', "Ö": r'{\"O}', "Ü": r'{\"U}',
               "ß": r"{\ss}", "é": r"{\'e}", "è": r"{\`e}", "á": r"{\'a}", "ó": r"{\'o}", "í": r"{\'i}"}
ASCII_FOLD = {"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss", "é": "e", "è": "e", "á": "a", "ó": "o", "í": "i"}


def commit_id():
    """Short id of the commit being built: GITHUB_SHA on Actions, else git, else ''."""
    sha = os.environ.get("GITHUB_SHA", "")
    if not sha:
        try:
            sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=flmap.ROOT,
                                 capture_output=True, text=True, check=True).stdout.strip()
        except (OSError, subprocess.CalledProcessError):
            sha = ""
    return sha[:7]


def compile_citation(built, repo):
    """data.citation from CITATION.cff: how to cite this build of the map, or None without the file."""
    if not CITATION.exists():
        return None
    cff = flmap.load_yaml(CITATION.read_text(encoding="utf-8"))
    ref = cff.get("preferred-citation", cff)
    people = ref["authors"]
    title, url, year = ref["title"], ref["url"], str(ref["year"])
    commit = commit_id()
    version = f"version of {built}" + (f", commit {commit}" if commit else "")

    def initials(given):
        return " ".join(part[0] + "." for part in given.replace("-", " ").split())

    names = [f"{a['family-names']}, {initials(a['given-names'])}" for a in people]
    apa = names[0] if len(names) == 1 else ", ".join(names[:-1]) + ", & " + names[-1]
    text = f"{apa} ({year}). {title} [Website; {version}]. {url}"

    def tex(name):
        return "".join(TEX_ACCENTS.get(ch, ch) for ch in name)

    key = "".join(ASCII_FOLD.get(ch, ch) for ch in people[0]["family-names"].lower())
    key = re.sub(r"[^a-z]", "", key) + year + "featurelearningmap"
    note = version[0].upper() + version[1:] + (f". Source: \\url{{{repo}}}" if repo else "")
    bibtex = "\n".join([
        f"@misc{{{key},",
        "  author       = {" + " and ".join(tex(a["family-names"]) + ", " + tex(a["given-names"]) for a in people) + "},",
        f"  title        = {{{title}}},",
        f"  year         = {{{year}}},",
        f"  howpublished = {{\\url{{{url}}}}},",
        f"  note         = {{{note}}}",
        "}",
    ])
    return {"message": " ".join(cff["message"].split()), "text": text, "bibtex": bibtex,
            "cff": f"{repo}/blob/main/CITATION.cff" if repo else ""}


def main():
    if validate.main([]) != 0:
        print("Build stopped: fix the validation errors above.", file=sys.stderr)
        return 1
    vocab = flmap.load_vocab()
    stmts = load_statements()
    papers, hidden_papers, hidden_results = [], 0, 0
    for path in flmap.paper_files():
        rec, hidden = compile_paper(path, vocab)
        hidden_results += hidden
        if rec is None:
            hidden_papers += 1
        else:
            papers.append(rec)
    papers.sort(key=lambda p: (p["year"], p["first_author"], p["title"]))
    queue = flmap.load_yaml(flmap.QUEUE.read_text(encoding="utf-8")) or []
    counts = {}
    for item in queue:
        counts[item["status"]] = counts.get(item["status"], 0) + 1
    now = datetime.datetime.now(datetime.timezone.utc)
    repo = repo_url()
    data = {
        "generated": now.strftime("%Y-%m-%d %H:%M UTC"),
        "repo": repo,
        "citation": compile_citation(now.strftime("%Y-%m-%d"), repo),
        "vocab": {
            "fields": {name: {"label": f["label"], "band": f["band"], "multi": f["multi"],
                              "values": {s: {"label": v["label"], "desc": v["desc"]} for s, v in f["values"].items()}}
                       for name, f in vocab["fields"].items()},
            "empty_states": vocab["empty_states"],
        },
        "papers": papers,
        "statements": compile_statements(stmts, papers),
        "experiments": compile_experiments(),
        "open_problems": compile_open_problems(papers),
        "queue": counts,
        "hidden_gd_only": {"papers": hidden_papers, "results": hidden_results},
    }
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SITE, OUT)
    shutil.copyfile(OUT / "overview.html", OUT / "index.html")   # the overview is the landing page
    for x in data["experiments"]:
        if x["figures"]:
            shutil.copytree(flmap.EXPERIMENTS / "figs" / x["id"], OUT / "experiments" / x["id"])
    (OUT / "data.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Built {OUT.relative_to(flmap.ROOT)}/ with {len(papers)} paper(s), {len(data['statements'])} statement(s), "
          f"{len(data['experiments'])} experiment(s); "
          f"{hidden_results} GD-only result(s) hidden, {hidden_papers} paper(s) with nothing else.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
