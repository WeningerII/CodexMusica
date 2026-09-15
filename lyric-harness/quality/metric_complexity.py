"""Declared metric complexity (MISSING.md C-3), never inferred performance.

Offsets/spans/periods use section-local, zero-based denominator pulses.
Modulation note values use whole notes; hypermeter uses bars. Rubato maps
score pulses to relative performed pulses, NOT seconds. These annotations
report rhythmic intent; they do not assign syllables or replace BeatGrid.
"""
from dataclasses import asdict, dataclass, fields
from fractions import Fraction

from quality.meter import exact_integer, exact_number, guard_expansion, lcm_fraction


def _positive(value, name):
    value = exact_number(value, name)
    if value <= 0:
        raise ValueError(f"{name} must be positive")
    return value


def _normalise(obj, positive=(), nonnegative=(), integers=()):
    for name in positive:
        object.__setattr__(obj, name, _positive(getattr(obj, name), name))
    for name in nonnegative:
        value = exact_number(getattr(obj, name), name)
        if value < 0:
            raise ValueError(f"{name} must be nonnegative")
        object.__setattr__(obj, name, value)
    for name in integers:
        object.__setattr__(obj, name, exact_integer(getattr(obj, name), name, 1))


def _positions(period, phase, start, span):
    end = start + span
    first = phase + (-((phase - start) // period)) * period
    count = max(0, -((first - end) // period))
    guard_expansion(count, "metric complexity positions")
    return tuple(first + i * period for i in range(count))


def _json(value):
    if isinstance(value, Fraction):
        return str(value)
    if isinstance(value, dict):
        return {k: _json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json(v) for v in value]
    return value


@dataclass(frozen=True)
class MetricModulation:
    """Old pivot duration equals new pivot duration across a tempo change.

    BPMs count the explicitly named old/new beat units. Old quarter = new dotted
    quarter gives 3/2 times the BPM when both beats are quarters.
    Without old_bpm, only the exact tempo multiplier is known.
    """
    old_pivot: object
    new_pivot: object
    old_beat: object
    new_beat: object
    at: object = 0
    old_bpm: object = None

    def __post_init__(self):
        _normalise(self, positive=("old_pivot", "new_pivot", "old_beat", "new_beat"),
                   nonnegative=("at",))
        if self.old_bpm is not None:
            object.__setattr__(self, "old_bpm", _positive(self.old_bpm, "old_bpm"))

    @property
    def multiplier(self):
        return self.new_pivot * self.old_beat / (self.old_pivot * self.new_beat)

    def result(self):
        return {"tempo_multiplier": self.multiplier,
                "new_bpm": None if self.old_bpm is None else self.old_bpm * self.multiplier}


@dataclass(frozen=True)
class Tuplet:
    """count equal notes in the time of normal notes of note_pulses each.

    parent_scale is the enclosing tuplet's duration multiplier, or its nested
    product. It changes the span as well as every note; it is never inferred.
    """
    count: int
    normal: int
    note_pulses: object
    start: object = 0
    parent_scale: object = 1

    def __post_init__(self):
        _normalise(self, positive=("note_pulses", "parent_scale"),
                   nonnegative=("start",), integers=("count", "normal"))
        guard_expansion(self.count, "tuplet notes")

    @property
    def span(self):
        return self.normal * self.note_pulses * self.parent_scale

    def result(self):
        duration = self.span / self.count
        return {"span": self.span, "note_duration": duration,
                "scale": Fraction(self.normal, self.count) * self.parent_scale,
                "onsets": tuple(self.start + i * duration for i in range(self.count))}


@dataclass(frozen=True)
class Hemiola:
    """A declared regrouping between two and three equal accents in one span.

    mode='successive' describes reinterpretation of the reference grouping;
    mode='simultaneous' describes both layers sounding. No barline changes.
    """
    span: object
    start: object = 0
    target_groups: int = 3
    mode: str = "successive"

    def __post_init__(self):
        _normalise(self, positive=("span",), nonnegative=("start",), integers=("target_groups",))
        if self.target_groups not in (2, 3) or self.mode not in ("successive", "simultaneous"):
            raise ValueError("hemiola requires target_groups 2 or 3 and successive/simultaneous mode")

    def result(self):
        def layer(n):
            return tuple(self.start + self.span * i / n for i in range(n))
        return {"reference_onsets": layer(5 - self.target_groups),
                "target_onsets": layer(self.target_groups)}


@dataclass(frozen=True)
class Swing:
    """Continuous positive long:short ratio over each pair, including 1:1.

    pair_span must be named: swinging eighths and sixteenths are different.
    Ratios below one are supported as reversed swing, not silently clamped.
    """
    ratio: object
    pair_span: object
    pairs: int
    start: object = 0

    def __post_init__(self):
        _normalise(self, positive=("ratio", "pair_span"), nonnegative=("start",), integers=("pairs",))
        guard_expansion(2 * self.pairs, "swing notes")

    @property
    def span(self):
        return self.pairs * self.pair_span

    def result(self):
        first = self.pair_span * self.ratio / (1 + self.ratio)
        return {"durations": (first, self.pair_span - first),
                "onsets": tuple(self.start + i * self.pair_span + offset
                                for i in range(self.pairs) for offset in (0, first))}


@dataclass(frozen=True)
class Rubato:
    """Piecewise-linear score -> relative performed pulse map, if declared.

    Empty anchors express rubato/senza misura intent with timing UNKNOWN.
    No tempo, equal-time compensation, or underlying regular beat is invented.
    """
    span: object
    start: object = 0
    mode: str = "rubato"
    anchors: tuple = ()

    def __post_init__(self):
        _normalise(self, positive=("span",), nonnegative=("start",))
        if self.mode not in ("rubato", "senza_misura"):
            raise ValueError("rubato mode must be rubato or senza_misura")
        if not isinstance(self.anchors, (list, tuple)):
            raise ValueError("rubato anchors must be an array of [score, performed] pairs")
        guard_expansion(len(self.anchors), "rubato anchors")
        anchors = []
        for pair in self.anchors:
            if not isinstance(pair, (list, tuple)) or len(pair) != 2:
                raise ValueError("rubato anchors require [score, performed] pairs")
            anchors.append(tuple(exact_number(x, "rubato anchor") for x in pair))
        if anchors:
            if len(anchors) < 2 or anchors[0] != (0, 0) or anchors[-1][0] != self.span:
                raise ValueError("rubato anchors must run from [0, 0] to the score span")
            if any(b[0] <= a[0] or b[1] <= a[1] for a, b in zip(anchors, anchors[1:])):
                raise ValueError("rubato score and performed coordinates must strictly increase")
        object.__setattr__(self, "anchors", tuple(anchors))

    def performed_at(self, score):
        score = exact_number(score, "score offset")
        if not 0 <= score <= self.span:
            raise ValueError("score offset is outside rubato span")
        if not self.anchors:
            return None
        for (x0, y0), (x1, y1) in zip(self.anchors, self.anchors[1:]):
            if x0 <= score <= x1:
                return y0 + (score - x0) * (y1 - y0) / (x1 - x0)

    def result(self):
        return {"timing": "declared_relative_map" if self.anchors else "unknown",
                "performed_span": self.performed_at(self.span)}


@dataclass(frozen=True)
class Hypermeter:
    """Ordered groups of whole BARS, with phase relative to section bar zero."""
    groups: tuple
    phase: int = 0

    def __post_init__(self):
        if not isinstance(self.groups, (list, tuple)) or not self.groups:
            raise ValueError("hypermeter groups must be a nonempty array")
        guard_expansion(len(self.groups), "hypermeter groups")
        object.__setattr__(self, "groups", tuple(exact_integer(g, "hypermeter group", 1) for g in self.groups))
        phase = exact_integer(self.phase, "hypermeter phase", 0)
        if phase >= sum(self.groups):
            raise ValueError("hypermeter phase must be smaller than its period")
        object.__setattr__(self, "phase", phase)

    def result(self, bars):
        period, offset, heads = sum(self.groups), 0, []
        guard_expansion(bars, "hypermeter bars")
        for group in self.groups:
            heads.extend(_positions(Fraction(period), Fraction(self.phase + offset), 0, bars))
            offset += group
        return {"period_bars": period, "cycle_heads": _positions(Fraction(period), Fraction(self.phase), 0, bars),
                "group_heads": tuple(sorted(heads))}


@dataclass(frozen=True)
class MetricDissonance:
    """Two declared periodic accent layers, not a perceptual dissonance score.

    Unequal non-nesting periods give grouping dissonance; non-aligned phases
    give displacement. Both may be present. Nested aligned layers are retained
    as consonant instead of labelling every pair of levels dissonant.
    """
    reference_period: object
    competing_period: object
    span: object
    reference_phase: object = 0
    competing_phase: object = 0
    start: object = 0

    def __post_init__(self):
        _normalise(self, positive=("reference_period", "competing_period", "span"),
                   nonnegative=("reference_phase", "competing_phase", "start"))
        if self.reference_phase >= self.reference_period or self.competing_phase >= self.competing_period:
            raise ValueError("metric dissonance phases must be smaller than their periods")

    def result(self):
        small, large = sorted((self.reference_period, self.competing_period))
        period = lcm_fraction(small, large)
        # The common rational tick is gcd(a,b) = a*b/lcm(a,b).
        tick = small * large / period
        return {"grouping": (large / small).denominator != 1,
                "displacement": (self.competing_phase - self.reference_phase) % tick != 0,
                "composite_period": period,
                "reference_onsets": _positions(self.reference_period, self.reference_phase, self.start, self.span),
                "competing_onsets": _positions(self.competing_period, self.competing_phase, self.start, self.span)}


_KINDS = {"metric_modulation": MetricModulation, "tuplet": Tuplet,
          "hemiola": Hemiola, "swing": Swing, "rubato": Rubato,
          "hypermeter": Hypermeter, "metric_dissonance": MetricDissonance}


def read_complexity(raw, bars, pulses):
    """Strict optional section `metric_complexity` JSON reader; no defaults inferred.

    Missing field = empty declaration. Unknown keys/kinds and out-of-section
    spans are refused, so a misspelled request cannot quietly disappear.
    """
    if not isinstance(raw, (list, tuple)):
        raise ValueError("metric_complexity must be an array")
    guard_expansion(len(raw), "metric complexity declarations", 1000)
    bars = exact_integer(bars, "complexity section bars", 1)
    pulses = _positive(pulses, "complexity section pulses")
    out, expanded = [], 0
    for item in raw:
        if not isinstance(item, dict) or not isinstance(item.get("kind"), str) or item["kind"] not in _KINDS:
            raise ValueError("metric_complexity requires a known kind: " + ", ".join(_KINDS))
        cls = _KINDS[item["kind"]]
        kwargs = {k: v for k, v in item.items() if k != "kind"}
        if set(kwargs) - {f.name for f in fields(cls)}:
            raise ValueError(f"unknown {item['kind']} fields: {sorted(set(kwargs) - {f.name for f in fields(cls)})}")
        try:
            event = cls(**kwargs)
        except TypeError as exc:
            raise ValueError(f"invalid {item['kind']} declaration: {exc}") from None
        if isinstance(event, MetricModulation):
            if event.at >= bars * pulses:
                raise ValueError("metric modulation is outside its section")
        elif not isinstance(event, Hypermeter) and event.start + event.span > bars * pulses:
            raise ValueError(f"{item['kind']} span is outside its section")
        # Bound the aggregate BEFORE expanding any event, not just each row.
        if isinstance(event, Tuplet):
            expanded += event.count
        elif isinstance(event, Swing):
            expanded += 2 * event.pairs
        elif isinstance(event, Hemiola):
            expanded += 5
        elif isinstance(event, Rubato):
            expanded += len(event.anchors)
        elif isinstance(event, Hypermeter):
            expanded += bars * 2
        elif isinstance(event, MetricDissonance):
            expanded += sum(-(-event.span // p) + 1 for p in (event.reference_period, event.competing_period))
        guard_expansion(expanded, "section metric complexity positions")
        out.append((item["kind"], event))
    return tuple(out)


def complexity_report(raw, bars, pulses):
    return [_json({"kind": kind, "declaration": asdict(event),
                   "result": event.result(bars) if isinstance(event, Hypermeter) else event.result()})
            for kind, event in read_complexity(raw, bars, pulses)]
