#!/usr/bin/env python3
"""Stage the lexical resources the quality layer needs.

Everything here is fetched from hosts this environment's network policy
permits (GitHub raw, PyPI). Most text-archive hosts, including Gutenberg and
archive.org, are 403 at the gateway, which is why the corpus used in the first
run is the one that happened to be reachable rather than one chosen on merit.
See quality/PREREGISTRATION.md -- no corpus here is privileged, and English is
one cell in a matrix, not the referent.

Note also that the resources staged below are English-specific: Brysbaert
concreteness is an English norming study and the tagger is an English model.
Any port to a second tradition needs its own equivalents, and features that
cannot be restated without them are not language-agnostic.
"""

import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

# THE RETRY POLICY IS NOT RESTATED HERE (doctrine 1). Both stagers fetch over
# the same network from the same host family, and two answers to "how many
# attempts, how long a wait, which errors" is how they start disagreeing.
# `lyric_harness` owns it because that is where the failure was measured.
from lyric_harness import download_to  # noqa: E402
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
    # ADDED 2026-08-23 for `quality/senses.py`, which supplies the `sense`
    # capability `antanaclasis` refuses without. WordNet 3.0 is licensed for
    # use, copy, modification and distribution without fee or royalty (the
    # notice ships beside the data and both rows are in `data/sources.tsv`);
    # it is FETCHED and not committed because `data/nltk/` is gitignored,
    # which is this repo's convention for every large corpus.
    "corpora/wordnet":
        f"{RAW}/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip",
    # THE TAGGER IS NOT OPTIONAL FOR THAT USE and the un-suffixed name is
    # needed beside the `_eng` one above: `nltk.pos_tag` loads
    # `averaged_perceptron_tagger` and then the language model. Simplified
    # Lesk with NO part of speech resolves `sat` to `saturday.n.01` on one
    # line and `ride.v.01` on another — measured — so a past-tense verb read
    # as two senses and the figure fired on an ordinary repeat.
    "taggers/averaged_perceptron_tagger":
        f"{RAW}/nltk/nltk_data/gh-pages/packages/taggers/"
        "averaged_perceptron_tagger.zip",
}


def _get(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return False
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    sys.stderr.write(f"  fetching {os.path.basename(dest)} ... ")
    sys.stderr.flush()
    # The guard above admits any file of NON-ZERO size, so a transfer that
    # died part-way used to be staged forever after. `download_to` writes to
    # `<dest>.part` and renames only on success, which is what makes that
    # guard safe rather than merely fast.
    download_to(url, dest)
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
