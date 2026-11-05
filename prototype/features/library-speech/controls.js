// Production semantics: src/library/reader.js at 10b42689f04, lines 1132–1150,
// 1326–1388. Integration pending Don's adapter and one-shot autoplay contract.
// ctx: {signal, announce, storage, language, lines, speech}
// lines: complete reading [{analysis_line: number|null, text: string}].
// Accepted port: #668 issuecomment-6642118480. speech provides available,
// getVoices(), subscribeVoices(fn)->unsubscribe, takeAutoplay()->boolean,
// speak(text,{lang,voiceURI,rate,onend,onerror})->{cancel()}.
// The shell owns device binding, rate clamping and the transient autoplay grant.
// Each returned cancellation handle owns only its utterance; no global cancel.
const TAGS = {
  eng: 'en',
  fas: 'fa',
  fin: 'fi',
  cym: 'cy',
  non: 'is',
  ltc: 'zh',
  msa: 'ms',
  san: 'sa',
  som: 'so',
};

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const stylesheet = doc.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./controls.css', import.meta.url).href;
  host.append(stylesheet);
  const root = doc.createElement('section');
  root.className = 'library-speech';
  root.setAttribute('aria-label', 'Read aloud');
  const make = (tag, text, parent = root) => {
    const el = doc.createElement(tag);
    if (text) el.textContent = text;
    parent.append(el);
    return el;
  };
  make('h2', 'Read aloud');
  const voiceLabel = make('label', 'Device voice');
  const select = make('select', '', voiceLabel);
  const speedLabel = make('label', 'Speed');
  const output = make('span', '1.0×', speedLabel);
  const speed = make('input', '', speedLabel);
  speed.type = 'range';
  speed.min = '0.5';
  speed.max = '2';
  speed.step = '0.1';
  speed.value = '1';
  const button = make('button', 'Read this work');
  button.type = 'button';
  make(
    'p',
    ctx.language === 'ltc'
      ? 'Modern Chinese device speech · independent from Middle Chinese analysis'
      : 'Device speech · independent from phonology evidence'
  );
  const status = make('p', '');
  host.append(root);
  const adapter = ctx.speech;
  let dead = false,
    generation = 0,
    active = false,
    waiting = false,
    rate = 1,
    selected = '',
    unsubscribe,
    current;
  const removers = [];
  const say = (text) => {
    if (!dead) {
      status.textContent = text;
      ctx.announce?.(text);
    }
  };
  const paint = () => {
    button.textContent = active || waiting ? 'Stop' : 'Read this work';
    button.setAttribute('aria-pressed', String(active || waiting));
  };
  const cancel = () => {
    generation++;
    active = false;
    waiting = false;
    const owned = current;
    current = null;
    try {
      owned?.handle?.cancel();
    } catch {
      say('Device speech could not be stopped.');
    }
    paint();
  };
  const voices = () => {
    const values = adapter.getVoices();
    if (!Array.isArray(values)) throw new Error('Invalid voice list');
    return values.filter(
      (v) =>
        v &&
        typeof v.voiceURI === 'string' &&
        typeof v.name === 'string' &&
        typeof v.lang === 'string'
    );
  };
  const refresh = (list) => {
    select.replaceChildren();
    const match = make('option', 'Match language', select);
    match.value = '';
    for (const v of list) {
      const option = make('option', `${v.name} · ${v.lang}`, select);
      option.value = v.voiceURI;
    }
    select.value = list.some((v) => v.voiceURI === selected) ? selected : '';
    selected = select.value;
  };
  function play(auto = false) {
    if (dead) return;
    if (!adapter?.available) return say('Device speech is not available in this browser.');
    let list;
    try {
      list = voices();
      refresh(list);
    } catch {
      waiting = false;
      paint();
      return say('Device speech is not available in this browser.');
    }
    const chosen =
      list.find((v) => v.voiceURI === selected) ||
      list.find((v) => v.lang.toLowerCase().startsWith(TAGS[ctx.language] ?? '!'));
    if (!chosen) {
      waiting = auto && list.length === 0;
      paint();
      return say(
        waiting
          ? 'Waiting for device voices.'
          : 'No matching device voice is available for this language.'
      );
    }
    const lines = ctx.lines;
    if (
      !Array.isArray(lines) ||
      lines.some(
        (l) =>
          !l ||
          !(l.analysis_line === null || Number.isInteger(l.analysis_line)) ||
          typeof l.text !== 'string'
      )
    ) {
      waiting = false;
      paint();
      return say('Complete reading lines are unavailable.');
    }
    const chunks = lines.filter((l) => l.analysis_line !== null && l.text).map((l) => l.text);
    const gen = ++generation;
    waiting = false;
    active = true;
    paint();
    status.textContent = '';
    let index = 0,
      advancing = false,
      again = false;
    function next() {
      if (advancing) {
        again = true;
        return;
      }
      advancing = true;
      try {
        do {
          again = false;
          step();
        } while (again);
      } finally {
        advancing = false;
      }
    }
    function step() {
      if (dead || gen !== generation || !active) return;
      if (index === chunks.length) {
        active = false;
        paint();
        return;
      }
      let settled = false;
      const owned = { handle: null };
      current = owned;
      const finish = (error) => {
        if (settled || dead || gen !== generation || !active) return;
        settled = true;
        if (current === owned) current = null;
        if (error) {
          generation++;
          active = false;
          paint();
          say('Device speech could not read this work.');
        } else next();
      };
      try {
        owned.handle = adapter.speak(chunks[index++], {
          voiceURI: chosen.voiceURI,
          lang: chosen.lang,
          rate,
          onend: () => finish(false),
          onerror: () => finish(true),
        });
        if (!owned.handle || typeof owned.handle.cancel !== 'function')
          throw new Error('Missing utterance handle');
        if (!settled && (dead || gen !== generation)) owned.handle.cancel();
      } catch {
        finish(true);
      }
    }
    next();
  }
  const listen = (el, type, fn) => {
    el.addEventListener(type, fn, el === ctx.signal ? undefined : { signal: ctx.signal });
    removers.push(() => el.removeEventListener(type, fn));
  };
  listen(button, 'click', () => {
    if (active || waiting) cancel();
    else play();
  });
  listen(select, 'change', () => {
    selected = select.value;
  });
  listen(speed, 'input', () => {
    const n = Number(speed.value);
    if (Number.isFinite(n)) rate = Math.min(2, Math.max(0.5, n));
    speed.value = String(rate);
    output.textContent = `${rate.toFixed(1)}×`;
  });
  function unmount() {
    if (dead) return;
    dead = true;
    generation++;
    active = false;
    waiting = false;
    for (const remove of removers) remove();
    try {
      unsubscribe?.();
    } catch {
      /* adapter cleanup is best effort */
    }
    const owned = current;
    current = null;
    try {
      owned?.handle?.cancel();
    } catch {
      /* already detached */
    }
    root.remove();
    stylesheet.remove();
  }
  if (ctx.signal?.aborted) unmount();
  else {
    if (ctx.signal) listen(ctx.signal, 'abort', unmount);
    try {
      const auto = adapter?.takeAutoplay?.() === true;
      if (
        !adapter?.available ||
        typeof adapter.takeAutoplay !== 'function' ||
        typeof adapter.speak !== 'function' ||
        typeof adapter.subscribeVoices !== 'function'
      )
        throw new Error('Missing adapter');
      refresh(voices());
      unsubscribe = adapter.subscribeVoices(() => {
        if (dead) return;
        try {
          refresh(voices());
          if (waiting) play(true);
        } catch {
          waiting = false;
          paint();
          say('Device voices are unavailable.');
        }
      });
      if (typeof unsubscribe !== 'function') throw new Error('Missing unsubscribe');
      if (auto) play(true);
    } catch {
      button.disabled = true;
      say('Device speech is not available in this browser.');
    }
  }
  paint();
  return {
    unmount,
    focus() {
      if (!dead) button.focus();
    },
  };
}
