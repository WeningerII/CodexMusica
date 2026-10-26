'use strict';

// The text between a `{` at `openBrace` and its matching `}`, skipping string
// literals so a brace inside a quoted string does not count. Enough for the
// injected harvester core, which carries no regex literals or comments.
function balancedBody(src, openBrace) {
  if (src[openBrace] !== '{') throw new Error('balancedBody: no `{` at offset ' + openBrace);
  let depth = 0;
  let quote = null;
  for (let i = openBrace; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return src.slice(openBrace + 1, i);
  }
  throw new Error('balancedBody: unbalanced braces after offset ' + openBrace);
}

// Card-descriptor semantics: there are TWO different card-descriptor harvesters
// in the codex, intentionally:
//   - `_card_descriptors.cardDescriptors` and the HTML embed's
//     `_cardDescriptorSet` pool ONLY variant.descriptors (production semantics).
//   - `_matcher.cardDescriptors` pools variant.descriptors AND
//     variant.match_tokens (offline audit-tool semantics).
//
// This check locks in the dichotomy:
//   1. Both production-side harvesters (HTML embed + _card_descriptors.js)
//      must NOT pool match_tokens. Re-introducing match_tokens to the HTML
//      embed silently changes preface assignments for ~5/79 regression
//      fixtures and uncontrolled additional cards.
//   2. The audit-tool harvester (_matcher.cardDescriptors) MUST pool
//      match_tokens, because audit tools depend on the enriched signal.
//
// If either invariant breaks, fail loudly: the divergence is a known design
// choice, not a bug to be "fixed" by silent equalization.
function checkCardDescriptorSemantics({ prodNodeSrc, auditNodeSrc, builtHtml }) {
  // The production harvester is now SINGLE-SOURCE in scripts/_card_descriptors.js
  // (the @inline `harvestDescriptors` core) and injected into codex.html by
  // build_html.js. There is no hand-duplicated copy in src/app.js anymore, so we
  // read the production body from the built HTML (proving the inject happened)
  // and still guard the match_tokens divergence vs the audit harvester.
  // The injected core in the built HTML. build_html.js squeezes every block it
  // emits (2026-09-14), so the core sits on one line: no space after the comma,
  // no newline before its closing brace. The regex this used to anchor on
  // (`\n}`) described the pretty-printed shape, not the function, and stopped
  // matching the day the page shipped minified. Find the declaration and walk
  // its braces to the matching close instead; that reads the same body from
  // either shape. Parameter names are local and are renamed by minification;
  // require the two-argument signature, not its source spelling.
  const decl = builtHtml.match(
    /\bfunction harvestDescriptors\(\s*[A-Za-z_$][\w$]*\s*,\s*[A-Za-z_$][\w$]*\s*\)\s*\{/
  );
  if (!decl)
    throw new Error('harvestDescriptors not found in built codex.html — build_html inject missing');
  const embedBody = balancedBody(builtHtml, decl.index + decl[0].length - 1);
  if (!/\bfunction _cardDescriptorSet\(\s*[A-Za-z_$][\w$]*\s*\)\s*\{/.test(builtHtml)) {
    throw new Error('_cardDescriptorSet browser adapter not found in built codex.html');
  }

  // Extract cardDescriptors body from _matcher.js
  const m2 = auditNodeSrc.match(/function cardDescriptors\(card\)\s*\{([\s\S]*?)\n\}/);
  if (!m2) throw new Error('cardDescriptors not found in _matcher.js');
  const matcherBody = m2[1];

  const issues = [];

  // Production-side: HTML embed and _card_descriptors.js must NOT reference match_tokens.
  // Strip comments first — the injected core carries an explanatory comment that
  // literally says "NOT match_tokens", which is documentation, not a code reference.
  const stripComments = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (/match_tokens/.test(stripComments(embedBody))) {
    issues.push(
      'HTML _cardDescriptorSet references match_tokens — would silently change production preface assignments'
    );
  }
  if (
    /match_tokens/.test(prodNodeSrc.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''))
  ) {
    // Strip comments before checking — the header documents the divergence and mentions match_tokens
    issues.push(
      '_card_descriptors.js references match_tokens outside comments — production gate would drift from HTML embed'
    );
  }

  // Audit-side: _matcher.cardDescriptors MUST reference match_tokens
  if (!/match_tokens/.test(matcherBody)) {
    issues.push(
      '_matcher.cardDescriptors no longer pools match_tokens — audit tools would lose the enrichment signal they were designed to consume'
    );
  }

  if (issues.length) throw new Error(issues.join('; '));
  return 'production harvesters skip match_tokens; audit harvester includes match_tokens (documented divergence preserved)';
}

module.exports = checkCardDescriptorSemantics;
