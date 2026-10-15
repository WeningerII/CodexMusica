import sys, os, hashlib
sys.path.insert(0, os.getcwd())
from quality import capacity as cap
from quality.revise import Reviser
rv = Reviser()
print("recorded_source_identity", cap.read_certification_source())
print("current_certification_identity", cap.certification_identity(rv))
print("table_sha256", hashlib.sha256(open(cap.TABLE_PATH,'rb').read()).hexdigest())
print("proof_path", cap._proof_path(), os.path.exists(cap._proof_path()))
print("recorded_judge==current", cap.read_judge()==cap.judge_fingerprint())
