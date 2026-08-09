#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared GRETIL fetch / verse-extraction / IAST key code for the sa labels.

GRETIL plain-text files mark verse ends with // or || plus a verse id.
Five marker dialects occur in 5_poetry:
    // [Sig_1.2]      // Sig_1.2 //      ||12||      [Bhk_1.1]      ||(66)
A verse is a blank-line-delimited paragraph that ENDS in such a marker.
Paragraph framing matters: sa_bhAravi-kirAtArjunIya.txt prints every verse
TWICE, once with an id and once without, and a marker-offset parser silently
concatenates the copy into the next verse.

LICENCE WARNING. Every file fetched here is CC BY-NC-SA 4.0 (783 of 784
GRETIL texts; catalog.csv column `license`). The NC clause makes the TEXT
inadmissible to this project, which ships only PD / PD-affirmed corpora.
The LABEL — a verse id and an integer count — is a fact about the text, not
the text; the .tsv this builds carries no body text, only keys and counts.
Anyone needing the bodies must fetch them themselves under the NC licence.
"""
import os, re, unicodedata, urllib.parse, urllib.request

RAW = 'https://raw.githubusercontent.com/tokushige-koyasan/gretil-corpus/main/'
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.gretil_cache')


def fetch(path):
    os.makedirs(CACHE, exist_ok=True)
    dest = os.path.join(CACHE, path.replace('/', '__'))
    if not (os.path.exists(dest) and os.path.getsize(dest) > 0):
        urllib.request.urlretrieve(RAW + urllib.parse.quote(path), dest)
    return open(dest, encoding='utf-8', errors='replace').read()


# ------------------------------------------------------------------ parsing
TAIL = re.compile(
    r'(?:(?://|\|\|)\s*)?'
    r'(?:\[\s*)?'
    r'(?P<sig>[A-Za-zÀ-ɏḀ-ỿ()\']{1,14}_)?'
    r'(?P<num>\*?\d+(?:\s*[,.]\s*\d+)*\*?[a-z]?)'
    r'\s*(?:\*?\(\d+[a-z]?\)\*?)?'
    r'\s*(?:\])?'
    r'\s*(?:(?://|\|\|)\s*)?'
    r'(?:\(\s*\d+[a-z]?\s*\)\s*\*?)?\s*$'
)
TAIL_PAREN = re.compile(r'(?://|\|\|)\s*\(\s*(?P<num>\d+[a-z]?)\s*\)\s*\|*\s*$')
ALLPAREN = re.compile(r'^\s*\(.*\)\s*$', re.S)


def paragraphs(text):
    text = re.sub(r'\r\n?', '\n', text.replace('﻿', ''))
    return [p for p in re.split(r'\n\s*\n', text) if p.strip()]


def extract(text, min_chars=40):
    """-> [(verse_id, raw_body)] for every paragraph ending in a verse marker."""
    out, seen = [], {}
    for p in paragraphs(text):
        p = p.strip()
        if ALLPAREN.match(p):
            continue                      # editorial citation paragraph
        m = TAIL.search(p)
        if m and m.start() > 0:
            vid = re.sub(r'\s+', '', (m.group('sig') or '') + m.group('num'))
            cut = m.start()
        else:
            m = TAIL_PAREN.search(p)
            if not m or m.start() == 0:
                continue
            vid, cut = 'app' + m.group('num'), m.start()
        body = p[:cut]
        if len(re.sub(r'\s+', '', body)) < min_chars:
            continue
        seen[vid] = seen.get(vid, 0) + 1
        if seen[vid] > 1:                 # ids repeat in MSS and in duplicated files
            vid = '%s#%d' % (vid, seen[vid])
        out.append((vid, body))
    return out


# ---------------------------------------------------------------------- keys
_AVAGRAHA = "'’‘ʼ`ʾʿ"
_IAST = 'abcdefghijklmnopqrstuvwxyzāīūṛṝḷḹṃñṅṇṭḍśṣḥ'


def _prep(s):
    s = unicodedata.normalize('NFC', s)
    s = s.replace('r̥', 'ṛ').replace('l̥', 'ḷ').replace('ṁ', 'ṃ').replace('ẖ', 'ḥ')
    return s


def key_exact(s):
    """EXACT body-text hashing. Whitespace collapsed, nothing else touched:
    case, hyphens, avagraha, punctuation and every diacritic stay."""
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', s)).strip()


def key_norm(s):
    """NORMALISED key. Lowercase; fold anusvara / vocalic-r spelling variants;
    delete every character that is not an IAST letter -- which removes the
    editorial compound hyphens (GRETIL splits compounds in some editions and
    not others), the avagraha, all punctuation, digits and whitespace."""
    s = _prep(s).lower()
    for a in _AVAGRAHA:
        s = s.replace(a, '')
    return ''.join(c for c in s if c in _IAST)


def key_loose(s):
    """NORMALISED + the three orthographic alternations that survive it:
    anusvara written as its homorganic nasal, post-r gemination (sarvva ~
    sarva), and cch ~ ch. Reported as a sensitivity check, not used to label."""
    s = key_norm(s)
    s = s.replace('cch', 'ch')
    s = re.sub(r'(?<=r)([kgcjṭḍtdpbmnyvlśṣs])\1', r'\1', s)
    s = re.sub(r'ṅ(?=[kg])|ñ(?=[cj])|ṇ(?=[ṭḍ])|n(?=[td])|m(?=[pb])', 'ṃ', s)
    return s
