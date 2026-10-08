"""Extract all 594 entries from the contiguous PG76498 plain-text transcription.
Usage: python adapter.py /path/to/76498.txt
"""
import re,json,hashlib,collections,pathlib,sys
ROOT=pathlib.Path(__file__).parent
def main():
    s=pathlib.Path(sys.argv[1]).read_text();body=s.split('VERSICLES FOR FESTIVAL')[0]
    ms=list(re.finditer(r'^([0-9]+)\s*$',body,re.M));assert [int(m[1]) for m in ms]==list(range(1,595))
    # Individually reviewed English hymn authors; explicit translators and foreign author credits always excluded first.
    original=set(map(int,'''4 6 7 8 11 12 13 14 15 16 17 18 19 25 26 27 28 29 36 37 39 40 41 42 43 44 45 46 47 48 49 50 51 52 53 54 55 56 57 58 61 68 69 70 71 72 73 75 76 77 78 79 81 85 91 92 93 94 95 96 97 99 100 101 102 104 105 107 108 111 112 113 114 115 116 117 118 119 120 122 123 124 125 127 128 129 131 132 139 144 154 155 158 160 163 164 165 166 167 168 172 175 178 181 182 183 184 186 187 199 200 202 204 209 211 212 213 214 219 221 223 229 231 232 237 238 240 241 242 243 244 245 250 253 254 255 258 259 262 263 265 267 268 269 270 281 283 288 289 290 291 293 294 295 296 297 298 299 300 302 303 304 306 307 308 309 313 315 316 318 319 320 321 322 324 325 328 329 330 332 335 336 337 338 339 341 342 351 352 353 354 355 356 357 358 359 360 361 362 364 367 368 369 370 371 373 374 375 376 377 378 379 380 382 384 386 388 389 395 397 398 399 406 407 409 410 411 412 418 419 423 428 429 437 438 439 440 442 443 444 447 449 450 451 452 455 457 458 459 461 462 463 464 465 466 468 469 470 471 472 473 474 476 477 478 479 482 483 484 485 486 487 488 489 490 491 492 493 496 497 500 502 504 510 512 514 518 519 520 521 522 524 531 534 535 536 540 541 542 546 548 550 553 554 560 561 562 563 564 567 578 592'''.split()))
    uncertain={305,558,*range(579,595)}-{592}
    rows=[]
    for i,m in enumerate(ms):
     n=int(m[1]); b=body[m.end():ms[i+1].start() if i+1<len(ms) else len(body)];ls=b.splitlines()
     verse_indices=[j for j,l in enumerate(ls) if re.match(r'^ {4,12}\S',l)]
     if n>=568 and n<=577:
      title=next(l.strip() for l in ls if l.strip());text=b.strip();credit='Liturgical chant';reason='translated_liturgy';ev='Chants section: biblical or historic Latin liturgical texts in English, not original English lyrics.'
     else:
      assert verse_indices,n
      a,z=verse_indices[0],verse_indices[-1]
      out=[]
      for l in ls[a:z+1]:
       if not l.strip():
        if out and out[-1]!='':out.append('')
       elif re.match(r'^ {4,12}\S',l):
        l=l.strip().replace('_','')
        if re.match(r'^\d+\. ',l):
         if out and out[-1]!='':out.append('')
         l=re.sub(r'^\d+\. ','',l)
        out.append(l)
       else:raise ValueError((n,l))
      text='\n'.join(out).strip(); title=text.splitlines()[0];credit=' '.join(l.strip() for l in ls[z+1:] if l.strip() and not l.strip().isupper())
      if n in original:reason=None;ev='Reviewed original English hymn; supplied authorship credit: '+(credit or ('Thomas Ken, doxology from morning/evening hymns' if n==578 else 'Horatius Bonar, same first stanza as hymn 268'))
      elif n in uncertain:reason='original_language_unresolved';ev='No sufficient original-English attribution in supplied entry; held out rather than assuming anonymous English text is original.'
      else:reason='translation';ev='Foreign-language hymn author or explicit translation credit in supplied entry: '+credit
      if n in {66,74}:ev='English rendering of the historic Latin liturgical text (Te Deum / Gloria), excluded as translation.'
      if n==137:ev='John Chandler translation of Charles Coffin’s Latin Instantis adventum Dei (https://hymnary.org/text/the_advent_of_our_king_our_prayers_must); English author credit alone does not establish original English.'
     rows.append(dict(id=str(n),title=title.rstrip(' ,;.!'),author=credit or ('Thomas Ken' if n==578 else 'Horatius Bonar' if n==592 else 'Anonymous'),text=text,disposition='eligible' if reason is None else 'excluded',reason=reason,source_locator=f'https://www.gutenberg.org/ebooks/76498.txt.utf-8 (numbered entry {n}; browser source line {s[:m.start()].count(chr(10))})',translation_evidence=ev))
    ROOT.mkdir(parents=True,exist_ok=True)
    (ROOT/'candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    print(collections.Counter(r['reason'] or 'eligible' for r in rows))


if __name__ == '__main__':
    main()
