"""Package the actual poem application; leave the audited sound payload unchanged.

Inputs are the saved structural and interpretive application records, not a new
device detector. The source JSON files are copied into analysis/rhetoric-inputs.
"""
import json
import re
import shutil
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
INPUT = PROJECT / 'analysis/rhetoric-inputs'
DIST = PROJECT / 'dist'
load = lambda name: json.loads((INPUT / name).read_text())
structural = load('structural-findings.json')
interpretive = load('interpretive-findings.json')
audit = load('structural-audit.json')
ledger = load('application-ledger.json')
poem = load('poem.json')
refinement = json.loads((DIST/'scope-refinement-audit.json').read_text())
pronunciation_manifest = json.loads((PROJECT/'analysis/scope-inputs/pronunciations.json').read_text())
tokens = {t['numericId']: t for t in poem['tokens']}
sources = []
source_ids = {}

def add_source(url, label=None):
    if url in source_ids:
        return source_ids[url]
    if not label:
        if 'CodexMusica' in url: label = 'Codex Musica · pinned English sound rules'
        elif 'prose-rhythm-detector' in url: label = 'ProseRhythmDetector · pinned repetition rules'
        elif 'priscian/rhetorica' in url: label = 'Rhetorica · formal figure definitions in code'
        elif 'MongetE/JaDe' in url: label = 'JaDe · punctuation and syntactic processing'
        elif 'universaldependencies' in url: label = 'Universal Dependencies · clause relations'
        elif 'gwalkden/hypotaxis' in url: label = 'Hypotaxis · published tree-query project'
        elif 'uwaterloo' in url: label = 'University of Waterloo · rhetorical figure research'
        else: label = url.split('://', 1)[-1]
    sid = 'source-' + str(len(sources) + 1)
    source_ids[url] = sid
    sources.append({'id': sid, 'url': url, 'label': label})
    return sid

human_sources = {k: add_source(v['url'], v['title']) for k, v in interpretive['sources'].items()}

def line_label(ids):
    lines = sorted({tokens[i]['line'] for i in ids})
    return 'Line ' + str(lines[0]) if len(lines) == 1 else 'Lines ' + ', '.join(map(str, lines))

def span(ids, quote, label=None):
    return {'words': ids, 'quote': quote, 'label': label or line_label(ids)}

def source_quote(ids):
    pieces=[]
    for pos,i in enumerate(ids):
        if pos:
            previous=ids[pos-1]
            pieces.append(' … ' if i != previous+1 else ' / ' if tokens[i]['line'] != tokens[previous]['line'] else ' ')
        pieces.append(tokens[i]['word'].rstrip('.,;:!?'))
    return ''.join(pieces)

def lab(name, scope=''):
    return {'name': name, 'scope': scope}

