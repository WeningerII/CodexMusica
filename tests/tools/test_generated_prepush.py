#!/usr/bin/env python3
"""Isolated CLI contract tests; fixture gates model freshness, not engine coverage.

Run: python3 tests/tools/test_generated_prepush.py
No generator, working-tree output, dependency download or Git hook is modified.
"""

from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
WRAPPER = ROOT / "tests/tools/check_generated_prepush.py"
GATE = '''from pathlib import Path
import sys
assert sys.argv[1:] == ["--check"], "fixture refuses mutation arguments"
assert Path.cwd().name == "lyric-harness"
name = {name!r}
print("fixture gate: " + name, flush=True)
if Path(name + ".source").read_bytes() != Path(name + ".generated").read_bytes():
    print("stale " + name + " witness", file=sys.stderr)
    sys.exit(1)
'''


class GeneratedPrepushTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="generated-prepush-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "tests/tools").mkdir(parents=True)
        self.script = self.root / "tests/tools" / WRAPPER.name
        shutil.copyfile(WRAPPER, self.script)
        self.harness = self.root / "lyric-harness"
        for name, path in (("counters", "quality/counters.py"), ("map", "map/build.py")):
            gate = self.harness / path
            gate.parent.mkdir(parents=True)
            gate.write_text(GATE.format(name=name))
            for suffix in ("source", "generated"):
                (self.harness / f"{name}.{suffix}").write_text("fresh\n")
        self.git("init", "--quiet")
        self.git("add", ".")

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.root, check=True,
                              capture_output=True)

    def run_check(self, *args, cwd=None):
        before = {p.relative_to(self.root): p.read_bytes()
                  for p in self.root.rglob("*") if p.is_file()}
        result = subprocess.run([sys.executable, str(self.script), *args],
                                cwd=cwd or self.root.parent, capture_output=True, text=True)
        after = {p.relative_to(self.root): p.read_bytes()
                 for p in self.root.rglob("*") if p.is_file()}
        self.assertEqual(before, after, "check must not repair or create fixture files")
        return result

    def test_clean_success_and_order_from_other_directory(self):
        result = self.run_check()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertLess(result.stdout.index("fixture gate: counters"),
                        result.stdout.index("fixture gate: map"))
        self.assertIn("PASS: both", result.stdout)
        self.assertIn("Untracked files", result.stdout)
        self.assertIn("does not certify a pushed commit", result.stdout)
        self.assertLess(result.stdout.index("Counters can take several minutes"),
                        result.stdout.index("fixture gate: counters"))

    def test_stale_counter_still_runs_map_and_names_repair(self):
        (self.harness / "counters.source").write_text("changed\n")
        result = self.run_check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("stale counters witness", result.stderr)
        self.assertIn("quality/counters.py --write", result.stderr)
        self.assertIn("--write cannot fix those", result.stderr)
        self.assertIn("fixture gate: map", result.stdout)
        self.assertNotIn("PASS:", result.stdout)

    def test_new_depth_resolves_root_from_repo_and_nested_cwds(self):
        for cwd in (self.root, self.root / "tests/tools", self.harness / "quality"):
            with self.subTest(cwd=cwd):
                result = self.run_check(cwd=cwd)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("fixture gate: counters", result.stdout)
                self.assertIn("fixture gate: map", result.stdout)

    def test_stale_map_preserves_diagnostic_and_names_actual_repair(self):
        (self.harness / "map.source").write_text("changed\n")
        result = self.run_check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("fixture gate: counters", result.stdout)
        self.assertIn("stale map witness", result.stderr)
        self.assertIn("python3 map/build.py --write", result.stderr)
        self.assertIn("retrace", result.stderr)
        self.assertNotIn("PASS:", result.stdout)

    def test_missing_checker_is_failure_not_success(self):
        (self.harness / "quality/counters.py").unlink()
        result = self.run_check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("FAIL: counters", result.stderr)
        self.assertIn("fixture gate: map", result.stdout)

    def test_both_failures_report_both_remedies(self):
        for name in ("counters", "map"):
            (self.harness / f"{name}.source").write_text("changed\n")
        result = self.run_check()
        self.assertEqual(result.returncode, 1)
        for name in ("counters", "map"):
            self.assertIn(f"stale {name} witness", result.stderr)
        self.assertIn("quality/counters.py --write", result.stderr)
        self.assertIn("map/build.py --write", result.stderr)
        self.assertIn("check: counters; map", result.stderr)
        self.assertNotIn("PASS:", result.stdout)

    def test_untracked_then_staged_file(self):
        path = self.harness / "new file.py"
        path.write_text("# pending addition\n")
        result = self.run_check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("lyric-harness/new file.py", result.stderr)
        self.assertIn("git add", result.stderr)
        self.assertIn("fixture gate: map", result.stdout)
        self.assertNotIn("PASS:", result.stdout)
        self.git("add", "lyric-harness/new file.py")
        result = self.run_check()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_ignored_inputs_are_excluded(self):
        (self.root / ".gitignore").write_text("lyric-harness/cache/\n")
        (self.harness / "cache").mkdir()
        (self.harness / "cache/input").write_text("local staged data\n")
        self.assertEqual(self.run_check().returncode, 0)

    def test_deleted_then_staged_file(self):
        path = self.harness / "tracked file.py"
        path.write_text("# tracked fixture\n")
        self.git("add", "lyric-harness/tracked file.py")
        path.unlink()
        result = self.run_check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("lyric-harness/tracked file.py", result.stderr)
        self.assertIn("git rm", result.stderr)
        self.assertIn("git restore", result.stderr)
        self.assertIn("fixture gate: counters", result.stdout)
        self.assertIn("fixture gate: map", result.stdout)
        self.assertNotIn("PASS:", result.stdout)
        self.git("rm", "--", "lyric-harness/tracked file.py")
        result = self.run_check()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_unavailable_git_inventory_is_not_a_pass(self):
        shutil.rmtree(self.root / ".git")
        result = self.run_check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("cannot inspect untracked", result.stderr)
        self.assertIn("fixture gate: map", result.stdout)
        self.assertNotIn("PASS:", result.stdout)

    def test_mutation_option_is_refused(self):
        result = self.run_check("--write")
        self.assertEqual(result.returncode, 2)
        self.assertNotIn("fixture gate:", result.stdout)

    def test_declared_order_matches_record_job(self):
        workflow = (ROOT / ".github/workflows/ci.yml").read_text()
        record = re.split(r"\n  [a-zA-Z0-9_-]+:",
                          workflow.split("\n  record:", 1)[1], maxsplit=1)[0]
        # Locate commands in the job itself, not unrelated workflow comments.
        self.assertLess(record.index("run: python3 quality/counters.py --check"),
                        record.index("run: python3 map/build.py --check"))
        for command in ("quality/counters.py", "map/build.py"):
            step = record[:record.index(f"run: python3 {command} --check")].rsplit(
                "- name:", 1)[1]
            self.assertIn("if: always()", step)


if __name__ == "__main__":
    unittest.main()
