# BB8's own stub writer for the call: proposer seam. Deterministic: one
# fixed line for a single-line request, one per marker for a group request.
import re
ANSWER = "and we would never come back then"
def factory():
    def call(prompt):
        marks = re.findall(r"^\s*(L\d+):", prompt, flags=re.M)
        return ANSWER
    return call
