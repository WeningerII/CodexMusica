"""Resume verified full-corpus package staging; credentials arrive only on stdin."""
import concurrent.futures
import hashlib
import hmac
import json
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


terminal_state = None
if sys.stdin.isatty():
    import termios
    terminal_state = termios.tcgetattr(sys.stdin)
    hidden = termios.tcgetattr(sys.stdin)
    hidden[3] &= ~termios.ECHO
    termios.tcsetattr(sys.stdin, termios.TCSADRAIN, hidden)
print("Ready for package publication JSON on stdin (input is hidden).", flush=True)
try:
    config = json.loads(sys.stdin.readline())
finally:
    if terminal_state is not None:
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, terminal_state)
origin = config["origin"].rstrip("/")
if urllib.parse.urlparse(origin).scheme != "https":
    raise ValueError("Use the private Site HTTPS origin.")
directory = pathlib.Path(config["parts_directory"])
bootstrap = json.loads((directory / "bootstrap.json").read_text())
snapshot = bootstrap["manifest"]["snapshot_id"]
tasks = []
for format_name, package in bootstrap["exports"].items():
    complete_hash = hashlib.sha256()
    total = 0
    for index, part in enumerate(package["parts"]):
        data = (directory / part["path"]).read_bytes()
        assert len(data) == part["bytes"] and hashlib.sha256(data).hexdigest() == part["sha256"]
        complete_hash.update(data)
        total += len(data)
        tasks.append((format_name, index, part))
    assert total == package["bytes"] and complete_hash.hexdigest() == package["sha256"]


def stage(task):
    format_name, index, part = task
    path = f"/api/library/exports/package-parts/{format_name}/{index}?snapshot={snapshot}"
    opener = urllib.request.build_opener(NoRedirect())

    def call(method, data=None):
        timestamp = str(int(time.time()))
        message = "\n".join(["library-package-v1", method, snapshot, format_name, str(index), part["sha256"], timestamp])
        signature = hmac.new(config["bridge_secret"].encode(), message.encode(), hashlib.sha256).hexdigest()
        request = urllib.request.Request(origin + path, data=data, method=method, headers={
            "OAI-Sites-Authorization": "Bearer " + config["site_token"],
            "Origin": origin,
            "Content-Type": "application/octet-stream",
            "X-Library-Upload-Time": timestamp,
            "X-Library-Upload-Signature": signature,
        })
        with opener.open(request, timeout=60) as response:
            return json.load(response)

    for attempt in range(6):
        try:
            if not call("GET").get("ready"):
                assert call("POST", (directory / part["path"]).read_bytes()).get("ready")
            print(json.dumps({"format": format_name, "part": index, "ready": True}), flush=True)
            return
        except urllib.error.HTTPError as error:
            if error.code not in (408, 429, 500, 502, 503, 504) or attempt == 5:
                raise RuntimeError(f"Package staging returned HTTP {error.code} for {format_name}/{index}") from None
        except (urllib.error.URLError, TimeoutError):
            if attempt == 5:
                raise RuntimeError(f"Package staging connection failed for {format_name}/{index}") from None
        time.sleep(min(2 ** attempt, 8))


with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    list(pool.map(stage, tasks))
print(json.dumps({"passed": True, "snapshot_id": snapshot, "verified_parts": len(tasks), "formats": list(bootstrap["exports"])}), flush=True)
