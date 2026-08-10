#!/usr/bin/env python3
"""Regressions for Malay (quality/phonology/msa.py) — the pantun's ABAB.

The load-bearing tests here are the REFUSALS and the ORTHOGRAPHY, because
those are where this module can be silently wrong:

  * `ng ny sy` are ONE consonant. A per-character loop corrupts every coda in
    the language, and /ŋ/ is the commonest rhyme coda in this corpus.
  * a 1900 spelling and its modern twin must behave AS DECLARED — `burong` vs
    `burung` is a refusal, `pechah` vs `pecah` is one word, `ka-` vs `ke-`
    rhymes while syllabifying differently.
  * out-of-inventory returns None, never False.
  * a shared final LETTER is not a rhyme.

Every fixture is a real quatrain from Skeat, *Malay Magic* (Macmillan, 1900),
public domain, declared in data/sources.tsv as
`GITenberg/Malay-Magic_47873#pantun-abab`, extracted this session as 82
exact-ABAB quatrains. They are embedded verbatim so the reported rate is
reproducible without the extraction file. A test built only from invented
words proves self-consistency, not correctness (doctrine 37).

Run: python3 quality/test_phon_msa.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.phonology import Unsupported  # noqa: E402
from quality.phonology import msa  # noqa: E402

M = msa.Malay()

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def _raises(fn):
    """-> True if fn() raises. Used where the contract is a REFUSAL."""
    try:
        fn()
    except Exception:
        return True
    return False


# ---------------------------------------------------------------------------
# Skeat, *Malay Magic*, 1900 (public domain; data/sources.tsv row
# GITenberg/Malay-Magic_47873#pantun-abab). All 82 quatrains the sourcing cell
# extracted as exact-ABAB, verbatim including Skeat's footnote markers,
# editorial brackets and parentheses -- the printing is part of the test.
# ---------------------------------------------------------------------------
QUATRAINS = [
    [
        '"Arak-arak iring-iring',
        'Kembang bunga si Panggil-Panggil,',
        'Datang berarak, datang beriring,',
        'Raja Suleiman datang memanggil.',
    ],
    [
        'Pergi mendapat `Ijrail, [813]',
        'Tiada juga dapat hati Bumi.',
        'Pergi mendapat `Ijrail, [814]',
        'Bharu-lah dapat hati Bumi.',
    ],
    [
        "Daun pekak, daun pegaga",
        'Katiga dengan mali-mali',
        "Aku pinta' mana yang ada,",
        'Membuang sial dengan pemali.',
    ],
    [
        'Lang Pok Lang Melini,',
        'Katiga dengan awan Shurga,',
        'Di-tepok jangan-lah tangan kiri,',
        "Aku pinta' mana yang ada.",
    ],
    [
        'Telor chichak, telor mengkarong,',
        'Ka-tiga dengan si labi-labi.',
        "Panchang 'ku chachak tengah harong,",
        'Angin ribut tidak menjadi.',
    ],
    [
        "Do' Ding, [859] punei Do'ding",
        'Katiga punei Madukara; [860]',
        'Patah ranting, tindeh ranting,',
        'Pulang `adat sedia kala.',
    ],
    [
        'Indang-indang melukut',
        'Indang di lapek [861] purun,',
        'Hilang-hilang di-jeput',
        'Di-jeput di-bawa turun.',
    ],
    [
        'Indang-indang melukut',
        'Indang di sumpit purun,',
        'Hilang-hilang di-jeput',
        'Hilang di-bawa turun.',
    ],
    [
        'Indang-indang ujong melukut',
        'Indang-indang di sumpit purun',
        'Hilang-hilang di-jeput,',
        'Di-jeput di-bawa turun.',
    ],
    [
        'Indang-indang melukut',
        'Indang di sumpit garam',
        'Hilang-hilang di-jeput,',
        'Bawa kadalam.',
    ],
    [
        'Arak-arak, iring-iring',
        'Kembang bunga Si Panggil-Panggil,',
        'Turun berarak, turun beriring',
        'Raja Suleiman datang memanggil.',
    ],
    [
        'Tetak dahan [868] mengkudu [869]',
        'Tetak tekan [870] tekankan,',
        'Yang dekat datang dahulu',
        'Yang jauh pesan-pesankan;',
    ],
    [
        'Hati-hati si merpati',
        'Tetak sa-nila-nila [871]',
        'Bumbun nama Si Raja Sakti',
        'Buluh bernama Si Raja Gila',
    ],
    [
        'Indang-indang melukut',
        'Aku indang di sumpit purun',
        'Aku kundang, aku jeput,',
        'Aku jeput, aku bawa turun,',
    ],
    [
        'Tanah liat, tanah perabun',
        'Ka-tiga dengan tanah merkah;',
        'Melihat, mata angkau rabun,',
        'Memandang, mata angkau pechah.',
    ],
    [
        '"Tanah liat, tanah benchah,',
        'Tanah memandang deri kabun',
        'Melihat, mata-nya pechah,',
        'Memandang, mata-nya rabun,',
    ],
    [
        'Hei hilir Delik, patah Delik,',
        'Letak mari tepian lalang,',
        'Kata berturut jijak berbalik,',
        'Hanchor daging berbalun [916] tulang!',
    ],
    [
        '"Delik kayu mendulang',
        'Tetak berakar-akar;',
        'Habis kulit pemalun tulang',
        "Kena do'a kalinting bakar.\"",
    ],
    [
        '"Rindu rindu rindang rindang, [919]',
        'Sulasih tumboh di batu;',
        "Dudok 'kau rindu, berjalan 'kau rindang,",
        'Tonak kasih ka jerat aku."',
    ],
    [
        '"Hantu Raya, Si Buta Raya,',
        'Hantu berjalan, anak beranak,',
        "Ta'tabek rimba yang raya",
        "Aku 'nak menempoh hantu yang banyak.",
    ],
    [
        "Bukan-nya jerat, bukan-nya reman,",
        'Kalang kaki sa-mata-mata,',
        'Kena perabun Raja Suleiman,',
        'Kalau di-pandang mata buta!',
    ],
    [
        'Arak-arak iring-iring,',
        'Kembang bunga Si Panggil-panggil;',
        'Datang berarak, datang beriring,',
        'Jaring-ku datang memanggil!',
    ],
    [
        'Sirih unta, pinang unta,',
        'Kerakap memanjat puar.',
        'Pesan pada jembalang rimba',
        'Kutu hutan [923] suroh kaluar!',
    ],
    [
        'Menyalak anjing didalam benchah',
        'Menyalak si anak tedong! [927]',
        "Menyalak tekum 'kau pechah,",
        "Menjilat lidah 'kau kudong!",
    ],
    [
        'Pisau raut, pisau renchong',
        "Menchato' banir pulai.",
        'Hantu laut, hantu [kampong],',
        'Kuching meniti dahan pulai.',
    ],
    [
        'Chinchang chendawan chinchang',
        'Chinchang mari buku buloh,',
        'Pesan mari mambang dewana bintang',
        'Jangan bri tumboh.',
    ],
    [
        'Ruwak-ruwak sakandang desa',
        'Bertenggek di bauran panah.',
        'Berkuak-lah angkau Rengkesa,',
        "'Nak letakkan bakul di-atas tanah.",
    ],
    [
        'Di-chinchang galenggang batang,',
        'Di-chinchang di muka pintu,',
        'Di-tentang melenggang-nya datang,',
        'Anak aku rupa-nya itu.',
    ],
    [
        'Bukan gantang gantang lada,',
        'Gantang berisi hampa padi,',
        'Bukan-nya datang datang sahaja,',
        'Besar maksud kahandak hati.',
    ],
    [
        'Layang-layang jatoh bertimpa,',
        'Timpa di laman kami,',
        'Bayang-bayang dengan Rengkesa,',
        'Jangan berchampor dengan kami.',
    ],
    [
        'Jamu-lah jamu wadi',
        'Ali berjuntei jamu watang',
        'Kalau sa-kisah bharu jadi',
        'Kalau sa-kisah bharu datang,',
    ],
    [
        'Al-salam `aleikum, hei Sang Gana!',
        'Al-salam `aleikum, hei Sang Gani!',
        'Al-salam `aleikum, hei Sang Kremasena,',
        'Sang Kremaseni, Sang Dermaseni!',
    ],
    [
        'Hei sahabat-ku [Si Anu]',
        "Aku minta' sampeikan kapada",
        '[tempat anu]',
        'Jangan rosak, jangan binasa.',
    ],
    [
        'Arak-arak, iring-iring',
        'Kembang bungi si Panggil-Panggil,',
        'Datang berarak, datang beriring',
        'Raja Suleiman datang memanggil.',
    ],
    [
        'Jembalang, Jembali,',
        'Daun lalang gulong-gulong,',
        'Datang angkau kamari,',
        "'Ku tetak dengan parang gudong.",
    ],
    [
        'Lada kechil, lada hitam [966]',
        'Sampei ka tunggul muda Peri [967]',
        'Adek yang kechil, adek yang hitam [968]',
        'Si Anu terkena sambar (ini).',
    ],
    [
        'Tetak buluh telang,',
        'Tetak serba bersisa;',
        'Ayer lior gilang gemilang',
        'Menawar serba yang bisa.',
    ],
    [
        "Rasul Allah di hadapan-'ku!",
        "Turun mala'ikat yang berampat,",
        "Terkunchi terkanching pintu bahia-'ku.",
        "Turun mala'ikat yang berampat,",
    ],
    [
        'Sekam burok, sekam bharu,',
        '[Di-]tampi terlayang-layang,',
        "Tundok hantu 'ku 'nak lalu,",
        'Jangan tindeh bayang-bayang,',
    ],
    [
        'Tinggi tinggi matahari',
        'Anak kerbau mati tertambat;',
        'Salama ini sahya menchari,',
        'Inilah bharu sahya mendapat.',
    ],
    [
        'Rumah kechil para-nya lima',
        'Tempat menyalei ikan kerisi;',
        'Aiu hei, Inche, sahya bertanya',
        'Brapa-kah harga intan disini?',
    ],
    [
        "Tali kail panjang-nya lima",
        "'Kan pengail ikan tenggiri;",
        'Tujoh tahil sakati lima,',
        'Itulah harga intan disini.',
    ],
    [
        'Kalau tidak rengas di tanjong',
        'Pandan di hulu di-rebahkan;',
        'Kalau tidak mas di-kandong,',
        'Badan dahulu di-serahkan.',
    ],
    [
        'Kalau tiada rengas di tanjong,',
        'Ambil beringin pagarkan dulang;',
        'Kalau tiada mas di-kandong,',
        'Jangan inginkan anak orang.',
    ],
    [
        'Ribu-ribu batang terpanggong,',
        "'Kan dudok batang rumbia;",
        "Meski sa-ribu hutang 'ku tanggong,",
        "Asal 'ku pinang anak dia.",
    ],
    [
        'Baik kalas, baik tidak,',
        'Lenggundi tumboh di panchor;',
        'Baik baik, baik tidak,',
        "Tegal de' budi hati-'ku hanchor.",
    ],
    [
        "'Che Ungku mudik ka hulu",
        'Ambil kain basoh nila-nya;',
        'Kalau yang itu, biar-lah dahulu,',
        'Kalau yang lain, barang bila-nya.',
    ],
    [
        "'Plam 'Che Dol Amat",
        'Jatoh tergolek ka dalam paya;',
        "Kalau ta' dapat dengan hikmat,",
        'Tilekkan tuju prang maya.',
    ],
    [
        "Kalau ta' rapat puan de' bingku",
        'Nasi kunyit panggang ayam;',
        "Kalau ta' dapat Tuan di-aku,",
        'Langit sengit, dunia karam!',
    ],
    [
        "Diri-diri pagar 'Che Naik",
        'Galu-galu anak tangga-nya;',
        'Inche terdiri mari-lah naik,',
        "Sahya ta' tahu menyebut nama-nya.",
    ],
    [
        "'Nak tajok, tajok-lah puan,",
        'Remunggei batang berduri;',
        "'Nak masok, masok-lah Tuan,",
        'Timbang-lah chukei `adat negri.',
    ],
    [
        'Belatok lagi terbang,',
        'Ini pula si burong nuri;',
        "Hukum dato' lagi 'ku timbang",
        "Ini 'kan pula chukei negri.",
    ],
    [
        'Batang penak, batang pejam,',
        'Katiga dengan batang kladi;',
        'Datang senak, datang tajam,',
        'Datang tawar tidak menjadi.',
    ],
    [
        "Aku pinta' turunkan sagala yang bisa",
        "De' dalam salerang badan tuboh Si Anu;",
        "Minta' chabutkan sagala yang bisa",
        "De' dalam salerang badan tuboh Si Anu!",
    ],
    [
        'Tatang puan, tatang cherana,',
        'Tatang dengan batang satawar,',
        'Datang-lah tuan, datang-lah nyawa,',
        'Datang membawa ubat penawar. [1012]',
    ],
    [
        'Anggrek dewana berjambangan,',
        'Kapala Gempa Raja Wolanda;',
        'Tabek Tuan Dewa Kayangan,',
        'Handak di-sambut Paduka chunda.',
    ],
    [
        'Anggrek dewana diatas papan,',
        'Jatoh sa-kaki di-makan kuda;',
        'Tabek Tuan Batara Kuripan,',
        "Di-pohunkan Tuan sakalian anak'nda.",
    ],
    [
        'Anggrek dewana di-sambar helang,',
        'Bunga-nya habis di-makan kuda;',
        'Tabek Tuan Batara Gugelang,',
        "Di-pohunkan turun Paduka anak'nda.",
    ],
    [
        'Anggrek dewana Naga Sari,',
        'Meraksi kain Wolanda;',
        'Tabek Tuanku Batara Sari,',
        "Di-pohunkan turun Paduka anak'nda.",
    ],
    [
        'Anggrek dewana berjambangan,',
        'Kapal kembali lalu ka Jawa;',
        'Tabek Tuanku Dewa Kayangan,',
        "Sudah kembali chunda anak'nda,",
    ],
    [
        'Jangan Tuan berpauh (?) padi,',
        'Jikalau bidok serempu juga;',
        'Jangan-lah Tuan berjauh hati,',
        'Jikalau hidup bertemu juga.',
    ],
    [
        'Tanam kembili didalam jambangan,',
        'Anak rusa memakan rumput;',
        'Kembali-lah Tuan orang kayangan',
        "Esok lusa pula 'ku jemput.",
    ],
    [
        'Pinjam tukol pinjam landasan',
        "'Nak menukol tengko' Pari",
        "Pinjam dusun pinjam 'laman",
        'Menurunkan anak bidadari.',
    ],
    [
        'Pinjam tukol pinjam landasan,',
        "'Nak menukol belakang Pari,",
        "Pinjam dusun pinjam 'laman",
        'Menurunkan anak bidadari.',
    ],
    [
        'Pinjam tukol pinjam landasan,',
        "'Nak menukol gelabang Pari,",
        "Pinjam dusun pinjam 'laman",
        'Menurunkan anak bidadari.',
    ],
    [
        'Pinjam tukol pinjam landasan',
        "'Nak menukol kapala Pari,",
        "Pinjam dusun pinjam 'laman",
        'Menurunkan anak bidadari.',
    ],
    [
        'Pinjam tukol pinjam landasan',
        "'Nak menukol gerongok Pari,",
        "Pinjam dusun pinjam 'laman",
        'Menurunkan anak bidadari.',
    ],
    [
        'Pinjam tukol, pinjam landasan',
        "'Nak menukol ensang Pari,",
        "Pinjam dusun, pinjam 'laman",
        'Menurunkan anak bidadari.',
    ],
    [
        'Pinjam tukol, pinjam landasan',
        "'Nak menukol ekor Pari,",
        "Pinjam dusun, pinjam 'laman,",
        'Menurunkan anak bidadari.',
    ],
    [
        'Gali-gali halia,',
        'Dapat sa-jari dua jari,',
        'Chhari-chhari padang mulia',
        'Menurunkan anak bidadari.',
    ],
    [
        'Gali-gali bunglei',
        'Dapat sa-jari dua jari,',
        'Chhari-chhari padang yang selesei',
        'Menurunkan anak bidadari.',
    ],
    [
        'Gali-gali kunyit',
        'Dapat sa-jari dua jari',
        'Chhari-chhari padang yang sulit',
        'Menurunkan anak bidadari.',
    ],
    [
        'Gali-gali lempoyang',
        'Dapat sa-jari dua jari',
        'Chhari-chhari padang yang loyang,',
        'Menurunkan anak bidadari.',
    ],
    [
        'Tatang puan, tatang cherana,',
        'Tatang di tengah taman,',
        'Datang-lah tuan, datang-lah nyawa,',
        "Datang-lah dudok di tengah 'laman.",
    ],
    [
        'Tatang puan, tatang cherana,',
        'Tatang puan pagi hari,',
        'Datang-lah tuan datang-lah nyawa,',
        'Datang naik membasoh kaki.',
    ],
    [
        'Tatang puan tatang cherana',
        'Tatang bidok di selasar',
        'Datang-lah tuan datang-lah nyawa',
        "Datang dudok 'nak bentang tikar.",
    ],
    [
        'Tatang puan, tatang cherana',
        'Tatang dengan tunjang nyiris (nyirih)',
        'Datang-lah tuan datang-lah nyawa',
        'Datang-lah dudok makan sirih.',
    ],
    [
        'Lukah melenggang bagei naga.',
        'Agai-agai perembek pagai',
        'Perembek tumboh di mata-nya,',
        "Suroh pulang de' nan langkai,",
    ],
    [
        'Angkau teringat kapada mak bapa-kau,',
        'Angkau teringat kapada aku,',
        "Angkau teringat kapada rumah tangga 'kau,",
        'Angkau teringat kapada aku,',
    ],
    [
        'Niyor manis, siamang bulan,',
        'Kalapa tumboh di batu,',
        'Si Anu menangis menentang bulan,',
        'Dia kena hikmat aku.',
    ],
    [
        '"Tekukur di gulei lemak',
        'Sulasi di-bawah batang',
        'Lagi lumpor jalan semak',
        'Sebab kasih maka-nya datang."',
    ],
    [
        'Talang puan, tatang cherana',
        'Dalang bidok pagi hari',
        'Datang-lah tuan datang-lah nyawa,',
        'Memanggil tuan datang kamari.',
    ],
]


def _syl(w):
    return ".".join(s.text for s in M.syllabify(w))


# ---------------------------------------------------------------------------


def test_digraphs_are_single_consonants():
    print("\n1. ng / ny / sy are ONE consonant — on real corpus words")
    # `memanggil` closes quatrain 1 and is its A-rhyme. Split ng into n+g and
    # its coda becomes ('n','g'), which corrupts the commonest rhyme coda in
    # the language while still looking like a plausible syllabification.
    s = M.syllabify("memanggil")           # 'Raja Suleiman datang memanggil.'
    check("memanggil -> me.mang.gil", _syl("memanggil") == "me.mang.gil",
          _syl("memanggil"))
    check("its ng coda is ONE unit, not ('n','g')", s[1].coda == ("ng",),
          str(s[1].coda))
    check("ngg reads ng + g, so tanggong is tang.gong",
          _syl("tanggong") == "tang.gong", _syl("tanggong"))
    # 'Datang-lah tuan, datang-lah nyawa' — ny onsets the first syllable.
    s = M.syllabify("nyawa")
    check("nyawa -> nya.wa", _syl("nyawa") == "nya.wa", _syl("nyawa"))
    check("its ny onset is ONE unit", s[0].onset == ("ny",), str(s[0].onset))
    # 'Aku "nak menempoh hantu yang banyak.' — ny between vowels.
    s = M.syllabify("banyak")
    check("banyak -> ba.nyak", _syl("banyak") == "ba.nyak", _syl("banyak"))
    check("banyak's ny is an onset, not a coda+onset",
          s[1].onset == ("ny",) and s[0].coda == (),
          str((s[0].coda, s[1].onset)))
    # 'Katiga dengan awan Shurga' — Straits sh, modern sy, ONE /ʃ/ either way.
    s = M.syllabify("Shurga")
    check("Shurga -> syur.ga (sh is one consonant)",
          _syl("Shurga") == "syur.ga", _syl("Shurga"))
    check("sh and modern sy give the SAME units",
          msa.units("shurga") == msa.units("syurga"),
          f"{msa.units('shurga')} vs {msa.units('syurga')}")
    # The counter-case: nj is NOT a digraph in this orthography.
    check("nj is n + j, so menjadi is men.ja.di (not a /ɲ/ onset)",
          _syl("menjadi") == "men.ja.di", _syl("menjadi"))


def test_ng_is_the_rhyme_coda_that_matters():
    print("\n2. the ng coda decides real pantun rhymes")
    # Quatrain 1: iring-iring / beriring on -ing; Panggil / memanggil on -il.
    check("iring-iring rhymes beriring", M.rhymes("iring-iring", "beriring")
          is True, str(M.rhymes("iring-iring", "beriring")))
    check("panggil-panggil rhymes memanggil",
          M.rhymes("Panggil-Panggil", "memanggil") is True)
    # Quatrain 43 (Kalau tiada rengas di tanjong / ... di-kandong): two
    # DIFFERENT words sharing the -ong rime.
    check("tanjong rhymes di-kandong", M.rhymes("tanjong", "di-kandong")
          is True)
    check("-ing does not rhyme -ang", M.rhymes("beriring", "datang") is False)


def test_out_of_inventory_is_none_not_false():
    print("\n3. unknown never produces an answer (commitment 2)")
    # Skeat's footnote markers are printed inside the verse lines.
    check("a footnote marker syllabifies to []", M.syllabify("[813]") == [])
    check("digits syllabify to []", M.syllabify("813") == [])
    check("rhymes() on an unreadable word is None, not False",
          M.rhymes("813", "burong") is None, str(M.rhymes("813", "burong")))
    check("alliterates() on an unreadable word is None, not False",
          M.alliterates("813", "burong") is None)
    check("a Cyrillic word is out of inventory", M.syllabify("бурong") == [])
    check("rhymes() against it is None",
          M.rhymes("бурong", "burong") is None)
    # A complex CODA is out of the (C)V(C) shape and refuses. `anggrek` is the
    # one word in the whole 82 that does: it is a Dutch loan whose medial
    # cluster needs a complex ONSET (ang.grek), and native Malay has none, so
    # the module will not invent a split. It is line-initial in quatrains
    # 55-59 and is never a rhyme word, so the cost is 5 syllable COUNTS and
    # zero rhyme verdicts. Refusing beats special-casing one loanword.
    check("anggrek (complex cluster) refuses rather than guessing",
          M.syllabify("anggrek") == [])
    check("but a word-initial cluster is ACCEPTED — the onset is not a rime",
          _syl("prang") == "prang" and _syl("Kremasena") == "kre.ma.se.na",
          f"{_syl('prang')} / {_syl('Kremasena')}")


def test_straits_and_modern_behave_as_declared():
    print("\n4. a 1900 spelling against its modern twin — AS DECLARED")
    # DECLARED: the module reads Straits natively and does NOT modernise the
    # rime, because the Straits -o- IS the surface allophone of /u/ in a final
    # closed syllable. Where the two orthographies differ INSIDE the rime it
    # refuses; where they differ outside it, it decides normally.
    check("burong / burung -> None (o~u inside the rime)",
          M.rhymes("burong", "burung") is None,
          str(M.rhymes("burong", "burung")))
    check("adek / adik -> None (e~i inside the rime)",
          M.rhymes("adek", "adik") is None, str(M.rhymes("adek", "adik")))
    check("dato' / dudok -> None (Straits writes final /ʔ/ both ways)",
          M.rhymes("dato'", "dudok") is None, str(M.rhymes("dato'", "dudok")))
    # ...and the refusal is NOT a blanket one. Two Straits -ong words are a
    # confident True; a genuinely different rime is a confident False.
    check("burong / tanjong -> True (same spelling, same rime)",
          M.rhymes("burong", "tanjong") is True)
    check("burong / burok -> False (different coda, decided)",
          M.rhymes("burong", "burok") is False)
    # pechah/pecah differ only in a NOTATIONAL consonant fold, so they are one
    # word here -- 'Memandang, mata angkau pechah.' (quatrain 15).
    check("pechah and pecah give identical syllables",
          _syl("pechah") == _syl("pecah") == "pe.cah", _syl("pechah"))
    check("pechah / pecah is REPEAT, not two words that sound alike",
          M.relation_type("pechah", "pecah") == "REPEAT",
          str(M.relation_type("pechah", "pecah")))
    # ka- / ke- is the pepet, and it is NOT folded: it cannot reach a rime.
    check("katiga / ketiga rhyme (the swap is outside the rime)",
          M.rhymes("katiga", "ketiga") is True)
    check("...while syllabify shows the difference it did not fold",
          _syl("katiga") == "ka.ti.ga" and _syl("ketiga") == "ke.ti.ga",
          f"{_syl('katiga')} / {_syl('ketiga')}")
    # 'Melihat, mata angkau rabun,' (quatrain 15) -- angkau vs modern engkau.
    check("angkau / engkau rhyme (the swap is in the penult)",
          M.rhymes("angkau", "engkau") is True)
    # ei is /ai/ word-finally: 'Gali-gali bunglei' / 'padang yang selesei'.
    check("bunglei and selesei rhyme on the Straits -ei = /ai/",
          M.rhymes("bunglei", "selesei") is True)
    check("bunglei -> bung.lai, one final syllable not two",
          _syl("bunglei") == "bung.lai", _syl("bunglei"))
    check("...but medial ei is NOT rewritten (aleikum keeps its hiatus)",
          _syl("aleikum") == "a.le.i.kum", _syl("aleikum"))


def test_a_shared_final_letter_is_not_a_rhyme():
    print("\n5. sharing a final LETTER is not sharing a rime")
    # All real end words from the 82. Same final letter, different rime.
    for a, b in (("tanah", "tumboh"),      # both -h   (q27 / q26)
                 ("pechah", "tumboh"),     # both -h   (q15 / q26)
                 ("melukut", "berampat"),  # both -t   (q7  / q37)
                 ("purun", "berjambangan"),  # both -n (q7  / q55)
                 ("burong", "beriring"),   # both -g   (q51 / q1)
                 ("hati", "nyawa")):       # vowel vs vowel
        check(f"{a} / {b} do NOT rhyme", M.rhymes(a, b) is False,
              str(M.rhymes(a, b)))
    # ...and the real pairs from the same quatrains DO.
    check("real pair: panah / tanah (quatrain 27, B-rhyme)",
          M.rhymes("panah", "tanah") is True)
    check("real pair: melukut / di-jeput (quatrain 7, A-rhyme)",
          M.rhymes("melukut", "di-jeput") is True)
    check("real pair: purun / turun (quatrain 7, B-rhyme)",
          M.rhymes("purun", "turun") is True)
    check("real pair: benchah / pechah (quatrain 24, A-rhyme)",
          M.rhymes("benchah", "pechah") is True)
    check("real pair: tedong / kudong (quatrain 24, B-rhyme)",
          M.rhymes("tedong", "kudong") is True)


def test_the_apostrophe_is_two_marks():
    print("\n6. the apostrophe — hamzah, apheresis, syncope")
    # HAMZAH, word-final: a real coda. 'Kalau ta" dapat dengan hikmat,'
    s = M.syllabify("ta'")
    check("ta' is one syllable with a GLOTTAL CODA",
          len(s) == 1 and s[0].coda == ("'",), str(s))
    check("pinta' -> pin.ta'", _syl("pinta'") == "pin.ta'", _syl("pinta'"))
    check("the final hamzah is in the rime, so pinta' does not rhyme pinta",
          M.rhymes("pinta'", "pinta") is False)
    # HAMZAH between vowels: forces a break. "Kena do'a kalinting bakar."
    check("do'a is TWO syllables (do.'a), the hamzah blocking the merge",
          _syl("do'a") == "do.'a", _syl("do'a"))
    check("mala'ikat -> ma.la.'i.kat", _syl("mala'ikat") == "ma.la.'i.kat",
          _syl("mala'ikat"))
    check("Ta'tabek -> ta'.ta.bek (hamzah as coda before a consonant)",
          _syl("Ta'tabek") == "ta'.ta.bek", _syl("Ta'tabek"))
    # APHERESIS, word-initial: nothing is pronounced. "'Ku tetak dengan parang"
    check("'ku is read as ku", _syl("'ku") == "ku", _syl("'ku"))
    check("'nak is read as nak", _syl("'nak") == "nak", _syl("'nak"))
    check("hati-'ku -> ha.ti.ku, and its rime is the clitic's",
          _syl("hati-'ku") == "ha.ti.ku", _syl("hati-'ku"))
    check("hadapan-'ku rhymes hati-'ku (quatrain 37 A-rhyme is on -ku)",
          M.rhymes("hadapan-'ku", "bahia-'ku") is True)
    # SYNCOPE, medial after a consonant: the word splits there.
    check("anak'nda -> a.nak.nda", _syl("anak'nda") == "a.nak.nda",
          _syl("anak'nda"))
    check("anak'nda rhymes kuda (quatrain 56 B-rhyme)",
          M.rhymes("anak'nda", "kuda") is True)
    # `ayn folds to the same glyph and, being word-initial, drops.
    check("`Ijrail -> ij.ra.il", _syl("`Ijrail") == "ij.ra.il",
          _syl("`Ijrail"))
    check("`adat -> a.dat", _syl("`adat") == "a.dat", _syl("`adat"))
    # Doctrine 26: a curly apostrophe must not change any of the above.
    check("U+2019 behaves exactly as ASCII ' (doctrine 26)",
          _syl("pinta’") == _syl("pinta'")
          and _syl("’ku") == _syl("'ku"),
          f"{_syl(chr(0x2019) + 'ku')} vs {_syl(chr(39) + 'ku')}")


def test_the_hyphen_blocks_resyllabification():
    print("\n6b. the hyphen is a SEAM here, not a joiner (doctrine 65)")
    # Welsh deletes the hyphen and lets the letters resyllabify; Finnish keeps
    # it as a compound seam that blocks resyllabification. Malay is Finnish's
    # case and the corpus proves it: `arak-arak` (quatrain 1) is a
    # reduplication of two whole words, and deleting the seam moves the /k/
    # across it. Both readings are defensible in the abstract; only one is
    # right for this language, and it is derived, not ported.
    check("arak-arak -> a.rak.a.rak", _syl("arak-arak") == "a.rak.a.rak",
          _syl("arak-arak"))
    check("...and the Welsh rule would give the WRONG a.ra.ka.rak",
          _syl("arakarak") == "a.ra.ka.rak", _syl("arakarak"))
    # The Straits clitic hyphen is the other use, and there the seam happens
    # to be invisible -- which is why it had to be checked rather than assumed.
    check("di-jeput and dijeput agree (the seam changes nothing here)",
          _syl("di-jeput") == _syl("dijeput") == "di.je.put",
          f"{_syl('di-jeput')} / {_syl('dijeput')}")
    check("the last hyphenated element carries the rime",
          M.rhymes("iring-iring", "beriring") is True
          and M.rhymes("mata-nya", "bila-nya") is True)


def test_diphthongs_are_word_final_only():
    print("\n7. ai / au / oi are diphthongs word-finally and hiatus elsewhere")
    check("pulai -> pu.lai (quatrain 25)", _syl("pulai") == "pu.lai",
          _syl("pulai"))
    check("naik -> na.ik, NOT nai.k (quatrain 49)", _syl("naik") == "na.ik",
          _syl("naik"))
    check("laut -> la.ut (quatrain 25)", _syl("laut") == "la.ut", _syl("laut"))
    check("daun -> da.un (quatrain 3)", _syl("daun") == "da.un", _syl("daun"))
    check("kau -> kau, one syllable (quatrain 78)", _syl("kau") == "kau",
          _syl("kau"))
    check("puar / kaluar rhyme on -ar (quatrain 23), ua never a diphthong",
          M.rhymes("puar", "kaluar") is True and _syl("puar") == "pu.ar",
          _syl("puar"))
    check("rumbia / dia rhyme on -a (quatrain 44), ia never a diphthong",
          M.rhymes("rumbia", "dia") is True and _syl("rumbia") == "rum.bi.a",
          _syl("rumbia"))


def test_prominence_is_refused():
    print("\n8. Malay supplies no stress binary, and says so")
    check("prominences() raises Unsupported",
          _raises(lambda: M.prominences("burong")))
    try:
        M.prominences("burong")
    except Unsupported as e:
        check("...and the refusal names the syllable grid instead",
              "syllable" in str(e).lower(), str(e)[:80])
    check("every syllable carries prominence None, not 0",
          all(s.prominence is None for s in M.syllabify("memanggil")))
    check("grid_unit is the syllable", M.grid_unit == "syllable")
    check("prominence_rule says NONE out loud",
          M.prominence_rule.startswith("NONE"), M.prominence_rule[:40])


def test_end_word_reads_skeat_not_the_printer():
    print("\n9. the printed line has three editorial layers")
    check("a footnote marker is not the end word",
          M.end_word("Pergi mendapat `Ijrail, [813]") == "'ijrail",
          str(M.end_word("Pergi mendapat `Ijrail, [813]")))
    check("...and the two footnoted copies still rhyme",
          M.rhymes(M.end_word("Pergi mendapat `Ijrail, [813]"),
                   M.end_word("Pergi mendapat `Ijrail, [814]")) is True)
    check("an editorial BRACKET around the rhyme word keeps it",
          M.end_word("Hantu laut, hantu [kampong],") == "kampong",
          str(M.end_word("Hantu laut, hantu [kampong],")))
    check("...so quatrain 25's A-rhyme resolves: renchong / kampong",
          M.rhymes("renchong", "kampong") is True)
    check("a bracketed gloss line still yields a word",
          M.end_word("[tempat anu]") == "anu")
    # The declared parameter. It changes the answer, so it is named.
    ln = "Tatang dengan tunjang nyiris (nyirih)"
    check("editorial_parentheses='drop' takes the poet's word",
          M.end_word(ln, "drop") == "nyiris", str(M.end_word(ln, "drop")))
    check("editorial_parentheses='keep' takes the editor's",
          M.end_word(ln, "keep") == "nyirih", str(M.end_word(ln, "keep")))
    check("the default is the conservative reading",
          msa.EDITORIAL_PARENTHESES == "drop", msa.EDITORIAL_PARENTHESES)


def test_abab_over_the_real_82():
    print("\n10. the ABAB pattern over all 82 Skeat quatrains")
    rates = {}
    for mode in ("drop", "keep"):
        conf = [M.abab(q, editorial_parentheses=mode)["confirmed"]
                for q in QUATRAINS]
        rates[mode] = (conf.count(True), conf.count(False), conf.count(None))
        n = conf.count(True)
        print(f"          {mode:5s}: {n}/{len(QUATRAINS)} confirmed "
              f"({n / len(QUATRAINS):.1%}), {conf.count(False)} refuted, "
              f"{conf.count(None)} undecidable")
    check("under 'keep' every one of the 82 confirms",
          rates["keep"][0] == 82, str(rates["keep"]))
    check("under the default 'drop' 80 of 82 confirm — the 2 that do not are "
          "the two whose end word IS an editorial parenthesis",
          rates["drop"][0] == 80, str(rates["drop"]))
    # Name them, so the disagreement with the recorded 82 is legible and
    # nobody is tempted to tune it away (doctrine 25, doctrine 58).
    off = [i for i, q in enumerate(QUATRAINS)
           if M.abab(q)["confirmed"] is not True]
    check("the two are quatrains 36 and 77 (1-indexed)", off == [35, 76],
          str([i + 1 for i in off]))
    check("no quatrain is UNDECIDABLE — the merger refusal never fires here",
          rates["drop"][2] == 0 and rates["keep"][2] == 0)


def test_a_matched_null_for_the_abab_claim():
    print("\n11. a matched null: the same words, the non-mandated pairings")
    # Doctrine 56. 80/82 means nothing until the same instrument is run over
    # pairs the form does NOT mandate. Doctrine 63 says to state what the null
    # PRESERVES and what it DESTROYS, and to check it is not the identity map:
    #   PRESERVES  the four end words of each quatrain, their rime inventory,
    #              the comparator, and the number of pairs per quatrain
    #   DESTROYS   the form's assignment of WHICH lines are paired
    # The mandated set {(1,3),(2,4)} and the null set {(1,2),(1,4),(2,3),(3,4)}
    # are disjoint, so this is not the identity map. Preserving the quatrain's
    # own rime inventory is the strong version: doctrine 28's failure mode is
    # an item whose whole inventory is one rime class, and this null would
    # expose it.
    hits = tot = 0
    for q in QUATRAINS:
        e = [M.end_word(ln) for ln in q]
        for i, j in ((0, 1), (0, 3), (1, 2), (2, 3)):
            v = M.rhymes(e[i], e[j]) if e[i] and e[j] else None
            tot += 1
            hits += 1 if v is True else 0
    print(f"          non-mandated pairs rhyming: {hits}/{tot} "
          f"({hits / tot:.1%})")
    check("the null is at or near zero, so 80/82 is not an inventory artefact",
          hits == 0, f"{hits}/{tot}")


def test_relation_type_separates_echo_from_rhyme():
    print("\n12. identity is not rhyme (doctrine 3), and here it matters")
    # Pantun lines 1 and 3 are frequently the SAME line. A caller measuring
    # "does the ABAB hold" and one measuring "is there rhyme here" need
    # different answers, so the type is reported beside the verdict.
    counts = {}
    for q in QUATRAINS:
        for p in M.abab(q)["pairs"]:
            counts[p["relation"]] = counts.get(p["relation"], 0) + 1
    print(f"          over the 164 mandated pairs: {counts}")
    check("REPEAT is separated from RHYME rather than counted as one",
          counts.get("REPEAT", 0) > 0 and counts.get("RHYME", 0) > 0,
          str(counts))
    check("`Ijrail against itself is REPEAT",
          M.relation_type("`Ijrail", "`Ijrail") == "REPEAT")
    check("beriring against iring-iring is RIME_RICHE, not REPEAT",
          M.relation_type("beriring", "iring-iring") == "RIME_RICHE",
          str(M.relation_type("beriring", "iring-iring")))
    check("tanjong against di-kandong is a plain RHYME",
          M.relation_type("tanjong", "di-kandong") == "RHYME",
          str(M.relation_type("tanjong", "di-kandong")))
    # echo_depth reports the whole-word echo as a COUNT, not a threshold.
    check("echo_depth(purun, turun) == 1 — the rime syllable only",
          M.echo_depth("purun", "turun") == 1,
          str(M.echo_depth("purun", "turun")))
    check("echo_depth(perabun, rabun) == 2 — a near-whole-word echo "
          "(quatrain 15, A-rhyme)",
          M.echo_depth("perabun", "rabun") == 2,
          str(M.echo_depth("perabun", "rabun")))
    check("echo_depth(iring-iring, beriring) == 1 — the shared -iring is one "
          "syllable deep, because the onsets diverge above it",
          M.echo_depth("iring-iring", "beriring") == 1,
          str(M.echo_depth("iring-iring", "beriring")))


def test_the_pembayang_maksud_split_is_exposed_not_measured():
    print("\n13. the pembayang/maksud split is handed over, never scored")
    # Skeat fn.[431]: 'there is little connection discernible between the
    # first and the second half of the quatrain; the latter always contains
    # the actual point, the former at most something analogous or remotely
    # parallel.' That discontinuity is why this corpus is worth having, and
    # measuring it is OUT OF SCOPE for a phonology module.
    r = M.abab(QUATRAINS[28])   # 'Bukan gantang gantang lada ...'
    check("pembayang is lines 1-2", r["pembayang"] == QUATRAINS[28][:2])
    check("maksud is lines 3-4", r["maksud"] == QUATRAINS[28][2:])
    check("the A pair is lines 1&3", r["pairs"][0]["lines"] == (0, 2))
    check("the B pair is lines 2&4", r["pairs"][1]["lines"] == (1, 3))
    check("no semantic field is offered",
          not any(k in r for k in ("meaning", "semantic", "similarity",
                                   "topic")), str(sorted(r)))


def test_syllable_counts_are_the_grid():
    print("\n14. the pantun's grid is the syllable count per line")
    counts = [M.line_syllables(ln) for q in QUATRAINS for ln in q]
    ok = [c for c in counts if c is not None]
    lo, hi = msa.PANTUN_SYLLABLES
    inband = sum(1 for c in ok if lo <= c <= hi)
    print(f"          {len(ok)}/{len(counts)} lines countable; "
          f"{inband} ({inband / len(counts):.1%}) inside the declared "
          f"{lo}-{hi}; range {min(ok)}-{max(ok)}")
    check("the declared band is stated, not inferred from the corpus",
          msa.PANTUN_SYLLABLES == (8, 12), str(msa.PANTUN_SYLLABLES))
    check("most lines fall inside it", inband / len(counts) > 0.75,
          f"{inband}/{len(counts)}")
    check("an uncountable line returns None rather than a partial count",
          M.line_syllables("Anggrek dewana berjambangan,") is None)


def test_orthography_is_reported_not_sniffed():
    print("\n15. notation is declared; detection is a report for the caller")
    corpus = " ".join(ln for q in QUATRAINS for ln in q)
    seen = msa.detect_orthography(corpus)
    print(f"          markers in the 82 quatrains: {sorted(seen)}")
    check("the corpus reads as Straits", "straits" in seen, str(sorted(seen)))
    check("and shows NO van Ophuijsen marker — this is the Wilkinson line",
          "van_ophuijsen" not in seen, str(sorted(seen)))
    check("Dutch-orthography Malay IS flagged when present",
          "van_ophuijsen" in msa.detect_orthography("boeroeng djalan"))
    check("modern Ejaan Rumi Baharu is flagged as modern",
          "modern" in msa.detect_orthography("cinta syurga engkau"))
    # ...and detection changes nothing inside syllabify. Doctrine 1: notation
    # is declared, never sniffed. A van Ophuijsen text is read WRONG here --
    # `nj` stays two units where that orthography means /ɲ/ -- and that is the
    # declared behaviour, which is why the detector exists for the caller.
    check("syllabify does not switch on the detector: nj stays TWO units",
          msa.units("njadi") == ["n", "j", "a", "d", "i"],
          str(msa.units("njadi")))


def test_the_cost_of_reading_two_orthographies():
    print("\n16. what the merger refusal costs, measured")
    mandated, null = [], []
    for q in QUATRAINS:
        e = [M.end_word(ln) for ln in q]
        mandated += [(e[0], e[2]), (e[1], e[3])]
        null += [(e[0], e[1]), (e[0], e[3]), (e[1], e[2]), (e[2], e[3])]
    rm, nm = M.merger_refusal_rate(mandated)
    rn, nn = M.merger_refusal_rate(null)
    print(f"          mandated pairs refused on a merger: {rm}/{nm}")
    print(f"          null pairs refused on a merger:     {rn}/{nn}")
    check("the refusal costs this corpus nothing — it is uniformly Straits",
          rm == 0 and rn == 0, f"{rm}/{nm}, {rn}/{nn}")
    # ...but it is not dead code: it fires the moment two systems meet.
    ref, tot = M.merger_refusal_rate([("burong", "burung"), ("adek", "adik"),
                                      ("dato'", "dudok"),
                                      ("tanjong", "kandong")])
    check("and it does fire on a cross-orthography set: 3 of 4",
          (ref, tot) == (3, 4), f"{ref}/{tot}")


def test_declaration_and_registration():
    print("\n17. the module declares itself and registers under its own name")
    from quality.phonology import declared, get
    check("msa is registered", "msa" in declared(), str(declared()))
    check("registered under the name it declares",
          get("msa").language == "msa")
    d = M.declaration()
    for k in ("language", "name", "notation", "grid_unit", "prominence_rule",
              "relation", "source"):
        check(f"declares {k}", bool(d.get(k)) and d[k] != "unset")
    check("notation names the orthography it reads",
          "Straits" in d["notation"] and "Skeat" in d["notation"])
    check("notation states what it refuses", "None" in d["notation"])
    check("relation names the form", "pantun" in d["relation"].lower())
    check("source claims no external resource", "no external" in d["source"])


def test_no_english_resource():
    print("\n18. nothing here consults English (commitment 3)")
    import ast
    import inspect
    tree = ast.parse(inspect.getsource(msa))
    mods = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            mods.update(a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            mods.add(node.module.split(".")[0])
    check("msa imports no English resource",
          "lyric_harness" not in mods and "cmudict" not in mods,
          f"imports: {sorted(mods)}")
    check("and imports nothing but the standard library and the interface",
          mods <= {"re", "unicodedata", "quality"}, f"imports: {sorted(mods)}")


if __name__ == "__main__":
    for fn in (test_digraphs_are_single_consonants,
               test_ng_is_the_rhyme_coda_that_matters,
               test_out_of_inventory_is_none_not_false,
               test_straits_and_modern_behave_as_declared,
               test_a_shared_final_letter_is_not_a_rhyme,
               test_the_apostrophe_is_two_marks,
               test_the_hyphen_blocks_resyllabification,
               test_diphthongs_are_word_final_only,
               test_prominence_is_refused,
               test_end_word_reads_skeat_not_the_printer,
               test_abab_over_the_real_82,
               test_a_matched_null_for_the_abab_claim,
               test_relation_type_separates_echo_from_rhyme,
               test_the_pembayang_maksud_split_is_exposed_not_measured,
               test_syllable_counts_are_the_grid,
               test_orthography_is_reported_not_sniffed,
               test_the_cost_of_reading_two_orthographies,
               test_declaration_and_registration,
               test_no_english_resource):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all Malay phonology regressions pass")
