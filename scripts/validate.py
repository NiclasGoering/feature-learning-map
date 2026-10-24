#!/usr/bin/env python3
"""Validate papers/, open-problems/ and queue.yaml.

    python scripts/validate.py              # check the whole repository
    python scripts/validate.py draft.md     # also check draft.md as if it were in papers/

Prints one line per problem, `ERROR <file>: <field>: <message>` or `WARN ...`,
and exits with status 1 if there is any ERROR. Warnings never fail the run.
"""

import re
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

sys.path.insert(0, str(Path(__file__).resolve().parent))
import flmap  # noqa: E402

# Public-site rule (SPEC.md section 2): none of these may appear in published data.
FORBIDDEN = [
    (re.compile(r"\[\["), "Obsidian link [[...]]"),
    (re.compile(r"\[derived\]", re.I), "[derived] tag (unpublished derivation)"),
    (re.compile(r"\bmanuscript\b", re.I), "reference to the unpublished manuscript"),
    (re.compile(r"priority (hygiene|discussion)", re.I), "priority discussion"),
]

MATH = re.compile(r"\$\$.+?\$\$|\$[^$]+\$", re.S)
ABBREVIATIONS = ["e.g.", "i.e.", "et al.", "cf.", "vs.", "resp.", "approx.", "Fig.", "Figs.", "Eq.", "Eqs.",
                 "Thm.", "Prop.", "Lem.", "Cor.", "Def.", "Sec.", "App.", "Ref.", "Refs.", "No.", "Ch."]

# (path in a paper or result, kind, limit). Paths starting with "results." are per result.
TEXT_LIMITS = [
    ("title", "words", 40),
    ("venue", "words", 12),
    ("one_line", "words", 25),
    ("summary", "sentences", 5),
    ("scaling.relations", "words", 25),
    ("data.target_params.k", "words", 8),
    ("data.target_params.degree", "words", 8),
    ("data.target_params.exponent", "words", 8),
    ("data.target_params.teacher_width", "words", 8),
    ("empirics.temperature", "words", 10),
    ("empirics.chains", "words", 10),
    ("empirics.scale", "words", 20),
    ("results.statement", "words", 40),
    ("results.source.loc", "words", 12),
    ("results.mechanism.paper_term", "words", 8),
    ("results.mechanism.explanation", "sentences", 3),
    ("relations.note", "words", 25),
]
FREE_TEXT_NA = {"scaling.relations", "data.target_params.k", "data.target_params.degree",
                "data.target_params.exponent", "data.target_params.teacher_width",
                "empirics.temperature", "empirics.chains", "empirics.scale"}

QUEUE_STATUSES = {"queued", "needs-id", "added", "skipped"}
QUEUE_KEYS = {"id", "cited_as", "title", "year", "status", "doi", "note", "source", "pr"}
OP_STATUSES = {"open", "partly-solved", "solved"}
MECH_KEYS = {"slug", "label", "types", "desc", "introduced_by", "added_by", "date_added"}


def count_words(text):
    return len(MATH.sub(" M ", str(text)).split())


def count_sentences(text):
    t = MATH.sub(" M ", str(text))
    for abbr in ABBREVIATIONS:
        t = t.replace(abbr, abbr.replace(".", ""))
    t = t.strip()
    if not t:
        return 0
    n = len(re.findall(r"[.!?](?=\s|$)", t))
    return n if re.search(r"[.!?]$", t) else n + 1


class Report:
    def __init__(self):
        self.lines = []
        self.errors = 0

    def error(self, where, field, msg):
        self.errors += 1
        self.lines.append(f"ERROR {where}: {field}: {msg}" if field else f"ERROR {where}: {msg}")

    def warn(self, where, field, msg):
        self.lines.append(f"WARN  {where}: {field}: {msg}" if field else f"WARN  {where}: {msg}")


def rel(path):
    try:
        return str(Path(path).resolve().relative_to(flmap.ROOT))
    except ValueError:
        return str(path)


def scan_forbidden(where, text, report):
    for rx, what in FORBIDDEN:
        for m in rx.finditer(text):
            line = text.count("\n", 0, m.start()) + 1
            report.error(where, f"line {line}", f"{what} is not allowed in public data (SPEC.md section 2)")


def get(obj, dotted):
    for part in dotted.split("."):
        if not isinstance(obj, dict):
            return None
        obj = obj.get(part)
    return obj


