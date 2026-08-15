#!/usr/bin/env python3
"""Regression tests for the provenance gate.

The load-bearing test is `test_model_recall_is_not_evidence`. The project has
already been burned twice by model-derived claims entering as data (the
Shakespeare anthologization label, and an OOV artifact read as signal). If the
gate admitted a date because its author was confident, it would be reproducing
that failure in a new place.

Run: python3 quality/test_provenance.py
"""

import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.provenance import (ADMIT_DATE_VERIFIED,  # noqa: E402
                                ADMIT_PD_AFFIRMED, ADMITTED,
                                REJECT_CONTESTED_NO_DATE, REJECT_GENERATED,
                                REJECT_NO_EVIDENCE, REJECT_TOO_RECENT,
                                REJECT_UNVERIFIED_DATE, Item,
                                ProvenanceDeclaration, ProvenanceGate, report,
                                load_authority, load_sources)

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def gate(strict=True):
    return ProvenanceGate(ProvenanceDeclaration(strict=strict),
                          load_sources(), load_authority())


def verdict(g, **kw):
    kw.setdefault("item_id", "x")
    kw.setdefault("language", "xx")
    return g.admit(Item(**kw))[0]


# ---------------------------------------------------------------------------

def test_route_one_pd_affirmation():
    print("\n1. ROUTE 1 — express PD affirmation")
    g = gate()
    v = verdict(g, source_id="projectbenyehuda/public_domain_dump")
    check("source affirming public domain admits", v == ADMIT_PD_AFFIRMED,
          f"got {v}")
    v = verdict(g, source_id="openscriptures/morphhb")
    check("second PD-affirming source admits", v == ADMIT_PD_AFFIRMED,
          f"got {v}")


def test_open_licence_is_not_a_pd_claim():
    print("\n2. OPEN LICENCE != PD CLAIM")
    g = gate()
    v = verdict(g, source_id="srophe/syriac-corpus")
    check("CC-BY source alone does NOT admit", v not in ADMITTED,
          f"got {v} — a redistribution grant is not a public-domain claim")
    v = verdict(g, source_id="srophe/syriac-corpus",
                author_key="ephrem_the_syrian")
    check("same source WITH a verified date admits",
          v == ADMIT_DATE_VERIFIED, f"got {v}")


def test_software_licence_never_admits():
    print("\n3. SOFTWARE LICENCE ON TEXT")
    g = gate()
    for src in ("Sefaria/hebrew_library", "AKS-DHLAB/KPoEM"):
        v = verdict(g, source_id=src)
        check(f"{src.split('/')[0]}: software licence does not admit",
              v not in ADMITTED, f"got {v}")


def test_contested_source_forces_dates():
    print("\n4. CONTESTED LICENCE FORCES PER-ITEM DATES")
    g = gate()
    v = verdict(g, source_id="AliMuhammad73/Pashto-Poetry")
    check("contested source with no author is rejected",
          v == REJECT_CONTESTED_NO_DATE, f"got {v}")
    v = verdict(g, source_id="AliMuhammad73/Pashto-Poetry",
                author_key="khushal_khan_khattak")
    check("the genuinely PD poet still admits (d.1689)",
          v == ADMIT_DATE_VERIFIED, f"got {v}")


def test_generated_is_hard_rejected():
    print("\n5. MODEL-GENERATED CONTENT (science-safety, not legal)")
    g = gate()
    v = verdict(g, source_id="nafisehNik/ganjoor-ipa-scansion")
    check("generated source rejected despite a CC-BY tag",
          v == REJECT_GENERATED, f"got {v}")
    v = verdict(g, source_id="nafisehNik/ganjoor-ipa-scansion",
                author_key="yehuda_halevi")
    check("generated rejection outranks a verified date",
          v == REJECT_GENERATED, f"got {v}")
    v = verdict(g, source_id="openscriptures/morphhb", generated=True)
    check("item-level generated flag beats a PD-affirming source",
          v == REJECT_GENERATED, f"got {v}")


