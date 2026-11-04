#!/usr/bin/env python3
"""Build the static site into _site/.

    python scripts/build.py

Runs the validator first and stops if it fails. Then copies site/ (publishing
overview.html also as the landing page index.html) and writes
_site/data.json, compiled from papers/*.md, open-problems/*.md and queue.yaml.
Results about gradient descent alone are left out of the site for now; results
that compare Bayes with GD stay. Statements (statements/S<NN>-*.yaml) are emitted as
data.statements only when `public: true`; a result's `canonical` block is dropped
from the site data when its statement is not public.
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
    """A result about gradient descent alone (no posterior side)."""
    return flmap.merged_view(meta, res).get("learning_rule") == ["gd"]


def load_statements():
    """[(path, meta)] for statements/*.yaml, in id order (the validator has checked them)."""
    return [(path, flmap.load_yaml(path.read_text(encoding="utf-8"))) for path in flmap.statement_files()]


def compile_paper(path, vocab, public_ids=frozenset()):
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
        if r.get("canonical") and r["canonical"]["statement"] not in public_ids:
            del r["canonical"]            # the statement is not on the site
        r["view"] = flmap.merged_view(meta, res)
        r["source_url"] = source_url(meta, res)
        rec["results"].append(r)
    rec["notes_html"] = md_to_html(body) if body else ""
    return rec, hidden


def compile_statements(stmts, papers):
    """Site records of the public statements: members resolved to the compiled papers,
    reduces_to edges only between public statements."""
    by_base = {p["base"]: p for p in papers}
    public = {m["id"] for _, m in stmts if m["public"]}
    out = []
    for _, m in stmts:
        if not m["public"]:
            continue
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
            "id": m["id"], "slug": m["slug"], "title": m["title"], "claim": m["claim"], "formula": m["formula"],
            "width_limit": m["regime"]["width_limit"], "learning_rule": m["regime"]["learning_rule"],
            "conditions": m["regime"]["conditions"], "status": m["status"], "members": members,
            "papers": sorted(keys), "n_papers": len(keys),
            "reduces_to": [r for r in m.get("reduces_to") or [] if r["target"] in public],
            "disagreements": [], "open_problems": m.get("open_problems") or [],
        }
        for key in ("formula_note", "status_note"):
            if m.get(key):
                rec[key] = m[key]
        for d in m.get("disagreements") or []:
            ds = [by_base[b]["key"] for b in d["papers"] if b in by_base]
            if len(ds) >= 2:
                rec["disagreements"].append({"papers": ds, "note": d["note"]})
        out.append(rec)
    return out


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


def main():
    if validate.main([]) != 0:
        print("Build stopped: fix the validation errors above.", file=sys.stderr)
        return 1
    vocab = flmap.load_vocab()
    stmts = load_statements()
    public_ids = {m["id"] for _, m in stmts if m["public"]}
    papers, hidden_papers, hidden_results = [], 0, 0
    for path in flmap.paper_files():
        rec, hidden = compile_paper(path, vocab, public_ids)
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
    data = {
        "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "repo": repo_url(),
        "vocab": {
            "fields": {name: {"label": f["label"], "band": f["band"], "multi": f["multi"],
                              "values": {s: {"label": v["label"], "desc": v["desc"]} for s, v in f["values"].items()}}
                       for name, f in vocab["fields"].items()},
            "empty_states": vocab["empty_states"],
        },
        "papers": papers,
        "statements": compile_statements(stmts, papers),
        "open_problems": compile_open_problems(papers),
        "queue": counts,
        "hidden_gd_only": {"papers": hidden_papers, "results": hidden_results},
    }
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SITE, OUT)
    shutil.copyfile(OUT / "overview.html", OUT / "index.html")   # the overview is the landing page
    (OUT / "data.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Built {OUT.relative_to(flmap.ROOT)}/ with {len(papers)} paper(s), {len(data['statements'])} public statement(s) "
          f"of {len(stmts)}; "
          f"{hidden_results} GD-only result(s) hidden, {hidden_papers} paper(s) with nothing else.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
