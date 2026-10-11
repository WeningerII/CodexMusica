/* The Library's head start: flagged Library builds only (scripts/build_html.js
   inlines it after the engine preload). On a #library route over http(s) it
   asks, from <head>, for what the tab draws first (docs/library-native-design.md,
   "Code loading", head preloads):
     - the core chunk, as a script with its integrity (the loader's own request
       then reuses it);
     - library/data/catalog.json;
     - on a read route, the reader chunk and either the reading's head file
       (when the link carries its <rev16>-<proj12> path key) or its u/ shard;
     - on a wide screen (the rail open), collections.json at low priority.
   Any other route, or file://, asks for nothing. LIBRARY_PRELOAD is replaced
   by the build with { core, reader, data }; build_html.js --check runs this
   against hashes. */
(function () {
  try {
    var table = 'LIBRARY_PRELOAD';
    if (!/^https?:$/.test(location.protocol)) return;
    var hash = location.hash;
    if (!/^#library(\/|\?|$)/.test(hash)) return;
    var add = function (href, as, attrs) {
      var link = document.createElement('link');
      link.setAttribute('rel', 'preload');
      link.setAttribute('href', href);
      link.setAttribute('as', as);
      link.setAttribute('crossorigin', 'anonymous');
      for (var key in attrs) link.setAttribute(key, attrs[key]);
      document.head.appendChild(link);
    };
    var chunk = function (entry) {
      if (entry) add(entry[0], 'script', { integrity: entry[1] });
    };
    chunk(table.core);
    add(table.data + 'catalog.json', 'fetch', {});
    var read = /^#library\/read\/(reading_([0-9a-f]{2})[0-9a-f-]*)(?:\?(.*))?$/.exec(hash);
    if (read) {
      chunk(table.reader);
      var key = /(?:^|&)revision=([0-9a-f]{16}-[0-9a-f]{12})(?:&|$)/.exec(read[3] || '');
      add(
        table.data +
          (key
            ? 'r/' + read[2] + '/' + read[1] + '/' + key[1] + '/head.json.gz'
            : 'u/' + read[2] + '.json.gz'),
        'fetch',
        {}
      );
    }
    if (window.matchMedia && matchMedia('(min-width:1100px)').matches)
      add(table.data + 'collections.json', 'fetch', { fetchpriority: 'low' });
  } catch {
    /* Nothing is asked for early; the tab asks as it renders. */
  }
})();