def test_model_recall_is_not_evidence():
    """THE LOAD-BEARING TEST."""
    print("\n6. MODEL RECALL IS NOT EVIDENCE")
    g = gate(strict=True)
    v = verdict(g, source_id="AKS-DHLAB/KPoEM", author_key="im_hwa")
    check("a recalled death year is REJECTED under strict",
          v == REJECT_UNVERIFIED_DATE, f"got {v}")
    v = verdict(g, source_id="pruizf/disco", author_key="recalled_victorian")
    check("recalled date rejected even though 1900 clears the term",
          v == REJECT_UNVERIFIED_DATE,
          f"got {v} — the year is fine; the SOURCING is not")

    lax = gate(strict=False)
    v = lax.admit(Item("x", "xx", "pruizf/disco",
                       author_key="recalled_victorian"))[0]
    check("non-strict admits it, so relaxing the rule is explicit and visible",
          v == ADMIT_DATE_VERIFIED, f"got {v}")

    v = verdict(g, source_id="pruizf/disco", author_key="some_1930s_spaniard")
    check("a recalled date inside the term fails on BOTH grounds",
          v in (REJECT_UNVERIFIED_DATE, REJECT_TOO_RECENT), f"got {v}")


def test_term_boundary():
    print("\n7. TERM ARITHMETIC")
    g = gate()
    cutoff = g.decl.cutoff_death_year()
    check("cutoff is current_year - term_years", cutoff == 2026 - 95,
          f"cutoff {cutoff}: an author must have died by then to clear")
    v = verdict(g, source_id="srophe/syriac-corpus", author_key="im_hwa")
    check("a 1953 death is inside the term",
          v in (REJECT_TOO_RECENT, REJECT_UNVERIFIED_DATE), f"got {v}")


def test_no_evidence():
    print("\n8. NO EVIDENCE AT ALL")
    g = gate()
    v = verdict(g, source_id="some/unknown-corpus")
    check("unknown source with no author is rejected",
          v == REJECT_NO_EVIDENCE, f"got {v}")
    v = verdict(g, source_id="linhd-postdata/metrique-en-ligne")
    check("no-licence source with no author is rejected",
          v == REJECT_NO_EVIDENCE, f"got {v}")


def test_report_counts():
    print("\n9. LEDGER AND REPORT")
    g = gate()
    items = [
        Item("he1", "he", "projectbenyehuda/public_domain_dump"),
        Item("he2", "he", "projectbenyehuda/public_domain_dump"),
        Item("syc1", "syc", "srophe/syriac-corpus", "ephrem_the_syrian"),
        Item("syc2", "syc", "srophe/syriac-corpus"),
        Item("ps1", "ps", "AliMuhammad73/Pashto-Poetry",
             "khushal_khan_khattak"),
        Item("ps2", "ps", "AliMuhammad73/Pashto-Poetry"),
        Item("fa1", "fa", "nafisehNik/ganjoor-ipa-scansion"),
        Item("ko1", "ko", "AKS-DHLAB/KPoEM", "im_hwa"),
    ]
    admitted, ledger = g.gate(items)
    check("ledger has one row per item, always",
          len(ledger) == len(items), f"{len(ledger)} rows for {len(items)}")
    check("admitted count is correct", len(admitted) == 4,
          f"admitted {[i.item_id for i in admitted]}")

    buf = io.StringIO()
    summary = report(ledger, stream=buf)
    check("Persian is eliminated entirely (all generated)",
          "fa" in summary["languages_eliminated"],
          f"eliminated: {summary['languages_eliminated']}")
    check("Korean is eliminated entirely (recalled date only)",
          "ko" in summary["languages_eliminated"],
          f"eliminated: {summary['languages_eliminated']}")
    check("three languages survive", summary["languages_surviving"] == 3,
          f"surviving {summary['languages_surviving']}")
    print("\n" + buf.getvalue())


