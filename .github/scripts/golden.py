"""Runs the projects' own Python on the demos' own inputs and records what it
returns, so the page can check its JavaScript ports against the real thing.

  - CodeCartographer: the strongly connected components of every demo graph,
    from codecartographer.graph.DiGraph.
  - HarmonicDNA: the alignment score and identity for every pair of demo
    progressions, from harmonicdna.aligner.align.
  - claimaudit and Hypothesisgraveyard: their pipelines on their own bundled
    sample data, for the page to move their thresholds over.
  - federated-aml: what each bank's data looks like in the repo's current
    generator, from client.data_loader.generate_bank_data, so the page can say
    plainly how its simpler generator differs.

Nothing here is typed in by hand: every number comes from running the repos.

Usage: python golden.py fixtures.json <repos-dir>   (prints JSON)
"""
import json
import subprocess
import sys
import types
from pathlib import Path

fixtures = json.load(open(sys.argv[1]))
repos = Path(sys.argv[2])


def head(name):
    return subprocess.run(["git", "-C", str(repos / name), "rev-parse", "HEAD"],
                          capture_output=True, text=True, check=True).stdout.strip()


out = {"commits": {}}

# CodeCartographer
sys.path.insert(0, str(repos / "CodeCartographer" / "src"))
from codecartographer.graph import DiGraph  # noqa: E402

out["commits"]["CodeCartographer"] = head("CodeCartographer")
cc = []
for g in fixtures["graphs"]:
    graph = DiGraph()
    for n in g["nodes"]:
        graph.add_node(n)
    for a, b in g["edges"]:
        graph.add_edge(g["nodes"][a], g["nodes"][b])
    comps = sorted(sorted(c) for c in graph.strongly_connected_components())
    cc.append({"graph": g["name"], "components": comps})
out["cc"] = cc

# HarmonicDNA
sys.path.insert(0, str(repos / "HarmonicDNA"))
from harmonicdna.aligner import align  # noqa: E402

out["commits"]["HarmonicDNA"] = head("HarmonicDNA")
hd = []
tracks = fixtures["tracks"]
for i in range(len(tracks)):
    for j in range(len(tracks)):
        if i == j:
            continue
        r = align(tracks[i]["seq"], tracks[j]["seq"])
        hd.append({"a": i, "b": j, "score": round(float(r.score), 6), "identity": round(float(r.identity), 6)})
out["hd"] = hd

# federated-aml. The generator only reaches for torch to wrap its arrays at the
# end, so a stand-in that hands the numpy arrays straight back is enough to run
# it without installing a deep-learning framework.
torch = types.ModuleType("torch")
torch.from_numpy = lambda a: a
torch.Tensor = object
data = types.ModuleType("torch.utils.data")
data.Dataset = object
data.DataLoader = object
utils = types.ModuleType("torch.utils")
utils.data = data
torch.utils = utils
sys.modules.update({"torch": torch, "torch.utils": utils, "torch.utils.data": data})
sys.path.insert(0, str(repos / "federated-aml"))
from client import data_loader as dl  # noqa: E402

out["commits"]["federated-aml"] = head("federated-aml")
banks = []
for k in range(3):
    d = dl.generate_bank_data(bank_id=k, n_samples=10_000, seed=k * 42)
    n_fraud = int(d.labels.sum())
    total = sum(d.typology_counts.values())
    banks.append({
        "fraud_rate": round(n_fraud / len(d.labels), 4),
        "home_typology": dl.TYPOLOGIES[k],
        "home_share": round(d.typology_counts[dl.TYPOLOGIES[k]] / total, 3),
        "unpatterned_share": round(d.n_unpatterned_fraud / total, 3),
    })
out["fa"] = {"banks": banks, "features": dl.FEATURE_DIM, "typologies": list(dl.TYPOLOGIES)}



def _more(out):
    """The two research tools' own pipelines on their bundled sample data, so
    the page can move their thresholds over real outputs rather than invented
    ones. Only what the scoring needs is kept: label counts per claim, and
    examined and engaging citation counts per paper."""
    sys.path.insert(0, str(repos / "claimaudit"))
    from claimaudit.classifier import ClaimClassifier
    out["commits"]["claimaudit"] = head("claimaudit")
    rows = []
    for r in ClaimClassifier(demo=True, min_citations=0).audit_topic("graphene batteries"):
        s = r.survival
        rows.append({"title": r.paper.title, "year": r.paper.year,
                     "confirms": s.confirms, "challenges": s.challenges,
                     "extends": s.extends, "neutral": s.neutral,
                     "score_at_5": __import__("claimaudit.scorer", fromlist=["x"]).compute_survival(
                         s.claim_text, {"confirms": s.confirms, "challenges": s.challenges,
                                        "extends": s.extends, "neutral": s.neutral}, 5).score})
    out["ca"] = rows

    sys.path.insert(0, str(repos / "Hypothesisgraveyard"))
    from hypothesisgraveyard.scholar import ScholarClient
    from hypothesisgraveyard.hypothesis import HypothesisExtractor
    from hypothesisgraveyard.scorer import NeglectScorer
    out["commits"]["Hypothesisgraveyard"] = head("Hypothesisgraveyard")
    client, ext, scorer = ScholarClient(demo=True), HypothesisExtractor(), NeglectScorer()
    rows = []
    for paper in client.search_topic("anything", limit=50):
        hyps = ext.extract(paper.abstract)
        if not hyps:
            continue
        ctxs = client.fetch_citations(paper.paper_id)
        e = scorer.score(paper, hyps, ctxs)
        rows.append({"title": paper.title, "year": paper.year, "examined": len(ctxs),
                     "engaging": e.engaging_count, "neglect": e.neglect_score})
    out["hg"] = rows


_more(out)
json.dump(out, sys.stdout, separators=(",", ":"))
