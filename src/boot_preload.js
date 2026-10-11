/* The boot index's preload, as a script: flagged Library builds only
   (scripts/build_html.js; a default build keeps the static <link>, byte for
   byte). It adds exactly the element the static build has, except on a
   #library route, which does not draw from the boot index first
   (docs/library-native-design.md, "Code loading", head preloads). BOOT_URL is
   replaced by the build; build_html.js --check runs this against hashes. */
(function () {
  try {
    if (/^#library(\/|\?|$)/.test(location.hash)) return;
  } catch {
    /* No hash to read: preload as the static build does. */
  }
  var link = document.createElement('link');
  link.setAttribute('rel', 'preload');
  link.setAttribute('href', 'BOOT_URL');
  link.setAttribute('as', 'fetch');
  link.setAttribute('crossorigin', 'anonymous');
  document.head.appendChild(link);
})();