def schema_message(err):
    node = err.schema if isinstance(err.schema, dict) else {}
    field = node.get("x-vocab-field")
    if err.validator == "enum" and field:
        allowed = ", ".join(map(str, node["enum"]))
        return f"{err.instance!r} is not allowed for vocab field `{field}` (allowed: {allowed})"
    if err.validator == "type" and isinstance(err.instance, (int, float)) and "string" in str(err.validator_value):
        return f"{err.instance!r} must be a string; quote it, e.g. \"{err.instance}\" (arXiv IDs lose digits unquoted)"
    if err.validator == "type" and isinstance(err.instance, str) and node.get("type") == "array":
        return f"{err.instance!r} must be a list, e.g. [{err.instance}]"
    if err.validator == "additionalProperties":
        return err.message + " (check the field name against schema/paper.schema.json)"
    return err.message


def check_paper(path, meta, body, ctx, report):
    where = rel(path)
    vocab = ctx["vocab"]
    errors = sorted(ctx["validator"].iter_errors(meta), key=lambda e: list(e.absolute_path))
    for err in errors:
        loc = ".".join(str(p) for p in err.absolute_path) or "(top level)"
        report.error(where, loc, schema_message(err))
    if errors:
        return  # semantic checks assume the structure is right

    pid = meta["id"]
    if flmap.key_to_filename(pid) != path.stem:
        report.error(where, "id", f"file must be named papers/{flmap.key_to_filename(pid)}.md for id {pid}")
    version = flmap.version_of(pid)
    prov = meta["provenance"]
    if prov["version_read"] != version:
        report.error(where, "provenance.version_read", f"{prov['version_read']} does not match the id's version {version}")
    if prov["status"] == "verified" and not prov["verified_by"]:
        report.error(where, "provenance.verified_by", "status verified needs at least one name in verified_by")

    has_html = meta["links"]["html"] != "not-available"
    if pid.startswith(("doi:", "ref:")):
        # No arXiv version: abs is the DOI resolver (doi:) or the official page (ref:),
        # pdf an open copy or not-available, and there is no HTML to anchor into.
        if pid.startswith("doi:") and meta["links"]["abs"] != "https://doi.org/" + pid[4:]:
            report.error(where, "links.abs", f"must be https://doi.org/{pid[4:]}")
        if meta["links"]["html"] != "not-available":
            report.error(where, "links.html", "must be not-available for a paper without an arXiv version")
    else:
        want = flmap.expected_links(pid, has_html)
        for k, v in want.items():
            if meta["links"][k] != v:
                report.error(where, f"links.{k}", f"must be {v}")

    # Free-text limits.
    def check_text(loc, value, kind, limit, na_ok):
        if value is None:
            return
        s = str(value)
        if s.strip() == flmap.NA and not na_ok:
            report.error(where, loc, "not-applicable is not allowed here")
        n = count_words(s) if kind == "words" else count_sentences(s)
        if n > limit:
            report.error(where, loc, f"{n} {kind} (max {limit})")
        if s.count("$") % 2:
            report.error(where, loc, "unbalanced $ math delimiters")

    if count_words(meta["summary"]) > 150:
        report.warn(where, "summary", f"{count_words(meta['summary'])} words; gold summaries run 100-140 words")
    for dotted, kind, limit in TEXT_LIMITS:
        na_ok = dotted in FREE_TEXT_NA
        if dotted.startswith("results."):
            for i, res in enumerate(meta["results"]):
                check_text(f"results[{i}].{dotted[8:]}", get(res, dotted[8:]), kind, limit, na_ok)
        elif dotted.startswith("relations."):
            for i, r in enumerate(meta["relations"]):
                check_text(f"relations[{i}].{dotted[10:]}", get(r, dotted[10:]), kind, limit, na_ok)
        else:
            check_text(dotted, get(meta, dotted), kind, limit, na_ok)

    # Empty states must stand alone in a list.
    def check_lists(loc, obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                check_lists(f"{loc}.{k}" if loc else k, v)
        elif isinstance(obj, list):
            specials = [x for x in obj if x in flmap.EMPTY + [flmap.NA]]
            if specials and len(obj) > 1:
                report.error(where, loc, f"{specials[0]} must be the only value in the list")

    for key in flmap.GROUPING + flmap.BANDS:
        check_lists(key, meta.get(key))
    for i, res in enumerate(meta["results"]):
        check_lists(f"results[{i}].overrides", res.get("overrides") or {})
        check_lists(f"results[{i}].quantity", res["quantity"])

    # Result ids, sources, anchors.
    for i, res in enumerate(meta["results"]):
        loc = f"results[{i}]"
        if res["id"] != f"r{i + 1}":
            report.error(where, f"{loc}.id", f"must be r{i + 1} (results are numbered in order)")
        if res["source"]["version"] != version:
            report.error(where, f"{loc}.source.version", f"{res['source']['version']} does not match the version read ({version})")
        if not has_html and res["source"]["anchor"] != "none":
            report.error(where, f"{loc}.source.anchor", "links.html is not-available, so the anchor must be none")
        mech = res["mechanism"]
        types = vocab["fields"]["mechanism_label"]["values"].get(mech["label"], {}).get("types") or []
        if types and mech["type"] not in types:
            report.warn(where, f"{loc}.mechanism", f"label {mech['label']} usually goes with {', '.join(types)}, not {mech['type']}")
        if mech["label"] == "other":
            report.warn(where, f"{loc}.mechanism.label",
                        "label is `other`; add a label file in schema/mechanisms/ instead (INGEST.md section 4)")
        overrides = res.get("overrides") or {}
        for band, val in overrides.items():
            if band in flmap.BANDS:
                for sub, subval in val.items():
                    if meta[band].get(sub) == subval:
                        report.warn(where, f"{loc}.overrides.{band}.{sub}", "same as the paper default; drop it")
            elif meta.get(band) == val:
                report.warn(where, f"{loc}.overrides.{band}", "same as the paper default; drop it")

    # Grouping: paper-level lists are defaults; the table uses the union over results.
    views = [flmap.merged_view(meta, r) for r in meta["results"]]
    for key in flmap.GROUPING:
        used = {v for view in views for v in view[key]}
        for v in meta[key]:
            if v not in used:
                report.error(where, key, f"{v} is listed for the paper but every result overrides it away")
    for i, view in enumerate(views):
        loc = f"results[{i}]" if meta["results"][i].get("overrides") else "paper"
        rules = view["learning_rule"]
        if "inf-depth" in view["width_limit"] and "deep" not in view["depth"]:
            report.error(where, loc, "width_limit inf-depth requires depth deep")
        if rules == ["gd"]:
            pass
        else:
            for f in ("likelihood_scaled", "temperature", "closure"):
                if view["dials"][f] == [flmap.NA]:
                    report.error(where, f"{loc} dials.{f}", "not-applicable is only allowed for GD-only papers or results")
        if rules == ["bayes"]:
            for f in ("gd_step_size", "gd_time"):
                if view["scaling"][f] != [flmap.NA]:
                    report.error(where, f"{loc} scaling.{f}", "must be [not-applicable] for a Bayes-only paper or result")
        else:
            for f in ("gd_step_size", "gd_time"):
                if view["scaling"][f] == [flmap.NA]:
                    report.error(where, f"{loc} scaling.{f}", "a GD paper or result needs a step-size / time value (or not-stated)")
        if meta["results"][i]["compared_other_rule"] == "yes" and set(rules) != {"bayes", "gd"}:
            report.error(where, f"results[{i}].compared_other_rule",
                         "a result that compares Bayes and GD must have learning_rule [bayes, gd] (paper listed under both)")

    # Regime tags (note, section 2) on Bayes papers.
    regimes = [t for t in meta["tags"] if t in flmap.REGIME_GROUP]
    widths = {w for view in views for w in view["width_limit"]}
    if "bayes" in meta["learning_rule"]:
        if not regimes:
            report.error(where, "tags", "a Bayes paper needs at least one regime tag (R0, R1, R2, R3, R3prime, R4, R5, R6)")
    elif regimes:
        report.error(where, "tags", "regime tags R0-R6 are for Bayes papers only")
    for t in regimes:
        if flmap.REGIME_GROUP[t] not in widths:
            report.error(where, "tags", f"regime tag {t} implies width_limit {flmap.REGIME_GROUP[t]}, which no result has")

    # Relations and open problems.
    base = flmap.base_id(pid)
    for i, r in enumerate(meta["relations"]):
        is_op = r["target"].startswith("op-")
        if (r["type"] == "answers") != is_op:
            report.error(where, f"relations[{i}]", "type answers takes an open-problem id (op-NN); other types take a paper id")
        if is_op and r["target"] not in ctx["op_ids"]:
            report.error(where, f"relations[{i}].target", f"{r['target']} is not an id in open-problems/")
        if r["target"] == base:
            report.error(where, f"relations[{i}].target", "a paper cannot relate to itself")
    for op in meta["open_problems"]:
        if op not in ctx["op_ids"]:
            report.error(where, "open_problems", f"{op} is not an id in open-problems/")


def check_open_problems(report):
    ids = set()
    for path in flmap.open_problem_files():
        where = rel(path)
        text = path.read_text(encoding="utf-8")
        scan_forbidden(where, text, report)
        try:
            meta, body = flmap.split_front_matter(text)
        except Exception as e:  # noqa: BLE001
            report.error(where, None, f"cannot parse: {e}")
            continue
        for key in ("id", "title", "rank", "status"):
            if key not in meta:
                report.error(where, key, "missing")
        extra = set(meta) - {"id", "title", "rank", "status"}
        if extra:
            report.error(where, None, f"unknown front-matter keys: {', '.join(sorted(extra))}")
        oid = str(meta.get("id", ""))
        if not re.fullmatch(r"op-[0-9]{2}", oid) or not path.name.startswith(oid + "-"):
            report.error(where, "id", "must be op-NN and the file must be named op-NN-<slug>.md")
        if meta.get("status") not in OP_STATUSES:
            report.error(where, "status", f"must be one of {', '.join(sorted(OP_STATUSES))}")
        if not isinstance(meta.get("rank"), int):
            report.error(where, "rank", "must be an integer")
        if not body:
            report.error(where, None, "body is empty")
        if oid in ids:
            report.error(where, "id", f"duplicate id {oid}")
        ids.add(oid)
    return ids


def check_mechanism_files(vocab, used_by, report):
    """New mechanism labels live one per file in schema/mechanisms/<slug>.yaml."""
    base = flmap.load_yaml(flmap.VOCAB.read_text(encoding="utf-8"))["fields"]["mechanism_label"]["values"]
    types = set(vocab["fields"]["mechanism_type"]["values"])
    labels = {}
    for slug, v in base.items():
        labels[str(v["label"] if isinstance(v, dict) else v).strip().lower()] = f"vocab.yaml `{slug}`"
    for path, spec in flmap.mechanism_files():
        where = rel(path)
        scan_forbidden(where, path.read_text(encoding="utf-8"), report)
        if not isinstance(spec, dict):
            report.error(where, None, f"cannot parse: {spec}")
            continue
        for key in sorted(MECH_KEYS - set(spec)):
            report.error(where, key, "missing")
        for key in sorted(set(spec) - MECH_KEYS):
            report.error(where, key, f"unknown key (allowed: {', '.join(sorted(MECH_KEYS))})")
        slug = path.stem
        if spec.get("slug") != slug:
            report.error(where, "slug", f"must equal the file name ({slug})")
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug):
            report.error(where, "slug", "lowercase words joined by hyphens, e.g. fourier-gap-amplification")
        if slug in base:
            report.error(where, "slug", "already a label in schema/vocab.yaml; use it instead of a new file")
        label = str(spec.get("label", "")).strip()
        if not label or count_words(label) > 4:
            report.error(where, "label", "one label of 1 to 4 words")
        elif label.lower() in labels:
            report.error(where, "label", f"same text as {labels[label.lower()]}; reuse that label")
        else:
            labels[label.lower()] = f"`{slug}`"
        tl = spec.get("types")
        if not isinstance(tl, list) or not tl or any(x not in types for x in tl):
            report.error(where, "types", f"a non-empty list of FL types from {', '.join(sorted(types))}")
        desc = str(spec.get("desc", "")).strip()
        if not desc or count_sentences(desc) > 2:
            report.error(where, "desc", "one or two sentences saying what changes in the features or kernel")
        users = used_by.get(slug, set())
        if not users:
            report.error(where, None, "no paper uses this label; use it in an entry or delete the file")
        elif spec.get("introduced_by") not in users:
            report.error(where, "introduced_by", f"must be the id of a paper that uses the label ({', '.join(sorted(users))})")
        if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", str(spec.get("date_added", ""))):
            report.error(where, "date_added", 'quoted date, e.g. "2026-10-24"')


