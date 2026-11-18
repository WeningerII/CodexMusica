"""Grade native source-labeled blocks on the filled blueprint, including changed returns."""
import json
import subprocess
import unittest
from pathlib import Path

import lyric_harness as lh
from quality import plan
from quality.catalog_grading import inspect_catalog
from quality.schemes import Mandate


class CatalogSectionArrangements(unittest.TestCase):
    def test_written_blocks_have_the_source_role_and_measured_text(self):
        base = Path(__file__).resolve().parents[2]
        for source, variant, role, counts in (
                ("terrace-chant", 0, "chant", {"1.1": 2, "1.1.1": 2}),
                ("street-cry", 1, "call", {"1.1": 2}),
                ("playground-taunt", 1, "chant", {"1.1": 2}),
                ("sonnet-sequence", 0, "sonnet", {"1.1": 2})):
            with self.subTest(source=source):
                proc = subprocess.run(["node", str(base / "scripts/song_forms.mjs"), "create", source],
                                      input=json.dumps(dict(variant=variant, counts=counts)),
                                      text=True, capture_output=True, check=True)
                contract = json.loads(proc.stdout)["contract"]
                width = contract["sections"][0]["lines"]
                self.assertEqual(plan.sweep([11], song_form=contract, lines=2*width)["accepted"], [11])
                result = plan.make_plan(11, lines=2*width, song_form=contract)
                self.assertEqual([s["source_role"] for s in result["sections"]], [role, role])
                self.assertIn("Catalog section: " + role, plan.writer_brief(result))
                if role != "sonnet":
                    self.assertEqual(result["returns"], "1,3;2,4")
                words = ["one", "two"] * width
                bp = plan.fill_plan(result, words)
                self.assertIn("[" + role.upper() + " — ", plan.render_blueprint_song(bp, words))

                def check(text):
                    return inspect_catalog(lh.Lexicon(), text, bp, Mandate(n_lines=len(text)), {})
                self.assertEqual(check(words)["verdict"], "pass")
                if role != "sonnet":
                    words[2] = "three one"
                    judged = check(words)
                    self.assertEqual(judged["verdict"], "fail")
                    self.assertTrue(any(c["kind"] == "section-text-return" and c["outcome"] == "fail"
                                        for c in judged["checks"]))


if __name__ == "__main__":
    unittest.main()
