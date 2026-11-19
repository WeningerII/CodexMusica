// A textual function is a reading of a particular passage in context. The
// score establishes the passage boundaries; its headings cannot supply that reading.

const functions = new Map(
  Object.entries({
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

export function withFunctionCriteria(id, rows) {
  if (!rows || !usesFunctionReadings(id)) return rows;
  return rows.map((row, i) => {
    const role = row.divisionPath.findLast((mark) => mark.role)?.role;
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