labels = {
    'S01': [lab('Alliteration', 'The complete consonant onset agrees in each selected local group.')],
    'S01b': [lab('Alliteration · first sound', 'The first consonant /s/ agrees; the complete onsets do not.'), lab('Sibilant echo', 'The shared /s/ gives a local sibilant recurrence.')],
    'S02': [lab('Assonance', 'The selected vowel nuclei agree. Some pairs also have a complete matching rhyme ending.')],
    'S03': [lab('Alliteration', 'Initial /h/ agrees.'), lab('Consonance', 'Final /z/ agrees.'), lab('Pararhyme', 'The /h…z/ consonant frame agrees while the vowels differ.'), lab('Slant rhyme · umbrella', 'The existing schema uses an inclusive assonance-or-consonance umbrella; it overlaps more specific labels.')],
    'S04': [lab('End rhyme', 'The line-ending families form AABA BBCB CCDC DDDD.'), lab('Linked stanza rhymes', 'The third-line family carries into the following stanza.'), lab('Final monorhyme', 'The final stanza uses one rhyme family; its two sleeps are identical words.')],
    'S05': [lab('Internal / cross-line rhyme', 'The evidence includes interior words and an ending-to-interior connection.'), lab('Perfect rhyme', 'The selected distinct-word pairs have matching stressed rhyme endings.'), lab('Assonance', 'Their vowel agreement remains visible alongside perfect rhyme.')],
    'S06': [lab('Homeoteleuton · source rule', 'Five pairs satisfy the existing ending-and-affix predicate. This does not prove shared productive morphology.'), lab('Syllabic ending rhyme', 'The same pairs also match E18 in the displayed pronunciation.')],
    'S07': [lab('Trite rhyme · list match', 'Know / go appears in the declared source list; each go is a separate occurrence.'), lab('Perfect rhyme / assonance', 'The sound classifications also hold; list membership does not replace them.')],
    'R01': [lab('Exact phrase repetition', 'All seven words repeat in immediately adjacent verse lines; final punctuation differs.'), lab('Anaphora', 'The verse-line beginnings repeat.'), lab('Epistrophe', 'The verse-line endings repeat.'), lab('Symploce · scoped overlap', 'The tested source combines repeated beginnings and endings. A definition requiring a changing middle would exclude this case.'), lab('Epizeuxis · phrase scope', 'The tested source permits adjacent phrase doubling. A single-word-only rule would not match.'), lab('Parallelism', 'Exact repetition also reproduces the grammatical structure.')],
    'R02': [lab('Ploce · lexical recurrence', 'The formal recurrence is verified. Its emphasis and effect remain matters of reading.')],
    'R03': [lab('Diacope · formal pattern', 'I is repeated with think between its two occurrences. Ordinary clause nesting also explains the form.')],
    'R04': [lab('Polyptoton · inflectional reading', 'Stop / stopping and dark / darkest are different grammatical forms of a shared word.')],
    'G01': [lab('Parallelism', 'Plural noun + to + verb recurs in the selected phrases.'), lab('Parison · candidate only', 'The phrases have three words each, but different syllable counts; the published parse-tree test was not run.')],
    'G02': [lab('Parataxis', 'Two independent clauses are juxtaposed across the semicolon.')],
    'G03': [lab('Hypotaxis', 'Purpose, explanatory and temporal clauses depend on other grammatical material.')],
    'G04': [lab('Enjambment · reviewed candidates', 'Punctuation gives six candidates; grammar distinguishes strong breaks from looser continuations.')]
}

method_names = {
    'existing_code': 'Executed existing rules, with declared poem inputs',
    'this_run_adaptation': 'Executed bounded adaptation of the researched rule',
    'manual_rule_application': 'Assistant-applied grammatical or morphological review'
}
findings = []
for f in structural['findings']:
    mode = f['execution_mode']
    kind = 'reviewed' if mode == 'manual_rule_application' else 'computed'
    if f['id'] in ('R01', 'G04'): kind = 'combined'
    description = {
        'S01b': 'Compared the first consonant of the declared pronunciations. The native E9 check compares whole onsets instead. This adaptation was run explicitly and is not silently presented as an E9 result.',
        'R01': 'Compared all adjacent complete lines after case and terminal-punctuation normalization. Independently ran the original ProseRhythmDetector functions with line and sentence units, with and without their stop filters. The full-line equality is secure; the overlap names depend on their declared units.',
        'G04': 'Ran the unchanged JaDe punctuation gate on every line ending, then manually reviewed grammatical dependence at its six candidate breaks. The parser-dependent JaDe classifier was not executed.'
    }.get(f['id'], 'The selected occurrences come from the recorded whole-poem application. ' + ('Sound rules used the displayed pronunciation across all 5,778 word pairs; the existing Sound & meter view retains the full pair results.' if f['id'].startswith('S') else f['limitations']))
    limits = f['limitations']
    if f['id'] == 'R01':
        limits = 'One repeated passage has several overlapping descriptions. Symploce and phrase-level epizeuxis depend on the chosen definition. A changed meaning of sleep is not proved by repetition.'
        description += ' The no-stop line-anaphora function raised IndexError on the identical ending; the separate bounded comparison verifies all seven words. Raw outputs are retained in the downloadable audit.'
    findings.append({'id':f['id'],'title':f['title'],'kind':kind,'labels':labels[f['id']],
                     'summary':f['description'],'spans':[span(w['wordIds'], source_quote(w['wordIds']), line_label(w['wordIds']) + ((' · '+w['sound']) if w.get('sound') else '')) for w in f['witnesses']],
                     'limit':limits,'method':{'name':method_names[mode],'description':description},
                     'sources':[add_source(u) for u in f['source_urls']], 'inventoryIds':f['inventory_ids'],
                     'applicationState':f['status'],'recordIds':[f['id']]})

# Apply the audited corrections while retaining the original source records.
firsts={r[0]:pronunciation_manifest['pronunciations'][r[5]][0] for r in pronunciation_manifest['occurrences']}
groups={}
for a,b in refinement['scopes']['annotated']['initialPairs']:
    if tokens[a]['line']==tokens[b]['line']:
        groups.setdefault((tokens[a]['line'],firsts[a]),set()).update((a,b))
