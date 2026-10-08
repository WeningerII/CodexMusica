"""The Library method reference, generated from the installed engine."""
from __future__ import annotations

import inspect
from .contracts import CONTRACT_VERSION, digest, json_safe, method_id

LANGUAGES = ("eng", "fas", "fin", "cym", "non", "ltc", "msa", "san", "som")
NATIVE_METHODS = {
    "eng": ("reading", "coverage", "relations"),
    "fas": ("rhymes", "alliterates", "radif", "qafiya", "coverage"),
    "fin": ("rhymes", "alliterates", "line_alliteration", "rhyme_declaration"),
    "cym": ("rhymes", "alliterates", "cynghanedd_scan", "rhyme_declaration"),
    "non": ("skothending", "adalhending", "line_hending", "stanza", "notation_report"),
    "ltc": ("rhymes", "readings", "script_report"),
    "msa": ("rhymes", "alliterates", "abab", "echo_depth", "rhyme_declaration"),
    "san": ("rhymes", "alliterates", "scan_pada", "prasa", "antya_prasa", "prasa_depth"),
    "som": ("alliterates", "higaad", "readability"),
}

# Engine helpers and a reader traversal are different interfaces. These are
# the independently traversable whole-reading adapters installed below.
NATIVE_WORK_METHODS = {
    "eng": (), "fas": ("radif", "qafiya", "coverage"),
    "fin": ("line_alliteration",), "cym": ("cynghanedd_scan",),
    "non": ("stanza", "notation_report"), "ltc": (),
    "msa": ("abab",), "san": ("prasa", "antya_prasa"),
    "som": ("higaad", "readability"),
}

REMEDIES = {
    "prominence": "This method requires the selected phonology's declared prominence channel.",
    "tone": "Supply a phonology that declares 平/仄 tone, not lexical stress.",
    "stanza": "Supply sourced stanza boundaries; refused source marks cannot be replaced silently.",
    "caesura": "Supply sourced or explicitly declared caesura positions.",
    "lifts": "Supply the declared line's lift positions.",
    "beat": "Declare the beat grid and its basis; this reader does not infer beats from audio or text.",
    "refrain_tail": "Declare or source a shared trailing refrain run.",
    "stub_resolution": "Supply the edition's reference-to-lines map.",
    "tonal_template": "Declare the form's 平仄 pattern for each participating line.",
    "sense": "Supply an installed, versioned sense resource or explicit sense declarations.",
    "morphology": "This method requires an installed native morphology resource.",
    "lexicon": "This method requires an installed native lexeme resource.",
    "orthography": "Supply a sourced orthographic comparison surface.",
    "earlier": "Supply a sourced historical phonology surface.",
    "poet": "Supply a sourced dialect phonology surface.",
    "delivered": "Supply a sourced delivered pronunciation surface.",
    "sung": "Supply a sourced sung pronunciation surface.",
    "slang": "Supply the absent member from a declared slang lexicon.",
}


def build_registry() -> dict:
    from quality import relations as RL, rhyme_types as RT, grid as GR
    from quality.phonology import get
    methods = []
    for name, s in RL.all_schemas().items():
        methods.append({"id": method_id("schema", name), "namespace": "schema", "name": name,
                        "reader_requestable": True,
                        "aliases": list(s.aka), "definition": s.note,
                        "normative": s.normative, "required_capabilities": list(s.capabilities()),
                        "span_rules": json_safe(s.spans), "figure": json_safe(s.figure),
                        "alignment": s.align, "unmatched": s.unmatched,
                        "channels": [{"channel": c.channel, "scope": c.scope,
                                      "surface": c.surface, "predicate": c.predicate.name,
                                      "required": c.required} for c in s.channels],
                        "pair_local": RL.pair_scope_representable(s),
                        "provenance": {"canon": list(RL.canon_entries(s)),
                                       "traditions": json_safe(s.traditions)},
                        "scopes": {lang: RL.tradition_scope(s, lang) for lang in LANGUAGES},
                        "remedies": {c: REMEDIES.get(c, "Supply the installed, versioned quotient named " + c)
                                     for c in s.capabilities()}})
    for name in RT.CLASS_RELATIONS:
        methods.append({"id": method_id("class", name), "namespace": "class", "name": name,
                        "reader_requestable": False, "reader_surface": "native_pair.class_verdicts"})
    labels = sorted({label for labels in RT.NAMED.values() for label in labels})
    for label in labels:
        methods.append({"id": method_id("type", label), "namespace": "type", "name": label,
                        "reader_requestable": False, "reader_surface": "native_pair.type_coordinate",
                        "coordinates": [json_safe(k) for k, names in RT.NAMED.items() if label in names]})
    profiles = []
    for lang in LANGUAGES:
        phon = get(lang)
        profiles.append({"language": lang, "declaration": json_safe(phon.declaration())})
        for name in dict.fromkeys(("relations", *NATIVE_METHODS[lang])):
            fn = getattr(phon, name, None)
            if not callable(fn):
                continue
            methods.append({"id": method_id("native", lang + "." + name), "namespace": "native",
                            "name": lang + "." + name, "language": lang,
                            "reader_requestable": name == "relations" or name in NATIVE_WORK_METHODS[lang],
                            "definition": inspect.getdoc(fn) or "", "signature": str(inspect.signature(fn))})
    functions = GR.SECTION_FUNCTIONS
    if isinstance(functions, dict):
        functions = functions.keys()
    for name in sorted(functions):
        spec = GR.SECTION_FUNCTIONS[name]
        methods.append({"id": method_id("function", name), "namespace": "function", "name": name,
                        "reader_requestable": False, "reader_surface": "form_result",
                        "scope": spec.kind, "definition": spec.gloss,
                        "aliases": list(spec.aliases), "conditions": json_safe(spec)})
    capabilities = sorted({c for s in RL.REGISTRY.values() for c in s.capabilities()})
    result = {"contract_version": CONTRACT_VERSION, "methods": methods, "profiles": profiles,
              "capabilities": capabilities, "counts": {"schemas": len(RL.REGISTRY),
                  "types": len(labels), "type_cells": len(RT.NAMED),
                  "classes": len(RT.CLASS_RELATIONS), "functions": len(functions),
                  "pair_local": sum(RL.pair_scope_representable(s) for s in RL.REGISTRY.values()),
                  "whole_figures": sum(not RL.pair_scope_representable(s) for s in RL.REGISTRY.values())}}
    result["registry_hash"] = digest(result)
    return result


def registry_by_id() -> dict:
    return {row["id"]: row for row in build_registry()["methods"]}


if __name__ == "__main__":
    from .contracts import canonical_json
    print(canonical_json(build_registry()))
