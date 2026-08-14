#!/usr/bin/env python3
"""Provenance gate — nothing enters a cell without positive evidence.

Three independent admission routes:

  1. EXPRESS PD AFFIRMATION at the source level — the corpus itself states that
     its texts are public domain (or CC0 / PD-mark).
  2. VERIFIED DATE at the item level — the author's death year comes from an
     authority record, and clears the declared term.
  3. VERIFIED PUBLICATION YEAR, for ANONYMOUS works only — copyright in an
     anonymous work runs from publication, not from an author's death. Without
     this, folk and oral-traditional corpora could never admit: they have no
     author to date, so route 2 is structurally unavailable to them, and an
     entire class of tradition would be excluded on a technicality rather than
     on the law. It is restricted to items with no named author, so it cannot
     be used as a loophole around route 2.

Everything else is rejected and logged with a reason. The gate reports what it
dropped and why, so "how much do we lose by being strict" is answered with a
number instead of a guess.

THREE RULES THIS ENFORCES RATHER THAN DOCUMENTS
-----------------------------------------------

**A software licence is not a PD affirmation.** MIT, GPL and Apache tags on a
text corpus cover code, not the text, and the audit found several corpora where
a GPL tag was being read as a redistribution grant for poems. They do not admit.

**A contested licence forces per-item dates.** Where a source asserts an open
licence that demonstrably cannot cover its contents (one Pashto corpus is tagged
cc-by-4.0 while roughly 29,000 of its 35,637 couplets are in copyright), the
source-level affirmation is void and every item must clear route 2 alone.

**Model-generated content is rejected regardless of licence.** This is a
science-safety rule, not a legal one, and it is the one that has already cost
this project twice. A flagship Persian corpus ships IPA that is G2P *model
output*; an Ancient Greek corpus carries 1.7M LLM-rewritten rows inside its
headline count. Scoring those measures the model, not the tradition.

WHY THE AUTHORITY TABLE IS A FILE AND NOT A LOOKUP
--------------------------------------------------

Wikidata and VIAF are both unreachable from this environment. That turns out to
be the better design: evidence committed to git is auditable after the fact,
where a runtime call is not. It also closes the hole that matters most — a date
I merely *believe* is not evidence. Entries carry their verification source, and
under the default strict declaration anything sourced to model recall is
REJECTED. The gate is built so its author's confidence cannot admit anything.
"""

import csv
import os
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field, asdict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")

# Verdicts
ADMIT_PD_AFFIRMED = "ADMIT_PD_AFFIRMED"
ADMIT_DATE_VERIFIED = "ADMIT_DATE_VERIFIED"
ADMIT_PUBLICATION_VERIFIED = "ADMIT_PUBLICATION_VERIFIED"
REJECT_GENERATED = "REJECT_GENERATED"
REJECT_CONTESTED_NO_DATE = "REJECT_CONTESTED_NO_DATE"
REJECT_UNVERIFIED_DATE = "REJECT_UNVERIFIED_DATE"
REJECT_TOO_RECENT = "REJECT_TOO_RECENT"
REJECT_NO_EVIDENCE = "REJECT_NO_EVIDENCE"

REJECT_PUBLICATION_TOO_RECENT = "REJECT_PUBLICATION_TOO_RECENT"
#: doctrine 85 -- an express non-commercial grant is a rejection, whatever the
#: dates say. Checked BEFORE every admitting route: see `admit`.
REJECT_NONCOMMERCIAL = "REJECT_NONCOMMERCIAL"

ADMITTED = {ADMIT_PD_AFFIRMED, ADMIT_DATE_VERIFIED,
            ADMIT_PUBLICATION_VERIFIED}

#: licence strings that constitute an express public-domain affirmation
PD_AFFIRMATIONS = {
    "cc0-1.0", "cc0", "public domain", "public-domain", "pd",
    "public-domain-mark", "pdm-1.0", "unlicense",
}

