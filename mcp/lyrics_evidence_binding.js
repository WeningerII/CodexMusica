// Report-only association. No declaration translation or engine decisions.
const canonical = (v) => JSON.stringify(sort(v));
function sort(v) {
  if (Array.isArray(v)) return v.map(sort);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sort(v[k])])
    );
  return v;
}
export function checkEvidenceInvocation(result, args) {
  const record = result.lyric_result;
  const evidence = record?.schema_instance_evidence;
  const source = args.lines?.join('\n');
  if (
    record?.version !== 1 ||
    record.status !== 'graded' ||
    record.command !== 'brief' ||
    evidence?.version !== 1 ||
    !evidence.identity?.declaration_hash ||
    evidence.source_text !== source ||
    record.final_draft?.join('\n') !== source
  )
    return null;
  const declarations = Object.fromEntries(
    Object.entries(args).filter(
      ([key, value]) =>
        value !== undefined &&
        !['lines', 'lines_text', 'lexicon_supplement', 'lexicon_supplement_sha256'].includes(key)
    )
  );
  declarations.voices = args.voices === true;
  return {
    version: 1,
    tool: 'lyric_check',
    source_text: source,
    declarations,
    report_identity_hash: evidence.identity.hash,
    declaration_hash: evidence.identity.declaration_hash,
    reader_scheme: record.reader_scheme,
    voices: args.voices === true,
    lexicon: record.lexicon,
  };
}
export function bindEvidenceContext(evidence, context) {
  if (!evidence) return null;
  const { request_binding: _untrusted, ...report } = evidence;
  const invocation = report.invocation;
  if (
    !context ||
    context.version !== 1 ||
    !context.binding?.document_sha256 ||
    invocation?.version !== 1 ||
    invocation.tool !== 'lyric_check' ||
    invocation.source_text !== context.document ||
    context.document !== report.source_text ||
    invocation.report_identity_hash !== report.identity?.hash ||
    invocation.declaration_hash !== report.identity?.declaration_hash ||
    invocation.reader_scheme !== report.identity?.provenance?.reader_scheme ||
    invocation.voices !== report.identity?.provenance?.voices ||
    canonical(invocation.lexicon) !== canonical(report.identity?.provenance?.lexicon) ||
    canonical(invocation.declarations) !==
      canonical({ ...context.declarations, voices: context.declarations?.voices === true })
  )
    return report;
  return {
    ...report,
    request_binding: {
      version: 1,
      context: structuredClone(context),
      report_identity_hash: invocation.report_identity_hash,
      declaration_hash: invocation.declaration_hash,
      reader_scheme: invocation.reader_scheme,
      voices: invocation.voices,
    },
  };
}
