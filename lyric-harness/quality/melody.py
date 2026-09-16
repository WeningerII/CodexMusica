"""Declared monophonic phrase for melody-first planning (no audio inference).

The phrase repeats once per lyric line. Frequencies in Hz avoid an implicit
12-TET tuning. Durations are integer grid ticks; notes are contiguous, with
pitch_hz=null for rests. This is a writing constraint, not pitch certification.
"""
import math


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
    if meter['unit'] not in (1, 2, 4, 8, 16, 32, 64):
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


def melody_brief(melody):
    """Render every event without implying a syllable-to-note assignment."""
    events = '; '.join(f"{'rest' if n['pitch_hz'] is None else str(n['pitch_hz']) + ' Hz'} / {n['ticks']} ticks"
                       for n in melody['notes'])
    return [f"MELODY FIRST: repeat this declared phrase for each lyric line; {melody['subdivision']} ticks per beat.",
            events,
            'Write to this tune. Syllable-to-note underlay and pitch performance are not certified; the grader checks the declared line grid.']
