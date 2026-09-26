/* exported UITheme */
/* Theme preference: Light, Dark or System. Owned by the shell integration owner.

   Runs synchronously in <head>, before the first paint, in both pages:
   inlined into codex.html by scripts/build_html.js and loaded as a blocking
   script by atlas.html. It writes data-theme on <html> immediately, so the
   page never paints in the wrong theme and no stylesheet needs a media query.

   One preference, stored under localStorage "codex-theme", shared by the app
   and the atlas (same origin). The atlas embedded in the Map view follows a
   change through the storage event, or through a postMessage from the app
   when storage is unavailable. "system" follows prefers-color-scheme live. */
'use strict';
var UITheme = (function () {
  var KEY = 'codex-theme';
  var CHOICES = ['system', 'light', 'dark'];
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var listeners = [];
  function read() {
    try {
      var value = localStorage.getItem(KEY);
      return CHOICES.indexOf(value) >= 0 ? value : 'system';
    } catch {
      return 'system';
    }
  }
  var preference = read();
  function resolve(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    return media && media.matches ? 'dark' : 'light';
  }
  function apply() {
    var theme = resolve(preference);
    // A headless host (the tandem gate's script sandbox) has no real root;
    // the theme is then simply not drawn, and nothing after it may fail.
    var root = document.documentElement;
    if (root && root.setAttribute) {
      root.setAttribute('data-theme', theme);
      root.setAttribute('data-theme-preference', preference);
      if (root.style) root.style.colorScheme = theme;
    }
    var meta = document.querySelector && document.querySelector('meta[name="theme-color"]');
    if (meta && meta.setAttribute)
      meta.setAttribute('content', theme === 'dark' ? '#0b0b0b' : '#ffffff');
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](theme, preference);
      } catch {
        /* One listener cannot stop the others. */
      }
    }
  }
  function relay() {
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      try {
        frames[i].contentWindow.postMessage(
          { type: 'codex-theme', preference: preference },
          location.origin
        );
      } catch {
        /* A frame that is not ready will read the stored preference on load. */
      }
    }
  }
  function set(pref) {
    if (CHOICES.indexOf(pref) < 0) return false;
    preference = pref;
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      /* Storage unavailable: the choice holds for this page only. */
    }
    apply();
    relay();
    return true;
  }
  if (media) {
    var onSystem = function () {
      if (preference === 'system') apply();
    };
    if (media.addEventListener) media.addEventListener('change', onSystem);
    else if (media.addListener) media.addListener(onSystem);
  }
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    preference = read();
    apply();
  });
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'codex-theme') return;
    if (window.parent === window || e.source !== window.parent) return;
    if (CHOICES.indexOf(e.data.preference) < 0) return;
    preference = e.data.preference;
    apply();
  });
  apply();
  return {
    preference: function () {
      return preference;
    },
    theme: function () {
      return resolve(preference);
    },
    set: set,
    onChange: function (fn) {
      listeners.push(fn);
    },
    // Read a token as the current theme resolves it (canvas drawing needs this).
    token: function (name, fallback) {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    },
  };
})();