#: open licences: a valid REDISTRIBUTION grant, but NOT a PD claim. These do not
#: admit on their own -- an item still needs a verified date.
OPEN_NOT_PD = {"cc-by-4.0", "cc-by-3.0", "cc-by-sa-4.0", "cc-by-sa-3.0"}

#: software licences. Applied to a text corpus these are incoherent and must
#: never be read as a grant over the texts.
SOFTWARE_LICENCES = {"mit", "apache-2.0", "gpl-2.0", "gpl-3.0", "lgpl-3.0",
                     "bsd-3-clause", "agpl-3.0"}

#: EXPRESS non-commercial restrictions. Doctrine 85: an express non-commercial
#: grant is a REJECTION, and it has to bind the same way in every language.
#:
#: Matched two ways, and the split is deliberate. Licence IDENTIFIERS are a
#: closed vocabulary and match by prefix, so the whole `cc-by-nc*` family is
#: covered without listing every suffix. Free PROSE is matched only against
#: phrases that are unambiguous PROHIBITIONS -- because the licence column of
#: data/sources.tsv is free text written by whoever staged the row, and the
#: row for the MIT replacement list says "No non-commercial clause anywhere in
#: the chain -- which is the point". A substring search for "non-commercial"
#: refuses that row: it would reject the admissible file for describing the
#: inadmissible one it replaced. `_NC_NEGATIONS` is the guard, and
#: quality/test_provenance.py pins both directions.
NONCOMMERCIAL_ID_PREFIXES = ("cc-by-nc", "cc-nc", "by-nc")

#: Prohibitions stated in prose, in the languages this repo has actually met
#: one in. 資料自由使用，但不得為商業用途 is the rime-aca digitiser's grant, the
#: exact string doctrine 85 was written about.
NONCOMMERCIAL_PROSE = (
    "不得為商業", "不得用於商業", "非商業",
    "non-commercial use only", "noncommercial use only",
    "not for commercial use", "no commercial use",
    "nicht kommerziell", "pas d'utilisation commerciale",
)

#: Phrases that MENTION a non-commercial clause in order to deny one. Checked
#: before the prose markers; a row that says a restriction is absent is not a
#: row that carries one.
_NC_NEGATIONS = (
    "no non-commercial clause", "no noncommercial clause",
    "without a non-commercial", "not non-commercial",
    "no commercial restriction", "free of any non-commercial",
)


def noncommercial_marker(licence):
    """-> the matched marker, or None. Doctrine 85 made mechanical.

    Until 2026-08-13 nothing in this module could express a non-commercial
    refusal: `grep -i non-commercial quality/provenance.py` returned zero hits
    while four separate refusals in this project's record cite doctrine 85 --
    pantunis-data, CELT, 4,347 ci and 734 樂府. Every one of those was a human
    reading licence text at fetch time. The gate would have admitted them all,
    because an NC grant is not a date and every admitting route here tests a
    date. That is the gap this closes.
    """
    if not licence:
        return None
    lic = " ".join(str(licence).lower().split())
    for neg in _NC_NEGATIONS:
        if neg in lic:
            return None
    ident = lic.split()[0].strip(",;.") if lic.split() else ""
    for pre in NONCOMMERCIAL_ID_PREFIXES:
        if ident.startswith(pre):
            return ident
    for marker in NONCOMMERCIAL_PROSE:
        if marker in lic:
            return marker
    return None

#: verification sources that count as authority evidence
TRUSTED_VERIFICATION = {"wikidata", "viaf", "dataset_field", "critical_edition",
                        "printed_authority"}


