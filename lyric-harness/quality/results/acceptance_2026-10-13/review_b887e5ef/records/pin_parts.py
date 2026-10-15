import sys, os, hashlib, json
root = sys.argv[1]
sys.path.insert(0, root)
os.chdir(root)
from quality.check_comparator_pin import measure
fp, parts, absent = measure()
print(json.dumps({"fingerprint": fp, "parts": parts, "absent": absent}, indent=1))
