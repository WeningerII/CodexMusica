// Task authority belongs to the host request/endpoint. The maintained client and
// the task endpoints (/mcp/recipe, /mcp/lyrics) never take it from model tool
// arguments. The shared session endpoint is the one declared exception: a remote
// host has no other channel, so begin_lyrics's `phase` argument selects create or
// edit, and the session then holds that phase fixed (workflow_tools.js says so in
// the tool's own description).
export const RECIPE_MARKER = '=== RECIPE TASK ===';
export const LYRICS_MARKER = '=== LYRICS TASK ===';
export const TASK_DOMAINS = Object.freeze(['recipe', 'lyrics']);

export function taskDomain(task) {
  const domain = typeof task === 'string' ? task : task?.domain;
  if (!TASK_DOMAINS.includes(domain)) throw new Error('Task domain must be recipe or lyrics.');
  return domain;
}

export function toolDomain(name) {
  return String(name).startsWith('lyric_') ? 'lyrics' : 'recipe';
}

export function assertToolTask(task, name, args = {}) {
  if (!task) return; // Legacy discovery endpoint has no host-owned task guarantee.
  const domain = taskDomain(task);
  if (domain !== toolDomain(name)) {
    const error = new Error(
      'TASK_SCOPE: this ' +
        domain +
        ' task cannot call ' +
        name +
        '. Start an explicit user-selected task to switch domains.'
    );
    error.code = 'TASK_SCOPE';
    throw error;
  }
  if (domain === 'recipe' && ['start_recipe', 'edit_recipe', 'render_recipe'].includes(name)) {
    const format = task.format || 'rich';
    const maxChars = task.maxChars ?? 1000;
    if (
      !['rich', 'tags', 'prose', 'compact'].includes(format) ||
      !Number.isInteger(maxChars) ||
      maxChars < 1 ||
      maxChars > 1000
    )
      throw new Error('Invalid host recipe output contract.');
    if (args.format !== undefined && args.format !== format)
      throw new Error('TASK_FORMAT: the requested recipe format is ' + format + '.');
    if (args.max_chars !== undefined && args.max_chars > maxChars)
      throw new Error('TASK_LENGTH: this recipe has a ' + maxChars + ' character ceiling.');
    args.format = format;
    args.max_chars = Math.min(args.max_chars ?? maxChars, maxChars);
  }
}

export function instructionsForTask(instructions, task) {
  const domain = taskDomain(task);
  const text = String(instructions || '');
  if (!text.trim()) throw new Error('Connector initialization instructions are missing.');
  const marker = domain === 'recipe' ? RECIPE_MARKER : LYRICS_MARKER;
  const start = text.indexOf(marker);
  if (start < 0) throw new Error('Connector does not advertise the ' + domain + ' task contract.');
  const other = domain === 'recipe' ? LYRICS_MARKER : RECIPE_MARKER;
  const end = text.indexOf(other, start + marker.length);
  return text.slice(start + marker.length, end < 0 ? undefined : end).trim();
}

// One ordered wire identity for the host's completion receipt and every
// downstream consumer. Mutable workflow progress/artifacts are not the task.
export function completionTaskIdentity(task) {
  return {
    version: task?.version,
    domain: task?.domain,
    brief: task?.brief,
    instructions: task?.instructions,
    plan: task?.plan,
  };
}

