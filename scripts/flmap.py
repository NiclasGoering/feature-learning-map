"""Shared loading code for the validator and the site build."""

import copy
import json
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
PAPERS = ROOT / "papers"
OPEN_PROBLEMS = ROOT / "open-problems"
QUEUE = ROOT / "queue.yaml"
VOCAB = ROOT / "schema" / "vocab.yaml"
SCHEMA = ROOT / "schema" / "paper.schema.json"

GROUPING = ["learning_rule", "depth", "width_limit"]
BANDS = ["setting", "dials", "scaling", "data", "method", "empirics"]
EMPTY = ["unknown", "not-stated"]
NA = "not-applicable"

# Where each vocabulary field lives. "r:" paths are read from a result's merged
# view (paper defaults plus that result's overrides); "p:" paths from the paper.
FIELD_PATHS = {
    "learning_rule": "r:learning_rule",
    "depth": "r:depth",
    "width_limit": "r:width_limit",
    "contribution": "p:contribution",
    "threads": "p:threads",
    "tags": "p:tags",
    "provenance_status": "p:provenance.status",
    "relation_type": "p:relations[].type",
    "quantity": "r:quantity",
    "status": "r:status",
    "grade": "r:grade",
    "compared_other_rule": "r:compared_other_rule",
    "mechanism_type": "r:mechanism.type",
    "mechanism_label": "r:mechanism.label",
    "moves_mean": "r:mechanism.moves_mean",
}
for _band, _fields in {
    "setting": ["architecture", "activation", "learned_layers", "parametrisation", "prior_scale", "prior_family"],
    "dials": ["likelihood_scaled", "p_vs_n", "amplitude", "temperature", "closure"],
    "scaling": ["N", "L", "P", "D", "order_of_limits", "gd_step_size", "gd_time"],
    "data": ["input", "target", "label_noise", "data_class"],
    "method": ["method", "solver", "approximations"],
    "empirics": ["sampler", "diagnostics", "mixing", "datasets"],
}.items():
    for _f in _fields:
        FIELD_PATHS[_f] = f"r:{_band}.{_f}"

# Regime tag -> the width/limit group it implies (note, section 2).
REGIME_GROUP = {
    "R0": "inf-kernel",
    "R1": "finite-proportional",
    "R2": "large-width-1/N",
    "R3": "inf-meanfield-fixedP",
    "R4": "inf-meanfield-fixedP",
    "R5": "inf-meanfield-fixedP",
    "R3prime": "inf-meanfield-propP",
    "R6": "high-dim",
}


class Loader(yaml.SafeLoader):
    """YAML 1.2-style loader: only true/false are booleans and dates stay strings,
    so `yes`, `no` and `2026-10-23` survive as plain strings."""


Loader.yaml_implicit_resolvers = {
    key: [(tag, rx) for tag, rx in resolvers
          if tag not in ("tag:yaml.org,2002:bool", "tag:yaml.org,2002:timestamp")]
    for key, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
}
Loader.add_implicit_resolver(
    "tag:yaml.org,2002:bool", re.compile(r"^(?:true|false)$"), list("tf"))


def load_yaml(text):
    return yaml.load(text, Loader=Loader)


FRONT_MATTER = re.compile(r"\A---[ \t]*\n(.*?)\n---[ \t]*(?:\n(.*))?\Z", re.S)


def split_front_matter(text):
    """Return (front matter dict, body). Raises ValueError on a malformed file."""
    m = FRONT_MATTER.match(text)
    if not m:
        raise ValueError('file must start with a "---" line and close the front matter with another "---" line')
    meta = load_yaml(m.group(1))
    if not isinstance(meta, dict):
        raise ValueError("front matter is not a YAML mapping")
    return meta, (m.group(2) or "").strip()


def load_vocab():
    raw = load_yaml(VOCAB.read_text(encoding="utf-8"))
    fields = {}
    for name, spec in raw["fields"].items():
        values = {}
        for slug, val in spec["values"].items():
            if isinstance(val, dict):
                values[str(slug)] = {"label": str(val.get("label", slug)), "desc": val.get("desc", ""),
                                     "types": val.get("types", [])}
            else:
                values[str(slug)] = {"label": str(val), "desc": "", "types": []}
        fields[name] = {
            "label": spec["label"],
            "band": spec["band"],
            "multi": bool(spec["multi"]),
            "empty": bool(spec.get("empty", True)),
            "na": bool(spec.get("na", False)),
            "values": values,
        }
    return {"fields": fields, "empty_states": raw["empty_states"], "free_text": raw.get("free_text", {})}


