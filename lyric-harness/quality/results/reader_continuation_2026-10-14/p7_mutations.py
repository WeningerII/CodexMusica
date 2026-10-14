#!/usr/bin/env python3
"""P7 mutation proof; run with C or F2. Only in-memory module code is changed.

Mutations from BB8 faf976ae041f7553e4d126940e1c93fbd927806e,
findings_0af39c6f/repro/king-relation/e/mut/relations.mut*.diff.
F2 removes `not sy` from the current guard (the old `cut` restriction was
already removed upstream) and preserves the previous reading for non-stems.
Exit zero means the named mutation was killed by the focused regression.
"""
import pathlib, sys, unittest
root = pathlib.Path(__file__).resolve().parents[3]
sys.path[:0] = [str(root), str(root / 'quality')]
import quality.relations as RL
import test_reader as tests
source = pathlib.Path(RL.__file__).read_text()
mutant = sys.argv[1]
if mutant == 'C':
    old = 'sy = token_phon.syllabify(stem) if stem else []'
    new = "from quality.phonology.eng import English as _E\n                        sy = _E(fallback='high').syllabify(stem) if stem else []"
    test = 'test_final_stem_recovery_keeps_the_declared_judges_fallback_policy'
elif mutant == 'F2':
    old = 'if (not sy and ti == len(words) - 1 and ti != boundary'
    new = 'if (ti == len(words) - 1 and ti != boundary'
    source = source.replace('sy = token_phon.syllabify(stem) if stem else []', 'sy = (token_phon.syllabify(stem) or sy) if stem else sy')
    test = 'test_a_declared_broken_token_reading_precedes_stem_recovery'
else:
    raise ValueError(mutant)
assert source.count(old) == 1
exec(compile(source.replace(old, new), RL.__file__, 'exec'), RL.__dict__)
result = unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([tests.Normalisation(test)]))
killed = bool(result.failures) and not result.errors
print('MUTANT', mutant, 'KILLED' if killed else 'ERROR' if result.errors else 'SURVIVED')
sys.exit(0 if killed else 1)
