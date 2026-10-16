# Direct CI runner import repair

On integration `25a3b20debd5d1cbec304bc2ee358e2c0f960e65`, invoking the newly
registered producer test as a script from `lyric-harness` failed to import
`lyric_harness`. Earlier passes used module invocation or an injected PYTHONPATH,
so they did not establish the direct CI runner contract.

The only code change adds the same root `sys.path` bootstrap used by neighboring
`quality/test_pronunciation_choices.py`. The suite remains registered in CI and
all nine test bodies/assertions are unchanged. No production or generated HTML
changes.

Reproduction and verification, from `lyric-harness`:

```sh
env -u PYTHONPATH python3 quality/test_schema_instance_evidence.py
```

[Before](before.txt): `ModuleNotFoundError: No module named 'lyric_harness'`.
[After](after.txt): 9 tests pass on system Python 3.12.14.
The same direct invocation also passes on the [pinned Python 3.12.14 runtime](pinned.txt)
and [Python 3.13.5](313.txt), with PYTHONPATH explicitly removed in every run.
[Map check](map.txt) and [full counter check](counters.txt) pass without regeneration.

The generated HTML retains SHA-256
`ad8332b85263638c5da92b2c0401adad09da70e529720d81b37d4b5d155f19ad`.
No provider calls or hosted acceptance. Remote CI must qualify the new head separately.