initial_groups=sorted(groups.items(),key=lambda item:(item[0]!=(11,'S'),item[0]))
initial_card=next(f for f in findings if f['id']=='S01b')
initial_card.update({
    'title':'Alliteration by first consonant',
    'soundCategory':'A1','soundPairCount':235,
    'labels':[lab('Alliteration · first consonant','A1 accepts shared first consonants even when the complete consonant clusters differ.'),lab('Repetition overlap','Repeated words can carry the same initial sound; the narrower E9 rule excludes identical spellings.')],
    'summary':'Sound’s / sweep and see / stopping share initial /s/. The complete check finds 235 occurrence pairs throughout the poem: 147 also meet the narrower E9 rule, 37 more join different words, and 51 involve repeated words. These passages show all 15 same-line pair matches.',
    'spans':[span(sorted(ids),source_quote(sorted(ids)),'Line '+str(line)+' · /'+pronunciation_manifest['consonant_to_ipa'][phone]+'/') for (line,phone),ids in initial_groups],
    'limit':'First-sound agreement is recorded wherever it occurs. Distance, prominence and context determine whether a particular recurrence is a conspicuous rhetorical effect. All 235 pairs are available under A1 in Sound & meter and Connection map.',
    'method':{'name':'Executed whole-poem first-consonant adaptation','description':'Compared all 5,778 pairs under both pronunciation modes, retaining complete pronunciation witnesses. A1 requires the actual first phoneme to be the same consonant; it does not skip an initial vowel or equate two absent onsets. The native E9 results remain unchanged at 147. The dictionary alternatives produce the same 235 endpoints here.'},
    'sources':initial_card['sources']+[add_source('https://poets.org/glossary/alliteration','Academy of American Poets · Alliteration')]
})
ending_card=next(f for f in findings if f['id']=='S06')
ends=lambda numbers:[poem['lines'][n-1]['wordIds'][-1] for n in numbers]
ending_groups=[([77,80],'Parallel adjectives · final /i/'),([19,20],'Neighboring words · final /i/'),([70,71],'Neighboring words · pronunciation-dependent /i/'),
    (ends([1,2,4]),'Line endings · OH'),(ends([3,5,6,8]),'Line endings · EER'),(ends([7,9,10,12]),'Line endings · AYK'),(ends([11,13,14,15,16]),'Line endings · EEP'),
    (list(range(95,102)),'Corresponding words · first occurrence'),(list(range(102,109)),'Corresponding words · repeated occurrence')]
ending_card.update({
    'title':'Homeoteleuton: matching endings in position','kind':'combined',
    'soundCategory':'E63','soundPairCount':34,
    'labels':[lab('Homeoteleuton · bounded sound-and-position check','Matching final vowel and complete coda, in declared adjacent or parallel positions.'),lab('Rhyme overlap','Line-ending cases also carry their existing rhyme labels; see / me is internal rhyme, and easy / downy is a weak ending echo.'),lab('Exact repetition overlap','Corresponding words of the repeated final line contribute seven pairs, including sleep / sleep.')],
    'summary':'The corrected check finds 34 occurrence pairs: 27 between different words and seven from the repeated final line. Easy / downy and see / me show interior examples; the end-rhyme families also qualify under the declared parallel-position rule.',
    'spans':[span(ids,source_quote(ids),label) for ids,label in ending_groups],
    'limit':'The / only is a weak formal candidate in the displayed “dhee” reading; “dhuh” would not match. The rule records structure and sound, not authorial intention. It does not claim to find every possible semantic parallel. Shared grammatical inflection is checked separately.',
    'method':{'name':'Executed ending rule + explicit grammatical placement review','description':'Compared all 5,778 pairs in both pronunciation modes. Final vowel and entire coda must agree; lexical stress is retained as evidence but need not agree. Positions are same-line neighbors, verse-line ends, the reviewed easy/downy adjective positions, or aligned words in the identical final line. Repeated words are included. Both modes give 34 pairs. This replaces E63’s affix guess for this poem. The five previous E63 pairs remain in the audit and retain their valid E18 sound labels; none has a declared adjacent or parallel position. His is not hi plus -s, evening is the time-of-day noun, and -ly derivation does not establish shared inflection.'},
    'sources':ending_card['sources']+[add_source('https://rhetoric.byu.edu/Figures/H/homoioteleuton.htm','BYU · Homoioteleuton'),add_source('https://rhetoric.byu.edu/Figures/H/homoioptoton.htm','BYU · Homoioptoton'),add_source('https://dictionary.cambridge.org/dictionary/english/his','Cambridge · His'),add_source('https://dictionary.cambridge.org/dictionary/english/evening','Cambridge · Evening')]
})
grammar_card=next(f for f in findings if f['id']=='G01')
grammar_card['labels'].append(lab('Shared English inflection','Promises and miles are plural nouns in parallel NOUN + to + VERB constructions. Their plural sounds differ: /ɪz/ and /z/.'))
grammar_card['method']['description']+=' Morphology was reviewed in context: promises and miles share noun-plural inflection, but their different final rimes do not satisfy the adapted E63 sound rule. No classical case-ending pattern is imposed on this English passage.'
grammar_card['sources'].append(add_source('https://stella.glasgow.ac.uk/grammar/unit-4-3-affixes.html','University of Glasgow · English affixes'))

