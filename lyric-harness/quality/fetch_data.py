#!/usr/bin/env python3
"""Stage the lexical resources the quality layer needs.

Everything here is fetched from hosts this environment's network policy
permits (GitHub raw, PyPI). The archive hosts that would give us a real
survived/forgotten song corpus -- Gutenberg, archive.org, Levy, HathiTrust,
Wikisource -- are all 403 at the gateway; see quality/PREREGISTRATION.md.
"""

import os
import sys
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
NLTK_DIR = os.path.join(DATA, "nltk")

RAW = "https://raw.githubusercontent.com"

FILES = {
    # Brysbaert et al. concreteness norms, 40k English lemmas, 1-5 scale.
    "concreteness.txt":
        f"{RAW}/ArtsEngine/concreteness/master/"
        "Concreteness_ratings_Brysbaert_et_al_BRM.txt",
}

NLTK_PACKAGES = {
    "taggers/averaged_perceptron_tagger_eng":
        f"{RAW}/nltk/nltk_data/gh-pages/packages/taggers/"
        "averaged_perceptron_tagger_eng.zip",
    "tokenizers/punkt_tab":
        f"{RAW}/nltk/nltk_data/gh-pages/packages/tokenizers/punkt_tab.zip",
}


def _get(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return False
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    sys.stderr.write(f"  fetching {os.path.basename(dest)} ... ")
    sys.stderr.flush()
    with urllib.request.urlopen(url, timeout=120) as r, \
            open(dest, "wb") as f:
        f.write(r.read())
    sys.stderr.write(f"{os.path.getsize(dest):,} bytes\n")
    return True


def fetch_all():
    for name, url in FILES.items():
        _get(url, os.path.join(DATA, name))
    for pkg, url in NLTK_PACKAGES.items():
        sub, leaf = pkg.split("/")
        target = os.path.join(NLTK_DIR, sub, leaf)
        if os.path.isdir(target):
            continue
        zp = os.path.join(NLTK_DIR, sub, leaf + ".zip")
        _get(url, zp)
        with zipfile.ZipFile(zp) as z:
            z.extractall(os.path.join(NLTK_DIR, sub))
        os.remove(zp)
    os.environ.setdefault("NLTK_DATA", os.path.abspath(NLTK_DIR))


def nltk_data_dir():
    return os.path.abspath(NLTK_DIR)


if __name__ == "__main__":
    fetch_all()
    print(f"staged into {os.path.abspath(DATA)}")
