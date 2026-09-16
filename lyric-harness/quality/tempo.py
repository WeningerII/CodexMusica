"""Declared tempo and exact elapsed time (MISSING.md C-5).

Positions and beat_value are whole-note fractions, independent of a meter's
pulse denominator. Changes are instantaneous, right-continuous steps, never
inferred accelerandi. Results are conditional on the supplied tempo, not audio.
"""
from dataclasses import dataclass
from fractions import Fraction

from quality.meter import exact_number, guard_expansion, MAX_BLUEPRINT_ITEMS


def positive(value, name):
    value = exact_number(value, name)
    if value <= 0:
        raise ValueError(f"{name} must be positive")
    return value


@dataclass(frozen=True)
class Tempo:
    bpm: object
    beat_value: object
    source: str

    def __post_init__(self):
        object.__setattr__(self, "bpm", positive(self.bpm, "tempo bpm"))
        object.__setattr__(self, "beat_value", positive(self.beat_value, "tempo beat_value"))
        if not isinstance(self.source, str) or not self.source.strip():
            raise ValueError("tempo source must name who or what declared it")

    def seconds(self, whole_notes):
        return exact_number(whole_notes, "whole_notes") * 60 / (self.bpm * self.beat_value)


@dataclass(frozen=True)
class TempoMap:
    """Ordered (whole-note offset, Tempo) points. Empty means undeclared.

    A declared map begins at zero; its first tempo also governs pickups before
    zero. Its last tempo continues until another change is declared.
    """
    points: tuple = ()

    def __post_init__(self):
        guard_expansion(len(self.points), "tempo changes", MAX_BLUEPRINT_ITEMS)
        points = tuple((exact_number(at, "tempo change at"), tempo)
                       for at, tempo in self.points)
        if any(not isinstance(t, Tempo) for _, t in points):
            raise ValueError("tempo map points require Tempo declarations")
        if points and (points[0][0] != 0 or any(
                b[0] <= a[0] for a, b in zip(points, points[1:]))):
            raise ValueError("tempo map must begin at zero and increase strictly")
        object.__setattr__(self, "points", points)

    def seconds_between(self, start, end):
        start, end = exact_number(start, "start"), exact_number(end, "end")
        if end < start:
            raise ValueError("end precedes start")
        if not self.points:
            from quality.fit import _no_tempo
            return _no_tempo("elapsed seconds over the declared musical span")
        tempo = self.points[0][1]
        cursor, seconds = start, Fraction(0)
        for at, following in self.points:
            if at <= start:
                tempo = following
            elif at < end:
                seconds += tempo.seconds(at - cursor)
                cursor, tempo = at, following
            else:
                break
        return seconds + tempo.seconds(end - cursor)


def from_blueprint(obj):
    """Read top-level tempo and tempo_changes. No BPM or beat-unit default."""
    raw, changes = obj.get("tempo"), obj.get("tempo_changes", [])
    if not isinstance(changes, list):
        raise ValueError("tempo_changes must be an array")
    guard_expansion(len(changes) + (raw is not None), "tempo changes", MAX_BLUEPRINT_ITEMS)
    if raw is None:
        if changes:
            raise ValueError("tempo_changes require an initial tempo")
        return TempoMap()

    def read(row, changing=False):
        keys = {"bpm", "beat_value", "source"} | ({"at"} if changing else set())
        if not isinstance(row, dict) or set(row) != keys:
            raise ValueError(f"tempo declaration requires exactly {sorted(keys)}")
        return Tempo(row["bpm"], row["beat_value"], row["source"])

    points = [(0, read(raw))]
    for row in changes:
        tempo = read(row, True)
        points.append((row["at"], tempo))
    return TempoMap(tuple(points))


def song_position(song, bar, beat=1):
    """Whole-note position, using each bar's own meter. No gap extrapolation."""
    from quality.meter import exact_integer
    bar = exact_integer(bar, "bar", 1)
    beat = exact_number(beat, "beat")
    cursor, offset = 1, Fraction(0)
    for section in song.sections:
        if section.start_bar != cursor:
            raise ValueError("timing requires contiguous, ordered sections starting at bar 1")
        meter = section.meter
        pulses = positive(meter.beats, "meter beats")
        unit = positive(meter.unit, "meter unit")
        if not meter.declared and not meter.assumed:
            raise ValueError("timing requires a declared or explicitly assumed meter")
        end = cursor + section.bars
        if cursor <= bar < end:
            # Negative beat offsets are pickups, measured in this bar's pulse.
            if beat > pulses + 1:
                raise ValueError("beat lies beyond the bar boundary")
            return offset + ((bar - cursor) * pulses + beat - 1) / unit
        offset += section.bars * pulses / unit
        cursor = end
    if bar == cursor and beat == 1:
        return offset
    raise ValueError("timing position lies outside the declared bars")


def line_end(song, line):
    """Line.duration counts local pulses, consuming each crossed bar's meter."""
    bar, beat = line.bar, exact_number(line.beat, "line beat")
    remaining = positive(line.duration, "line duration")
    start = song_position(song, bar, beat)
    end = start
    last_bar = max((s.end_bar for s in song.sections), default=0)
    while remaining:
        # Validate every traversed bar rather than meter_at's last-meter fallback.
        song_position(song, bar, beat)
        if bar > last_bar:
            raise ValueError("line duration extends beyond the declared bars")
        meter = song.meter_at(bar)
        available = exact_number(meter.beats) - beat + 1
        used = min(available, remaining)
        end += used / exact_number(meter.unit)
        remaining -= used
        bar, beat = bar + 1, Fraction(1)
    return start, end


def report(song):
    """The CLI's per-second question: declared bar-span and line durations."""
    if not song.tempo.points:
        return str(song.tempo.seconds_between(0, 0))
    end = song_position(song, max((s.end_bar for s in song.sections), default=0) + 1)
    rows = ["  TIMING: conditional on declared tempo; not measured performance"]
    for at, tempo in song.tempo.points:
        rows.append(f"    at {at} whole notes: {tempo.bpm} BPM, beat={tempo.beat_value}; source={tempo.source}")
    rows.append(f"    bar-span seconds: {song.tempo.seconds_between(0, end)} (excludes pickups before bar 1)")
    for i, line in enumerate(song.lines, 1):
        start, stop = line_end(song, line)
        rows.append(f"    line {i} seconds: {song.tempo.seconds_between(start, stop)}")
    return "\n".join(rows)
