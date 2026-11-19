// A textual function is a reading of a particular passage in context. The
// score establishes the passage boundaries; its headings cannot supply that reading.

const functions = new Map(
  Object.entries({
    'nonsense-refrain-song': {
      'vocables-refrain': 'The repeated refrain is sung as nonlexical vocables in this context.',
    },
    'american-sonnet': {
      opening: 'The opening establishes a perspective.',
      'viewpoint-shift': 'The middle shifts the perspective established in the opening.',
      'closing-turn': 'The ending turns from the preceding perspective.',
    },
    epigram: { poem: 'The last line gives a pointed, witty turn to the preceding text.' },
    'gnomic-verse': { maxim: 'This unit expresses a compact, generally applicable maxim.' },
    sevenling: {
      stanza: 'This tercet presents three items.',
      twist: 'The isolated closing line turns the sense of the preceding two tercets.',
    },
    bop: {
      problem: 'The opening stanza states the problem.',
      exploration: 'This stanza explores the stated problem.',
      'resolution-or-attempt': 'This stanza resolves or attempts to resolve the problem.',
      extension: 'This stanza extends the preceding attempt or resolution.',
    },
    elegy: {
      lament: 'The speaker mourns the loss.',
      praise: 'The speaker praises the subject of that loss.',
      consolation: 'The speaker turns toward consolation.',
    },
    'riddle-song': {
      'riddle-stanzas': 'This stanza poses one riddle.',
      'answer-stanzas': 'This stanza solves its corresponding earlier riddle.',
    },
    'verse-epistle': {
      address: 'The letter addresses its recipient.',
      body: 'The writer develops the message to that recipient.',
      'sign-off': 'The writer signs off from that letter.',
    },
    'goodnight-ballad': {
      confession: 'The speaker confesses in the first person and offers a warning.',
      farewell: 'The speaker takes leave in the closing stanza.',
    },
    'come-all-ye': {
      'opening-address': 'The opening calls on listeners to hear the story.',
      verse: 'This stanza tells part of the story announced in the address.',
      moral: 'The ending draws a lesson from the story.',
      farewell: 'The ending bids the listeners farewell.',
    },
    'calling-on-song': {
      introduction: 'The leader introduces a dancer by name in this stanza.',
      'dance-call': 'The leader closes by calling for the dance.',
      appeal: 'The leader closes by asking for money.',
    },
  })
);

export const usesFunctionReadings = (id) => functions.has(id);
export function functionCriterion(id, role) {
  const profile = functions.get(id);
  return profile && Object.hasOwn(profile, role) ? profile[role] : undefined;
}

// Admit only the precise realized, countable source tree. A position locates
// the text for review; only that review addresses the meaning of a turn or maxim.
export function countedTextualLayout(plan, mark, plain) {
  const [root] = plan.tree;
  if (plan.tree.length !== 1 || !root || root.unit !== 'poem' || root.role || !plain(root))
    return null;
  const nodes = root.children;
  const line = (n, role) => n?.unit === 'line' && n.role === role && !n.children.length && plain(n);
  const block = (n, count) => ({
    unit: 'section',
    role: 'verse',
    lines: count,
    divisionPath: n === root ? [mark(root)] : [mark(root), mark(n)],
  });
  if (
    plan.id === 'epigram' &&
    nodes.length >= 2 &&
    nodes.length <= 4 &&
    nodes.slice(0, -1).every((n) => line(n)) &&
    line(nodes.at(-1), 'turn')
  )
    return [block(root, nodes.length)];
  if (
    plan.id === 'gnomic-verse' &&
    nodes.length &&
    nodes.every(
      (n) =>
        n.unit === 'maxim' &&
        !n.role &&
        plain(n) &&
        n.children.length >= 1 &&
        n.children.length <= 2 &&
        n.children.every((l) => line(l))
    )
  )
    return nodes.map((n) => block(n, n.children.length));
  if (
    plan.id === 'sevenling' &&
    nodes.length === 3 &&
    line(nodes[2], 'twist') &&
    nodes
      .slice(0, 2)
      .every(
        (n) =>
          n.unit === 'stanza' &&
          !n.role &&
          plain(n) &&
          n.children.length === 3 &&
          n.children.every((l) => line(l))
      )
  )
    return nodes.map((n) => block(n, n.unit === 'line' ? 1 : n.children.length));
  if (plan.id === 'bop' && [6, 8].includes(nodes.length)) {
    const blocks = ['problem', 'exploration', 'resolution-or-attempt', 'extension'];
    const widths = [6, 8, 6, 6];
    const refrain = nodes[1].returns;
    if (
      !refrain ||
      !nodes.every((n, i) =>
        i % 2 === 0
          ? n.unit === 'stanza' &&
            n.role === blocks[i / 2] &&
            plain(n) &&
            n.children.length === widths[i / 2] &&
            n.children.every((l) => line(l))
          : n.returns === refrain && line({ ...n, returns: undefined }, 'refrain')
      )
    )
      return null;
    return nodes.map((n) => block(n, n.unit === 'line' ? 1 : n.children.length));
  }
  return null;
}

export function withFunctionCriteria(id, rows) {
  if (!rows || !usesFunctionReadings(id)) return rows;
  return rows.map((row, i) => {
    const role =
      row.divisionPath.findLast((mark) => mark.role)?.role ?? row.divisionPath.at(-1).unit;
    // The Bop refrain is a separately measured exact return, independent of interpretation.
    if (
      (id === 'bop' && role === 'refrain') ||
      (id === 'nonsense-refrain-song' && role === 'verse')
    )
      return row;
    const criterion = functionCriterion(id, role);
    if (!criterion) throw new Error('Missing section reading criterion for ' + id + '/' + role);
    const answersSection =
      id === 'riddle-song' && role === 'answer-stanzas' ? i + 1 - rows.length / 2 : null;
    return {
      ...row,
      textualFunction: { role, criterion, ...(answersSection && { answersSection }) },
    };
  });
}
