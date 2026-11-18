# Andrej’s meter and planner findings

[Review comment](https://github.com/WeningerII/CodexMusica/pull/857#issuecomment-6968098933) · [Pinned main](https://github.com/WeningerII/CodexMusica/commit/d336c17f51836f03e9a99e7a6a55cbbafa86dbf1) · [Stage 4 head](https://github.com/WeningerII/CodexMusica/commit/d2f3c709fad2dc4c1dd074cb17052834a8d6cf59) · [Interpretation and line-specific sources](comparison/meter.md#what-the-two-repository-snapshots-actually-accept)

On November 18, 2026, both snapshots were read directly through the GitHub connector. The scheme module has the same Git blob at both revisions, `5d47e5c0cea8291c060f92d3b8e682bb7cabee98`. The workflow blob is also unchanged, `b4d3d37654fbdbef794b862c9d570f88c0fd3a7e`. The plan and section registry differ between revisions. This historical comparison made no live song generation, calendar, performance or deployment check.

| Finding | Action and access |
|---|---|
| 10. Local case and named scheme | Executed the pinned parser, refrain discriminator, and name lookup at each revision. Both produce four unsupported *identity* pairs if the local diagram notation is supplied literally. Uppercase-only preserves the intended rhyme partition without identity, but that partition has no registered name. The erroneous named partition is present at both revisions. The production correction remains with its repository owner. |
| 11. Volunteered and declared plans | Read both samplers, per-function scheme tables, per-occurrence line groups, return generation, exact-total guards, connector input fields and per-form minima. Executed the two scheme branches and the singleton case with three seeds at both revisions. Section rhyme groups are obligations within sections. Returning text can span sections; it is a different relation from a requested continuous rhyme chain. The lower-level mandate interface can refer to arbitrary global line numbers. |
| 12. Inventory claims | Executed the section registry’s placement check at both revisions. Burden first returned one placement finding at index zero; verse then burden returned none. The grader marks this finding advisory, while the planner excludes that ordering. Extended AABA needs a more qualified answer than “possible only in Stage 4”. Main has a default once convention and already lifts it for a stated minimum of two bridges. We executed that exact policy check. The Stage 4 registry marks bridge open. The placement function at both revisions accepts an otherwise admissible six-section ordering with two interior bridges. This checks placement only; no request was claimed to produce an exact six-section plan. |
| Historical checks | The 1,624 field comparisons and original 12 comparator cases plus three assertions are earlier manual records. Their scripts and vectors were not shipped. They are now labeled accordingly in the [original meter review](R2-meter.md#validation) and [implementation account](comparison/meter.md#pinned-implementation-and-limits). This review’s new checks below are separate. |
| Units and positions | For every one of 105 ID/form pairs the measured unit and position are now separate columns. For the M053 Spenserian comparison, the position is line 9 and the measured dimension comprises syllables or feet under the stated reading. The ID summary retains the 203 original rows, with empty associations for the 116 unlinked IDs. Editorial, historical and witness names in the meter files remain review-only. |

## Replaying the new checks

Use a configured CodexMusica checkout at either exact SHA, from the `lyric-harness` directory. The commands below exercise the public module functions, plus the two private planner functions whose behavior was challenged. In the review environment the checks were executed on those same unmodified definitions and registry values extracted from the GitHub files, without running the entire production pipeline.

```sh
python3 -B - <<'PY'
import random
import subprocess
from quality import grid, plan, schemes

main = "d336c17f51836f03e9a99e7a6a55cbbafa86dbf1"
stage4 = "d2f3c709fad2dc4c1dd074cb17052834a8d6cf59"
head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
assert head in {main, stage4}
local = "aBaB ccDD eFFe GG"
assert schemes.is_refrain_notation(local)
assert schemes.parse_refrain(local).refrains == {
    "B": (2, 4), "D": (7, 8), "F": (10, 11), "G": (13, 14),
}
plain = "ABABCCDDEFFEGG"
assert not schemes.is_refrain_notation(plain)
assert schemes.parse(local) == schemes.parse(plain)
assert schemes.identify(schemes.parse(plain)) is None
assert "Onegin stanza" in schemes.identify(schemes.parse("ABABCBCDCDEDEE"))["names"]

assert grid.SECTION_FUNCTIONS["burden"].adjacent_after == "verse"
assert [(code, i) for code, i, _ in grid.placement_findings(
    ["burden", "verse", "burden"]
)] == [("SECTION_NOT_ADJACENT", 0)]
assert grid.placement_findings(["verse", "burden"]) == []
assert grid.placement_findings(["verse", "verse", "bridge", "verse", "bridge", "verse"]) == []
assert grid.SECTION_FUNCTIONS["bridge"].recurrence == ("once" if head == main else "open")
if head == main:
    assert plan._recurrence_policy([]) == {}
    assert plan._recurrence_policy([("sections.bridge", "=", 2)])["bridge"] == "named count lower bound"
for line_count in (1, 2, 3, 5, 11):
    for seed in (0, 1, 11):
        scheme, pool = plan._scheme_for(line_count, random.Random(seed))
        assert len(scheme) == line_count
        assert (len(set(scheme)) == line_count) == (line_count == 1)
        assert pool == (1 if line_count == 1 else schemes.bell(line_count) - 1)
print(head, "parser, named partition, scheme sampling and placement checks passed")
PY
```
