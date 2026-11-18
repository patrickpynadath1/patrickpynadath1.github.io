"""Build src/data/sudoku_hint_ladder.json for the Part 3 hint-ladder figure.

Inputs (Claude outputs/sudoku-hint-ladder/): summary.json and spec.json from
candi's scripts/analysis/sudoku_hint_ladder.py (672 runs), and peeling.json from
sudoku_peeling.py.

    python3 scripts/build_sudoku_hint_ladder.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "Claude outputs" / "sudoku-hint-ladder"
FAMILY = {"masked": "masked", "uniform_posterior_ce": "uniform", "uniform": "uniform",
          "gaussian_embedding": "gaussian", "simplex": "simplex", "spherical": "spherical",
          "spherical_vmf": "vmf"}

rows = json.loads((SRC / "summary.json").read_text())
spec = json.loads((SRC / "spec.json").read_text())
peel = json.loads((SRC / "peeling.json").read_text())
fractions = [p["fraction"] for p in peel]
by = {(r["case"], r["sampler"], r["fraction"]): r for r in rows}


def rates(r, f):
    # distinct valid boards / samples: per puzzle (of 16) averaged; at 0 hints all puzzles are
    # the same empty grid, so pooled over every sample
    dv = r["pooled_valid_unique"] / r["generations"] if f == 0 else r["valid_unique_per_puzzle"] / 16
    return {"valid": round(r["valid_rate"], 4), "dv": round(dv, 4)}


cases = []
for c in spec:
    body = c["case"].removeprefix("sudoku_hard-").split("-seed-")[0]
    arm = "sc" if body.endswith("expected_embedding") else "none"
    parts = [FAMILY[p] for p in body.rsplit("-", 1)[0].split("-")]
    samplers = []
    for s in sorted(c["samplers"], key=lambda s: (s["rank"] == 0, s["rank"])):
        samplers.append({"name": s["name"], "tuned": s["rank"] > 0, "val": s["val"],
                         "levels": [rates(by[(c["case"], s["name"], f)], f) for f in fractions]})
    cases.append({"id": c["case"], "disc": parts[0] if parts[0] in ("masked", "uniform") else None,
                  "cont": parts[-1] if parts[-1] not in ("masked", "uniform") else None,
                  "arm": arm, "samplers": samplers})
assert len(cases) == 28 and all(len(s["levels"]) == 6 for c in cases for s in c["samplers"])

out = {"meta": {"fractions": fractions, "hints": [round(p["hints"]) for p in peel],
                "peeled": [p["peeled"] for p in peel], "solved": [p["solved"] for p in peel],
                "sols_ge_16": [p["sols_ge_16"] for p in peel],
                "puzzles": 32, "samples_per_puzzle": 16, "nfe": 128},
       "cases": cases}
(ROOT / "src" / "data" / "sudoku_hint_ladder.json").write_text(json.dumps(out, separators=(",", ":")))
print("wrote", len(cases), "cases")