# Preserve every formal lexical recurrence, including articles and pronouns.
findings.append({'id':'R05','title':'Exact word recurrence, including I / the / to','kind':'computed',
    'labels':[lab('Lexical repetition', 'Equal words are grouped without a stop-word filter, preserving every occurrence.')],
    'summary':'Every repeated spelling is inspectable, including ordinary articles and pronouns. Select a word in the poem to isolate that word’s occurrences in this group.',
    'spans':[span(w['wordIds'], w['normalized_word']+' × '+str(len(w['wordIds']))) for w in audit['all_lexical_recurrences']],
    'limit':'These are formal recurrences, not automatic claims about emphasis or authorial intention. He and his can refer to different characters. The contraction sound’s is one orthographic word, meaning sound is.',
    'method':{'name':'Executed whole-poem occurrence grouping','description':'The recorded bounded adapter case-folds the 108 supplied word occurrences and removes terminal punctuation. It retains all 16 recurring word types and every token ID; nothing is removed for being a function word.'},
    'sources':[add_source('https://github.com/priscian/rhetorica/blob/dc3367c138d266001cbd1b6a2dd5bc715c74eabd/code/RhetoricalFigure.cs')],
    'inventoryIds':['02.11'],'applicationState':'observed','recordIds':['all_lexical_recurrences']})

for f in interpretive['findings']:
    if f['id'] == 'H08': continue  # Same span, now an explicit overlapping label on H04.
    f_labels = [lab(n) for n in f['inventoryLabels']]
    if f['id'] in ('H01','H02'): f_labels = [lab('Qualification'),lab('Epistemic stance')]
    if f['id'] == 'H04':
        f_labels = [lab('Metaphor', 'Snow is described through resemblance to bird’s down.'),lab('Tactile imagery', 'The same adjective suggests softness; this descriptive annotation is not an executed imagery classifier.')]
    if f['id'] == 'H05': f_labels = [lab('Contrast'),lab('Counter-expectation'),lab('Turn toward obligation')]
    if f['id'] == 'H09': f_labels = [lab('Superlative intensity')]
    if f['id'] == 'I01':
        f_labels = [lab('Concession · possible', 'A self-persuasion reading acknowledges attraction, then gives priority to obligations.'),lab('Antithesis · broad reading', 'Attraction and obligation can be read as contrasting ideas. Parallel form is not required by every definition; But alone would be insufficient.')]
    name = 'Assistant-applied published decision steps'
    if f['provenance'] == 'human_descriptive_component': name = 'Assistant close reading · descriptive component'
    if f['provenance'] == 'interpretation': name = 'Assistant close reading · competing interpretations retained'
    description = ' '.join(f['stepsActuallyApplied'])
    if 'mipvu_application' in f['sourceIds']:
        description += ' The inspected paper’s contextual/basic-meaning steps were applied manually to candidate words; this was not a full dictionary audit of all lexical units or an executed metaphor classifier.'
    if f['alternativeReadings']:
        description += ' Alternative reading: ' + ' '.join(f['alternativeReadings'])
    findings.append({'id':f['id'],'title':f['label'],'kind':'interpretation' if f['status']!='supported' else 'reviewed',
                     'labels':f_labels,'summary':f['explanation'],'spans':[span(w['wordIds'],w['quote']) for w in f['spans']],
                     'limit':f.get('limitations',''),'method':{'name':name,'description':description},
                     'sources':[human_sources[s] for s in f['sourceIds']], 'inventoryIds':f['inventoryIds'],
                     'applicationState':f['status'],'recordIds':[f['id']]+(['H08'] if f['id']=='H04' else [])})