// THE LYRICS PAGE'S CONTEXT, STRUCTURED (2026-09-30). The page used to paste
// the whole draft and its declarations into the 5000-character message, so a
// long song could not be reviewed at all and a creative brief had nowhere to
// go. A new lyrics task may instead carry `lyric_context`, version 1: the
// committed document exactly as the page holds it, the exact declarations it
// parsed from it, the creative brief, one note per section, and the page's
// binding (its SHA-256 identity of the document and of the context). It is
// validated here, stored in the signed task, and restored with it on every
// continuation, so a later request can never swap in a different context. The
// brief and notes are creative guidance for the writer, never a graded
// obligation; the declarations are what the lyric tools take.
export const LYRIC_CONTEXT_LIMITS = Object.freeze({
  documentChars: 120_000,
  briefChars: 4_000,
  notes: 120,
  noteChars: 400,
  sectionChars: 80,
  declarationBytes: 60_000,
});
const HEX64 = /^[a-f0-9]{64}$/;
export function lyricContext(value) {
  if (value == null) return null;
  const refuse = (why) => {
    const error = new Error(`lyric_context: ${why}`);
    error.status = 400;
    error.code = 'LYRIC_CONTEXT';
    throw error;
  };
  const L = LYRIC_CONTEXT_LIMITS;
  if (typeof value !== 'object' || Array.isArray(value) || value.version !== 1)
    refuse('must be a version 1 object.');
  const known = ['version', 'document', 'declarations', 'brief', 'notes', 'binding'];
  const extra = Object.keys(value).filter((k) => !known.includes(k));
  if (extra.length) refuse(`unknown field ${extra[0]}.`);
  if (typeof value.document !== 'string') refuse('document must be the draft text.');
  if (value.document.length > L.documentChars)
    refuse(`document is longer than ${L.documentChars} characters.`);
  const brief = value.brief ?? '';
  if (typeof brief !== 'string' || brief.length > L.briefChars)
    refuse(`brief must be text of at most ${L.briefChars} characters.`);
  const notes = value.notes ?? [];
  if (!Array.isArray(notes) || notes.length > L.notes)
    refuse(`notes must be a list of at most ${L.notes}.`);
  for (const n of notes)
    if (
      !n ||
      typeof n !== 'object' ||
      typeof n.section !== 'string' ||
      !n.section.trim() ||
      n.section.length > L.sectionChars ||
      typeof n.note !== 'string' ||
      n.note.length > L.noteChars
    )
      refuse(
        `each note is { section, note } with a section name of at most ${L.sectionChars} characters and a note of at most ${L.noteChars}.`
      );
  const declarations = value.declarations ?? {};
  if (typeof declarations !== 'object' || Array.isArray(declarations) || declarations === null)
    refuse('declarations must be an object.');
  if (Buffer.byteLength(JSON.stringify(declarations)) > L.declarationBytes)
    refuse(`declarations are larger than ${L.declarationBytes} bytes.`);
  const binding = value.binding ?? null;
  if (
    binding !== null &&
    (typeof binding !== 'object' ||
      !HEX64.test(binding.document_sha256 ?? '') ||
      (binding.context_sha256 != null && !HEX64.test(binding.context_sha256)))
  )
    refuse('binding holds the document_sha256 (and context_sha256) as 64 hex characters.');
  return {
    version: 1,
    document: value.document.replace(/\r\n?/g, '\n'),
    declarations: structuredClone(declarations),
    brief,
    notes: notes.map((n) => ({ section: n.section.trim(), note: n.note })),
    binding: binding
      ? {
          document_sha256: binding.document_sha256,
          ...(binding.context_sha256 ? { context_sha256: binding.context_sha256 } : {}),
        }
      : null,
  };
}
// The context as the writer reads it: creative guidance kept apart from the
// exact document and the exact declarations the lyric tools take.
export function lyricContextText(context) {
  if (!context) return '';
  const parts = [
    'PAGE CONTEXT (from the Lyrics page, version 1; the host holds it for this whole task).',
  ];
  if (context.brief?.trim() || context.notes?.length) {
    parts.push(
      'CREATIVE GUIDANCE — what the song is for. Guidance only: nothing grades a draft against it.'
    );
    if (context.brief?.trim()) parts.push(`Brief: ${context.brief.trim()}`);
    for (const n of context.notes || []) parts.push(`Section note — ${n.section}: ${n.note}`);
  }
  parts.push(
    'THE COMMITTED DOCUMENT — exactly as the page holds it: section headers carry declared size, bars, meter and pickup; [SETUP — …] rows are page declarations and are not sung; do not send [SETUP] rows to a lyric tool as lines.',
    '<<<DOCUMENT',
    context.document,
    'DOCUMENT>>>'
  );
  if (context.declarations && Object.keys(context.declarations).length)
    parts.push(
      'EXACT DECLARATIONS for the lyric tools (never guess a reading that is not chosen): ' +
        JSON.stringify(context.declarations)
    );
  return parts.join('\n');
}
