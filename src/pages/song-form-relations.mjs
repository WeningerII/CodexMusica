const evidenceLabels = {
  catalog: 'Catalog evidence only',
  reference: 'Reference recorded, passage unverified',
  passage: 'Source passage checked',
};
const relNames = {
  variant: ['Variant of', 'Has variant'],
  contains: ['Can contain', 'Can occur within'],
  'shares-feature': ['Shares a feature with', 'Shares a feature with'],
  comparison: ['Compare with', 'Compare with'],
  other: ['Documented link to', 'Documented link from'],
};

export function relationshipsFor(links, forms, formId) {
  const related = new Map();
  const evidence = new Map();
  for (const e of links) {
    if (e.source !== formId && e.target !== formId) continue;
    const outgoing = e.source === formId,
      id = outgoing ? e.target : e.source;
    if (!forms.has(id) || id === formId) continue;
    const kind = (relNames[e.kind] ?? relNames.other)[outgoing ? 0 : 1];
    if (!related.has(kind)) related.set(kind, new Set());
    related.get(kind).add(id);
    const key = kind + '|' + id;
    if (!evidence.has(key)) evidence.set(key, new Set());
    evidence.get(key).add(evidenceLabels[e.confidence]);
  }
  return { related, evidence };
}