# Reading order is based on the first actual witness, not a label's alphabetic name.
findings.sort(key=lambda f:(min(i for s in f['spans'] for i in s['words']), f['kind']=='interpretation', f['id']=='R05', f['id']))

line_notes = {str(row['line']):row['note'] for row in interpretive['lineNotes']}
line_additions = {
    1:'Whose / His share /h…z/ with different vowels.',2:'His / house share initial /h/.',
    3:'He / see / me rhyme within this line; will / fill links lines 3–4.',
    4:'Watch / woods / with share /w/.',7:'The sentence continues into its time phrase on line 8.',
    9:'He / his / harness share /h/.',11:'Sound’s / sweep share first /s/, although the strict complete-onset rule differs.',
    13:'Lovely, dark and deep form a three-part description; dark / deep share /d/.',
    14:'Promises to keep / miles to go repeat a grammatical shape and noun-plural inflection, although their final sounds differ.',
    15:'Line-unit anaphora and epistrophe overlap with the exact final-line repetition.',
    16:'Phrase-level epizeuxis and formal symploce are definition-sensitive overlapping descriptions.'
}
for n, addition in line_additions.items(): line_notes[str(n)] += ' ' + addition

reviewed=[]
for r in interpretive['temptingLabelsChecked']:
    # Every excerpt is assembled from the supplied poem, with gaps made explicit.
    ids=r['wordIds']; groups=[]
    for i in ids:
        if groups and groups[-1][-1]+1 == i: groups[-1].append(i)
        else: groups.append([i])
    quote=' … '.join(' '.join(tokens[i]['word'] for i in g) for g in groups)
    if len(quote)>180: quote=quote[:177]+'…'
    reviewed.append({'label':r['label'],'quote':quote,'reason':r['reason'],'sources':[]})
reviewed.append({'label':'Polysyndeton from every and in the final sentence','quote':'lovely, dark and deep … And miles … And miles',
                'reason':'The original repetition function combines conjunctions at different grammatical levels. The adjective-list conjunction and repeated line-opening conjunctions do not automatically constitute one excessive series. The raw candidate remains available for inspection.',
                'sources':[add_source('https://github.com/text-processing/prose-rhythm-detector/tree/6ca3e48612f5bc6c9df80e3d84bcad8ee46f4179')]})
reviewed.append({'label':'Homeoteleuton inferred from an affix guess','quote':'His … promises; stopping … evening; only … lovely',
    'reason':'These words share audible endings, which remain visible in the sound analysis. The original affix heuristic does not verify their grammatical roles or the adjacent/parallel placement required by the revised figure check. His is not hi plus -s; evening is a noun here; only/lovely has a derivational history, not shared grammatical inflection. All five original occurrence-pair results are retained in the refinement audit.',
    'sources':ending_card['sources']})

entries=[]
for e in ledger['entries']:
    st=e['application_state'].replace('interpretation_or_component_only','interpretation_component')
    notes=[]
    for key in ('result','limitation'):
        v=e.get(key)
        if isinstance(v,str) and v and v not in notes: notes.append(v)
    if not notes: notes=[e.get('result',e.get('verified_scope',''))]
    mode=e.get('application_mode','').replace('_',' ')
    entries.append({'id':e['id'],'name':e['label'],'status':st,'mode':mode,
                    'note':' '.join(notes),'sources':[add_source(u) for u in e.get('source_urls',[]) if u],
                    'findingIds':e.get('finding_ids',[])})

for e in entries:
    if e['id']=='01.01':
        e.update(mode='existing whole-onset rule + executed first-consonant adaptation',note='All 5,778 pairs checked in each pronunciation mode. A1 has 235 first-consonant pairs, including all 147 unchanged E9 whole-onset pairs, 37 other distinct-word pairs and 51 repeated-word pairs. Local witnesses are displayed; remote sound agreement alone is not a claim of rhetorical prominence.',findingIds=['S01','S01b'],sources=initial_card['sources'])
    elif e['id']=='01.06':
        e.update(mode='executed ending adaptation + reviewed placement',note='All 5,778 pairs checked in each mode; 34 pairs have matching final vowel and coda plus a declared adjacent/parallel position. The original five affix-heuristic positives are archived, with sound labels retained. Morphological identity is not inferred from a spelling suffix.',findingIds=['S06'],sources=ending_card['sources'])

