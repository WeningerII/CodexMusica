/* global UILayout */
'use strict';
// Panel geometry for the atlas, standalone and in the app's Map view: the side
// column and the inspector resize from their inner edges (drag, arrow keys,
// Home resets), and the side column, inspector and map key can be moved and
// resized as floating panels with accessible Move / Resize / Reset buttons.
// All of it is layout preference (codex-layout:*), never session state, and
// Reset layout (Map information, or the app's More menu) restores it.
(function () {
  var $ = function (id) {
    return document.getElementById(id);
  };
  var body = document.querySelector('.body');
  UILayout.anchor($('results'), $('search'));
  var docked = function () {
    return innerWidth >= 900;
  };
  [
    ['side', 'map panels', '.side-head', 'side-floating'],
    ['card', 'tradition detail', '.card-tools', 'card-floating'],
    ['legend-key', 'map key', '.key-tools', null],
  ].forEach(function (entry) {
    UILayout.floating($(entry[0]), {
      key: 'map-' + entry[0],
      title: entry[1],
      header: entry[2],
      enabled: docked,
      // A panel moved out of its column gives the column back to the map.
      onChange: function (floating) {
        if (entry[3]) document.body.classList.toggle(entry[3], floating);
      },
    });
  });
  UILayout.splitter({
    container: body,
    panel: $('side'),
    key: 'map-side-width',
    property: '--map-side-w',
    title: 'Resize map panels',
    side: 'right',
    limits: function () {
      return [240, Math.max(260, Math.min(480, innerWidth * 0.4))];
    },
    enabled: function () {
      return (
        docked() &&
        !document.body.classList.contains('side-collapsed') &&
        !document.body.classList.contains('side-floating')
      );
    },
  });
  UILayout.splitter({
    container: body,
    panel: $('card'),
    key: 'map-card-width',
    property: '--map-card-w',
    title: 'Resize tradition detail',
    side: 'left',
    limits: function () {
      return [300, Math.max(320, Math.min(560, innerWidth * 0.42))];
    },
    enabled: function () {
      return docked() && !$('card').hidden && !document.body.classList.contains('card-floating');
    },
  });
  window.addEventListener('message', function (e) {
    if (
      e.origin === location.origin &&
      e.source === parent &&
      e.data &&
      e.data.type === 'reset-layout'
    )
      UILayout.reset();
  });
})();