@dataclass
class ProvenanceDeclaration:
    """Declared assumptions, in the spirit of the harness's Declaration tuple.
    Disagreements about what is admissible are located in a field here rather
    than argued case by case."""

    current_year: int = 2026
    #: years after author death before a work is treated as clear. 95 is chosen
    #: to clear the longest term in play (life+80, Spain pre-1987) with margin,
    #: rather than the life+70 that covers most jurisdictions.
    term_years: int = 95
    #: term for ANONYMOUS works, which run from publication rather than from
    #: an author's death. Folk and oral-traditional corpora are anonymous by
    #: nature, so without this route they can never clear on route 2 -- there
    #: is no author to date -- and an entire class of tradition is excluded on
    #: a technicality rather than on the law.
    anon_term_years: int = 95
    #: when True the declaration's anon term wins over any per-source term.
    #: Without this the declaration cannot TIGHTEN a source that declared a
    #: shorter term, so "apply one conservative rule everywhere" would be
    #: unexpressible -- the per-source value would silently always win.
    override_source_terms: bool = False
    #: reject dates whose verification source is not in TRUSTED_VERIFICATION
    strict: bool = True
    #: a source-level PD affirmation admits every item from that source
    allow_source_affirmation: bool = True
    note: str = ("conservative: term chosen to clear the longest applicable "
                 "national term, not the median")

    def cutoff_death_year(self):
        return self.current_year - self.term_years

    def cutoff_publication_year(self):
        return self.current_year - self.anon_term_years


@dataclass
class Source:
    """Corpus-level provenance record."""
    source_id: str
    licence: str = ""
    pd_affirmed: bool = False          # source explicitly states public domain
    evidence: str = ""                 # URL or quoted statement
    contested: bool = False            # affirmation cannot cover the contents
    generated: bool = False            # content or a key column is model output
    #: publication year of the edition, for anonymous/traditional material
    publication_year: int = None
    publication_evidence: str = ""
    #: jurisdiction whose term governs this source, and an optional override of
    #: the declaration's anonymous term. Applying one country's term uniformly
    #: is not conservatism, it is using the wrong law: the anonymous-work term
    #: is 70 years from publication in the EU and 95 in the US, so a uniform 95
    #: silently misclassifies every European corpus.
    jurisdiction: str = ""
    anon_term_years: int = None
    note: str = ""


@dataclass
class Item:
    """One poem/song presented for admission."""
    item_id: str
    language: str
    source_id: str
    author_key: str = ""
    generated: bool = False
    #: per-item publication year, overriding the source's, when known
    pub_year: int = None


@dataclass
class AuthorRecord:
    author_key: str
    death_year: int = None
    qid: str = ""
    verification_source: str = ""
    verified_on: str = ""
    note: str = ""

    def trusted(self):
        return self.verification_source.split(":")[0] in TRUSTED_VERIFICATION


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

