from contextlib import closing
import concurrent.futures
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import uuid

from fastapi.testclient import TestClient

SPEC = importlib.util.spec_from_file_location(
    "brimstone_scores", Path(__file__).resolve().parents[1] / "backend/app.py"
)
scores = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(scores)


class ScoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = Path(self.temp.name) / "scores.sqlite3"
        self.store = scores.ScoreStore(self.db)
        self.store.initialize()

    def client(self, limiter=None):
        client = TestClient(scores.create_app(
            self.db, limiter or scores.WriteLimiter(per_client=1000, total=1000)
        ))
        client.__enter__()
        self.addCleanup(client.__exit__, None, None, None)
        return client

    @staticmethod
    def payload(score=100, initials="ABC", key=None):
        return {"submissionId": key or str(uuid.uuid4()), "initials": initials, "score": score}

    @staticmethod
    def headers(**extra):
        return {"Origin": scores.ORIGIN, "X-Gunner-Client-IP": "192.0.2.1", **extra}

    def test_shared_empty_and_no_store(self):
        response = self.client().get(scores.SCORES_PATH)
        self.assertEqual(response.json(), {"scope": "shared", "verification": "player-submitted", "rows": []})
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")

    def test_persistence_below_top_ten_and_ties(self):
        client = self.client()
        for i in range(12):
            response = client.post(scores.SCORES_PATH, json=self.payload(100, f"A{i:02}"), headers=self.headers())
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["rank"], i + 1)
        rows = self.client().get(scores.SCORES_PATH).json()["rows"]
        self.assertEqual([row["initials"] for row in rows], [f"A{i:02}" for i in range(10)])
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM scores").fetchone()[0], 12)
            self.assertEqual([r[1] for r in connection.execute("PRAGMA table_info(scores)")],
                             ["id", "submission_id", "initials", "score", "created_at"])
        response = client.post(scores.SCORES_PATH, json=self.payload(101, "WIN"), headers=self.headers())
        self.assertEqual(response.json()["rank"], 1)
        self.assertEqual(response.json()["rows"][0]["initials"], "WIN")

    def test_identical_retry_conflicting_retry_and_restart(self):
        payload = self.payload()
        first = self.client().post(scores.SCORES_PATH, json=payload, headers=self.headers())
        self.assertEqual(first.status_code, 201)
        again = self.client().post(scores.SCORES_PATH, json=payload, headers=self.headers())
        self.assertEqual(again.status_code, 200)
        self.assertEqual(first.json(), again.json())
        conflict = self.client().post(scores.SCORES_PATH, json={**payload, "score": 200}, headers=self.headers())
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json(), {"error": "submission_conflict"})
        self.assertEqual(self.store.top_ten()[0]["score"], 100)

    def test_concurrent_duplicate_writes_are_one_durable_row(self):
        key = str(uuid.uuid4())
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            replies = list(pool.map(lambda _: self.store.save(key, "ONE", 500), range(16)))
        self.assertEqual(sum(created for created, _ in replies), 1)
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM scores").fetchone()[0], 1)

    def test_concurrent_distinct_equal_scores_have_stable_unique_ranks(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            replies = list(pool.map(lambda _: self.store.save(str(uuid.uuid4()), "TIE", 500), range(16)))
        self.assertEqual(sorted(reply[1]["rank"] for reply in replies), list(range(1, 17)))
        self.assertEqual(len(self.store.top_ten()), 10)

    def test_strict_validation_and_no_partial_writes(self):
        client = self.client()
        bad = [None, [], {}, {**self.payload(), "extra": 1}]
        bad += [self.payload(value) for value in [-1, 1000000000, True, False, 1.0, "1", None]]
        bad += [self.payload(initials=value) for value in ["AB", "ABCD", "abc", "A B", "<A>", "ＡＢＣ", None]]
        bad += [self.payload(key=value) for value in ["bad", str(uuid.uuid1()), str(uuid.uuid4()).upper()]]
        for payload in bad:
            with self.subTest(payload=payload):
                response = client.post(scores.SCORES_PATH, content=json.dumps(payload), headers=self.headers(**{"Content-Type": "application/json"}))
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json(), {"error": "invalid_request"})
        self.assertEqual(self.store.top_ten(), [])

    def test_json_boundaries_duplicate_fields_and_content_types(self):
        client = self.client()
        headers = self.headers(**{"Content-Type": "application/json"})
        for raw in [b"{", b"\xff", b'{"score":1,"score":2}', b"null", b"[" * 500 + b"0" + b"]" * 500]:
            self.assertEqual(client.post(scores.SCORES_PATH, content=raw, headers=headers).status_code, 400)
        self.assertEqual(client.post(scores.SCORES_PATH, content=b"x" * 1025, headers=headers).status_code, 413)
        self.assertEqual(client.post(scores.SCORES_PATH, content=b"{}", headers=self.headers()).status_code, 415)
        response = client.post(scores.SCORES_PATH, content=b"{}", headers={**headers, "Content-Length": "9" * 100})
        self.assertEqual(response.status_code, 413)
        response = client.post(scores.SCORES_PATH, content=b"{}", headers={**headers, "Content-Length": "1"})
        self.assertEqual(response.status_code, 400)

    def test_only_exact_origin_and_trusted_proxy_client_header(self):
        client = self.client()
        for headers in [{}, {"Origin": "https://evil.invalid", "X-Gunner-Client-IP": "192.0.2.1"}]:
            self.assertEqual(client.post(scores.SCORES_PATH, json=self.payload(), headers=headers).status_code, 403)
        for address in ["", "not-an-ip", "192.0.2.1,192.0.2.2"]:
            response = client.post(scores.SCORES_PATH, json=self.payload(), headers=self.headers(**{"X-Gunner-Client-IP": address}))
            self.assertEqual(response.status_code, 400)
        self.assertEqual(client.options(scores.SCORES_PATH).status_code, 405)
        self.assertEqual(client.get("/docs").status_code, 404)

    def test_hive_and_legacy_share_scores_and_retries(self):
        client = self.client()
        payload = self.payload(321, "HIV")
        hive_headers = self.headers(Origin="https://stable.example.invalid")
        first = client.post(scores.SCORES_PATH, json=payload, headers=hive_headers)
        self.assertEqual(first.status_code, 201)
        retry = client.post(scores.SCORES_PATH, json=payload, headers=self.headers())
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(first.json(), retry.json())
        self.assertEqual(client.get(scores.SCORES_PATH).json()["rows"][0]["score"], 321)
        for origin in ("http://stable.example.invalid", "https://stable.example.invalid/",
                       "https://stable.example.invalid.evil.invalid", "null"):
            with self.subTest(origin=origin):
                response = client.post(scores.SCORES_PATH, json=self.payload(),
                                       headers=self.headers(Origin=origin))
                self.assertEqual(response.status_code, 403)
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM scores").fetchone()[0], 1)
    def test_gunner_and_legacy_share_scores_and_retries(self):
        client = self.client()
        payload = self.payload(321, "HIV")
        gunner_headers = self.headers(Origin="https://game.example.invalid")
        first = client.post(scores.SCORES_PATH, json=payload, headers=gunner_headers)
        self.assertEqual(first.status_code, 201)
        retry = client.post(scores.SCORES_PATH, json=payload, headers=self.headers())
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(first.json(), retry.json())
        self.assertEqual(client.get(scores.SCORES_PATH).json()["rows"][0]["score"], 321)
        for origin in ("http://game.example.invalid", "https://game.example.invalid/",
                       "https://game.example.invalid.evil.invalid", "null"):
            with self.subTest(origin=origin):
                response = client.post(scores.SCORES_PATH, json=self.payload(),
                                       headers=self.headers(Origin=origin))
                self.assertEqual(response.status_code, 403)
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM scores").fetchone()[0], 1)


    def test_rate_limits_expire_and_do_not_write_rejected_rows(self):
        clock = [0]
        limiter = scores.WriteLimiter(per_client=2, total=3, clock=lambda: clock[0])
        client = self.client(limiter)
        for i in range(2):
            self.assertEqual(client.post(scores.SCORES_PATH, json=self.payload(), headers=self.headers()).status_code, 201)
        blocked = client.post(scores.SCORES_PATH, json=self.payload(), headers=self.headers())
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.headers["Retry-After"], "60")
        self.assertEqual(client.post(scores.SCORES_PATH, json=self.payload(), headers=self.headers(**{"X-Gunner-Client-IP": "192.0.2.2"})).status_code, 201)
        self.assertEqual(client.post(scores.SCORES_PATH, json=self.payload(), headers=self.headers(**{"X-Gunner-Client-IP": "192.0.2.3"})).status_code, 429)
        clock[0] = 60
        self.assertEqual(client.post(scores.SCORES_PATH, json=self.payload(), headers=self.headers()).status_code, 201)
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM scores").fetchone()[0], 4)

    def test_ipv6_addresses_in_one_prefix_share_bucket(self):
        client = self.client(scores.WriteLimiter(per_client=1))
        for i, expected in [(1, 201), (2, 429)]:
            response = client.post(scores.SCORES_PATH, json=self.payload(), headers=self.headers(**{"X-Gunner-Client-IP": f"2001:db8::{i}"}))
            self.assertEqual(response.status_code, expected)

    def test_database_failure_is_honest_unavailable(self):
        client = self.client()
        with patch.object(scores.ScoreStore, "save", side_effect=sqlite3.OperationalError("disk full")):
            response = client.post(scores.SCORES_PATH, json=self.payload(), headers=self.headers())
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"error": "unavailable"})
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(self.store.top_ten(), [])

    def test_full_database_keeps_prior_scores_and_has_no_partial_save(self):
        self.store.save(str(uuid.uuid4()), "OLD", 1)
        with closing(self.store.connect()) as connection:
            current_pages = connection.execute("PRAGMA page_count").fetchone()[0]
        with patch.object(scores, "MAX_DB_PAGES", current_pages):
            for _ in range(1000):
                try:
                    self.store.save(str(uuid.uuid4()), "NEW", 2)
                except sqlite3.OperationalError as error:
                    self.assertIn("full", str(error))
                    break
            else:
                self.fail("Database capacity was not enforced")
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM scores WHERE initials='OLD'").fetchone()[0], 1)
            self.assertEqual(connection.execute("PRAGMA integrity_check").fetchone()[0], "ok")


if __name__ == "__main__":
    unittest.main()