def test_noncommercial_is_a_rejection():
    """Doctrine 85, made mechanical — and it is the ORDER that does the work.

    Before 2026-08-13 `grep -i non-commercial quality/provenance.py` returned
    nothing, while four refusals in this project's record cite doctrine 85:
    pantunis-data, CELT, 4,347 ci and 734 樂府. Every one was a human reading
    licence text at fetch time. The gate would have admitted all of them,
    because an NC grant is not a date and every admitting route tests a date.
    """
    print("\n10. an express non-commercial grant is a REJECTION")
    from quality.provenance import (REJECT_NONCOMMERCIAL, ADMITTED, Source,
                                    AuthorRecord, ProvenanceGate,
                                    ProvenanceDeclaration,
                                    noncommercial_marker)

    def one(licence, contested=False, death=450):
        src = Source(source_id="s", licence=licence, contested=contested)
        auth = {"a": AuthorRecord(author_key="a", death_year=death,
                                  verification_source="wikidata")}
        g = ProvenanceGate(ProvenanceDeclaration(), {"s": src}, auth)
        return g.admit(Item(item_id="i", language="xx", source_id="s",
                            author_key="a"))[0]

    # THE ORDERING. A 450 CE author clears every term this gate can compute,
    # so route 2 admitted these on the strength of the author being long dead
    # -- true, and beside the point.
    check("cc-by-nc-sa-4.0 refuses even with a verified 450 CE death year",
          one("cc-by-nc-sa-4.0") == REJECT_NONCOMMERCIAL)
    check("the quoted rime-aca grant refuses -- doctrine 85's own case",
          one("non-commercial free-use grant by the DIGITISER, quoted in the "
              "file: '資料自由使用，但不得為商業用途'") == REJECT_NONCOMMERCIAL,
          "an NC restriction has to bind the same way in every language")
    check("contested=true does not change the answer either way",
          one("cc-by-nc-4.0", contested=True) == REJECT_NONCOMMERCIAL,
          "contested only voids route 1; REJECT_CONTESTED_NO_DATE is reached "
          "after route 2 has already returned, which is why this check has to "
          "sit ahead of all three routes rather than beside them")

    # THE CONTROLS. A refusal that fires on everything is not a gate.
    check("CC0 still admits", one("cc0-1.0") in ADMITTED)
    check("plain CC BY + a verified date still admits",
          one("cc-by-4.0") in ADMITTED)

    # THE NEGATION TRAP, and it is a live string in data/sources.tsv. The MIT
    # row for the frequency list this project SHIPS describes the NC clause of
    # the list it REPLACED. A substring search for "non-commercial" refuses
    # the admissible file for describing the inadmissible one.
    mit = ("MIT (hermitdave/FrequencyWords, LICENSE at repo root). No "
           "non-commercial clause anywhere in the chain -- which is the "
           "point, since the list it replaces has one.")
    check("a row DENYING an NC clause is not read as carrying one",
          noncommercial_marker(mit) is None,
          "data/opensubtitles_en_50k.tsv is the shipped list; refusing it "
          "here would be the gate reading its own changelog as a restriction")
    check("and it admits end to end", one(mit) in ADMITTED)

    # Nothing currently staged may start refusing. This is the regression that
    # matters: the fix must close a hole, not re-litigate the corpus.
    from quality.provenance import load_sources
    now_refused = [s.source_id for s in load_sources().values()
                   if noncommercial_marker(s.licence)]
    check("the NC verdict fires on the staged sources it should, and no others",
          all("nc" in s.lower() or "gretil" in s.lower() or "rime" in s.lower()
              for s in now_refused) if now_refused else True,
          f"refused: {now_refused or 'none'}")