def check_queue(paper_bases, report):
    where = "queue.yaml"
    if not flmap.QUEUE.exists():
        report.error(where, None, "missing")
        return
    text = flmap.QUEUE.read_text(encoding="utf-8")
    scan_forbidden(where, text, report)
    try:
        items = flmap.load_yaml(text)
    except Exception as e:  # noqa: BLE001
        report.error(where, None, f"cannot parse: {e}")
        return
    if not isinstance(items, list):
        report.error(where, None, "must be a YAML list")
        return
    seen = {}
    for i, it in enumerate(items):
        loc = f"item {i + 1}"
        if not isinstance(it, dict):
            report.error(where, loc, "must be a mapping")
            continue
        extra = set(it) - QUEUE_KEYS
        if extra:
            report.error(where, loc, f"unknown keys: {', '.join(sorted(extra))}")
        for key in ("id", "cited_as", "title", "status"):
            if key not in it:
                report.error(where, loc, f"missing {key}")
        qid, status = it.get("id"), it.get("status")
        if isinstance(qid, (int, float)):
            report.error(where, loc, f"id {qid!r} must be a quoted string, e.g. \"{qid}\"")
            continue
        if status not in QUEUE_STATUSES:
            report.error(where, loc, f"status must be one of {', '.join(sorted(QUEUE_STATUSES))}")
        if qid is not None and not re.fullmatch(r"[0-9]{4}\.[0-9]{4,5}|[a-z-]+(\.[A-Z]{2})?/[0-9]{7}|doi:10\.[0-9]{4,9}/\S+|ref:[a-z0-9]+(-[a-z0-9]+)*", str(qid)):
            report.error(where, loc, f"id {qid!r} must be an arXiv ID without version, doi:<DOI>, ref:<slug>, or null")
        if status == "needs-id" and qid is not None:
            report.error(where, loc, "status needs-id must have id: null")
        if status in ("queued", "added") and qid is None:
            report.error(where, loc, f"status {status} needs an arXiv id")
        if qid is not None:
            if qid in seen:
                report.error(where, loc, f"duplicate id {qid} (also item {seen[qid]})")
            seen[qid] = i + 1
            if status == "queued" and qid in paper_bases:
                report.error(where, loc, f"{qid} already has a file in papers/; set status: added")
            if status == "added" and qid not in paper_bases:
                report.error(where, loc, f"status added but papers/ has no file for {qid}")


