/** Shared, offline interpretation of the versioned symbolic Song Forms catalog.
 * patterns are alternatives, indexed from zero. Count keys are one-based dotted
 * template paths, rooted at "1". A default applies to every copy. An occurrence
 * override such as "1[1].2[3].1" sets child 1 inside just that parent occurrence.
 * Occurrence addresses add a one-based copy number at each level: 1[1].2[3].
 * Spans are half-open offsets into the explicit preorder node, line, and section
 * projections. A partial projection is not an absolute transcript coordinate.
 */
const MAX_NODES = 8192;
const MAX_DEPTH = 48;
const SCOPES = new Set(['rule', 'setting', 'deferred']);
const FEATURES = ['rhyme', 'returns', 'endWord', 'syllables', 'stress', 'stresses', 'bars', 'role'];
const COUNTERS = new Set(['syllables', 'stresses', 'bars']);
const IDENTITIES = new Set(['rhyme', 'returns', 'endWord']);
const NODE_KEYS = new Set(['unit', 'children', 'times', ...FEATURES]);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const has = (obj, key) => Object.hasOwn(obj, key);

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function symbol(value) {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value
  );
}

function validateFeatures(obj) {
  for (const key of FEATURES) {
    if (!has(obj, key)) continue;
    const value = obj[key];
    if (COUNTERS.has(key)) requireValue(integer(value), 'Invalid ' + key);
    else if (key === 'stress')
      requireValue(typeof value === 'string' && /^[./]+$/.test(value), 'Invalid stress sequence');
    else requireValue(symbol(value), 'Invalid ' + key);
  }
  if (has(obj, 'stress')) {
    requireValue(
      !has(obj, 'syllables') || obj.syllables === obj.stress.length,
      'Inconsistent syllables and stress'
    );
    requireValue(
      !has(obj, 'stresses') || obj.stresses === obj.stress.split('/').length - 1,
      'Inconsistent stress count'
    );
  }
}

function bounds(times) {
  if (times === undefined) return [1, 1];
  if (integer(times)) return [times, times];
  requireValue(
    Array.isArray(times) &&
      times.length === 2 &&
      integer(times[0]) &&
      (times[1] === null || (integer(times[1]) && times[1] >= times[0])),
    'Invalid repetition bounds'
  );
  return times;
}

function catalogEntry(catalog, id) {
  requireValue(Array.isArray(catalog) && symbol(id), 'Expected a catalog and form id');
  const matches = catalog.filter((entry) => entry?.id === id);
  if (matches.length === 0) throw new RangeError('Unknown form: ' + id);
  requireValue(matches.length === 1, 'Duplicate form: ' + id);
  const form = matches[0];
  requireValue(
    symbol(form.name) && SCOPES.has(form.scope) && Array.isArray(form.patterns),
    'Invalid form: ' + id
  );
  requireValue(
    form.scope === 'deferred' ? !form.patterns.length : form.patterns.length > 0,
    'Invalid pattern count for ' + id
  );
  let size = 0;
  const variants = form.patterns.map((root, index) => {
    const counts = [];
    function visit(node, path, depth, inLine) {
      if (++size > MAX_NODES || depth > MAX_DEPTH)
        throw new RangeError('Pattern size limit exceeded');
      requireValue(
        isRecord(node) && symbol(node.unit) && Object.keys(node).every((k) => NODE_KEYS.has(k)),
        'Invalid node at ' + path
      );
      requireValue(
        !inLine || (node.unit !== 'line' && node.unit !== 'section'),
        'Nested line or section inside line at ' + path
      );
      validateFeatures(node);
      const [min, max] = bounds(node.times);
      if (min !== max) counts.push({ path, min, max });
      if (has(node, 'children')) {
        requireValue(
          Array.isArray(node.children) && node.children.length > 0,
          'Invalid children at ' + path
        );
        node.children.forEach((child, i) =>
          visit(child, path + '.' + (i + 1), depth + 1, inLine || node.unit === 'line')
        );
      }
    }
    visit(root, '1', 1, false);
    return { index, unit: root.unit, counts };
  });
  return { form, variants };
}

export function describeForm(catalog, id) {
  const { form, variants } = catalogEntry(catalog, id);
  return {
    id,
    name: form.name,
    scope: form.scope,
    patterns: globalThis.structuredClone(form.patterns),
    variants,
  };
}

