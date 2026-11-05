// Fixture responses for the states the prototype's UI must handle (#670, 3PO's
// list): pending, partial, refusal, cancel, resume, stale, storage failure.
//
// They are written by hand to the shape the UI consumes. They are NOT
// recordings of the live server, and a check that passes on them validates the
// UI's handling only (Jony's spec correction, 6622487968 §2). A feature slice
// that needs a real server response replaces its fixture with a recording and
// says where the recording came from.
//
// Nothing here reaches the network: `replay` resolves from memory. The
// prototype makes no call to the connector, /chat or any model provider.

const FIXTURES = {
  pending: {
    state: 'pending',
    message: 'Still working on it.',
    next_step: null,
  },
  partial: {
    state: 'partial',
    message: 'Part of the result is ready. The rest did not finish.',
    next_step: 'Resume to finish the rest.',
  },
  refusal: {
    state: 'refusal',
    message: 'This request was refused.',
    next_step: 'Change the request as described, then try again.',
  },
  cancel: {
    state: 'cancel',
    message: 'Cancelled. Nothing was changed.',
    next_step: null,
  },
  resume: {
    state: 'resume',
    message: 'Resumed from where it stopped.',
    next_step: null,
  },
  stale: {
    state: 'stale',
    message: 'This result is out of date: the text changed after it was made.',
    next_step: 'Run it again on the current text.',
  },
  'storage-failure': {
    state: 'storage-failure',
    message: 'Not saved: this browser would not store it.',
    next_step: 'Keep this tab open, or allow site data and try again.',
  },
};

export const FIXTURE_STATES = Object.freeze(Object.keys(FIXTURES));

export function replay(state) {
  const f = FIXTURES[state];
  if (!f) return Promise.reject(new Error(`no fixture for state "${state}"`));
  return Promise.resolve(JSON.parse(JSON.stringify(f)));
}
