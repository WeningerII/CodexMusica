(function () {
  'use strict';
  const BASE = window.POEM_DATA;
  if (window.RHETORIC_DATA) {
    BASE.lines.forEach(line => {line.R = window.RHETORIC_DATA.lineNotes[line.line] || line.R;});
    BASE.globalNotes.rhetoric = window.RHETORIC_DATA.globalNotes;
    BASE.scopeNotes.all = 'Union of recorded dictionary pronunciations, including alternatives that may be inappropriate in this poem. These matches need not hold together in one performance; the pronunciation grid keeps the contextual reference reading.';
  }
  let D = BASE;
  let M = window.PoemModel.create(D);
  const referenceModel = M;
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = {
    anchor: 1, partner: 9, filter: M.availableMask, matchMode: 'any',
    view: 'poem', evidence: null, mapZoom: 1,
    layers: {meter:true, pronunciation:true, alternatives:false, rhetoric:false, grammar:false, punctuation:false, pauses:false, rhyme:true}
  };
  const wordEls = new Map();
  let mapGeometry = null, hoverPair = null, mapFrame = 0;
  const mapCursor = {a:1,b:9};
  const token = id => D.tokens[id - 1];
  const word = id => token(id)[0];
  const address = id => 'Line ' + token(id)[1] + ' · word ' + token(id)[2];
  const shortIds = mask => M.labels(mask).map(c => c.id).join(' · ');
  const displayedMask = p => p && M.matches(p.mask,state.filter,state.matchMode) ? p.mask & state.filter : 0;
  const familyClass = letter => 'family-' + letter.toLowerCase();

  function renderPoem() {
    $('poem').innerHTML = D.stanzas.map(stanza => {
      const heading = '<div class="stanza-heading"><span class="stanza-roman">' + stanza.roman + '</span><h2 class="stanza-title">' + esc(stanza.title) + '</h2><span class="scheme" aria-label="Rhyme scheme ' + stanza.scheme + '">' + stanza.scheme.split('').map(c => '<span class="rhyme-letter ' + familyClass(c) + '">' + c + '</span>').join('') + '</span></div>';
      const lines = D.lines.slice(stanza.firstLine - 1, stanza.lastLine).map(line => {
        const sentence = D.sentences.find(s => line.line >= s.firstLine && line.line <= s.lastLine);
        const verse = line.words.map((text, index) => {
          const id = line.wordIds[index], last = index === line.words.length - 1;
          const punctuation = (text.match(/[.,;:!?]+$/) || [''])[0];
          const plain = punctuation ? text.slice(0,-punctuation.length) : text;
          let body = esc(plain);
          if (last) {
            const tail = line.rhymeTail;
            body = esc(plain.slice(0,plain.length-tail.length)) + '<span class="rhyme-tail">' + esc(plain.slice(-tail.length)) + '</span>';
          }
          const pause = D.optionalPauses[line.line] === index + 1 ? '<span class="pause-marker" data-layer="pauses" hidden title="Optional performed pause">‖<sup>?</sup></span>' : '';
          return '<button type="button" class="word' + (last ? ' end-rhyme ' + familyClass(line.rhyme) : '') + '" data-word="' + id + '" aria-pressed="false" aria-label="' + esc(plain + ', ' + address(id)) + '"><span class="word-text">' + body + '</span><span class="word-punctuation">' + esc(punctuation) + '</span></button>' + pause;
        }).join(' ');
        const stresses = line.stress.split(' ');
        const feet = [0,1,2,3].map(f => {
          const light = (line.line === 8 || line.line === 14) && f === 2;
          return '<div class="foot' + (light ? ' is-light' : '') + '" title="Foot ' + (f+1) + (light ? ': light in the displayed reading' : '') + '">' + [f*2,f*2+1].map(s => {
            const join = line.joins.includes(s) ? '<span class="syllable-join" aria-hidden="true">-</span>' : '';
            const pronounced = line.pronunciation[s];
            const prominent = pronounced === pronounced.toUpperCase();
            return '<span class="syllable" data-syllable-word="' + line.syllableWords[s] + '"><span class="stress-mark" data-layer="meter">' + (stresses[s] === '/' ? '/' : '˘') + '</span><span class="pronunciation-syllable' + (prominent ? ' is-prominent' : '') + '" data-layer="pronunciation">' + esc(pronounced) + join + '</span></span>';
          }).join('') + '</div>';
        }).join('');
        const rows = [['punctuation','P'],['grammar','G'],['pauses','V'],['rhetoric','R']].map(([layer,key]) => '<div class="annotation-row" data-layer="' + layer + '" hidden><span class="annotation-label" title="' + esc(D.notationKey[key]) + '">' + key + '</span><span class="annotation-text">' + esc(line[key]) + '</span></div>').join('');
        const alt = '<div class="annotation-row" data-layer="alternatives" hidden><span class="annotation-label">ALT</span><ul class="alternative-list">' + line.alternatives.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul></div>';
        return '<div class="poem-line" data-line="' + line.line + '" id="line-' + line.line + '"><div class="line-margin"><button type="button" class="line-number" data-line-detail="' + line.line + '" title="Read all annotations for line ' + line.line + '">' + String(line.line).padStart(2,'0') + '</button><span class="sentence-tag" data-layer="grammar" hidden title="Sentence ' + sentence.id + ' spans lines ' + sentence.firstLine + '–' + sentence.lastLine + '">' + sentence.id + '</span></div><div class="line-body"><div class="verse">' + verse + '</div><div class="foot-grid">' + feet + '</div>' + ((line.line === 8 || line.line === 14) ? '<p class="metrical-note" data-layer="meter">Foot 3 stays light in this reading; the four-beat pattern remains.</p>' : '') + '<div class="line-annotations">' + alt + rows + '</div></div></div>';
      }).join('');
      return '<section class="stanza" aria-label="Stanza ' + stanza.number + '">' + heading + lines + '</section>';
    }).join('');
    document.querySelectorAll('[data-word]').forEach(el => wordEls.set(Number(el.dataset.word),el));
  }

  function applyLayers() {
    document.querySelectorAll('[data-layer]').forEach(el => {el.hidden = !state.layers[el.dataset.layer];});
    document.querySelectorAll('.foot-grid').forEach(el => {el.hidden = !state.layers.meter && !state.layers.pronunciation;});
    document.body.classList.toggle('hide-rhyme',!state.layers.rhyme);
  }

  function makeFilters() {
    $('type-filters').innerHTML = M.categories.map(c => '<label class="type-filter' + (c.unavailable ? ' is-unavailable' : '') + '" title="' + esc(c.unavailable || (c.count + ' pairs across this poem')) + '"><input type="checkbox" data-category="' + c.id + '" ' + (c.unavailable ? 'disabled' : 'checked') + '><span class="category-id">' + c.id + '</span><span class="type-name">' + esc(c.name) + (c.id === 'E18' && D.counts.by_category.E18.undecided ? '<small>Partly determined</small>' : '') + (c.unavailable ? '<small>' + esc(c.unavailable) + '</small>' : '') + '</span><span class="type-count">' + (c.unavailable ? '—' : c.count.toLocaleString()) + '</span></label>').join('');
  }

  function selectWord(id) {
    if (state.view === 'rhetoric') {window.RhetoricExplorer.selectWord(id);return;}
    if (state.anchor === id) state.partner = null;
    else if (!state.anchor || state.partner) {state.anchor = id; state.partner = null;}
    else state.partner = id;
    state.evidence = null;
    expandInspector();
    updateSelection();
  }

  function selectPair(a,b,scroll) {
    const p = M.pair(a,b);
    if (!p) return;
    state.anchor = p.a; state.partner = p.b; state.evidence = null;
    mapCursor.a = p.a; mapCursor.b = p.b;
    expandInspector();
    updateSelection();
    if (scroll && state.view === 'poem') scrollToWord(p.b);
  }

  function expandInspector() {
    document.querySelector('.inspector').classList.remove('is-collapsed');
    $('inspector-toggle').setAttribute('aria-expanded','true');
  }

  function scrollToWord(id) {
    const el = wordEls.get(id);
    if (el) el.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'center',inline:'nearest'});
  }

  function updateSelection() {
    if (state.view === 'rhetoric' && window.RhetoricExplorer) {window.RhetoricExplorer.renderHighlights();return;}
    $('reading-scope-note').textContent = D.scopeNotes[D.readingMode];
    const relations = state.anchor ? M.related(state.anchor,state.filter,state.matchMode) : [];
    const relatedIds = new Set(relations.map(r => r.id));
    const overview = state.anchor ? null : M.overview(state.filter,state.matchMode);
    const overviewIds = new Set(overview ? overview.words : []);
    wordEls.forEach((el,id) => {
      el.classList.toggle('is-anchor', id === state.anchor);
      el.classList.toggle('is-partner', id === state.partner);
      el.classList.toggle('is-connected', relatedIds.has(id) && id !== state.partner);
      el.classList.toggle('is-overview-match', overviewIds.has(id));
      el.setAttribute('aria-pressed',String(id === state.anchor || id === state.partner));
      const p = state.anchor && id !== state.anchor ? M.pair(state.anchor,id) : null;
      el.title = address(id) + (p && displayedMask(p) ? ' · ' + shortIds(displayedMask(p)) : overviewIds.has(id) ? ' · Has a matching connection under these filters' : '');
    });
    document.querySelectorAll('[data-syllable-word]').forEach(el => {
      const id = Number(el.dataset.syllableWord);
      el.classList.toggle('is-anchor',id === state.anchor);
      el.classList.toggle('is-partner',id === state.partner);
      el.classList.toggle('is-connected',relatedIds.has(id) && id !== state.partner);
      el.classList.toggle('is-overview-match',overviewIds.has(id));
    });
    $('connection-summary').textContent = state.anchor ? relations.length + ' connections from “' + word(state.anchor) + '”' : overview.words.length + ' matching words · ' + overview.pairs.toLocaleString() + ' pairs';
    $('selection-guide').hidden = !state.anchor;
    $('connection-guide').classList.toggle('is-overview',!state.anchor);
    $('connection-guide-label').textContent = state.anchor ? 'Connected words, wherever they occur' : 'Words with a matching connection';
    $('show-all-matches').disabled = !state.anchor;
    const selected = M.labels(state.filter).length;
    $('filter-status').textContent = state.filter === M.availableMask ? 'All available' : selected + ' selected';
    document.querySelectorAll('[data-category]').forEach(el => {el.checked = !!(state.filter & M.bit(el.dataset.category));});
    renderInspector(relations,overview);
    if (state.view === 'map') {
      const current = hoverPair ? M.pair(hoverPair.a,hoverPair.b) : state.partner ? M.pair(state.anchor,state.partner) : M.pair(mapCursor.a,mapCursor.b);
      describeMapPair(current);
    }
    queueMap();
    const announcement = state.partner ? word(state.anchor) + ' and ' + word(state.partner) + ' selected.' : state.anchor ? word(state.anchor) + ' selected, ' + relations.length + ' connections.' : overview.words.length + ' words in ' + overview.pairs + ' matching pairs across the poem.';
    $('announcement').textContent = announcement;
  }

  function placement(p) {
    const a = token(p.a), b = token(p.b);
    const endA = a[2] === D.lines[a[1]-1].words.length, endB = b[2] === D.lines[b[1]-1].words.length;
    const posA = a[2] === 1 ? 'line opening' : endA ? 'line ending' : 'interior';
    const posB = b[2] === 1 ? 'line opening' : endB ? 'line ending' : 'interior';
    const place = posA === posB ? ({'line opening':'Line openings','line ending':'Line endings','interior':'Interior words'}[posA]) : posA[0].toUpperCase()+posA.slice(1)+' ↔ '+posB;
    return place + ' · ' + (a[1] === b[1] ? 'same line' : 'across lines');
  }

  function categoryDetail(c,p) {
    const pairWords = [word(p.a).toLowerCase(),word(p.b).toLowerCase()].sort().join('/');
    if (c.id === 'A1') return 'The first consonant agrees. Different opening clusters and repeated words can qualify; a distant pair is sound evidence, not automatically a local rhetorical figure.';
    if (c.id === 'E9') return 'The complete initial consonant cluster agrees. This narrower source rule excludes repeated spellings; A1 also accepts different clusters that begin with the same consonant.';
    if (c.id === 'E63') {
      const flags=D.scopeRefinement.endingPositions[p.a+':'+p.b]||[];
      const places=flags.map(f=>({A:'neighboring words',L:'verse-line endings',P:'parallel adjectives in coordinated phrases',R:'corresponding words in the repeated final line'}[f]));
      return 'Matching final vowel and complete coda at '+places.join(' and ')+'. This is the adapted sound-and-position rule; it makes no suffix claim.'+([p.a,p.b].includes(70)&&[p.a,p.b].includes(71)?' The / only matches with the displayed “dhee” pronunciation; “dhuh” would not match. This weak echo is a formal candidate.':'');
    }
    if (pairWords === 'his/whose') return {E5:'Shared final /z/.',E7:'Shared /h…z/, with different vowels.',E9:'Shared initial /h/.',E10:'The inclusive umbrella applies through consonance.'}[c.id] || '';
    if (c.id === 'E10') return 'Inclusive umbrella: assonance or coda consonance.';
    if (c.id === 'E18') return 'Matching unstressed word endings.';
    if (c.id === 'E66') return 'This pair belongs to Codex Musica’s declared trite-rhyme list.';
    if (c.id === 'H1') return 'An audible rhyme also has the same spelled ending. This spelling property alone does not establish homeoteleuton placement.';
    return '';
  }

  function pairPronunciations(p,e) {
    if (!e) return [BASE.tokenPronunciations[p.a-1],BASE.tokenPronunciations[p.b-1]];
    const normalized = value => String(value).toLowerCase().replace(/[’‘]/g,"'");
    const readings = new Map();
    const labels = (D.readingWitnessLabels && D.readingWitnessLabels[e.witness]) || e.readings;
    labels.forEach(record => {
      const separator = record.indexOf(' = ');
      if (separator < 0) return;
      const key = normalized(record.slice(0,separator));
      if (!readings.has(key)) readings.set(key,[]);
      readings.get(key).push(record.slice(separator+3));
    });
    return [p.a,p.b].map(id => {
      const variants = readings.get(normalized(word(id)));
      const fixed = D.tokenDefaultPronunciations && D.tokenDefaultPronunciations[id-1];
      const pronunciation = variants && variants.length ? variants.shift() : fixed == null ? 'multiple pronunciations' : fixed;
      return word(id) + ' = ' + pronunciation;
    });
  }

  function renderInspector(relations,overview) {
    const target = $('selection-detail');
    if (!state.anchor) {
      overview = overview || M.overview(state.filter,state.matchMode);
      const examples = [[19,20],[17,27],[8,98],[21,52],[71,85],[1,9]].filter(([a,b]) => M.matches(M.pair(a,b).mask,state.filter,state.matchMode)).slice(0,3);
      target.innerHTML = '<p class="selection-kicker">Across the poem</p><h2 class="pair-heading">' + overview.words.length + ' matching words</h2><p class="token-location">' + overview.pairs.toLocaleString() + ' pairs under the active filters</p><p class="empty-state">Each marked word has at least one matching connection. Choose a rhyme type to narrow the view, or select a word to highlight its direct connections.</p>' + examples.map(([a,b]) => '<button class="sample-button" data-example="' + a + ',' + b + '" type="button">' + esc(word(a)) + ' ↔ ' + esc(word(b)) + '<span aria-hidden="true">→</span></button>').join('');
      return;
    }
    const p = state.partner ? M.pair(state.anchor,state.partner) : null;
    if (!p) {
      target.innerHTML = '<p class="selection-kicker">Word connections</p><h2 class="pair-heading">' + esc(word(state.anchor)) + '</h2><p class="token-location">' + address(state.anchor) + '</p><div class="respelling">' + esc(D.tokenPronunciations[state.anchor-1]) + '</div><div class="selection-actions"><button type="button" data-action="clear">Clear selection</button></div><div class="related-heading"><h3>Connected words</h3><span>' + relations.length + '</span></div>' + (relations.length ? '<div class="related-list">' + relations.map(r => '<button type="button" data-related="' + r.id + '"><span class="related-word">' + esc(word(r.id)) + '<small class="related-location">L' + token(r.id)[1] + ' · word ' + token(r.id)[2] + '</small></span><span class="related-count" title="' + esc(shortIds(r.pair.mask & state.filter)) + '">' + r.count + (r.count === 1 ? ' type' : ' types') + ' <span aria-hidden="true">↗</span></span></button>').join('') + '</div>' : '<p class="empty-state">No displayed connections under these filters.</p>') + '<p class="limit-note">Counts are overlapping labels, not rhyme strength.</p>';
      return;
    }
    const labels = M.labels(p.mask), visibleMask = p.mask & state.filter;
    const e = p.evidence.find(item => item.witness === state.evidence);
    let evidenceMask = e ? e.mask : 0;
    if (e && (evidenceMask & (M.bit('E4')|M.bit('E5')))) evidenceMask |= M.bit('E10');
    const cards = labels.map(c => {
      const inFilter = (visibleMask & c.bit) !== 0;
      const supported = e && (evidenceMask & c.bit) !== 0;
      const dimmed = !inFilter || (e && !supported);
      const alternative = D.readingMode === 'all' && !(referenceModel.pair(p.a,p.b).mask & c.bit);
      const detail = categoryDetail(c,p);
      return '<div class="classification' + (supported ? ' is-supported' : '') + (dimmed ? ' is-dimmed' : '') + '"><span class="category-id">' + c.id + '</span><div><div class="category-name">' + esc(c.name) + '</div>' + (detail ? '<p class="category-detail">' + esc(detail) + '</p>' : '') + (alternative ? '<span class="evidence-tag">Requires alternative pronunciation</span>' : '') + (supported ? '<span class="evidence-tag">Recorded for this reading</span>' : '') + (!inFilter ? '<span class="evidence-tag">Outside active filter</span>' : '') + '</div></div>';
    }).join('');
    const shownPhones = pairPronunciations(p,e).map(v => '<span>' + esc(v) + '</span>').join('<span aria-hidden="true">/</span>');
    let reading = '';
    if (p.evidence.length) {
      const witnessLabel = item => (D.readingWitnessLabels ? D.readingWitnessLabels[item.witness] : item.readings).join(' · ');
      const annotated = D.readingMode === 'annotated';
      const optionLabel = annotated ? 'All labels for this pronunciation' : 'All dictionary variants';
      const evidenceNote = annotated ? 'All labels use the displayed vowel and consonant sounds, with lexical stress. Highlighted labels have this recorded support.' : D.readingEvidenceNote;
      const selectionNote = annotated ? 'These labels use the displayed vowel and consonant sounds, with lexical stress. Select recorded evidence to highlight its supporting labels.' : 'These labels may use different pronunciations. Select recorded evidence to see its sounds and supported labels.';
      reading = '<div class="reading-evidence"><label for="reading-selector">Lexical pronunciation evidence</label><select id="reading-selector"><option value="">' + optionLabel + '</option>' + p.evidence.map(item => '<option value="' + item.witness + '"' + (state.evidence === item.witness ? ' selected' : '') + '>' + esc(witnessLabel(item)) + '</option>').join('') + '</select>' + (e ? '<div class="evidence-phones">' + esc(witnessLabel(e)) + '</div><p class="evidence-note">' + esc(evidenceNote) + '</p>' : '<p class="evidence-note">' + selectionNote + '</p>') + '</div>';
    } else reading = '<p class="evidence-note">' + (D.readingMode === 'annotated' ? 'All labels above use the displayed vowel and consonant sounds, with lexical stress. The meter grid marks a suggested delivery.' : 'This setting collects supported pronunciation alternatives; the grid remains the reference reading.') + '</p>';
    target.innerHTML = '<p class="selection-kicker">Selected connection</p><div class="pair-heading"><div class="selected-token"><strong>' + esc(word(p.a)) + '</strong><span class="token-location">' + address(p.a) + '</span></div><span class="pair-arrow" aria-hidden="true">↔</span><div class="selected-token"><strong>' + esc(word(p.b)) + '</strong><span class="token-location">' + address(p.b) + '</span></div></div><p class="placement-note">' + placement(p) + '</p><div class="respelling">' + shownPhones + '</div><div class="selection-actions"><button type="button" data-action="connections">All “' + esc(word(state.anchor)) + '” connections</button><button type="button" data-action="clear">Clear</button></div><div class="related-heading"><h3>' + labels.length + ' overlapping ' + (labels.length === 1 ? 'type' : 'types') + '</h3>' + (visibleMask !== p.mask ? '<span>' + M.popcount(visibleMask) + ' enabled</span>' : '') + '</div><div class="classification-list">' + (cards || '<p class="empty-state">No displayed match is recorded for this pair.</p>') + '</div>' + reading + '<p class="limit-note">Directional types read earlier → later in the poem. A missing label is not a finding that no relationship exists.</p>';
  }

  function setView(view) {
    state.view = view;
    $('poem-view').hidden = view === 'map';
    $('map-view').hidden = view !== 'map';
    ['poem','map','rhetoric'].forEach(v => {
      $('view-' + v).classList.toggle('active',v === view);
      $('view-' + v).setAttribute('aria-pressed',String(v === view));
    });
    $('workspace').classList.toggle('showing-map',view === 'map');
    document.body.classList.toggle('rhetoric-mode',view === 'rhetoric');
    $('rhetoric-overview').hidden = view !== 'rhetoric';
    $('rhetoric-guide').hidden = view !== 'rhetoric';
    $('rhetoric-panel').hidden = view !== 'rhetoric';
    document.querySelector('.inspector').setAttribute('aria-label',view === 'rhetoric' ? 'Rhetorical evidence and findings' : 'Selected words and rhyme filters');
    $('inspector-toggle').innerHTML = (view === 'rhetoric' ? 'Rhetorical findings' : 'Selected connection') + ' <span aria-hidden="true">⌄</span>';
    $('reading-intro').textContent = view === 'rhetoric' ? 'Select a finding to see its evidence. Click any word to explore overlapping devices.' : 'Select a word. Follow its connections. Select another to compare.';
    if (window.RhetoricExplorer) window.RhetoricExplorer.onView(view);
    if (view !== 'rhetoric') updateSelection();
    if (view === 'map') {
      hoverPair = null;
      const selected = state.partner ? M.pair(state.anchor,state.partner) : state.anchor ? M.pair(Math.min(state.anchor,107),Math.min(state.anchor+1,108)) : M.pair(mapCursor.a,mapCursor.b);
      if (selected) {mapCursor.a=selected.a;mapCursor.b=selected.b;describeMapPair(selected);}
      queueMap();
    }
  }

  function queueMap() {
    if (state.view !== 'map') return;
    cancelAnimationFrame(mapFrame);
    mapFrame = requestAnimationFrame(drawMap);
  }

  function drawMap() {
    const canvas = $('rhyme-map'), scroll = $('map-scroll');
    const w = Math.max(700,scroll.clientWidth) * state.mapZoom;
    const left = 88, top = 52, cell = (w-left-12)/108, h = top+108*cell+12;
    const ratio = Math.min(window.devicePixelRatio || 1,2);
    canvas.width = Math.ceil(w*ratio); canvas.height = Math.ceil(h*ratio);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio,ratio);
    ctx.fillStyle = '#f5f2ea';ctx.fillRect(0,0,w,h);
    const colors = ['#fffdf8','#eee9ef','#ddd4e1','#c9bccf','#b19ebc','#9880a5','#7e638d','#694e7a','#543c67'];
    const max = 8;
    D.pairs.forEach(([a,b]) => {
      const p = M.pair(a,b), m = displayedMask(p), n = M.popcount(m);
      ctx.fillStyle = colors[Math.min(n,max)];
      ctx.fillRect(left+(b-1)*cell,top+(a-1)*cell,cell-.35,cell-.35);
    });
    ctx.strokeStyle = '#d8d7ce';ctx.lineWidth = .6;
    D.lines.forEach(line => {
      const end = line.wordIds[line.wordIds.length-1];
      const pos = end*cell;
      ctx.beginPath();ctx.moveTo(left+pos,top);ctx.lineTo(left+pos,top+pos);ctx.stroke();
      ctx.beginPath();ctx.moveTo(left+pos,top+pos);ctx.lineTo(left+108*cell,top+pos);ctx.stroke();
    });
    ctx.font = '10px system-ui, sans-serif';ctx.textBaseline = 'middle';ctx.fillStyle = '#506058';
    for (let i=1;i<=108;i++) {
      const t = token(i), y = top+(i-.5)*cell;
      if (cell >= 9 || i%2 === 1 || i === state.anchor || i === state.partner) {
        ctx.fillStyle = i === state.anchor || i === state.partner ? '#654775' : '#506058';
        ctx.fillText(String(i).padStart(3,'0')+' '+t[0],2,y,80);
      }
      if (i%5 === 0 || i === 1 || i === state.anchor || i === state.partner) {
        ctx.save();ctx.translate(left+(i-.5)*cell,top-8);ctx.rotate(-Math.PI/2);ctx.fillText(String(i),0,0);ctx.restore();
      }
    }
    D.lines.forEach(line => {
      const first = line.wordIds[0], last = line.wordIds[line.wordIds.length-1];
      const x = left+((first+last)/2-.5)*cell;
      ctx.textAlign = 'center';ctx.fillStyle = '#6e776e';ctx.font = '9px system-ui, sans-serif';ctx.fillText('L'+line.line,x,12);ctx.textAlign = 'left';
    });
    const current = hoverPair || (state.partner ? M.pair(state.anchor,state.partner) : M.pair(mapCursor.a,mapCursor.b));
    if (current) {
      const x = left+(current.b-1)*cell, y = top+(current.a-1)*cell;
      ctx.fillStyle = 'rgba(105,78,122,.08)';ctx.fillRect(left,y,108*cell,cell);ctx.fillRect(x,top,cell,108*cell);
      ctx.strokeStyle = '#654775';ctx.lineWidth = 2;ctx.strokeRect(x+.5,y+.5,cell-1,cell-1);
    }
    ctx.fillStyle = '#34463d';ctx.font = '600 20px Georgia, serif';
    const captionX = left+24, captionY = top+108*cell*.63;
    ctx.fillText(M.count(state.filter,state.matchMode).toLocaleString()+' matching pairs',captionX,captionY);
    ctx.font = '12px system-ui, sans-serif';ctx.fillStyle = '#69766c';
    ctx.fillText('Each occurrence is counted separately.',captionX,captionY+25);
    ctx.fillText('Select a cell to inspect its words.',captionX,captionY+45);
    mapGeometry = {left,top,cell,w,h};
    $('map-scale').innerHTML = '<span>Types per pair</span>' + colors.map((c,i) => '<span><i style="background:'+c+'"></i>'+i+(i === max ? '+' : '')+'</span>').join('');
  }

  function pairAtPointer(event) {
    if (!mapGeometry) return null;
    const rect = $('rhyme-map').getBoundingClientRect();
    const x = event.clientX-rect.left, y = event.clientY-rect.top;
    const a = Math.floor((y-mapGeometry.top)/mapGeometry.cell)+1;
    const b = Math.floor((x-mapGeometry.left)/mapGeometry.cell)+1;
    return a < b ? M.pair(a,b) : null;
  }

  function describeMapPair(p) {
    if (!p) return;
    const m = displayedMask(p);
    $('map-live').textContent = word(p.a)+' · L'+token(p.a)[1]+' ↔ '+word(p.b)+' · L'+token(p.b)[1]+' — '+(m ? shortIds(m) : 'No displayed match under these filters');
  }

  function openDialog(title,content) {
    $('dialog-title').textContent = title;
    $('dialog-content').innerHTML = content;
    if (!$('info-dialog').open) $('info-dialog').showModal();
  }

  function paragraphs(values) {return values.map(v => '<p>'+esc(v)+'</p>').join('');}

  function showKey() {
    const table = rows => '<table class="key-table"><thead><tr><th>Respelling</th><th>IPA</th><th>Example</th></tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    openDialog('Pronunciation & notation','<p class="method-note">'+esc(D.pronunciationKey.title)+'</p>'+paragraphs([D.notationKey.meter,D.notationKey.case,D.notationKey.optionalPause,D.notationKey.alternatives])+'<h3 class="section-heading">Vowels</h3>'+table(D.pronunciationKey.vowels)+'<h3 class="section-heading">Consonants</h3>'+table(D.pronunciationKey.consonants)+paragraphs(D.pronunciationKey.notes));
  }

  function showAbout() {
    const syllabic = D.counts.by_category.E18;
    const unavailable = Object.entries(D.unavailable).map(([id,note])=>'<li><strong>'+id+'</strong> '+esc(note)+'</li>').join('');
    const overlap = '<div class="table-scroll"><table class="overlap-table"><thead><tr>'+D.overlapTable.columns.map(v=>'<th>'+esc(v)+'</th>').join('')+'</tr></thead><tbody>'+D.overlapTable.rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
    openDialog('About this reading','<p>Explore the supplied poem through selectable words, overlapping rhyme labels and annotation layers.</p>'+paragraphs(D.globalNotes.attribution)+'<h3 class="section-heading">How rhyme labels overlap</h3>'+overlap+paragraphs(D.globalNotes.rhymeOverlap)+'<h3 class="section-heading">Initial sounds, endings and overlap</h3>'+paragraphs(D.analysisNotes)+'<h3 class="section-heading">Punctuation, syntax & silence</h3>'+paragraphs(D.globalNotes.boundaries.slice(1))+'<h3 class="section-heading">Rhetorical readings</h3>'+paragraphs(D.globalNotes.rhetoric.slice(1))+'<h3 class="section-heading">The word-pair comparison</h3><p>'+D.tokens.length+' occurrences · '+D.pairs.length.toLocaleString()+' pairs · '+D.categories.length+' classification labels. The data records '+D.counts.pairs_with_native_matches.toLocaleString()+' pairs with original native-rule matches before the declared refinement, and '+D.counts.pairs_with_nonabsence_matches.toLocaleString()+' pairs with current displayed matches after removing absence-only agreements and applying the declared refinement.</p><p>Pronunciation shown uses one declared reading for every occurrence. Lexical stress is used where the particular rhyme rule requires it. A1 and the adapted E63 do not require equal stress; capitals in the meter grid show performed prominence in the suggested delivery. Dictionary alternatives adds recorded dictionary variants, including some that may be inappropriate in this poem; labels in that setting need not all hold in one performance. E10 is the inclusive E4-or-E5 umbrella, and E20 is spelling-based. Directional labels follow the words’ order in the poem, regardless of click order.</p><p>Recorded reading evidence highlights positive support already in the data. It does not re-test every label or turn other labels into negative findings.</p><ul class="method-note">'+unavailable+'</ul><p>E18 checks actual unstressed word endings: '+(syllabic.true||0).toLocaleString()+' matches, '+(syllabic.false||0).toLocaleString()+' nonmatches and '+(syllabic.undecided||0).toLocaleString()+' unresolved cases in this setting. The compact data does not attach a negative or undecided verdict to each unmarked pair.</p><h3 class="section-heading">Sources</h3><ul class="source-list">'+D.sourceLinks.map(([label,url])=>'<li><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a></li>').join('')+'</ul><p class="method-note">Codex Musica revision '+esc(D.source.commit.slice(0,12))+'. Every occurrence pair was rerun with checked English anchors, complete required endings, directional extensions and the vowel distinctions shown in the key. The original sound output is preserved in the audit. A1 and the current E63 use the explicit poem adaptations; E66 retains the original trite-rhyme list.</p>');
  }

  function showLine(n) {
    const line = D.lines[n-1];
    openDialog('Line '+n,'<blockquote class="line-quote">'+esc(line.text)+'</blockquote><p class="respelling">'+esc(line.pronunciation.map((p,i)=>p+(line.joins.includes(i)?'-':'')+(i%2===1&&i<7?' |':'')).join(' '))+'</p><h3 class="section-heading">Alternative emphasis</h3>'+paragraphs(line.alternatives)+['P','G','V','R'].map(k=>'<h3 class="section-heading">'+esc(D.notationKey[k])+'</h3><p>'+esc(line[k])+'</p>').join(''));
  }

  $('poem').addEventListener('click',event => {
    const w = event.target.closest('[data-word]');
    if (w) {selectWord(Number(w.dataset.word));return;}
    const l = event.target.closest('[data-line-detail]');
    if (l) showLine(Number(l.dataset.lineDetail));
  });
  $('selection-detail').addEventListener('click',event => {
    const related = event.target.closest('[data-related]');
    if (related) {state.partner = Number(related.dataset.related);state.evidence=null;updateSelection();scrollToWord(state.partner);return;}
    const action = event.target.closest('[data-action]');
    if (action) {
      if (action.dataset.action === 'clear') {state.anchor=null;state.partner=null;}
      else state.partner=null;
      state.evidence=null;updateSelection();return;
    }
    const example = event.target.closest('[data-example]');
    if (example) {const [a,b] = example.dataset.example.split(',').map(Number);selectPair(a,b,true);}
  });
  $('selection-detail').addEventListener('change',event => {
    if (event.target.id === 'reading-selector') {
      state.evidence = event.target.value === '' ? null : Number(event.target.value);
      renderInspector(M.related(state.anchor,state.filter,state.matchMode));
      $('reading-selector').focus();
    }
  });
  $('type-filters').addEventListener('change',event => {
    if (!event.target.dataset.category) return;
    const b = M.bit(event.target.dataset.category);
    state.filter = event.target.checked ? state.filter|b : state.filter&~b;
    updateSelection();
  });
  $('types-all').addEventListener('click',()=>{state.filter=M.availableMask;updateSelection();});
  $('types-none').addEventListener('click',()=>{state.filter=0;updateSelection();});
  $('show-all-matches').addEventListener('click',()=>{state.anchor=null;state.partner=null;state.evidence=null;updateSelection();});
  $('match-mode').addEventListener('change',event=>{state.matchMode=event.target.value;updateSelection();});
  $('reading-scope').addEventListener('change',event=>{
    D = event.target.value === 'all' ? {...BASE,...BASE.allReadings} : BASE;
    M = event.target.value === 'all' ? window.PoemModel.create(D) : referenceModel;
    state.filter &= M.availableMask;
    state.evidence = null;
    hoverPair = null;
    makeFilters();
    updateSelection();
  });

  Object.keys(state.layers).forEach(layer=>$('layer-'+layer).addEventListener('change',event=>{state.layers[layer]=event.target.checked;applyLayers();}));
  $('view-poem').addEventListener('click',()=>setView('poem'));
  $('view-map').addEventListener('click',()=>setView('map'));
  $('map-return').addEventListener('click',()=>{setView('poem');if(state.partner||state.anchor)scrollToWord(state.partner||state.anchor);});
  $('map-zoom').addEventListener('change',event=>{state.mapZoom=Number(event.target.value);queueMap();});
  $('rhyme-map').addEventListener('pointermove',event=>{
    const p=pairAtPointer(event);
    if ((!p&&!hoverPair)||(p&&hoverPair&&p.a===hoverPair.a&&p.b===hoverPair.b))return;
    hoverPair=p;if(p)describeMapPair(p);queueMap();
  });
  $('rhyme-map').addEventListener('pointerleave',()=>{hoverPair=null;queueMap();});
  $('rhyme-map').addEventListener('click',event=>{const p=pairAtPointer(event);if(p){selectPair(p.a,p.b,false);describeMapPair(p);}});
  $('rhyme-map').addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter',' '].includes(event.key))return;
    event.preventDefault();
    if(event.key==='ArrowUp')mapCursor.a=Math.max(1,mapCursor.a-1);
    if(event.key==='ArrowDown')mapCursor.a=Math.min(mapCursor.b-1,mapCursor.a+1);
    if(event.key==='ArrowLeft')mapCursor.b=Math.max(mapCursor.a+1,mapCursor.b-1);
    if(event.key==='ArrowRight')mapCursor.b=Math.min(108,mapCursor.b+1);
    const p=M.pair(mapCursor.a,mapCursor.b);
    hoverPair=p;describeMapPair(p);queueMap();
    if(event.key==='Enter'||event.key===' ')selectPair(p.a,p.b,false);
  });
  $('inspector-toggle').addEventListener('click',()=>{
    const panel=document.querySelector('.inspector');
    const collapsed=panel.classList.toggle('is-collapsed');
    $('inspector-toggle').setAttribute('aria-expanded',String(!collapsed));
  });
  $('key-open').addEventListener('click',showKey);
  $('about-open').addEventListener('click',showAbout);
  $('source-open').addEventListener('click',showAbout);
  $('dialog-close').addEventListener('click',()=>$('info-dialog').close());
  $('info-dialog').addEventListener('click',event=>{if(event.target===$('info-dialog')){const r=$('info-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('info-dialog').close();}});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && state.view==='rhetoric' && !$('info-dialog').open){window.RhetoricExplorer.clearWord();return;}
    if(event.key==='Escape'&&!$('info-dialog').open){if(state.partner)state.partner=null;else state.anchor=null;state.evidence=null;updateSelection();}
  });
  document.addEventListener('click',event=>{if(!$('layer-menu').contains(event.target))$('layer-menu').open=false;});
  window.addEventListener('resize',queueMap);
  renderPoem();makeFilters();applyLayers();updateSelection();
  window.PoemExplorer = {state,get model(){return M;},selectWord,selectPair,setView};
})();
