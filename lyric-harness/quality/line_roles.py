"""A line marked `refrain` or `burden` (`role` on a blueprint line, #676).

A role says what one line IS. It declares no Return, no repeat and no hook,
so nothing here compares the marked lines' words: that is the Return check's
question, and only where a Return is declared. What this module does is read
the mark, keep its spelling, and say what was and was not checked.

The caller supplies section owners already resolved from the existing grid.
Line positions (one-based), not lyric text, identify physical occurrences.
These helpers neither grade Return identity nor alter the input blueprint.
"""
from dataclasses import dataclass
from .grid import GridFinding, Unasked, as_function

#: The two roles a line can be marked with. `burden` is never folded into
#: `refrain`: the registry keeps them as two rows and so does every report.
#: Written without brackets on purpose: `mcp/test_prompt_provenance.mjs`
#: looks here for both names as values of ROLES, and reads `= 'x', 'y'`.
ROLES = 'refrain', 'burden'


def canonical_role(raw, line):
    """-> 'refrain' | 'burden' for one line's `role`; ValueError otherwise.

    Resolved through the function vocabulary's own aliases, so a spelling the
    vocabulary reads as one of the two is accepted and anything else (null, a
    list, an empty string, an unknown word, a section name such as 'verse')
    is refused with the value named. `line` is one-based.
    """
    try:
        canonical = as_function(raw) if isinstance(raw, str) else None
    except ValueError:
        canonical = None
    if canonical not in ROLES:
        raise ValueError(
            f"line {line}: `role` is {raw!r}, which isn't a line role. "
            f'Write "refrain" or "burden", or remove `role` from this line.')
    return canonical


@dataclass(frozen=True)
class LineRole:
    line: int
    container: int
    raw: str
    role: str


def resolve_line_roles(lines, owners):
    """Resolve explicitly present roles; absent keys remain wholly undeclared.

    owners maps zero-based line indices to resolved zero-based section indices.
    No lookup by text, heading inference or last-matching-section fallback.
    """
    result = []
    for index, row in enumerate(lines):
        if 'role' not in row:
            continue
        raw = row['role']
        canonical = canonical_role(raw, index + 1)
        owner = owners.get(index)
        if type(owner) is not int or owner < 0:
            raise ValueError(f'line {index + 1}: unresolved containing section for role {raw!r}')
        result.append(LineRole(index + 1, owner, raw, canonical))
    return tuple(result)


def role_report(roles, owners, *, line_count, returns=()):
    """Disclose declarations and draft-scoped notes, never identity judgments.

    returns contains existing, prevalidated directionless one-based classes.
    Membership only points to the existing Return checker; it proves nothing.
    Adjacent physical occurrences determine whether a burden is at a boundary.
    line_count is the physical draft length, independent of resolved owners.
    Missing adjacent owners produce an explicit unresolved-position note.
    """
    roles = tuple(roles)
    classes = tuple(tuple(group) for group in returns)
    declarations, notes = [], []
    for item in roles:
        count = sum(other.role == item.role for other in roles)
        groups = [list(group) for group in classes if item.line in group]
        declarations.append({
            'line': item.line, 'container': item.container,
            'raw': item.raw, 'role': item.role,
            'identity': 'not_checked', 'declared_returns': groups,
            'disclosure': ('A Return is declared for this line; only the Return check '
                           'judges its identity, and only when that check is asked. '
                           'This report does not judge it.' if groups else
                           'No Return is declared for this occurrence; identity was not checked.'),
        })
        if count == 1:
            notes.append({'line': item.line, 'severity': 'note',
                          'code': 'LINE_ROLE_ONCE', 'role': item.role,
                          'message': f'marked {item.role}; the only line marked {item.role} in this draft'})
        if item.role == 'burden':
            index = item.line - 1
            previous = owners.get(index - 1)
            following = owners.get(index + 1)
            if index == 0:
                position = 'at the opening of this draft'
            elif item.line == line_count:
                position = 'at the close of this draft'
            elif type(previous) is not int or previous < 0:
                position = "the preceding line's section isn't resolved, so its position isn't known"
            elif previous != item.container:
                position = 'at a section boundary in this draft'
            elif type(following) is int and following >= 0 and following != item.container:
                position = 'at a section boundary in this draft'
            elif type(following) is not int or following < 0:
                position = "the following line's section isn't resolved, so its position isn't known"
            else:
                position = 'inside its containing section in this draft'
            notes.append({'line': item.line, 'severity': 'note',
                          'code': 'BURDEN_POSITION', 'role': item.role,
                          'position': position,
                          'message': 'marked burden; ' + position})
    return {'declarations': declarations, 'notes': notes}


