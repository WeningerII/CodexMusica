"""M-244 regression counterexample; run explicitly from lyric-harness."""

if __name__ == "__main__":
    import subprocess
    from quality import test_relations_null as t
    from quality import relations_null as n
    t.s16_observation_is_shared_but_every_null_is_measured()
    assert not t.FAIL
    old = subprocess.check_output(['git', 'show', 'fe9181f7:lyric-harness/quality/relations_null.py'], text=True)
    start = old.index('def sweep(')
    stop = old.index('\n\n# ---', start)
    # Only the old sweep function is installed in the current module namespace;
    # the test's spy reaches the same _measure in both arms.
    exec(old[start:stop], n.__dict__)
    t.FAIL.clear()
    t.s16_observation_is_shared_but_every_null_is_measured()
    print('CONTROL: original sweep failed', len(t.FAIL), 'checks')
    assert len(t.FAIL) == 2 and all('measured once' in x for x in t.FAIL), t.FAIL
