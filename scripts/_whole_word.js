'use strict';
// _whole_word.js — is a word printed, as a WHOLE word, in a piece of a recipe?
//
// One rule for every place that decides whether a part descriptor someone
// pinned was printed (#671): the connector's render_warnings (mcp/engine.js)
// and the CLI's --swap-variant stderr note (scripts/translate.js). Each one
// applies it inside the card's own segment of the output it rendered; this file
// only answers whether `word` is a whole word of `text`.
//
// A whole word is bounded as `\b` bounds one, made Unicode-aware: no letter,
// digit, combining mark or underscore on either side. A hyphen is a boundary,
// so `modern` is a word in `uilleann-pipes: modern cane` and in a hyphenated
// compound such as `modern-alder` (where subsumption folds a pinned word into a
// longer one, the word is still printed), but not in `postmodern`, and `low` is
// not in `bellowing`. Case is ignored: compact prints catalog names as named,
// and the CLI capitalises proper nouns and acronyms.

const WORD_EDGE = '[\\p{L}\\p{N}\\p{M}_]';

function hasWord(text, word) {
  const w = String(word || '').toLowerCase();
  if (!text || !w) return false;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<!${WORD_EDGE})${esc}(?!${WORD_EDGE})`, 'u').test(
    String(text).toLowerCase()
  );
}

module.exports = { WORD_EDGE, hasWord };
