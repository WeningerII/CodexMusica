"""M-170 fixed-word field comparison and held-instance declaration counterexample.

Run from lyric-harness. Writes JSON to stdout; no code, data or pin is changed.
These are counterexamples to universal equivalence, not a corpus rate.
"""
import dataclasses
import hashlib
import json
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from lyric_harness import Declaration, Lexicon
from quality.features import RhymeField
from quality.revise import Reviser


def main():
    lex, decl = Lexicon(), Declaration()
    field, reviser = RhymeField(lex, decl), Reviser(lex=lex, decl=decl)
    out = {'scope': 'fixed-word counterexamples, no sharing or held-Reviser implementation',
           'declaration': dataclasses.asdict(decl), 'words': []}
    for word in ('stone', 'door', 'light'):
        start = time.process_time()
        feature = [row[0] for row in field.field(word)]
        feature_cpu = time.process_time()-start
        start = time.process_time()
        candidate = reviser._field_one(word)
        candidate_cpu = time.process_time()-start
        out['words'].append(dict(word=word, feature_count=len(feature),
                                reviser_count=len(candidate),
                                feature_only=sorted(set(feature)-set(candidate)),
                                reviser_only=sorted(set(candidate)-set(feature)),
                                feature_cpu=feature_cpu, reviser_cpu=candidate_cpu))
    # The per-instance matrix key omits the declaration; it is fixed for the
    # lifetime of the shipped Reviser. Reusing that instance for another
    # declaration is NOT licensed by a warm cache hit.
    lines = ['we keep the stone', 'they shut the door']
    before = reviser._matrix(lines)[3]
    changed = dataclasses.replace(decl, channel_weights={
        'nucleus': 0., 'coda': 0., 'onset': 1., 'stress': 0.})
    reviser.decl = changed
    held = reviser._matrix(lines)[3]
    fresh = Reviser(lex=lex, decl=changed)._matrix(lines)[3]
    out['held_instance'] = dict(lines=lines, before=before[0][1],
                               held=held[0][1], fresh=fresh[0][1],
                               stale=held != fresh,
                               changed_declaration=dataclasses.asdict(changed))
    if not any(row['feature_only'] or row['reviser_only'] for row in out['words']):
        raise RuntimeError('fixed words did not distinguish the fields')
    if not out['held_instance']['stale']:
        raise RuntimeError('held-instance counterexample no longer reproduces')
    out['source_sha256'] = {str(p): hashlib.sha256(p.read_bytes()).hexdigest()
                           for p in (Path('lyric_harness.py'), Path('quality/features.py'),
                                     Path('quality/revise.py'), Path(__file__))}
    print(json.dumps(out, indent=2, sort_keys=True))


if __name__ == '__main__':
    main()
