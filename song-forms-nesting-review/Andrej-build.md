# Offline rebuild and headline verification

Andrej identified an isolated-import failure, bytecode left by child scripts, locale-sensitive text I/O, and missing executable checks for the headline counts. The two builders for the revised catalog use explicit UTF-8, load the adjudicated entries and links through the same evidence resolver, and pass the stated basis into the tables and explorer. All script-to-script calls preserve isolated imports and suppress bytecode. The archived baseline remains byte-for-byte historical source and runs with UTF-8 explicitly selected.

Run `python3 -I -B verify-offline.py` from the extracted review. From any other directory, pass the absolute path to that script. This uses Python’s standard library and requires a writable system temporary directory. It reads the release without writing to it.

1. Compare the full shipped summary and the reviewed passages in README.md and validation.md with the independently maintained `comparison/reviewed-headlines.json`.
2. Recount rows, adjudications, supported links, evidence classes and changes from the ledgers. Compare the names, row verdicts, link types, evidence and references with the actual offline browser catalog.
3. In a fresh temporary copy, delete the seven derived products and regenerate them under isolated Python from a separate working directory with a C locale and Python UTF-8 mode disabled. Compare every package file’s SHA-256 with its original digest. Repeat the unit-ledger check and build the current explorer from each inventory individually.
4. Invoke the revised builder through ordinary reconciliation and check that no bytecode or other files appear. Regenerate the original baseline catalog in isolation and compare its exact bytes.

The checked-in headline snapshot uses a `summary` object and a `documentation` object keyed by document path. Each document maps to verbatim, unique, reviewed passages that contain its published headline claims. Updating a generated output does not update the snapshot. The seven file checks cover the two ledgers, summary, change log, unit crosswalk, inventory row comparison and current catalog. Browser interactions and external research require their own checks.
