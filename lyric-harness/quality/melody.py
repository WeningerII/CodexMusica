"""Declared monophonic phrase for melody-first planning (no audio inference).

The phrase repeats once per lyric line. Frequencies in Hz avoid an implicit
12-TET tuning. Durations are integer grid ticks; notes are contiguous, with
pitch_hz=null for rests. This is a writing constraint, not pitch certification.
"""
import math

#: The time-signature denominators a declared meter may carry: the
#: power-of-two note values through the sixty-fourth. One tuple, read by this
#: refusal and by `plan.py`'s denominator draw, so the planner never samples a
#: meter a writer could not declare back by hand.
NOTE_DENOMINATORS = (1, 2, 4, 8, 16, 32, 64)


def validate_melody(value):
    """Return an owned, canonical declaration or raise ValueError by coordinate."""
    def refuse(message):
        raise ValueError('melody: ' + message)

    if not isinstance(value, dict) or set(value) != {'meter', 'bars', 'subdivision', 'notes'}:
        refuse('expected exactly meter, bars, subdivision, notes')
    meter = value['meter']
    if not isinstance(meter, dict) or set(meter) != {'beats', 'unit', 'groups'}:
        refuse('meter requires exactly beats, unit, groups')
    for name, v in [('beats', meter['beats']), ('unit', meter['unit']),
                    ('bars', value['bars']), ('subdivision', value['subdivision'])]:
        if type(v) is not int or v <= 0:
            refuse(name + ' must be a positive integer')
    groups = meter['groups']
    if not isinstance(groups, list) or not groups or any(type(g) is not int or g not in (2, 3) for g in groups):
        refuse('meter.groups must use the supported 2/3 grouping grammar')
    if sum(groups) != meter['beats']:
        refuse('meter.groups must sum to meter.beats')
    if meter['unit'] not in NOTE_DENOMINATORS:
        refuse('meter.unit must be a power-of-two note denominator through 64')
    if value['subdivision'] not in (1, 2, 4):
        refuse('subdivision must be 1, 2 or 4')
    notes = value['notes']
    if not isinstance(notes, list) or not notes or len(notes) > 4096:
        refuse('notes must contain 1..4096 events')
    clean = []
    for i, note in enumerate(notes):
        if not isinstance(note, dict) or set(note) != {'pitch_hz', 'ticks'}:
            refuse(f'notes[{i}] requires exactly pitch_hz and ticks')
        pitch, ticks = note['pitch_hz'], note['ticks']
        if pitch is not None and (type(pitch) not in (int, float) or (isinstance(pitch, float) and not math.isfinite(pitch)) or pitch <= 0):
            refuse(f'notes[{i}].pitch_hz must be positive finite Hz or null for a rest')
        if type(ticks) is not int or ticks <= 0:
            refuse(f'notes[{i}].ticks must be a positive integer')
        clean.append(dict(note))
    if not any(n['pitch_hz'] is not None for n in clean):
        refuse('a melody requires at least one pitched event')
    if sum(n['ticks'] for n in clean) != value['bars'] * meter['beats'] * value['subdivision']:
        refuse('event ticks must fill exactly bars × beats × subdivision')
    return dict(meter=dict(meter, groups=list(groups)), bars=value['bars'],
                subdivision=value['subdivision'], notes=clean)


def assign_section_melodies(rng, sections, declarations, subdivision):
    """Draw one bounded monophonic score per identity, reusing its literal events."""
    phrases = {}
    base_hz = rng.randint(180, 360)
    group_count = len({p["melodyGroup"] for p in declarations if "melodyGroup" in p})
    count = max(4, group_count)
    intervals = iter(rng.sample(range(12, max(121, 12 + count)), count))
    heads = declarations[0].get('sourceRole') == declarations[-1].get('sourceRole') == 'head'
    for section, declaration in zip(sections, declarations):
        group = declaration.get('melodyGroup')
        solo = heads and declaration['role'] == 'solo'
        if solo:
            group = ('solo', section['name'])
        if group is None:
            continue
        meter, bars = section['meter'], section['bars']
        if group not in phrases:
            total = bars * meter['beats'] * subdivision
            if declaration.get("sourceRole") == "vamp":
                beat = subdivision
                # Each selected bar has at least two beats. Repeat once per
                # bar, preserving the second attack even in binary meters.
                notes = [{"pitch_hz": pitch, "ticks": length}
                         for _ in range(bars)
                         for pitch, length in ((base_hz, beat),
                                               (base_hz + 32, (meter["beats"] - 1) * beat))]
                if bars < 2:
                    raise ValueError("the selected vamp needs at least two complete riff cycles")
            elif declaration.get("sourceRole") == "break":
                notes = [{"pitch_hz": base_hz, "ticks": total}]
            else:
                size = rng.randint(2, min(8, total))
                bounds = [0, *sorted(rng.sample(range(1, total), size - 1)), total]
                # A shared starting pitch and a distinct first interval rule out
                # two contrasting groups that differ only by transposition.
                pitches = [base_hz, base_hz + (rng.randint(12, 120) if solo else next(intervals))]
                for _ in range(size - 2):
                    pitches.append(None if rng.randrange(5) == 0 else rng.randint(150, 500))
                notes = [{'pitch_hz': pitch, 'ticks': right - left}
                         for pitch, left, right in zip(pitches, bounds, bounds[1:])]
            phrases[group] = dict(bars=bars, meter=meter, subdivision=subdivision, notes=notes)
        phrase = phrases[group]
        if phrase['bars'] != bars or phrase['meter'] != meter:
            raise ValueError('a literal section melody requires identical bar and meter spans on each return')
        section['section_melody'] = validate_melody(phrase)
        if declaration.get('vocalDuty') == 'ensemble':
            section['section_parts'] = []
            for i, singer in enumerate(section['performers']):
                # A reproducible, fully written vocal setting. All voices
                # keep their own events, even when their attacks align.
                notes = [dict(n, pitch_hz=None if n['pitch_hz'] is None else n['pitch_hz'] * (1 + i / 4))
                         for n in phrase['notes']]
                section['section_parts'].append(dict(performer=singer, kind='voice',
                                                     melody=validate_melody(dict(phrase, notes=notes))))


def assign_imitative_score(rng, plan, repeats):
    """Write distinct performers with delayed note streams on the section grid."""
    section = plan["sections"][0]
    capacity = section["bars"] * section["meter"]["beats"] * 4
    width = min((capacity - index) // count for index, count in enumerate(repeats))
    if width < 2:
        return False
    first, second = rng.sample(range(180, 441), 2)
    cut = rng.randint(1, width - 1)
    tracks = []
    for index, count in enumerate(repeats):
        tracks.append(dict(performer=f"v{index + 1}", start=index,
                           phrases=[[[first, cut], [second, width - cut]] for _ in range(count)]))
    section["voice_score"] = {"subdivision": 4, "tracks": tracks}
    plan["vocal_roster"] = [track["performer"] for track in tracks]
    return True


def melody_brief(melody):
    """Render every event without implying a syllable-to-note assignment."""
    events = '; '.join(f"{'rest' if n['pitch_hz'] is None else str(n['pitch_hz']) + ' Hz'} / {n['ticks']} ticks"
                       for n in melody['notes'])
    return [f"MELODY FIRST: repeat this declared phrase for each lyric line; {melody['subdivision']} ticks per beat.",
            events,
            'Syllable-to-note underlay and pitch performance are not certified; the grader checks the declared line grid.']
