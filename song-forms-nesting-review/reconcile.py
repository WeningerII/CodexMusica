"""Rebuild the examiner and all derived review ledgers, then validate the package."""
import argparse
from collections import Counter
import csv
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import parse_catalog
from evidence import reviewed

def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def save(path, obj):
    Path(path).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def table(path, headings, rows):
    with Path(path).open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream, delimiter="\t")
        writer.writerow(headings)
        writer.writerows(rows)

def records(path):
    with Path(path).open(newline="", encoding="utf-8") as stream:
        return list(csv.DictReader(stream, delimiter="\t"))

def topology(nodes):
    return [topology(n["children"]) if isinstance(n,dict) else None for n in nodes]

def node_count(nodes):
    return sum(1 + (node_count(node["children"]) if isinstance(node, dict) else 0) for node in nodes)

def source_basis(record, refs):
    assert all(isinstance(u,str) and u.startswith(("https://","http://")) for u in refs)
    basis = record["basis"]
    assert basis in {"passage checked for stated scope", "reference recorded; passage unverified", "catalog and model only"}, basis
    return basis

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", nargs="?", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    os.chdir(args.package.resolve())
    src = list(parse_catalog(Path("english-forms.md")))
    r2 = list(parse_catalog(Path("comparison/r2-post.md")))
    key = read("comparison/title-map.json")
    assert len(src) == len(r2) == 364
    srcby = {row[2][0]: row for row in src}
    digest = hashlib.sha256(Path("english-forms.md").read_bytes()).hexdigest()
    assert digest == "c2b6bfb4d73611eba7e455ab8d2e2c455092fb8277909faa718a702e3b49233c"
    changes = []
    for (g,i,a),(h,j,b) in zip(src,r2):
        assert g==h and a[0]==key.get(b[0],b[0])
        diffs = {f:[x,y] for f,x,y in zip(["title","aliases","description","length","extra sections"],a,b) if x!=y}
        changes.append([g,i,j,a[0],b[0],", ".join(diffs) or "identical",json.dumps(diffs,ensure_ascii=False)])
    table("comparison/r2-row-diff.tsv",["group","source_line","comment_line","catalog_title","r2_title","changed_fields","before_after"],changes)
    assert Counter(r[5] for r in changes) == {"identical":349,"description":14,"title":1}
    forms, links, log = [], [], []
    kinds, edgeverdict, history, diagram_status, entry_basis, edge_basis = [Counter() for _ in range(6)]
    source_refs=set()
    topology_changes=0
    diagram_nodes=0
    for path in sorted(Path("models").glob("*.json")):
        before=read(Path("baseline/models")/path.name)
        now=read(path)
        audit=read(Path("audit")/path.name)
        assert before.keys()==now.keys()==audit.keys()
        for title, model in now.items():
            group,line,_=srcby[title]
            orig=before[title]
            rev=reviewed(title, audit[title])
            old=set(orig.get("related",[]))
            new=set(model.get("related",[]))
            decisions={e["target"] for e in rev["edges"]}
            assert old|new <= decisions and decisions <= srcby.keys(), title
            assert title not in decisions and len(decisions) == len(rev["edges"]), title
            assert new=={e["target"] for e in rev["edges"] if e["status"]=="supported"}, title
            assert len(new)==len(model.get("related",[])), title
            for edge in rev["edges"]:
                target,kind,verdict=edge["target"],edge["kind"],edge["status"]
                assert kind in {"variant","contains","shares-feature","comparison","other"},(title,kind)
                assert verdict in {"supported","ambiguous","rejected","contested","redirected"} and edge["evidence"].strip()
                provenance=source_basis(edge, edge.get("refs",[]))
                change=("retained" if target in old else "added") if target in new else ("removed" if target in old else "withheld")
                history[change]+=1
                edgeverdict[verdict]+=1
                if verdict=="supported":
                    kinds[kind]+=1
                    edge_basis[provenance]+=1
                canonical = edge.get("canonical_edge", {})
                if verdict=="redirected":
                    assert {canonical.get("source"), canonical.get("target")} == {title, target}, (title, target, canonical)
                links.append([title,line,target,srcby[target][1],kind,verdict,change,edge["evidence"],
                              provenance if verdict=="supported" else "decision basis: " + provenance,
                              " ".join(edge.get("refs",[])),canonical.get("source",""),canonical.get("target",""),
                              ";".join(edge.get("scope_paths", []))])
            delta={k:{"before":orig.get(k),"after":model.get(k)} for k in sorted(orig.keys()|model.keys()) if orig.get(k)!=model.get(k)}
            if delta:
                log.append(dict(form=title,source_line=line,changes=delta,reason=rev["note"],edges=rev["edges"],references=rev["refs"]))
            topology_changes+=topology(orig["tree"]) != topology(model["tree"])
            diagram_nodes+=node_count(model["tree"])
            source_refs.update(rev["refs"])
            provenance=source_basis(rev, rev.get("attested_refs",[]))
            status=rev["status"]
            diagram_status[status]+=1
            entry_basis[status+" | "+provenance]+=1
            forms.append([group,line,title,status,model["mode"],", ".join(sorted(delta)) or "unchanged",len(old),len(new),rev["note"],provenance," ".join(rev.get("attested_refs",[]))," ".join(rev["refs"])])
    assert len(forms)==364
    supported = {(row[0], row[2]) for row in links if row[5]=="supported"}
    assert all(tuple(row[10:12]) in supported for row in links if row[5]=="redirected")
    variant={(row[0],row[2]) for row in links if row[4:6]==["variant","supported"]}
    assert not any((b,a) in variant for a,b in variant)
    table("coverage.tsv",["group","catalog_line","form","review_status","diagram_mode","changed_fields","old_edges","supported_edges","entry_finding","evidence_basis","attested_references","review_bibliography"],forms)
    table("relationships.tsv",["source","source_line","target","target_line","kind","verdict","change","evidence","evidence_basis","link_specific_references","canonical_source","canonical_target","diagram_node_paths"],links)
    save("model-changes.json",log)
    # Counts from hand-curated comparison files are remeasured every build.
    survey=read("comparison/structure-crosswalk.json")
    rows=survey["rows_by_source_data_row"]
    assert len(rows)==623 and sum(survey["methods"].values())==623
    assert sum(survey["dispositions"].values())==623 and sum(survey["survey_layers"].values())==623
    meter=records("comparison/meter-crosswalk.tsv")
    assert len(meter)==203 and [v[next(iter(v))] for v in meter]==[f"M{n:03}" for n in range(1,204)]
    for row in meter:
        for title in row["prototype_forms_exact_semicolon"].split(";"):
            if title.strip():
                assert title.strip() in srcby, title
    aliases=read("comparison/alias-overrides.json")
    terms=read("comparison/meta-forms.json")
    placements=records("comparison/issue-676-crosswalk.tsv")
    poetry=read("comparison/external-poetry.json")
    music=read("comparison/song-gaps.json")
    assert len(placements)==320 and len(terms["terms"])==terms["term_count"]==62
    assert [s["headwords"] for s in poetry["scope"]["indexes"]]==[163,35]
    assert sum(len(v) for v in poetry["index_disposition"].values())==198
    assert len(music["references_checked"])==7 and len(music["findings"])==15
    assert sum(x[2][1]!="–" for x in src)==177
    assert sorted((int(k), row["source_row"]) for k,row in rows.items()) == [(i,i) for i in range(1,624)]
    assert Counter(item["disposition"] for item in rows.values()) == survey["dispositions"]
    assert Counter(item["method"] for item in rows.values()) == survey["methods"]
    assert Counter(item["layer"] for item in rows.values()) == survey["survey_layers"]
    meterlinks=records("comparison/meter-links.tsv")
    pairs={(r["meter_id"],r["catalog_title"]) for r in meterlinks}
    assert len(pairs)==len(meterlinks)
    matrix_pairs={(r["meter_id"],n.strip()) for r in meter for n in r["prototype_forms_exact_semicolon"].split(";") if n.strip()}
    assert pairs==matrix_pairs and all(n in srcby for _,n in pairs)
    assert all(r["link_evidence"] and r["comparison_scope"] and r["strength"] and r["governed_unit"] for r in meterlinks)
    subprocess.run([sys.executable,"-I","-B","audit_units.py"],check=True)
    units=records("model-unit-crosswalk.tsv")
    counts=dict(source_rows=len(forms), row_counts=dict(Counter(row[0] for row in forms)), status=dict(diagram_status),
        changed_models=len(log), fields_changed=dict(Counter(k for item in log for k in item["changes"])), hierarchy_changed=topology_changes,
        diagram_nodes=diagram_nodes, candidate_relationships=len(links), edge_verdicts=dict(edgeverdict), edge_changes=dict(history), supported_kinds=dict(kinds),
        entry_evidence=dict(entry_basis), supported_edge_evidence=dict(edge_basis), distinct_bibliography_urls=len(source_refs),
        alias_fields_before=177, alias_fields_reviewed_differently=len(aliases), issue_676_placements=len(placements), meta_terms=62,
        survey_rows=623,survey_dispositions=survey["dispositions"], survey_methods=survey["methods"],survey_layers=survey["survey_layers"],
        unit_node_matches=len(units), meter_pairs=len(pairs), meter_evidence=dict(Counter(r["evidence_basis"] for r in meterlinks)), meter_ids=203,meter_ids_with_example=sum(bool(row["prototype_forms_exact_semicolon"].strip()) for row in meter),
        poetry_index_occurrences=198, music_reference_comparisons=7, music_findings=15, r2_identical_records=349,
        source_sha256=digest,r2_comment="https://github.com/WeningerII/CodexMusica/pull/665#issuecomment-6964243074")
    save("coverage-summary.json",counts)
    subprocess.run([sys.executable,"-I","-B","build.py"],check=True)
    print(json.dumps(counts,ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()

