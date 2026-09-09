from contextlib import closing
import importlib.util
import ipaddress
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
import uuid

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'backend' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

app = load('gunner_scores', 'app.py')
reports = load('gunner_report', 'private_stats.py')


class PrivateStatsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'plays.sqlite3'
        self.client = TestClient(app.create_app(Path(self.temp.name) / 'scores.sqlite3'))
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    def payload(self, **kwargs):
        return {'runId': str(uuid.uuid4()), 'event': 'start', 'build': '041t',
                'activeMs': 0, 'score': 0, 'hull': 100, 'eggs': 0, 'progress': 0, **kwargs}

    def send(self, value, ip='192.0.2.1', origin='https://game.example.invalid'):
        return self.client.post(app.PLAYS_PATH, json=value, headers={'Origin': origin, 'X-Gunner-Client-IP': ip})

    def test_duplicate_replay_unique_ips_and_no_raw_identifiers(self):
        first = self.payload()
        self.assertEqual(self.send(first).status_code, 204)
        self.assertEqual(self.send(first).content, b'')
        self.send(self.payload())
        self.send(self.payload(), ip='2001:db8::1')
        result = reports.report(self.path)['totals']
        self.assertEqual((result['gamesStarted'], result['uniqueIPs']), (3, 2))
        self.assertNotIn(b'192.0.2.1', self.path.read_bytes())
        self.assertNotIn(b'2001:db8::1', self.path.read_bytes())
        self.assertEqual(self.path.with_suffix('.key').stat().st_mode & 0o777, 0o600)
        response = self.send(self.payload())
        self.assertNotIn('set-cookie', response.headers)

    def test_reordered_events_finish_latch_and_partial_recovery(self):
        first = self.payload(event='win', activeMs=99000, score=1500, hull=80, eggs=10, progress=9999)
        self.send(first)
        self.send({**first, 'event': 'progress', 'activeMs': 30000, 'score': 50, 'hull': 100, 'eggs': 1, 'progress': 200})
        self.send({**first, 'event': 'loss'})
        result = reports.report(self.path)['totals']
        self.assertEqual((result['gamesStarted'], result['wins'], result['losses'], result['activePlaySeconds']), (1, 1, 0, 99))
        self.assertEqual(result['averageFinishedScore'], 1500)

    def test_restart_preserves_ip_identity_and_scores_remain_separate(self):
        self.send(self.payload())
        store = app.PlayStore(self.path)
        store.initialize()
        store.record(ipaddress.ip_address('192.0.2.1'), self.payload())
        self.assertEqual(reports.report(self.path)['totals']['uniqueIPs'], 1)
        self.assertEqual(self.client.get(app.SCORES_PATH).json()['rows'], [])

    def test_no_stats_read_endpoint(self):
        for path in (app.PLAYS_PATH, '/stats', '/brimstone-run/api/stats', '/plays.sqlite3', '/private_stats.py', '/openapi.json', '/docs'):
            self.assertIn(self.client.get(path).status_code, (404, 405))

    def test_strict_origin_validation_and_payload_bounds(self):
        for origin in ('https://evil.test', 'https://game.example.invalid.evil.test', 'https://stable.example.invalid'):
            self.assertEqual(self.send(self.payload(), origin=origin).status_code, 403)
        for field, value in [('activeMs', -1), ('activeMs', 86400001), ('score', True), ('hull', 101), ('eggs', 1001), ('progress', 10001), ('runId', 'bad'), ('build', '../x'), ('event', 'list')]:
            self.assertEqual(self.send(self.payload(**{field: value})).status_code, 400)
        self.assertEqual(self.send({**self.payload(), 'playerId': 'forbidden'}).status_code, 400)
        self.assertEqual(self.send(self.payload(), ip='bad').status_code, 400)
        self.assertEqual(reports.report(self.path)['totals']['gamesStarted'], 0)

    def test_throttle_is_separate_from_score_submissions(self):
        for _ in range(60):
            self.assertEqual(self.send(self.payload()).status_code, 204)
        self.assertEqual(self.send(self.payload()).status_code, 429)
        response = self.client.post(app.SCORES_PATH, json={'submissionId': str(uuid.uuid4()), 'initials': 'TST', 'score': 1},
                                    headers={'Origin': 'https://game.example.invalid', 'X-Gunner-Client-IP': '192.0.2.1'})
        self.assertEqual(response.status_code, 201)


if __name__ == '__main__':
    unittest.main()
