export const layout = `<div class="song-forms">
  <header class="page-head">
    <h1>Song Forms</h1>
    <div class="find">
      <div class="search-frame">
        <label class="sr" for="query">Search song forms</label>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
        <input id="query" type="search" role="combobox" placeholder="Search song forms" autocomplete="off" aria-autocomplete="list" aria-expanded="false" aria-controls="results" disabled>
        <div class="search-menu" id="search-menu" hidden><div id="search-empty" class="empty" hidden>No matching forms</div><div id="results" role="listbox" aria-label="Matching forms"></div></div>
      </div>
      <div class="browse-wrap" id="browse-wrap">
        <button type="button" class="browse-trigger" id="browse" aria-expanded="false" aria-controls="browse-list" disabled>Browse all forms <span class="browse-chevron" aria-hidden="true"></span></button>
        <ul class="browse-list" id="browse-list" aria-label="Song forms, alphabetically" hidden></ul>
      </div>
    </div>
  </header>
  <p class="sr" id="search-status" role="status"></p>
  <div id="loading" class="loading" role="status" hidden>
    <span class="sr">Loading Song Forms</span>
    <div class="surface" aria-hidden="true"><div class="skeleton-title"></div><div class="skeleton-graph"><i></i><i></i><i></i></div></div>
    <div class="surface" aria-hidden="true"><div class="skeleton-title"></div><div class="skeleton-chart"></div></div>
  </div>
  <p id="load-error" class="empty" hidden>Could not load Song Forms. <button type="button" id="retry">Retry</button></p>
  <section id="workspace" class="workspace" hidden>
    <section class="surface relations" aria-labelledby="relation-heading">
      <div class="panel-heading"><h2 id="relation-heading">Related forms</h2><span id="relation-count" class="meta"></span></div>
      <div id="relations"></div>
      <details id="all-related" hidden><summary>All related forms</summary><div id="relation-list" class="relation-list"></div></details>
    </section>
    <section class="surface structure" aria-labelledby="structure-heading">
      <div class="panel-heading structure-head">
        <div><h2 id="structure-heading">Structure</h2><p class="meta" id="measure"></p></div>
        <div class="pattern-controls"><button type="button" class="write-form" id="write-with-form">Write with this form</button><label id="pattern-label" hidden>Pattern <span class="select-wrap"><select id="patterns"></select></span></label><details id="repeat-panel" hidden><summary>Repeat counts</summary><form id="repeat-form"></form></details></div>
      </div>
      <div id="chart-region" class="chart-region"><div id="diagram"></div></div>
      <div class="structure-footer">
        <div id="legend" class="legend" aria-label="Diagram key"></div>
        <div id="chart-zoom" class="chart-zoom" role="group" aria-label="Diagram zoom" hidden>
          <button type="button" id="chart-out" aria-label="Zoom out" aria-controls="diagram">−</button>
          <button type="button" id="chart-in" aria-label="Zoom in" aria-controls="diagram">+</button>
          <button type="button" id="chart-fit" aria-label="Fit entire diagram" aria-controls="diagram">Fit</button>
        </div>
      </div>
      <div class="inspector" aria-live="polite" id="inspect">Select a line to trace its exact returns.</div>
      <details id="outline"><summary>Read structure as text</summary><div id="outline-body"></div></details>
      <p id="writing-note"></p>
      <details id="symbolic"><summary>Catalog pattern</summary><div id="symbolic-body"></div></details>
    </section>
  </section>
</div>`;
