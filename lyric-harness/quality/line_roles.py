"""Pure P2 proposal helpers; admission remains refused until consumer acceptance.

The caller supplies section owners already resolved from the existing grid.
Line positions (one-based), not lyric text, identify physical occurrences.
These helpers neither grade Return identity nor alter the input blueprint.
"""
from dataclasses import dataclass
from .grid import as_function


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
        try:
            canonical = as_function(raw) if isinstance(raw, str) else None
        except ValueError:
            canonical = None
        if canonical not in ('refrain', 'burden'):
            raise ValueError(f'line {index + 1}: unsupported line role {raw!r}')
        owner = owners.get(index)
        if type(owner) is not int or owner < 0:
            raise ValueError(f'line {index + 1}: unresolved containing section for role {raw!r}')
        result.append(LineRole(index + 1, owner, raw, canonical))
    return tuple(result)


def role_report(roles, owners, *, returns=()):
    """Disclose declarations and draft-scoped notes, never identity judgments.

    returns contains existing, prevalidated directionless one-based classes.
    Membership only points to the existing Return checker; it proves nothing.
    Adjacent physical occurrences determine whether a burden is at a boundary.
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
                          'message': f'marked {item.role}; the only line marked {item.role} in this draft'})
        if item.role == 'burden':
            index = item.line - 1
            previous = owners.get(index - 1)
            following = owners.get(index + 1)
            if index == 0:
                position = 'at the opening of this draft'
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
                          'message': 'marked burden; ' + position})
    return {'declarations': declarations, 'notes': notes}
