"""A deterministic stand-in for the writer behind `--propose=call:`.

    PYTHONPATH=quality/fixtures FAKE_WRITER_SPEC=spec.json \\
        python3 lyric_harness.py revise FILE --propose=call:fake_writer:make ...

No model and no network: every reply is read from a JSON spec, so a test can
say exactly what the writer sent back and the loop's handling of it is the
only thing that varies. Built for the 2026-11-20 bug hunt's revise-loop
findings (5, 25, 28 and 29), whose repros all used a throwaway copy of this.

THE SPEC is one JSON object:

    {"L3": ["first reply to a question about L3", "second reply", ...],
     "group": ["reply to the first group question", ...]}

A LINE question is recognised by its own heading, `REVISE ONE LINE — L<n>`
(`quality/propose.py:render_line`); every other question is a GROUP question.
The k-th question about a line gets the k-th reply in that line's list, and
the k-th group question the k-th reply under `group`. Past the end of a list
the writer DECLINES: it returns `None`, which is not a string, so
`ModelProposer` reads it as a writer with nothing to offer and not as a reply
it could not read. A reply may be any JSON value, so a spec can also send a
non-string through the seam.

`FAKE_WRITER_SPEC` names the spec file. `FAKE_WRITER_LOG`, when set, names a
directory that receives each question as `pNN.txt`, in the order asked.
`make(spec, log)` takes both directly for a test that runs the loop in its own
process; `calls` on the returned callable is the list of questions it was
asked, each `(kind, prompt)`.
"""

import json
import os
import re

_LINE_QUESTION = re.compile(r"^REVISE ONE LINE — L(\d+) ")


def make(spec=None, log=None):
    """-> `call(prompt) -> reply`, the callable a `ModelProposer` takes."""
    if spec is None:
        with open(os.environ["FAKE_WRITER_SPEC"], encoding="utf-8") as fh:
            spec = json.load(fh)
    if log is None:
        log = os.environ.get("FAKE_WRITER_LOG") or None
    asked = {}

    def call(prompt):
        head = _LINE_QUESTION.match(prompt)
        key = f"L{head.group(1)}" if head else "group"
        call.calls.append((key, prompt))
        if log:
            os.makedirs(log, exist_ok=True)
            name = os.path.join(log, f"p{len(call.calls):02d}.txt")
            with open(name, "w", encoding="utf-8") as fh:
                fh.write(prompt)
        k = asked.get(key, 0)
        asked[key] = k + 1
        replies = spec.get(key) or []
        return replies[k] if k < len(replies) else None

    call.calls = []
    return call
