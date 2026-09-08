// Task authority belongs to the host request/endpoint, never model tool arguments.
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