def test_the_dataset_a_date_names_has_to_have_a_row():
    print("\n11. `dataset_field:` NAMES A DATASET, and the dataset has to "
          "have a data/sources.tsv row (FIXED 2026-08-15)")
    # THE DEFECT: `AuthorRecord.trusted()` is
    # `verification_source.split(":")[0] in TRUSTED_VERIFICATION` -- it reads
    # the text before the first colon and stops. `dataset_field:` followed by
    # ANY STRING WHATEVER cleared it, so the one scheme in the trusted set
    # whose payload names something IN THIS REPO was the one scheme whose
    # payload was never looked at. A check that cannot fail on the coordinate
    # that discriminates (doctrine 48), inside the gate that decides what may
    # be scored at all.
    from quality.provenance import (REJECT_UNDECLARED_DATASET,
                                    resolve_dataset_field, AuthorRecord,
                                    Source)

    def rec(vs):
        return AuthorRecord(author_key="a", death_year=800,
                            verification_source=vs)

    srcs = {"chinese-poetry/chinese-poetry": Source("chinese-poetry/chinese-poetry"),
            "pruizf/disco": Source("pruizf/disco"),
            "OpenITI/RELEASE#metadata_2025-1-9": Source("OpenITI/RELEASE#metadata_2025-1-9")}
    g = ProvenanceGate(ProvenanceDeclaration(), srcs, {"a": rec("x")})

    # THE THREE DECLARED ROUTES, each on its own, against a table small enough
    # to read. Asserted separately because a rule with three routes and one
    # test is a rule with one route and two accidents.
    for payload, want, route in (
            ("chinese-poetry/chinese-poetry", "chinese-poetry/chinese-poetry",
             "1 · path prefix"),
            ("chinese-poetry/authors.song.json",
             "chinese-poetry/chinese-poetry", "2 · owner"),
            ("disco/author_metadata.tsv:death", "pruizf/disco", "3 · repo name"),
            ("OpenITI/RELEASE#metadata_2025-1-9", "OpenITI/RELEASE#metadata_2025-1-9",
             "1 · path prefix, #subset stripped")):
        got = resolve_dataset_field(payload, srcs)
        check(f"route {route}: {payload!r} reaches its row", got == want,
              f"got {got!r}")
    check("and a payload naming nothing in the table reaches NOTHING — this "
          "is the half `trusted()` cannot ask",
          resolve_dataset_field("corpus_1835/csv/authors.csv", srcs) is None,
          "a resolver that always resolves is the defect wearing a new name")
    # THE INVARIANT THE FIRST DRAFT OF THE RESOLVER BROKE, asserted over the
    # WHOLE SHIPPED TABLE rather than the four cases above: whatever comes
    # back must BE a row. Stripping `#subset` from the row ids and returning
    # the stripped string answered `OpenITI/RELEASE` from a table holding only
    # `OpenITI/RELEASE#metadata` — a source_id naming no row, produced by the
    # function whose entire job is proving a row exists.
    _live_srcs = load_sources()
    _ghosts = [(p, h) for p, h in
               ((r.dataset_payload(), None) for r in load_authority().values())
               if p is not None]
    _ghosts = [(p, resolve_dataset_field(p, _live_srcs)) for p, _ in _ghosts]
    _bad = [(p, h) for p, h in _ghosts if h is not None and h not in _live_srcs]
    check("EVERY resolution over the shipped table returns an id that is "
          "actually a row, never a stripped string that names none",
          not _bad, f"{len(_ghosts)} payloads resolved; offenders: "
                    f"{_bad[:3] or 'none'}")

    # TWO-SIDED AT THE GATE. Against the unfixed tree the first of these
    # ADMITTED: the scheme was trusted and the payload was never read.
    g.authority = {"a": rec("dataset_field:corpus_1835/csv/authors.csv")}
    v, why = g.admit(Item("x", "xx", "chinese-poetry/chinese-poetry", "a"))
    check("a date sourced to an UNDECLARED dataset is REJECTED, with its own "
          "verdict rather than folded into REJECT_UNVERIFIED_DATE "
          "(doctrine 79 — two failures are two counts)",
          v == REJECT_UNDECLARED_DATASET, f"got {v}")
    check("and the refusal NAMES the dataset that reached no row "
          "(doctrine 20 — a refusal states its own cause)",
          "corpus_1835/csv/authors.csv" in why, why)

    g.authority = {"a": rec("dataset_field:chinese-poetry/authors.song.json")}
    v, why = g.admit(Item("x", "xx", "chinese-poetry/chinese-poetry", "a"))
    check("a date sourced to a DECLARED dataset still admits",
          v == ADMIT_DATE_VERIFIED, f"got {v}")
    check("and the admission names WHICH row it resolved to — routes 2 and 3 "
          "are ambiguous in principle, so 'declared' without a row is "
          "unauditable",
          "chinese-poetry/chinese-poetry" in why, why)

    # THE SCHEMES WITH NO DATASET TO NAME must not be refused for lacking a
    # row: `wikidata`, `viaf`, `critical_edition` and `printed_authority` name
    # authorities that live OUTSIDE this repo, and demanding a row of them
    # would refuse them for being what they are.
    for vs in ("wikidata", "viaf", "critical_edition", "printed_authority"):
        g.authority = {"a": rec(vs)}
        check(f"`{vs}` is not asked for a sources.tsv row",
              g.admit(Item("x", "xx", "chinese-poetry/chinese-poetry",
                           "a"))[0] == ADMIT_DATE_VERIFIED, vs)

    # THE COORDINATE IS REAL. A caller who wants the scheme checked and the
    # payload not has to be able to SAY so rather than argue it (doctrine 1).
    lax = ProvenanceGate(
        ProvenanceDeclaration(require_declared_dataset=False), srcs,
        {"a": rec("dataset_field:corpus_1835/csv/authors.csv")})
    check("require_declared_dataset=False restores the old answer, so the "
          "change is a DECLARED coordinate and not a new hardcoded rule",
          lax.admit(Item("x", "xx", "chinese-poetry/chinese-poetry",
                         "a"))[0] == ADMIT_DATE_VERIFIED)

    # AND THE SHIPPED TABLE, measured rather than assumed.
    live = ProvenanceGate(ProvenanceDeclaration(), load_sources(),
                          load_authority())
    unreachable = sorted(
        k for k, r in live.authority.items()
        if not live.date_is_declared(r)[0])
    kinds = sorted({live.authority[k].dataset_payload()
                    .replace("#", ":").split(":")[0] for k in unreachable})
    check("the shipped data/authority.tsv has a KNOWN, NAMED set of rows that "
          "reach no row — the number is reported, not asserted to be zero "
          "(doctrine 58: a recorded count is a threshold nobody wrote down)",
          kinds == ["corpus_1835/csv/authors.csv",
                    "trister95/dbnl_bear/notebook/poezie.csv"],
          f"{len(unreachable)} rows across {len(kinds)} datasets: {kinds}")
    # THE TWO CORRECTED SPELLINGS. Both named a dataset whose TARGET ROW'S OWN
    # `note` declares this exact route -- `OpenITI/RELEASE` says "metadata
    # carries author death dates in AH -> dataset_field route" -- so the
    # defect was the payload's spelling, not the provenance. Re-spelled with
    # the `#subset` convention data/sources.tsv already uses.
    for key, want in (("abiwardi_shacir", "OpenITI/RELEASE"),
                      ("solomon_ibn_gabirol",
                       "projectbenyehuda/public_domain_dump")):
        if key in live.authority:
            ok, hit = live.date_is_declared(live.authority[key])
            check(f"the corrected spelling for {key!r} resolves to {want}",
                  ok and hit == want, f"got {hit!r}")


if __name__ == "__main__":
    test_route_one_pd_affirmation()
    test_open_licence_is_not_a_pd_claim()
    test_software_licence_never_admits()
    test_contested_source_forces_dates()
    test_generated_is_hard_rejected()
    test_model_recall_is_not_evidence()
    test_term_boundary()
    test_no_evidence()
    test_report_counts()
    test_noncommercial_is_a_rejection()
    test_the_dataset_a_date_names_has_to_have_a_row()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all provenance regressions pass")
