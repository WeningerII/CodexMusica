"""Recompute the two declared poem adaptations over all 5,778 pairs.

Uses the complete saved pronunciation manifest, with the existing respelling
system. This build needs only the Python standard library. The independent
native-reader audits are retained to verify the normalization and pair results.
No guessed suffix is used to recognize a sound or a grammatical ending.
"""
import hashlib
import itertools
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / 'analysis/scope-inputs'
DIST = ROOT / 'dist'
read = lambda name: json.loads((INPUT/name).read_text())
manifest = read('pronunciations.json')
native_initial = read('alliteration-audit.json')
native_ending = read('active_endings.json')
poem = json.loads((ROOT/'analysis/rhetoric-inputs/poem.json').read_text())
phones = manifest['pronunciations']
occurrences = manifest['occurrences']
tokens = {r[0]:r for r in occurrences}
assert len(tokens)==108 and set(tokens)==set(range(1,109))
CONSONANTS = set('B CH D DH F G HH JH K L M N NG P R S SH T TH V W Y Z ZH'.split())
VOWELS = set('AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW AX AXR IX UX'.split())

def first_consonant(pronunciation):
    if not pronunciation:
        raise ValueError('Missing pronunciation')
    first=re.sub('[012]$', '', pronunciation[0])
    if first in CONSONANTS: return first
    if first in VOWELS: return None
    raise ValueError('Unknown initial phoneme: '+first)

def final_ending(pronunciation):
    """Actual final nucleus and entire coda, under the existing English licence."""
    nuclei=[i for i,p in enumerate(pronunciation) if re.sub('[012]$','',p) in VOWELS]
    if not nuclei: raise ValueError('No vowel nucleus')
    i=nuclei[-1]
    raw=pronunciation[i]
    nucleus=re.sub('[012]$','',raw)
    stress=int(raw[-1]) if raw[-1] in '012' else 0
    coda=pronunciation[i+1:]
    assert all(c in CONSONANTS for c in coda)
    if nucleus=='AH' and stress==0: nucleus='AH0'
    if coda[:1]==['R']:
        for first,second in manifest['beforeRLicence']:
            if nucleus in (first,second): nucleus=first;break
    return (nucleus,*coda),stress

line_ends={line['wordIds'][-1] for line in poem['lines']}
repeated_slots=set(zip(poem['lines'][14]['wordIds'],poem['lines'][15]['wordIds']))
assert [tokens[i][2].casefold() for i in poem['lines'][14]['wordIds']]==[tokens[i][2].casefold() for i in poem['lines'][15]['wordIds']]

def positions(a,b):
    tags=[]
    if tokens[a][3]==tokens[b][3] and tokens[b][4]==tokens[a][4]+1: tags.append('A')
    if a in line_ends and b in line_ends: tags.append('L')
    if (a,b)==(77,80): tags.append('P')  # Reviewed adjective positions in coordinated noun phrases.
    if (a,b) in repeated_slots: tags.append('R')
    return tags

all_pairs=list(itertools.combinations(tokens,2))
assert len(all_pairs)==5778
phonetic=[(first_consonant(p),final_ending(p)) for p in phones]
scopes={}
for mode in ('annotated','dictionary_union'):
    choices={r[0]:[r[5]] if mode=='annotated' else r[6] for r in occurrences}
    initial,ending,unpositioned,witnesses=set(),{},set(),{}
    for a,b in all_pairs:
        placement=positions(a,b)
        for ra,rb in itertools.product(choices[a],choices[b]):
            ca,(ea,sa)=phonetic[ra];cb,(eb,sb)=phonetic[rb]
            flags=0
            if ca is not None and ca==cb: initial.add((a,b));flags|=1
            if ea==eb:
                unpositioned.add((a,b))
                if placement: ending[(a,b)]=placement;flags|=2
            if flags: witnesses[(a,b,ra,rb)]=flags
    old=native_initial['scopes'][mode]
    strict={tuple(x) for x in old['native_E9_pairs']}
    repeats={p for p in initial if tokens[p[0]][2].casefold()==tokens[p[1]][2].casefold()}
    assert initial=={tuple(x) for x in old['positive_pairs']}
    assert strict<=initial
    assert set(ending)=={tuple(x[:2]) for x in native_ending['modes'][mode]['pairs']}
    assert len(unpositioned)==native_ending['modes'][mode]['counts']['unrestricted_ending_agreements']
    # Check complete pronunciation witnesses against independent native-reader audit.
    native_witnesses=native_ending['modes'][mode]['witnesses']
    expected={(a,b,tuple(native_witnesses[w][0]),tuple(native_witnesses[w][1]))
              for a,b,_,_,ids in native_ending['modes'][mode]['pairs'] for w in ids}
    actual={(a,b,tuple(phones[ra]),tuple(phones[rb])) for (a,b,ra,rb),mask in witnesses.items() if mask&2}
    assert expected==actual
    scopes[mode]={
        'counts':{'comparedPairs':len(all_pairs),'initialConsonantPairs':len(initial),
            'nativeWholeOnsetPairs':len(strict),'addedDistinctWordInitialPairs':len(initial-strict-repeats),
            'repeatedWordInitialPairs':len(repeats),'sameLineInitialPairs':sum(tokens[a][3]==tokens[b][3] for a,b in initial),
            'positionedEndingPairs':len(ending),'distinctWordEndingPairs':sum(tokens[a][2].casefold()!=tokens[b][2].casefold() for a,b in ending),
            'repeatedWordEndingPairs':sum(tokens[a][2].casefold()==tokens[b][2].casefold() for a,b in ending),
            'unpositionedEndingAgreements':len(unpositioned)},
        'initialPairs':[list(p) for p in sorted(initial)],
        'endingPairs':[[a,b,tags] for (a,b),tags in sorted(ending.items())],
        'witnesses':[[a,b,mask,ra,rb] for (a,b,ra,rb),mask in sorted(witnesses.items())]
    }