function parameters(options) {
  requireValue(isRecord(options), 'Expected options');
  const counts = options.counts === undefined ? {} : options.counts;
  requireValue(isRecord(counts), 'Expected repeat counts keyed by template path');
  return counts;
}

export function realizeForm(catalog, id, options = {}) {
  const { form, variants } = catalogEntry(catalog, id);
  const counts = parameters(options);
  const plan = {
    id,
    name: form.name,
    scope: form.scope,
    status: 'ready',
    variant: null,
    needs: [],
    tree: [],
    lines: [],
    sections: [],
    coverage: { lines: 'none', sections: 'none' },
    minimum: { lines: 0, sections: 0 },
  };
  if (form.scope === 'deferred') {
    plan.status = 'deferred';
    return plan;
  }
  if (options.variant === undefined && variants.length > 1) {
    plan.status = 'needs-input';
    plan.needs.push({ kind: 'variant', choices: variants.map((v) => v.index) });
    return plan;
  }
  const variant = options.variant === undefined ? 0 : options.variant;
  requireValue(integer(variant) && variant < variants.length, 'Unknown variant');
  plan.variant = variant;
  const allowed = new Map(variants[variant].counts.map((c) => [c.path, c]));
  const overrides = new Set();
  for (const [key, count] of Object.entries(counts)) {
    let path = key;
    if (key.includes('[')) {
      requireValue(
        /^(?:[1-9]\d*\[[1-9]\d*\]\.)+[1-9]\d*$/.test(key),
        'Invalid occurrence count key: ' + key
      );
      overrides.add(key);
      path = key.replace(/\[\d+\]/g, '');
    }
    const bound = allowed.get(path);
    requireValue(
      bound && integer(count) && count >= bound.min && (bound.max === null || count <= bound.max),
      'Invalid count at ' + key
    );
  }

  const root = form.patterns[variant];
  let hasLine = false,
    hasSection = false;
  const repeat = (node, path) => (has(counts, path) ? counts[path] : bounds(node.times)[0]);
  function collect(node, path) {
    hasLine ||= node.unit === 'line';
    hasSection ||= node.unit === 'section';
    const [min, max] = bounds(node.times);
    if (!overrides.size && min !== max && !has(counts, path)) {
      plan.needs.push({ kind: 'count', path, min, max });
    } else if (!overrides.size && repeat(node, path) === 0) {
      return;
    }
    node.children?.forEach((child, i) => collect(child, path + '.' + (i + 1)));
  }
  collect(root, '1');
  if (plan.needs.length) {
    plan.status = 'needs-input';
    return plan;
  }

  let ordinal = 0,
    lineGap = false,
    sectionGap = false;
  const usedOverrides = new Set();
  function expand(node, path, prefix, dest, inLine, inSection, unordered) {
    const local = has(counts, prefix);
    if (overrides.has(prefix)) usedOverrides.add(prefix);
    if (allowed.has(path) && !local && !has(counts, path)) {
      const { min, max } = allowed.get(path);
      if (plan.needs.length >= MAX_NODES) throw new RangeError('Realization size limit exceeded');
      plan.needs.push({ kind: 'count', path, occurrencePath: prefix, min, max });
      return;
    }
    const total = local ? counts[prefix] : repeat(node, path);
    if (total > MAX_NODES - ordinal) throw new RangeError('Realization size limit exceeded');
    for (let copy = 1; copy <= total; copy++) {
      const address = prefix + '[' + copy + ']';
      const startNode = ordinal++,
        startLine = plan.lines.length,
        startSection = plan.sections.length;
      const unit = { unit: node.unit, path, address };
      if (inLine) unit.lineIndex = startLine;
      for (const key of FEATURES) if (has(node, key)) unit[key] = node[key];
      const realized = { ...unit, children: [] };
      dest.push(realized);
      const line = node.unit === 'line',
        section = node.unit === 'section';
      const parallel =
        unordered || node.unit === 'simultaneous' || node.unit === 'staggered-voices';
      if (line)
        plan.lines.push({ ...unit, index: startLine + 1, positionKnown: !lineGap && !parallel });
      if (section)
        plan.sections.push({
          ...unit,
          index: startSection + 1,
          positionKnown: !sectionGap && !parallel,
        });
      if (line) {
        if (parallel) lineGap = true;
        else plan.minimum.lines++;
      }
      if (section) {
        if (parallel) sectionGap = true;
        else plan.minimum.sections++;
      }
      if (node.children) {
        node.children.forEach((child, i) =>
          expand(
            child,
            path + '.' + (i + 1),
            address + '.' + (i + 1),
            realized.children,
            inLine || line,
            inSection || section,
            parallel
          )
        );
      } else if (!line && !inLine) {
        lineGap = true;
        if (!section && !inSection) sectionGap = true;
      }
      realized.span = {
        nodes: [startNode, ordinal],
        lines: [startLine, plan.lines.length],
        sections: [startSection, plan.sections.length],
      };
    }
  }
  expand(root, '1', '1', plan.tree, false, false, false);
  if (plan.needs.length)
    return {
      ...plan,
      status: 'needs-input',
      tree: [],
      lines: [],
      sections: [],
      minimum: { lines: 0, sections: 0 },
    };
  requireValue(
    usedOverrides.size === overrides.size,
    'Count override refers to an inactive occurrence'
  );
  plan.coverage.lines = hasLine ? (lineGap ? 'partial' : 'complete') : 'none';
  plan.coverage.sections = hasSection ? (sectionGap ? 'partial' : 'complete') : 'none';
  return plan;
}

