# Answer lines and call-and-response

A blueprint can declare directed relationships between lyric lines within one
section instance. The `line_relations` array uses **1-based positions in the
blueprint's `lines` array**, not physical file lines or bar numbers:

```json
{
  "line_relations": [
    {
      "kind": "call_and_response",
      "call": 1,
      "response": 2,
      "source": "writer declaration",
      "call_voice": "leader",
      "response_voice": "group"
    },
    {
      "kind": "answer",
      "call": 3,
      "response": 4,
      "source": "printed question/answer labels"
    }
  ]
}
```

This fragment belongs alongside the blueprint's existing `sections` and
`lines`. `answer` assigns call/answer roles; `call_and_response` assigns
call/response roles. Voice labels are optional and do not have to differ.
The source is required provenance for the declaration, not evidence checked
by the program. The response must follow its call within the same concrete
section instance. It need not be adjacent. Declare multiple links for a call
with several response lines or a response answering several call lines.

Missing `line_relations` means **undeclared**; `[]` explicitly declares no
links. Invalid kinds, fields, coordinates, sources, duplicates and cross-block
links are refused by the shared blueprint validator. Section names alone
cannot link two repeated sections. Null is not a valid JSON declaration.

The existing `function` command prints these links, source, optional voices
and current words. Python callers use `grid.song_from_blueprint`, then
`grid.song_function_report(song)["line_relations"]` or
`song.line_relation_report()`. Replacing a song line's text changes the report
without changing its declared role. Inserting, deleting or reordering lines
requires updating their coordinates, as with other blueprint declarations.

`quality/line_relations.py` owns the functional registry. It stays separate
from the phonological schemas in `quality/relations.py`: neither rhyme nor
identity proves that a line replies to another. These declarations do not
certify semantic coherence, create rhyme obligations, change chorus-return
classification, or automatically annotate corpus text or planner output.