sound_data=json.JSONDecoder().raw_decode((DIST/'data.js').read_text().split('=',1)[1].lstrip())[0]
def refined_pair_count(base,scope):
    d=refinement['scopes'][scope]
    a1={tuple(x) for x in d['initialPairs']};e63={tuple(x[:2]) for x in d['endingPairs']}
    absent={(a,b):m&~(1<<22) for a,b,m in base['absenceOnly']}
    return sum(bool(((m&~(1<<22))|((1<<25) if (a,b) in a1 else 0)|((1<<22) if (a,b) in e63 else 0))&~absent.get((a,b),0)) for a,b,m in base['pairs'])

output={'schemaVersion':1,'title':poem['title'],'author':poem['author'],
    'scope':{'lines':16,'words':108,'unorderedPairs':5778,'distinctRecurringWords':len(audit['all_lexical_recurrences'])},
    'provenance':{'code':'Pinned source functions and explicitly declared bounded adaptations were executed.',
        'manual':'Manual review means the assistant applied a published decision procedure or declared close reading. No independent human adjudication was measured.',
        'interpretation':'Possible readings remain distinct from directly observed structure; a missing label is not proof of absence.'},
    'findings':findings,'sources':sources,'lineNotes':line_notes,
    'globalNotes':['Rhetorical readings',
        'All 16 lines and 108 occurrences were reviewed. Rhetoric cards link exact words to code checks, assistant-applied manual review, or interpretations.',
        'The final line repeats as a complete seven-word span. Line-unit anaphora and epistrophe overlap; symploce and phrase-level epizeuxis depend on the stated definition.',
        'The horse’s attributed question is the strongest personifying construction. Downy flake supports a feather-based metaphor and tactile imagery.',
        'But marks a clear contrast. Broad antithesis and concession remain possible readings of the attraction–obligation relation, with their conditions stated.',
        'Literal travel and sleep remain available alongside life-journey and mortality interpretations. The poem does not narrate an actual departure.',
        'The new application record distinguishes observed evidence, scoped no-matches, partial/interpretive work, outside-scope methods, and methods not run. It does not claim 415 working automatic detectors.'],
    'reviewedLabels':reviewed,'coverage':{'inventoryTotal':415,'methodEntries':91,'researchOnlyEntries':324,'entries':entries,
        'summary':'Code ran where the inputs and dependencies allowed it. Manual review means I applied the stated procedure; it is not independent human validation. Grammar, morphology and meaning judgments are identified separately from software output. The full poem was read, but there was no complete dictionary audit of every lexical unit.'},
    'auditFiles':{'structural':'structural-audit.json','nativeRepetition':'native-repetition-results.json','scopeRefinement':'scope-refinement-audit.json'},
    'soundVerification':{'annotatedPositivePairs':refined_pair_count(sound_data,'annotated'),'dictionaryUnionPositivePairs':refined_pair_count(sound_data['allReadings'],'dictionary_union'),'originalAnnotatedPositivePairs':911,'originalDictionaryUnionPositivePairs':1248,'comparisonPairsPerScope':5778,'preservedFeet':64,'preservedSyllables':128}}

assert len(entries)==91 and len({e['id'] for e in entries})==91
assert len({f['id'] for f in findings})==len(findings)
for f in findings:
    assert f['labels'] and f['spans']
    for s in f['spans']:
        assert s['words'] and all(i in tokens for i in s['words'])
    assert all(s in {x['id'] for x in sources} for s in f['sources'])
assert set(line_notes)==set(map(str,range(1,17)))

(DIST/'rhetoric-data.js').write_text('window.RHETORIC_DATA = '+json.dumps(output,ensure_ascii=False,separators=(',',':'))+';\n')
(DIST/'rhetoric-application.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
shutil.copyfile(INPUT/'structural-audit.json',DIST/'structural-audit.json')
shutil.copyfile(INPUT/'native-repetition-results.json',DIST/'native-repetition-results.json')
print(json.dumps({'groups':len(findings),'interpretations':sum(f['kind']=='interpretation' for f in findings),'methods':len(entries),'states':{s:sum(e['status']==s for e in entries) for s in sorted({e['status'] for e in entries})},'sourceCount':len(sources)},indent=2))