def allowed_values(field):
    vals = list(field["values"])
    if field["empty"]:
        vals += EMPTY
    if field["na"]:
        vals.append(NA)
    return vals


def expand_schema(node, vocab):
    """Replace every {"x-vocab": name} node with the concrete JSON Schema for that field."""
    if isinstance(node, list):
        return [expand_schema(n, vocab) for n in node]
    if not isinstance(node, dict):
        return node
    if "x-vocab" in node:
        name = node["x-vocab"]
        field = vocab["fields"][name]
        rest = {k: v for k, v in node.items() if k != "x-vocab"}
        enum = {"type": "string", "enum": allowed_values(field), "x-vocab-field": name}
        if field["multi"]:
            out = {"type": "array", "items": enum, "uniqueItems": True,
                   "minItems": 0 if name in ("threads", "tags") else 1, "x-vocab-field": name}
        else:
            out = enum
        out.update(rest)
        return out
    return {k: expand_schema(v, vocab) for k, v in node.items()}


def load_schema(vocab):
    return expand_schema(json.loads(SCHEMA.read_text(encoding="utf-8")), vocab)


def key_to_filename(pid):
    """Paper id -> file stem: 2302.00375v2, cond-mat_9501082v1, doi-10.1103_PhysRevA.45.6056."""
    if pid.startswith("doi:"):
        return "doi-" + pid[4:].replace("/", "_")
    return pid.replace("/", "_")


def base_id(pid):
    """Strip the arXiv version: 2302.00375v2 -> 2302.00375. DOIs are returned unchanged."""
    if pid.startswith("doi:"):
        return pid
    return re.sub(r"v[0-9]+$", "", pid)


def version_of(pid):
    m = re.search(r"(v[0-9]+)$", pid)
    return m.group(1) if m else "published"


def expected_links(pid, has_html):
    if pid.startswith("doi:"):
        return {"abs": "https://doi.org/" + pid[4:], "pdf": "not-available", "html": "not-available"}
    return {
        "abs": f"https://arxiv.org/abs/{pid}",
        "pdf": f"https://arxiv.org/pdf/{pid}",
        "html": f"https://arxiv.org/html/{pid}" if has_html else "not-available",
    }


def merged_view(paper, result):
    """Paper defaults with the result's overrides applied (overridden fields are replaced)."""
    view = {k: copy.deepcopy(paper.get(k)) for k in GROUPING + BANDS}
    for key, val in (result.get("overrides") or {}).items():
        if key in GROUPING:
            view[key] = copy.deepcopy(val)
        elif key in BANDS and isinstance(val, dict) and isinstance(view.get(key), dict):
            for sub, subval in val.items():
                view[key][sub] = copy.deepcopy(subval)
    return view


def _get(obj, dotted):
    for part in dotted.split("."):
        if not isinstance(obj, dict):
            return None
        obj = obj.get(part)
    return obj


def field_values(paper, name):
    """All values of a vocabulary field across a paper and its results (merged views)."""
    where, path = FIELD_PATHS[name].split(":", 1)
    out = []

    def add(v):
        for x in (v if isinstance(v, list) else [v]):
            if x is not None and x not in out:
                out.append(x)

    if where == "p":
        if path.startswith("relations[]."):
            for rel in paper.get("relations") or []:
                add(rel.get(path.split(".", 1)[1]))
        else:
            add(_get(paper, path))
        return out
    for res in paper.get("results") or []:
        view = merged_view(paper, res)
        if path in GROUPING or path.split(".")[0] in BANDS:
            add(_get(view, path))
        else:
            add(_get(res, path))
    # An empty state from one result is noise next to real values from another.
    real = [v for v in out if v not in EMPTY + [NA]]
    return real or out


def group_keys(paper):
    """Table groups (rule|depth|width) the paper appears in: union over results of the
    cross product of each result's merged grouping values."""
    keys = []
    for res in paper.get("results") or []:
        view = merged_view(paper, res)
        for rule in view.get("learning_rule") or []:
            for depth in view.get("depth") or []:
                for width in view.get("width_limit") or []:
                    if width == "inf-depth" and depth != "deep":
                        continue
                    k = f"{rule}|{depth}|{width}"
                    if k not in keys:
                        keys.append(k)
    return keys


def paper_files():
    return sorted(p for p in PAPERS.glob("*.md"))


def open_problem_files():
    return sorted(p for p in OPEN_PROBLEMS.glob("op-*.md"))
