# Pre-registration — the schema door's END-RHYME reading, split from its satisfaction

**Registered 2026-09-18, before the numbers.** `MISSING.md` M-140's ruling, taken
under the owner's delegation, is a REPORTING rule and not a threshold:

> schema satisfaction alone, at a LINE END, is reported under its own name
> rather than as end rhyme, and the audible family (M-120's derived
> nucleus-and-coda agreement) is what the end-rhyme reading requires. A pair
> that satisfies a schema and nothing else is still satisfied, still printed,
> and no longer counted as a sound the listener gets.

Because that moves recorded readings, it lands under this registration rather
than as an edit.

## What is NOT in dispute, and is not re-opened here

The 77-schema default stays. The measurement that opened M-140 is not
challenged: the schema door admits 23.9–24.7% of random CMUdict pairs against
1.18% of Shakespeare's mandated pairs failing, an order of magnitude past the
1.5x that got `theta_coda` recalibrated. Retuning the door to shrink that number
is doctrine 58's error and stays refused; narrowing the default would delete the
capability M-116 added on the owner's ruling. **Nothing in this registration
changes which pairs are SATISFIED.** Every pair satisfied today is satisfied
after, by the same judge, with the same names.

## The hypothesis

**H.** Of the mandated pairs the scalar door fails and the whole-vocabulary
schema door rescues, a MINORITY are rescued by a schema a listener would hear as
the lines rhyming, and the majority are rescued by a schema that binds somewhere
else or lets the nucleus or the coda differ.

If H holds, then reporting the whole rescue population under one heading has
been reporting a relation the reader takes as end rhyme, for pairs where it is
not, and the split is the repair.

## The predicate, declared and derived

`relations.audible_as_end_rhyme(schema)`, which is M-120's, unchanged and not
re-derived here: BOTH member spans read the line-final token AND the schema
requires the nucleus AND the coda to agree. A rescue is counted AUDIBLE when
**any** of the schemas that answered it is audible, and NOT-AUDIBLE otherwise.
The `any` is deliberate and is the conservative direction for H: it can only
move a pair INTO the audible half, so it can only make H harder to hold.

## The population

Every mandated pair in `pairs_schema_satisfied` over the maintained sonnet
battery (`battery.py`, 152 sonnets under `SONNET_SCHEME`), plus the shipped
lyric fixtures and `songs/` drafts the battery already reads. The counts are
reported per population and **never pooled**, because a sonnet's mandated pairs
and a song's are different objects (doctrine 79, and the M-140 entry's own note
that the 23.30% chance rate is a one-word-line figure that does not transfer).

## The statistic

Three counts, never summed:

1. `schema_audible` — rescued, and at least one answering schema is audible.
2. `schema_inaudible` — rescued, and none is.
3. `scalar` — satisfied by the scalar door, untouched by this change.

Reported as counts with their share of the rescue population, and the answering
schema names listed per half.

## The falsifiers, each with the number that fires it

### E1 — the split is empty in one direction, so the heading was already right

If `schema_inaudible` is **0** over every population, then every rescue already
was an end-rhyme reading, the current heading claims nothing false, and the
split is a distinction with no members. **The reporting change is then WITHDRAWN**
and the entry records that the door is wide but not wide in the way the ruling
assumed.

### E2 — the split is total, so the heading is not the defect

If `schema_audible` is **0** over every population, the schema door never
rescues an audible pair at all. The ruling's premise — that some rescues are
end rhyme and some are not — is false in the other direction, and what is owed
is a statement that the rescue is NEVER an end-rhyme reading, which is a
stronger and simpler sentence than the split.

### E3 — a verdict moves

Any pair whose `satisfied_by`, `relation`, `score` or violation status differs
before and after. **This must be zero.** The change is a rendering, and the
battery's `mandated / judged / refused / violations` quadruple must be
byte-identical either side of it. A single moved verdict withdraws the whole
change, because a reporting rule that regrades is not a reporting rule.

## What is adopted if it holds

The `SCHEMA DEFAULT` line reports the two halves apart, under their own names,
with the audible half named as the end-rhyme reading and the inaudible half
named by the schemas that answered. The chance-rate clause M-140's disclosure
half already added stays where it is, beside the door, unchanged.

## What this will NOT claim

That a not-audible rescue is wrong, a defect, or a worse pair. It is a real
relation the grade judges correctly, and doctrine 24 is the rule: the split
RELABELS and deletes nothing. That the audible half is a rate transferable to
any other population. That a listener was measured — `audible_as_end_rhyme` is
a derivation over the registry's declared channels, not an experiment on
hearers, and M-120 says so in its own docstring.

## The runner

`python3 quality/schema_end_reading.py` derives the three counts over each
population and prints them apart; `--check` re-derives them against the
committed figures. Registered before it was run.
