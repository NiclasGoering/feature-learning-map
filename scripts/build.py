#!/usr/bin/env python3
"""Build the static site into _site/.

    python scripts/build.py

Runs the validator first and stops if it fails. Then copies site/ and writes
_site/data.json, compiled from papers/*.md, open-problems/*.md and queue.yaml.
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
    if pid.startswith("doi:"):
        return meta["links"]["abs"]
    anchor = res["source"]["anchor"]
    if meta["links"]["html"] != "not-available" and anchor != "none":
        return f"https://arxiv.org/html/{pid}#{anchor}"
    return f"https://arxiv.org/pdf/{pid}"


def compile_paper(path, vocab):
    meta, body = flmap.split_front_matter(path.read_text(encoding="utf-8"))
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
    return rec


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
    papers = [compile_paper(p, vocab) for p in flmap.paper_files()]
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
        "open_problems": compile_open_problems(papers),
        "queue": counts,
    }
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SITE, OUT)
    (OUT / "data.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Built {OUT.relative_to(flmap.ROOT)}/ with {len(papers)} paper(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
