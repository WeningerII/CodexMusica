// The codex skin convention for Twemoji artwork.
//
// Every glyph in the codex that depicts a person is recoloured from Twemoji's
// stock yellow to the codex green. This is why ✊ next to 🤠 in the tradition
// tree reads as one family of pictograph rather than two. The convention was
// applied by hand for years, which is exactly why it drifted — ✊ (protest song)
// and 🫠 shipped stock yellow until they were caught by eye.
//
// It now lives here, is applied at build time, and is enforced by
// scripts/check_glyph_skin.js.
//
// The palette mapping was derived from the glyphs that already followed the
// convention (😴 🥹 🤠), not invented: Twemoji uses two skin base colours
// (#FFDC5D on limbs and hands, #FFCC4D on faces) each with one shade partner.

const SKIN_SWAP = [
  ['#FFDC5D', '#77bf57'], // limb / hand base   → codex green base
  ['#FFCC4D', '#77bf57'], // face base          → codex green base
  ['#EF9645', '#6ab948'], // limb / hand shade  → codex green shade
  ['#FFAC33', '#6ab948'], // face shade         → codex green shade
];

// Unicode blocks whose members are faces. Used only as a fallback signal, and
// only in combination with the presence of face-base yellow, so a non-face
// glyph can never be dragged in by codepoint alone.
const FACE_RANGES = [
  [0x1f600, 0x1f64f], // emoticons (includes cat faces and person gestures)
  [0x1f910, 0x1f92f], // supplemental faces (🤠 🤬 🤯 …)
  [0x1f970, 0x1f97a], // 🥰 🥵 🥶 🥹 …
  [0x1fae0, 0x1fae8], // 🫠 🫡 🫥 …
];

// Glyphs that use a skin colour for something that is not skin.
//
// Across the whole 15.x set, exactly one does: 🪷 LOTUS paints the flower's
// centre with #FFDC5D. Every other one of the 366 glyphs carrying that colour
// depicts a person (down to the odd ones — Santa, a guardsman, a merperson, a
// handshake). Greening the lotus would turn its heart green, so it is excluded
// from both the recolour and the check.
//
// To re-derive after a Twemoji version bump: for every vendored SVG containing
// #FFDC5D, look up the codepoint's Unicode name and list the ones that name no
// person or body part.
const NON_HUMAN_SKIN_YELLOW = new Set(['1fab7']);

function inFaceRange(codepoint) {
  const first = parseInt(String(codepoint).split('-')[0], 16);
  if (!Number.isFinite(first)) return false;
  return FACE_RANGES.some(([lo, hi]) => first >= lo && first <= hi);
}

// Does this artwork depict a person?
//
// Three signals, in order of reliability:
//   1. #FFDC5D is Twemoji's dedicated skin colour — it appears on all 366 body
//      and hand glyphs in the set and on nothing else. Presence is conclusive.
//   2. A full-canvas circle (or the equivalent path) filled with the face base
//      is the canonical Twemoji face. Conclusive.
//   3. Face-block codepoint carrying face-base yellow — catches the faces whose
//      base is not a full-canvas circle (cat faces, 🤠, 🫠, 🙃).
function isHumanArtwork(svgText, codepoint) {
  if (NON_HUMAN_SKIN_YELLOW.has(String(codepoint).toLowerCase())) return false;
  const upper = svgText.toUpperCase();
  if (upper.includes('#FFDC5D')) return true;
  if (!upper.includes('#FFCC4D')) return false;

  const circles = svgText.match(/<(?:circle|ellipse)[^>]*>/gi) || [];
  for (const c of circles) {
    if (!c.toUpperCase().includes('#FFCC4D')) continue;
    if (/cx="18"/.test(c) && /cy="18"/.test(c) && /r="18"/.test(c)) return true;
  }
  if (/fill="#FFCC4D"[^>]*d="M36 18c0 9\.941/i.test(svgText)) return true;
  if (/d="M36 18c0 9\.941[^"]*"[^>]*fill="#FFCC4D"/i.test(svgText)) return true;

  return inFaceRange(codepoint);
}

// Apply the convention. Non-human artwork is returned untouched — plenty of
// objects are legitimately yellow (🔥 🌽 👑 🌙) and must stay that way.
function greenifySkin(svgText, codepoint) {
  if (!isHumanArtwork(svgText, codepoint)) return { svg: svgText, changed: 0 };
  let out = svgText;
  let changed = 0;
  for (const [from, to] of SKIN_SWAP) {
    const re = new RegExp(from, 'gi');
    const hits = out.match(re);
    if (hits) {
      changed += hits.length;
      out = out.replace(re, to);
    }
  }
  return { svg: out, changed };
}

// Yellow that should never survive on a human glyph.
function residualSkinYellow(svgText) {
  const found = [];
  for (const [from] of SKIN_SWAP) {
    if (new RegExp(from, 'i').test(svgText)) found.push(from);
  }
  return found;
}

module.exports = {
  SKIN_SWAP,
  NON_HUMAN_SKIN_YELLOW,
  isHumanArtwork,
  greenifySkin,
  residualSkinYellow,
  inFaceRange,
};