def main(argv):
    report = Report()
    vocab = flmap.load_vocab()
    for name, field in vocab["fields"].items():
        if name == "mechanism_label":
            for slug, v in field["values"].items():
                if not v.get("added") and count_words(v["label"]) > 4:
                    report.error("schema/vocab.yaml", f"mechanism_label.{slug}", "label longer than 4 words")
    ctx = {"vocab": vocab, "validator": Draft202012Validator(flmap.load_schema(vocab))}
    ctx["op_ids"] = check_open_problems(report)

    files = {p.name: p for p in flmap.paper_files()}
    for extra in argv:
        p = Path(extra)
        files[p.name] = p
    for p in flmap.PAPERS.iterdir():
        if p.suffix != ".md" and p.name != ".gitkeep":
            report.error(rel(p), None, "papers/ holds only <id>.md files")

    bases = {}
    used_by = {}
    for name in sorted(files):
        path = files[name]
        where = rel(path)
        text = path.read_text(encoding="utf-8")
        scan_forbidden(where, text, report)
        try:
            meta, body = flmap.split_front_matter(text)
        except Exception as e:  # noqa: BLE001
            report.error(where, None, f"cannot parse front matter: {e}")
            continue
        check_paper(path, meta, body, ctx, report)
        pid = meta.get("id")
        for res in meta.get("results") or []:
            label = (res.get("mechanism") or {}).get("label") if isinstance(res, dict) else None
            if isinstance(label, str) and isinstance(pid, str):
                used_by.setdefault(label, set()).add(pid)
        if isinstance(pid, str):
            b = flmap.base_id(pid)
            if b in bases:
                report.error(where, "id", f"{b} is already present as {bases[b]} (one file per paper, any version)")
            bases[b] = where

    check_mechanism_files(vocab, used_by, report)
    check_queue(set(bases), report)

    for line in report.lines:
        print(line)
    n = len(files)
    if report.errors:
        print(f"\n{report.errors} error(s) in {n} paper file(s), open-problems/ and queue.yaml.")
        return 1
    print(f"OK: {n} paper file(s), {len(ctx['op_ids'])} open problem(s), queue.yaml.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