function observations(list, line) {
  if (list === undefined) return undefined;
  requireValue(
    Array.isArray(list) && list.length <= MAX_NODES,
    'Expected ordered observations within size limit'
  );
  return Array.from(list, (item) => {
    const obs = typeof item === 'string' ? (line ? { text: item } : { role: item }) : item;
    requireValue(
      isRecord(obs) && (!has(obs, 'text') || typeof obs.text === 'string'),
      'Invalid observation'
    );
    if (line && has(obs, 'text'))
      requireValue(
        obs.text.trim() && !/[\r\n\u2028\u2029]/u.test(obs.text),
        'Expected one nonblank text line'
      );
    validateFeatures(obs);
    return obs;
  });
}

function wordTokens(text) {
  return (
    text
      .normalize('NFC')
      .toLowerCase()
      .replace(/’/g, "'")
      .match(/[\p{L}\p{M}\p{N}]+(?:['‐‑-][\p{L}\p{M}\p{N}]+)*/gu) ?? []
  );
}

// This symbol never crosses the raw check JSON interface. Only the native
// reader supplies a separate token stream for asides, compounds and voices.
const readerWords = Symbol('sung word tokens');
function observedWords(obs) {
  if (obs && has(obs, readerWords)) return obs[readerWords] ?? undefined;
  return typeof obs?.text === 'string' ? wordTokens(obs.text) : undefined;
}

export function checkReaderForm(catalog, id, options) {
  if (!options.lines) return checkForm(catalog, id, options);
  const lines = options.lines.map((line) => {
    if (!isRecord(line) || !has(line, 'sungWords')) return line;
    const { sungWords, ...obs } = line;
    requireValue(
      sungWords === null ||
        (Array.isArray(sungWords) &&
          sungWords.every(
            (token) => typeof token === 'string' && token.length && !/\s/u.test(token)
          )),
      'Invalid sung word tokens'
    );
    return {
      ...obs,
      [readerWords]:
        sungWords?.map((token) => token.normalize('NFC').toLowerCase().replace(/’/g, "'")) ?? null,
    };
  });
  return checkForm(catalog, id, { ...options, lines });
}

function identity(obs, key) {
  const id = obs?.[key];
  let text;
  if (typeof obs?.text === 'string') {
    if (key === 'returns') text = obs.text.normalize('NFC').trim() || undefined;
    if (key === 'endWord') text = observedWords(obs)?.at(-1);
  }
  return { id, text };
}

function compareClass(members, key) {
  // Text identities and analyzer-provided opaque identities are separate namespaces.
  const ids = new Set(),
    texts = new Set();
  let missingId = false,
    missingText = false,
    bridge = false,
    missingBoth = false;
  for (const obs of members) {
    const { id, text } = identity(obs, key);
    if (id !== undefined) ids.add(id);
    else missingId = true;
    if (text !== undefined) texts.add(text);
    else missingText = true;
    bridge ||= id !== undefined && text !== undefined;
    missingBoth ||= id === undefined && text === undefined;
  }
  if (ids.size > 1 || texts.size > 1) return 'fail';
  return !missingBoth && (!missingId || !missingText || bridge) ? 'pass' : 'unknown';
}

function distinguish(groups) {
  const ids = new Map(),
    texts = new Map();
  let idOnly = false,
    textOnly = false,
    unseen = false;
  for (const group of groups) {
    let seenId = false,
      seenText = false;
    for (const obs of group.members) {
      const { id, text } = identity(obs, group.key);
      if (id !== undefined) {
        if (ids.has(id) && ids.get(id) !== group.label) return 'fail';
        ids.set(id, group.label);
        seenId = true;
      }
      if (text !== undefined) {
        if (texts.has(text) && texts.get(text) !== group.label) return 'fail';
        texts.set(text, group.label);
        seenText = true;
      }
    }
    idOnly ||= seenId && !seenText;
    textOnly ||= seenText && !seenId;
    unseen ||= !seenId && !seenText;
  }
  return unseen || (idOnly && textOnly) ? 'unknown' : 'pass';
}

function observedValue(obs, key) {
  if (!obs) return undefined;
  if (has(obs, key)) return obs[key];
  if (obs.stress && key === 'stresses') return obs.stress.split('/').length - 1;
  if (obs.stress && key === 'syllables') return obs.stress.length;
  return undefined;
}

export function checkForm(catalog, id, options = {}) {
  const plan = realizeForm(catalog, id, options);
  const checks = [];
  if (plan.status !== 'ready') return { ...plan, verdict: 'unknown', checks };
  const observationsByAddress = new Map(),
    classSets = new Map();
  function add(kind, outcome, detail = {}) {
    checks.push({ kind, outcome, ...detail });
  }
  function align(key, observed) {
    if (plan.coverage[key] === 'none') {
      if (observed) add(key + '-coverage', 'unknown');
      return;
    }
    const units = plan[key],
      full = plan.coverage[key] === 'complete';
    const minimum = plan.minimum[key];
    const outcome = !observed
      ? 'unknown'
      : observed.length < minimum
        ? 'fail'
        : !full
          ? 'unknown'
          : observed.length === units.length
            ? 'pass'
            : 'fail';
    add(key + '-count', outcome, {
      expected: full ? units.length : minimum,
      exact: full,
      ...(observed && { actual: observed.length }),
    });
    for (const unit of units) {
      if (unit.positionKnown && observed?.[unit.index - 1]) {
        observationsByAddress.set(unit.address, observed[unit.index - 1]);
      } else if (!unit.positionKnown) {
        add('position', 'unknown', { address: unit.address });
      }
    }
  }
  align('lines', observations(options.lines, true));
  align('sections', observations(options.sections, false));
  const extra = options.units === undefined ? {} : options.units;
  requireValue(isRecord(extra), 'Expected unit observations by address');
  const used = new Set();
  function inspect(node, parent, inLine, inferred) {
    let obs = observationsByAddress.get(node.address) ?? inferred;
    if (has(extra, node.address)) {
      const value = extra[node.address];
      requireValue(
        isRecord(value) && (!has(value, 'text') || typeof value.text === 'string'),
        'Invalid unit observation at ' + node.address
      );
      validateFeatures(value);
      if (obs) {
        for (const key of Object.keys(obs))
          requireValue(
            !has(value, key) || value[key] === obs[key],
            'Conflicting observations at ' + node.address
          );
      }
      obs = { ...obs, ...value };
      used.add(node.address);
    }
    // A named event outside the line/section projections needs its own observation.
    // Measured groups nested within a line also have requirements beyond its total length.
    const needsUnit =
      node.unit !== 'line' &&
      node.unit !== 'section' &&
      (!node.children.length ||
        inLine ||
        node.unit === 'simultaneous' ||
        node.unit === 'staggered-voices');
    if (needsUnit || (obs && has(obs, 'unit'))) {
      add('unit', obs?.unit === undefined ? 'unknown' : obs.unit === node.unit ? 'pass' : 'fail', {
        address: node.address,
        expected: node.unit,
      });
    }
    // Two arrays with matching counts cannot prove where each intervening stanza ends.
    const [start, end] = node.span.lines;
    const container = parent?.span.lines ?? [0, plan.lines.length];
    const needsSpan =
      node.unit !== 'line' &&
      node.children.length &&
      end > start &&
      (start !== container[0] || end !== container[1]);
    if (obs && has(obs, 'lineSpan')) {
      requireValue(
        Array.isArray(obs.lineSpan) &&
          obs.lineSpan.length === 2 &&
          obs.lineSpan.every(integer) &&
          obs.lineSpan[0] <= obs.lineSpan[1],
        'Invalid observed line span'
      );
      const [a, b] = node.span.lines;
      add(
        'line-span',
        plan.coverage.lines !== 'complete'
          ? 'unknown'
          : a === obs.lineSpan[0] && b === obs.lineSpan[1]
            ? 'pass'
            : 'fail',
        { address: node.address, expected: [a, b] }
      );
    }
    if (needsSpan && !obs?.lineSpan)
      add('line-span', 'unknown', { address: node.address, expected: [start, end] });
    for (const key of FEATURES) {
      if (!has(node, key)) continue;
      if (IDENTITIES.has(key)) {
        const groupKey = JSON.stringify([key, node[key]]);
        if (!classSets.has(groupKey))
          classSets.set(groupKey, { key, label: node[key], addresses: [], members: [] });
        const group = classSets.get(groupKey);
        group.addresses.push(node.address);
        group.members.push(obs);
      } else {
        const actual = observedValue(obs, key);
        add(key, actual === undefined ? 'unknown' : actual === node[key] ? 'pass' : 'fail', {
          address: node.address,
          expected: node[key],
        });
      }
    }
    let inferredCount, tokens;
    const part = node.children[0]?.unit;
    const measurable =
      (node.unit === 'line' && ['word', 'syllable', 'mora'].includes(part)) ||
      (node.unit === 'word' && part === 'letter');
    if (measurable && node.children.every((child) => child.unit === part)) {
      const countKey = { word: 'words', syllable: 'syllables', mora: 'moras', letter: 'letters' }[
        part
      ];
      if (obs && has(obs, countKey))
        requireValue(integer(obs[countKey]), 'Invalid observed ' + countKey);
      if (typeof obs?.text === 'string') {
        if (part === 'word') tokens = observedWords(obs);
        if (part === 'letter') tokens = obs.text.normalize('NFC').match(/\p{L}/gu) ?? [];
      }
      inferredCount = tokens?.length ?? observedValue(obs, countKey);
      if (tokens && has(obs, countKey))
        requireValue(tokens.length === obs[countKey], 'Inconsistent ' + countKey);
      add(
        part + '-count',
        inferredCount === undefined
          ? 'unknown'
          : inferredCount === node.children.length
            ? 'pass'
            : 'fail',
        {
          address: node.address,
          expected: node.children.length,
          ...(inferredCount !== undefined && { actual: inferredCount }),
        }
      );
    }
    // A measured final phrase belongs at the end of its enclosing line.
    const last = node.children.at(-1);
    if (
      node.unit === 'line' &&
      last?.unit === 'phrase' &&
      typeof obs?.text === 'string' &&
      typeof extra[last.address]?.text === 'string'
    ) {
      const source = observedWords(obs),
        ending = wordTokens(extra[last.address].text);
      const matches =
        source &&
        ending.length > 0 &&
        ending.length <= source.length &&
        ending.every((token, i) => token === source[source.length - ending.length + i]);
      add('closing-phrase', source === undefined ? 'unknown' : matches ? 'pass' : 'fail', {
        address: last.address,
      });
    }
    node.children.forEach((child, i) => {
      const observation =
        inferredCount !== undefined && i < inferredCount
          ? { unit: part, ...(tokens && { text: tokens[i] }) }
          : undefined;
      inspect(child, node, inLine || node.unit === 'line', observation);
    });
  }
  for (const root of plan.tree) inspect(root, null, false);
  requireValue(
    Object.keys(extra).every((key) => used.has(key)),
    'Unknown unit observation address'
  );
  const families = new Map();
  for (const group of classSets.values()) {
    const family = group.key;
    if (!families.has(family)) families.set(family, []);
    families.get(family).push(group);
    if (group.members.length > 1)
      add(group.key, compareClass(group.members, group.key), {
        label: group.label,
        addresses: group.addresses,
      });
  }
  for (const groups of families.values()) {
    const key = groups[0].key;
    if (groups.length > 1 && (key === 'rhyme' || key === 'endWord')) {
      add(key + '-distinct', distinguish(groups), { labels: groups.map((g) => g.label) });
    } else {
      for (const group of groups) {
        if (group.members.length === 1)
          add(key + '-unpaired', 'unknown', { label: group.label, addresses: group.addresses });
      }
    }
  }
  const verdict = checks.some((c) => c.outcome === 'fail')
    ? 'fail'
    : checks.length && checks.every((c) => c.outcome === 'pass')
      ? 'pass'
      : 'unknown';
  return { ...plan, verdict, checks };
}