def _read_tsv(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [r for r in csv.DictReader(f, delimiter="\t")
                if r.get(next(iter(r))) and not
                str(list(r.values())[0]).startswith("#")]


def load_sources(path=None):
    path = path or os.path.join(DATA, "sources.tsv")
    out = {}
    for r in _read_tsv(path):
        s = Source(
            source_id=r["source_id"].strip(),
            licence=(r.get("licence") or "").strip().lower(),
            pd_affirmed=(r.get("pd_affirmed") or "").strip().lower() == "true",
            evidence=(r.get("evidence") or "").strip(),
            contested=(r.get("contested") or "").strip().lower() == "true",
            generated=(r.get("generated") or "").strip().lower() == "true",
            publication_year=(int(r["publication_year"])
                              if (r.get("publication_year") or "").strip().isdigit()
                              else None),
            publication_evidence=(r.get("publication_evidence") or "").strip(),
            jurisdiction=(r.get("jurisdiction") or "").strip(),
            anon_term_years=(int(r["anon_term_years"])
                             if (r.get("anon_term_years") or "").strip().isdigit()
                             else None),
            note=(r.get("note") or "").strip(),
        )
        out[s.source_id] = s
    return out


def load_authority(path=None):
    path = path or os.path.join(DATA, "authority.tsv")
    out = {}
    for r in _read_tsv(path):
        dy = (r.get("death_year") or "").strip()
        try:
            dy = int(dy)
        except ValueError:
            dy = None
        a = AuthorRecord(
            author_key=r["author_key"].strip(),
            death_year=dy,
            qid=(r.get("qid") or "").strip(),
            verification_source=(r.get("verification_source") or "").strip(),
            verified_on=(r.get("verified_on") or "").strip(),
            note=(r.get("note") or "").strip(),
        )
        out[a.author_key] = a
    return out


# ---------------------------------------------------------------------------
# The gate
# ---------------------------------------------------------------------------

class ProvenanceGate:

    def __init__(self, decl=None, sources=None, authority=None):
        self.decl = decl or ProvenanceDeclaration()
        self.sources = sources if sources is not None else load_sources()
        self.authority = authority if authority is not None else load_authority()

    def admit(self, item):
        """-> (verdict, human-readable reason)."""
        src = self.sources.get(item.source_id)

        # science-safety first: generated content never admits
        if item.generated or (src and src.generated):
            return REJECT_GENERATED, (
                "content or a key column is model-generated; scoring it "
                "measures the model, not the tradition")

        # LICENCE BEFORE DATES -- doctrine 85, and the ORDER is the whole fix.
        #
        # Every admitting route below tests a DATE: route 1 an affirmation,
        # route 2 an author's death year, route 3 a publication year. A
        # non-commercial grant is none of those, so before this check existed
        # there was no position in the flow at which one could be refused --
        # `cc-by-nc-sa-4.0` over a 12th-century author admitted at route 2 on
        # the strength of the author being long dead, which is true and beside
        # the point. Marking the row `contested=true` did not save it either:
        # that only voids route 1, and REJECT_CONTESTED_NO_DATE is reached
        # further down, after route 2 has already returned.
        #
        # So this sits ahead of all three. An express NC restriction is a
        # property of the GRANT, not of the work's age, and no amount of age
        # cures it.
        marker = noncommercial_marker(src.licence if src else None)
        if marker:
            return REJECT_NONCOMMERCIAL, (
                f"source '{item.source_id}' carries an express non-commercial "
                f"restriction ({marker!r}); doctrine 85 -- the stated target "
                f"of this project is an MCP server beside Codex Musica, and a "
                f"grant that excludes commercial use is a REJECTION whatever "
                f"the dates say. Refused here rather than at fetch time by a "
                f"human remembering to read the licence")

        # route 1 -- express PD affirmation at source level
        if src and self.decl.allow_source_affirmation and not src.contested:
            lic = src.licence
            if src.pd_affirmed or lic in PD_AFFIRMATIONS:
                if lic in SOFTWARE_LICENCES and not src.pd_affirmed:
                    pass          # software tag alone is not an affirmation
                else:
                    return ADMIT_PD_AFFIRMED, (
                        f"source '{item.source_id}' affirms public domain "
                        f"({src.evidence or lic or 'stated'})")

        # route 2 -- verified date at item level
        rec = self.authority.get(item.author_key) if item.author_key else None
        if rec and rec.death_year is not None:
            if self.decl.strict and not rec.trusted():
                return REJECT_UNVERIFIED_DATE, (
                    f"death year {rec.death_year} for '{item.author_key}' is "
                    f"sourced to '{rec.verification_source or 'nothing'}', "
                    f"which is not an authority record")
            if rec.death_year <= self.decl.cutoff_death_year():
                return ADMIT_DATE_VERIFIED, (
                    f"author died {rec.death_year}, clears "
                    f"{self.decl.term_years}-year term "
                    f"(cutoff {self.decl.cutoff_death_year()})")
            return REJECT_TOO_RECENT, (
                f"author died {rec.death_year}, inside the declared "
                f"{self.decl.term_years}-year term")

        # route 3 -- anonymous/traditional work cleared by PUBLICATION year.
        # Only for items with no author: if an author is named, route 2 is the
        # correct test and falling through to publication would be a loophole.
        if not item.author_key:
            pub = item.pub_year or (src.publication_year if src else None)
            if pub is not None:
                src_term = src.anon_term_years if src else None
                if self.decl.override_source_terms or not src_term:
                    term = self.decl.anon_term_years
                else:
                    term = src_term
                juris = (src.jurisdiction if src else "") or "unspecified"
                if pub + term <= self.decl.current_year:
                    ev = (src.publication_evidence if src else "") or "stated"
                    return ADMIT_PUBLICATION_VERIFIED, (
                        f"anonymous work published {pub}, clears the {term}-year "
                        f"publication term for {juris} ({ev})")
                return REJECT_PUBLICATION_TOO_RECENT, (
                    f"anonymous work published {pub}, inside the {term}-year "
                    f"publication term for {juris}")

        if src and src.contested:
            return REJECT_CONTESTED_NO_DATE, (
                f"source '{item.source_id}' asserts a licence that cannot "
                f"cover its contents, and no verified author date is present")

        return REJECT_NO_EVIDENCE, (
            "no source PD affirmation and no verified author death year")

    def gate(self, items):
        """-> (admitted, ledger). Ledger is one row per item, always."""
        admitted, ledger = [], []
        for it in items:
            verdict, reason = self.admit(it)
            ledger.append({"item_id": it.item_id, "language": it.language,
                           "source_id": it.source_id,
                           "author_key": it.author_key,
                           "verdict": verdict, "reason": reason})
            if verdict in ADMITTED:
                admitted.append(it)
        return admitted, ledger


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def report(ledger, stream=sys.stdout):
    """Surviving N per language, plus why everything else was dropped."""
    per_lang = defaultdict(lambda: Counter())
    reasons = Counter()
    for row in ledger:
        per_lang[row["language"]][row["verdict"]] += 1
        if row["verdict"] not in ADMITTED:
            reasons[row["verdict"]] += 1

    total = len(ledger)
    kept = sum(1 for r in ledger if r["verdict"] in ADMITTED)
    print(f"\nPROVENANCE GATE — {kept}/{total} items admitted "
          f"({kept / total:.1%})" if total else "\nPROVENANCE GATE — no items",
          file=stream)

    print(f"\n  {'language':<12} {'admitted':>9} {'dropped':>8}  "
          f"{'survival':>8}", file=stream)
    print(f"  {'-' * 42}", file=stream)
    for lang in sorted(per_lang):
        c = per_lang[lang]
        a = sum(c[v] for v in ADMITTED)
        d = sum(c.values()) - a
        rate = a / (a + d) if (a + d) else 0.0
        print(f"  {lang:<12} {a:>9} {d:>8}  {rate:>7.1%}", file=stream)

    if reasons:
        print(f"\n  dropped, by reason:", file=stream)
        for v, n in reasons.most_common():
            print(f"    {n:>6}  {v}", file=stream)

    langs_alive = [l for l in per_lang
                   if any(per_lang[l][v] for v in ADMITTED)]
    langs_dead = [l for l in per_lang if l not in langs_alive]
    print(f"\n  languages surviving: {len(langs_alive)}", file=stream)
    if langs_dead:
        print(f"  languages eliminated entirely: "
              f"{', '.join(sorted(langs_dead))}", file=stream)
    return {"total": total, "admitted": kept,
            "languages_surviving": len(langs_alive),
            "languages_eliminated": sorted(langs_dead)}


def write_ledger(ledger, path=None):
    """The drop log is evidence; it gets written, not just printed."""
    path = path or os.path.join(DATA, "provenance_ledger.tsv")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, delimiter="\t",
                           fieldnames=["item_id", "language", "source_id",
                                       "author_key", "verdict", "reason"])
        w.writeheader()
        w.writerows(ledger)
    return path


if __name__ == "__main__":
    gate = ProvenanceGate()
    print("DECLARATION")
    for k, v in asdict(gate.decl).items():
        print(f"  {k}: {v}")
    print(f"\n  sources loaded:   {len(gate.sources)}")
    print(f"  authority records: {len(gate.authority)}")
    trusted = sum(1 for a in gate.authority.values() if a.trusted())
    print(f"  of which trusted:  {trusted}")
    print(f"  cutoff death year: {gate.decl.cutoff_death_year()} "
          f"(died this year or earlier to clear)")