raw=(DIST/'data.js').read_text()
baseline=json.JSONDecoder().raw_decode(raw[raw.index('=')+1:].lstrip())[0]
absent={(a,b):mask for a,b,mask in baseline['absenceOnly']}
legacy=[[a,b] for a,b,mask in baseline['pairs'] if (mask&~absent.get((a,b),0))&(1<<22)]
assert len(legacy)==5
assert all(not positions(a,b) for a,b in legacy)
result={
    'version':1,'title':'Alliteration and ending-rule refinement',
    'baseDataSha256':hashlib.sha256((DIST/'data.js').read_bytes()).hexdigest(),
    'pronunciations':phones,'respellings':manifest['respellings'],
    'pairColumns':['a','b','position flags'],'witnessColumns':['a','b','relation flags: 1 initial, 2 ending','reading a','reading b'],
    'positionFlags':native_ending['position_flags'],
    'definitions':{
        'A1':'Equal nonempty consonantal first phonemes in complete declared pronunciations. Includes repeated words. No stress or proximity condition; remote pair evidence is not automatically a salient rhetorical figure.',
        'E9':'Original nonempty complete-onset agreement between different spellings; unchanged.',
        'E63':'Equal final vowel nucleus and complete coda, plus an explicitly recorded adjacent or parallel position. Stress is evidence, not an equality gate. Includes exact repetition. This bounded adaptation replaces the original affix heuristic in this poem only.',
        'H1':'Same spelled rhyme ending at an existing audible match; unchanged predicate, clarified label.',
        'scope':'All 108 occurrences and 5,778 pairs in each pronunciation mode. Position scopes are declared, not an exhaustive parser for every possible semantic parallelism. The /ðə/ alternative to /ði/ removes the The/only witness; union mode retains only witnesses that actually match.'},
    'scopes':scopes,'legacyEndingPairs':legacy,
    'morphology':[
        {'words':[9,25,58,92],'judgment':'His is a possessive form of he, not hi plus a plural suffix. Promises is a plural noun here. The audible /ɪz/ ending survives as E18; shared grammatical inflection is rejected.'},
        {'words':[21,52],'judgment':'Stopping is an -ing verb form; evening is the time-of-day noun here. Equal /ɪŋ/ does not make them the same inflection.'},
        {'words':[71,85],'judgment':'Only and lovely share historical derivational -ly, but that is not a repeated grammatical inflection. Their /li/ sound agreement is retained.'},
        {'words':[92,96,103],'judgment':'Promises and miles are plural nouns in the parallel constructions NOUN + to + VERB. Their plural endings have different whole final rimes, /ɪz/ and /aɪlz/. This is shared English inflection, not an E63 final-rime match.'}
    ],
    'analysisNotes':[
        'Every supported relation remains available for analyzing this existing poem. Pair counts describe overlapping formal evidence, not independent rhetorical effects.',
        'A1 compares the first consonant of every word. E9 retains the narrower original whole-onset rule. The broader check includes repeated words; vowel-initial words never match merely because both lack an onset.',
        'E63 now requires a real matching final vowel and complete coda in a declared adjacent or parallel position. The tested positions are neighboring words in a line, line endings, easy/downy in coordinated noun phrases, and corresponding words in the repeated final line. It does not infer a grammatical suffix or artistic intention.',
        'The previous five affix-heuristic matches remain in the downloadable audit. They retain their actual sound labels, including E18, but no longer receive E63 from an unverified suffix guess. His is not hi plus -s; evening is a noun here.',
        'H1 is named same spelled rhyme ending. It records the original spelling-plus-sound property and does not by itself establish the placement needed for the homeoteleuton figure.',
        'E66 (trite rhyme) still means membership in Codex Musica’s declared list. It neither grades this poem nor establishes that unlisted pairs are original.'
    ],
    'sourceLinks':[
        ['Academy of American Poets · Alliteration','https://poets.org/glossary/alliteration'],
        ['BYU · Homoioteleuton','https://rhetoric.byu.edu/Figures/H/homoioteleuton.htm'],
        ['BYU · Homoioptoton','https://rhetoric.byu.edu/Figures/H/homoioptoton.htm'],
        ['Cambridge · His','https://dictionary.cambridge.org/dictionary/english/his'],
        ['Cambridge · Evening','https://dictionary.cambridge.org/dictionary/english/evening']
    ]
}
(DIST/'scope-refinement-data.js').write_text('window.POEM_REFINEMENT = '+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n')
(DIST/'scope-refinement-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v['counts'] for k,v in scopes.items()},indent=2))
