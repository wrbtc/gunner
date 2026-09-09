"""Loopback-only candidate fixture: real score API, isolated disposable SQLite.

Never installed on public. Existing candidate files are served unchanged; only the
local fixture Origin and edge client header are adapted at the proxy boundary.
"""

import argparse
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
from pathlib import Path
import tempfile
import threading
from urllib.parse import urlsplit

from fastapi.testclient import TestClient


@contextmanager
def score_fixture_server(directory, app_path=None):
    app_path = Path(app_path or Path(__file__).with_name("app.py")).resolve()
    spec = importlib.util.spec_from_file_location("gunner_score_fixture_app", app_path)
    backend = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(backend)
    with tempfile.TemporaryDirectory(prefix="gunner-score-fixture-") as temporary:
        with TestClient(backend.create_app(Path(temporary) / "scores.sqlite3")) as client:
            class Handler(SimpleHTTPRequestHandler):
                def __init__(self, *args, **kwargs):
                    super().__init__(*args, directory=str(directory), **kwargs)

                def log_message(self, *args):
                    pass

                def api(self):
                    if urlsplit(self.path).path != backend.SCORES_PATH:
                        return False
                    raw = b""
                    if self.command == "POST":
                        length = self.headers.get("Content-Length", "")
                        if not length.isascii() or not length.isdecimal() or len(length) > 4 or int(length) > backend.MAX_BODY:
                            self.send_error(413)
                            return True
                        raw = self.rfile.read(int(length))
                    port = self.server.server_port
                    origin = self.headers.get("Origin", "")
                    if origin in {f"http://127.0.0.1:{port}", f"http://localhost:{port}"}:
                        origin = backend.ORIGIN
                    headers = {"Origin": origin, "X-Gunner-Client-IP": "127.0.0.1"}
                    if self.headers.get("Content-Type"):
                        headers["Content-Type"] = self.headers["Content-Type"]
                    response = client.request(self.command, self.path, content=raw, headers=headers)
                    self.send_response(response.status_code)
                    for name in ["Content-Type", "Cache-Control", "X-Content-Type-Options", "Retry-After"]:
                        if name in response.headers:
                            self.send_header(name, response.headers[name])
                    self.send_header("Content-Length", str(len(response.content)))
                    self.end_headers()
                    self.wfile.write(response.content)
                    return True

                def do_GET(self):
                    if not self.api():
                        super().do_GET()

                def do_POST(self):
                    if not self.api():
                        self.send_error(404)

            server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
            server.daemon_threads = True
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                yield server
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--app", type=Path)
    args = parser.parse_args()
    with score_fixture_server(args.directory, args.app) as server:
        print(f"http://127.0.0.1:{server.server_port}", flush=True)
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            pass