def _lines(numbers):
    """[1, 3, 5] -> 'lines 1, 3 and 5'."""
    numbers = [str(n) for n in numbers]
    if len(numbers) == 1:
        return f'line {numbers[0]}'
    return 'lines ' + ', '.join(numbers[:-1]) + ' and ' + numbers[-1]


def match_not_checked(roles, returns=()):
    """-> [Unasked], at most one: marked lines whose words nothing compared.

    Two or more lines marked with one role are compared only where ONE
    declared Return holds all of them; that check then judges them and this
    says nothing. Otherwise the report says the match was not checked. It is
    never a finding: a role licenses no comparison (the ruling on #676).
    One row for the draft, both roles in it, because a coverage row's id is
    its code and the same code twice is not a report a caller can read.
    """
    classes = [set(group) for group in returns]
    said = []
    for role in ROLES:
        marked = [item.line for item in roles if item.role == role]
        if len(marked) < 2 or any(set(marked) <= group for group in classes):
            continue
        partial = [sorted(group & set(marked)) for group in classes
                   if len(group & set(marked)) >= 2]
        count = 'both' if len(marked) == 2 else 'all'
        why = ('no one Return covers all of them; declared: '
               + ', '.join(_lines(group) for group in partial)
               if partial else 'no Return is declared for them')
        said.append(f'whether {_lines(marked)}, {count} marked {role}, '
                    f'match ({why})')
    if not said:
        return []
    return [Unasked(
        'ROLE_MATCH_NOT_CHECKED', 'not checked: ' + '; '.join(said),
        "A role says what a line is. It declares no Return, so the marked "
        "lines' words are not compared. Declare a Return over those lines to "
        "have them compared. This is not a finding against the draft, and "
        "it is counted as neither answered nor refused.")]


def role_findings(notes):
    """The draft's role notes -> [GridFinding], at most one per code.

    LINE_ROLE_ONCE   a role marked on exactly one line. A role asks for no
        repeat, so this is stated and nothing more.
    BURDEN_POSITION  where each line marked burden sits in THIS draft. The
        registry's "printed after a stanza" is a measurement of a corpus;
        here it is not a rule, so the position is stated and not judged.

    Both are notes (`grid.SEVERITY`) and neither can stop a song: a mark is
    part of the declaration, and no rewrite of a line's words moves it.
    """
    once = [n for n in notes if n['code'] == 'LINE_ROLE_ONCE']
    where = [n for n in notes if n['code'] == 'BURDEN_POSITION']
    out = []
    if once:
        out.append(GridFinding(
            'LINE_ROLE_ONCE',
            '; '.join(f"line {n['line']} is the only line marked "
                      f"{n['role']} in this draft" for n in once),
            "A role says what a line is and asks for no repeat, so a role "
            "used once is stated here and not counted against the draft."))
    if where:
        out.append(GridFinding(
            'BURDEN_POSITION',
            'marked burden: ' + '; '.join(
                f"line {n['line']}, {n['position']}" for n in where),
            "Where each line marked burden sits in this draft. No position "
            "is required of it, so this is stated and not judged."))
    return out


def song_role_report(song, returns=()):
    """Every marked line of a grid `Song` -> declarations, notes, findings,
    not_checked.

    `returns` holds the declared whole-line verbatim Return classes as
    one-based line numbers; a caller with no Return layer passes none, and
    the report then says no Return is declared, which is true of that call.
    """
    owners = {index: block for index, block in enumerate(song.line_blocks())
              if block is not None}
    rows = [{'role': line.role} if line.role else {} for line in song.lines]
    roles = resolve_line_roles(rows, owners)
    report = role_report(roles, owners, line_count=len(song.lines),
                         returns=returns)
    report['findings'] = role_findings(report['notes'])
    report['not_checked'] = match_not_checked(roles, returns)
    return report
