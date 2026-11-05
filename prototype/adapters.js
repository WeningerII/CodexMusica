// Shell adapters a lane receives instead of reaching for the page itself
// (#670, #668 6641909843): media for images, overlay for anything that takes
// over the page. A lane adds no window or document listener and no root
// style (check_prototype_isolation.js rule 6); these hold that on its behalf.

// media.resolve(image) → a committed, same-origin file URL, or null. The
// prototype makes no off-origin request (R2's limit 1), so production's remote
// images resolve to null and the lane shows its image-unavailable state.
const LOCAL = /^\.\.\/assets\/[\w-]+(?:\/[\w.-]+)+\.(?:webp|avif|png|jpe?g|svg)$/;
export const media = Object.freeze({
  resolve(image) {
    return typeof image === 'string' && LOCAL.test(image) && !image.includes('..', 3)
      ? image
      : null;
  },
});

// overlay.open({ label, onClose }) → { close() }. While one is open the shell
// holds one history entry and locks page scroll. Back closes it and calls
// onClose once; close() releases it without calling onClose. Opening another
// while one is open closes the first through its onClose.
let current = null;
let skipPop = false;
const root = () => document.documentElement;

function release(entry) {
  if (current !== entry) return false;
  current = null;
  root().style.overflow = entry.overflow;
  return true;
}

window.addEventListener('popstate', () => {
  if (skipPop) {
    skipPop = false;
    return;
  }
  const entry = current;
  if (entry && release(entry)) entry.onClose();
});

export const overlay = Object.freeze({
  open({ label, onClose } = {}) {
    if (typeof onClose !== 'function') throw new TypeError('overlay.open needs onClose');
    // A second overlay takes over the first one's history entry and scroll
    // lock (no back-then-push, which would race), and closes it.
    const previous = current;
    const entry = { onClose, overflow: previous ? previous.overflow : root().style.overflow };
    current = entry;
    if (previous) previous.onClose();
    else {
      history.pushState({ protoOverlay: String(label || '') }, '');
      root().style.overflow = 'hidden';
    }
    return Object.freeze({
      close() {
        if (!release(entry)) return;
        skipPop = true;
        history.back();
      },
    });
  },
});

// ctx.speech for read-aloud (#758, #668 6642118480): the device's speech,
// bound here so a lane never names it.
//   available                  whether this browser can speak at all
//   getVoices()                frozen [{ voiceURI, name, lang, default, localService }]
//   subscribeVoices(fn)        → unsubscribe; fn() when the device's voices change
//   speak(text, { lang, voiceURI, rate, onend, onerror }) → { cancel() }
//   takeAutoplay()             true once if Play opened this reading, then false
// The device has one speech queue and only a global cancel, so the adapter
// gives it one utterance at a time: each handle owns its utterance alone, and
// cancelling one never stops another's. Rate is clamped to production's
// 0.5–2. onend and onerror run at most once, and never after cancel().
export function speechAdapter({ autoplay = false } = {}) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  const Utterance =
    typeof SpeechSynthesisUtterance === 'function' ? SpeechSynthesisUtterance : null;
  const available = !!(synth && Utterance);
  let grant = !!autoplay;
  const queue = []; // [{ text, opts, live }]
  let current = null;
  const voices = () => (available && synth.getVoices ? synth.getVoices() : []);
  const pump = () => {
    if (current || !queue.length) return;
    current = queue.shift();
    const job = current;
    const { lang, voiceURI, rate } = job.opts;
    const u = new Utterance(String(job.text));
    const voice = voiceURI ? voices().find((v) => v.voiceURI === voiceURI) : null;
    if (voice) u.voice = voice;
    if (voice || lang) u.lang = voice ? voice.lang : String(lang);
    const r = Number(rate);
    u.rate = Number.isFinite(r) ? Math.min(2, Math.max(0.5, r)) : 1;
    const settle = (fn, arg) => {
      if (current !== job) return;
      current = null;
      if (job.live) {
        job.live = false;
        if (typeof fn === 'function') fn(arg);
      }
      pump();
    };
    u.onend = () => settle(job.opts.onend);
    u.onerror = (e) => settle(job.opts.onerror, e && e.error);
    synth.speak(u);
  };
  return Object.freeze({
    available,
    getVoices: () =>
      Object.freeze(
        voices().map((v) =>
          Object.freeze({
            voiceURI: v.voiceURI,
            name: v.name,
            lang: v.lang,
            default: !!v.default,
            localService: !!v.localService,
          })
        )
      ),
    subscribeVoices(fn) {
      if (!available || typeof fn !== 'function') return () => {};
      const on = () => fn();
      synth.addEventListener('voiceschanged', on);
      return () => synth.removeEventListener('voiceschanged', on);
    },
    speak(text, opts = {}) {
      if (!available)
        throw Object.assign(new Error('Device speech is not available.'), { code: 'UNAVAILABLE' });
      const job = { text, opts, live: true };
      queue.push(job);
      pump();
      return Object.freeze({
        cancel() {
          if (!job.live) return;
          job.live = false;
          const at = queue.indexOf(job);
          if (at >= 0) queue.splice(at, 1);
          else if (current === job) {
            current = null;
            synth.cancel(); // only this utterance is with the device
            pump();
          }
        },
      });
    },
    takeAutoplay() {
      const g = grant;
      grant = false;
      return g;
    },
  });
}
