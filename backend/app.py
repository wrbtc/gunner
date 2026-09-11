"""Anonymous, player-submitted GUNNER scores; nginx is the public boundary."""

from collections import deque
from contextlib import asynccontextmanager, closing
from datetime import datetime, timezone
import ipaddress
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import sqlite3
import threading
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, Response

SCORES_PATH = "/gunner/api/scores"
PLAYS_PATH = "/gunner/api/play-events"
ORIGIN = "https://scores.example.invalid"
ALLOWED_ORIGINS = frozenset({ORIGIN, "https://stable.example.invalid", "https://game.example.invalid"})
MAX_BODY = 1024
MAX_SCORE = 999999999
MAX_DB_PAGES = 16384  # 64 MiB at the enforced 4096-byte page size.


class Conflict(Exception):
    pass


class ScoreStore:
    def __init__(self, path):
        self.path = Path(path)

    def connect(self):
        connection = sqlite3.connect(self.path, timeout=2, isolation_level=None)
        try:
            connection.row_factory = sqlite3.Row
            connection.execute(f"PRAGMA max_page_count={MAX_DB_PAGES}")
            connection.execute("PRAGMA synchronous=FULL")
        except sqlite3.Error:
            connection.close()
            raise
        return connection

    def initialize(self):
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with closing(self.connect()) as connection:
            connection.execute("PRAGMA page_size=4096")
            if connection.execute("PRAGMA page_size").fetchone()[0] != 4096:
                raise RuntimeError("Unexpected score database page size")
            connection.execute("PRAGMA journal_mode=DELETE")
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS scores (
                    id INTEGER PRIMARY KEY,
                    submission_id TEXT NOT NULL UNIQUE,
                    initials TEXT NOT NULL CHECK(length(initials)=3),
                    score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 999999999),
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS scores_ranking ON scores(score DESC, id ASC);
            """)

    @staticmethod
    def rows(connection):
        result = connection.execute(
            "SELECT initials, score, created_at FROM scores ORDER BY score DESC, id ASC LIMIT 10"
        ).fetchall()
        return [dict(rank=i + 1, initials=row["initials"], score=row["score"],
                     createdAt=row["created_at"]) for i, row in enumerate(result)]

    def top_ten(self):
        with closing(self.connect()) as connection:
            return self.rows(connection)

    def save(self, submission_id, initials, score):
        with closing(self.connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            existing = connection.execute(
                "SELECT id, initials, score FROM scores WHERE submission_id=?", (submission_id,)
            ).fetchone()
            if existing:
                if (existing["initials"], existing["score"]) != (initials, score):
                    raise Conflict()
                row_id, created = existing["id"], False
            else:
                created_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
                row_id = connection.execute(
                    "INSERT INTO scores(submission_id, initials, score, created_at) VALUES(?,?,?,?)",
                    (submission_id, initials, score, created_at),
                ).lastrowid
                created = True
            rank = 1 + connection.execute(
                "SELECT count(*) FROM scores WHERE score>? OR (score=? AND id<?)",
                (score, score, row_id),
            ).fetchone()[0]
            result = dict(saved=True, submissionId=submission_id, rank=rank, rows=self.rows(connection))
            connection.commit()
            return created, result


class PlayStore(ScoreStore):
    """Private, bounded database; no raw IPs or persistent browser identifiers."""

    def initialize(self):
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        key_path = self.path.with_suffix('.key')
        try:
            fd = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            pass
        else:
            with os.fdopen(fd, 'wb') as handle:
                handle.write(os.urandom(32))
                handle.flush()
                os.fsync(handle.fileno())
        self.ip_key = key_path.read_bytes()
        if len(self.ip_key) != 32:
            raise RuntimeError('Invalid private play statistics key')
        with closing(self.connect()) as connection:
            connection.execute('PRAGMA journal_mode=DELETE')
            connection.executescript('''
                CREATE TABLE IF NOT EXISTS plays (
                    run_id TEXT PRIMARY KEY,
                    ip_key TEXT NOT NULL,
                    build TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    last_seen TEXT NOT NULL,
                    active_ms INTEGER NOT NULL,
                    outcome TEXT,
                    score INTEGER NOT NULL,
                    hull INTEGER NOT NULL,
                    eggs INTEGER NOT NULL,
                    progress INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS plays_started ON plays(started_at);
                CREATE INDEX IF NOT EXISTS plays_ip ON plays(ip_key);
            ''')

    def record(self, ip, value):
        key = hmac.new(self.ip_key, str(ip).encode('ascii'), hashlib.sha256).hexdigest()
        now = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
        outcome = value['event'] if value['event'] in ('win', 'loss') else None
        with closing(self.connect()) as connection:
            connection.execute('BEGIN IMMEDIATE')
            row = connection.execute('SELECT build FROM plays WHERE run_id=?', (value['runId'],)).fetchone()
            if row and row['build'] != value['build']:
                raise Conflict()
            # First IP owns this run even if its network changes during play.
            # Cumulative values and a latched outcome tolerate retries/out-of-order delivery.
            connection.execute('''
                INSERT INTO plays VALUES(?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(run_id) DO UPDATE SET
                    last_seen=excluded.last_seen,
                    active_ms=max(plays.active_ms,excluded.active_ms),
                    outcome=coalesce(plays.outcome,excluded.outcome),
                    score=max(plays.score,excluded.score),
                    hull=min(plays.hull,excluded.hull),
                    eggs=max(plays.eggs,excluded.eggs),
                    progress=max(plays.progress,excluded.progress)
            ''', (value['runId'], key, value['build'], now, now, value['activeMs'],
                  outcome, value['score'], value['hull'], value['eggs'], value['progress']))
            connection.commit()


def parse_play(raw):
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('Duplicate key')
            result[key] = value
        return result
    value = json.loads(raw, object_pairs_hook=unique_pairs)
    if not isinstance(value, dict) or set(value) != {'runId', 'event', 'build', 'activeMs', 'score', 'hull', 'eggs', 'progress'}:
        raise ValueError('Invalid fields')
    key = value['runId']
    if not isinstance(key, str) or len(key) != 36:
        raise ValueError('Invalid run ID')
    parsed = uuid.UUID(key)
    if parsed.version != 4 or str(parsed) != key:
        raise ValueError('Invalid run ID')
    if value['event'] not in ('start', 'progress', 'win', 'loss'):
        raise ValueError('Invalid event')
    if not isinstance(value['build'], str) or re.fullmatch(r'[0-9]{3}[a-z0-9.-]{0,16}', value['build']) is None:
        raise ValueError('Invalid build')
    for name, maximum in [('activeMs', 86400000), ('score', MAX_SCORE), ('hull', 100), ('eggs', 1000), ('progress', 10000)]:
        if type(value[name]) is not int or not 0 <= value[name] <= maximum:
            raise ValueError('Invalid counter')
    return value


class WriteLimiter:
    """One worker; bounded, minute-lived network buckets. No IPs stored on disk."""

    def __init__(self, per_client=10, total=120, clock=time.monotonic):
        self.per_client, self.total, self.clock = per_client, total, clock
        self.clients, self.global_times = {}, deque()
        self.lock = threading.Lock()

    def allow(self, client):
        with self.lock:
            now = self.clock()
            for key in list(self.clients):
                queue = self.clients[key]
                while queue and queue[0] <= now - 60:
                    queue.popleft()
                if not queue:
                    del self.clients[key]
            while self.global_times and self.global_times[0] <= now - 60:
                self.global_times.popleft()
            queue = self.clients.get(client, deque())
            if len(queue) >= self.per_client or len(self.global_times) >= self.total:
                return False
            if client not in self.clients and len(self.clients) >= 2048:
                return False
            queue.append(now)
            self.clients[client] = queue
            self.global_times.append(now)
            return True


def parse_submission(raw):
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate key")
            result[key] = value
        return result

    value = json.loads(raw, object_pairs_hook=unique_pairs)
    if not isinstance(value, dict) or set(value) != {"submissionId", "initials", "score"}:
        raise ValueError("Invalid fields")
    key, initials, score = value["submissionId"], value["initials"], value["score"]
    if not isinstance(key, str) or len(key) != 36:
        raise ValueError("Invalid submission ID")
    parsed = uuid.UUID(key)
    if parsed.version != 4 or str(parsed) != key:
        raise ValueError("Invalid submission ID")
    if not isinstance(initials, str) or re.fullmatch(r"[A-Z0-9]{3}", initials) is None:
        raise ValueError("Invalid initials")
    if type(score) is not int or not 0 <= score <= MAX_SCORE:
        raise ValueError("Invalid score")
    return key, initials, score


def create_app(db_path=None, limiter=None, play_db_path=None, play_limiter=None):
    store = ScoreStore(db_path or os.environ.get("GUNNER_SCORE_DB", "./backend/data/scores.sqlite3"))
    limiter = limiter or WriteLimiter()
    plays = PlayStore(play_db_path or store.path.with_name('plays.sqlite3'))
    play_limiter = play_limiter or WriteLimiter(per_client=60, total=600)

    @asynccontextmanager
    async def lifespan(application):
        store.initialize()
        plays.initialize()
        yield

    application = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @application.middleware("http")
    async def headers_and_errors(request, call_next):
        try:
            response = await call_next(request)
        except (sqlite3.Error, OSError):
            response = JSONResponse({"error": "unavailable"}, status_code=503)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @application.get("/health")
    def health():
        store.top_ten()
        return {"status": "ok"}

    @application.get(SCORES_PATH)
    def scores():
        return {"scope": "shared", "verification": "player-submitted", "rows": store.top_ten()}

    @application.post(SCORES_PATH)
    async def submit(request: Request):
        if request.headers.get("origin") not in ALLOWED_ORIGINS:
            return JSONResponse({"error": "origin_not_allowed"}, status_code=403)
        if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
            return JSONResponse({"error": "unsupported_media_type"}, status_code=415)
        length = request.headers.get("content-length", "")
        if request.headers.get("transfer-encoding") or not length.isascii() or not length.isdecimal():
            return JSONResponse({"error": "invalid_request"}, status_code=400)
        if len(length) > 4 or int(length) > MAX_BODY:
            return JSONResponse({"error": "body_too_large"}, status_code=413)
        try:
            ip = ipaddress.ip_address(request.headers.get("x-gunner-client-ip", ""))
        except ValueError:
            return JSONResponse({"error": "invalid_request"}, status_code=400)
        client = str(ipaddress.ip_network(f"{ip}/64", strict=False)) if ip.version == 6 else str(ip)
        if not limiter.allow(client):
            return JSONResponse({"error": "rate_limited"}, status_code=429, headers={"Retry-After": "60"})
        raw = bytearray()
        async for chunk in request.stream():
            if len(raw) + len(chunk) > MAX_BODY:
                return JSONResponse({"error": "body_too_large"}, status_code=413)
            raw.extend(chunk)
        if len(raw) != int(length):
            return JSONResponse({"error": "invalid_request"}, status_code=400)
        try:
            values = parse_submission(raw)
        except (ValueError, UnicodeError, RecursionError):
            return JSONResponse({"error": "invalid_request"}, status_code=400)
        try:
            created, result = await run_in_threadpool(store.save, *values)
        except Conflict:
            return JSONResponse({"error": "submission_conflict"}, status_code=409)
        return JSONResponse(result, status_code=201 if created else 200)

    @application.post(PLAYS_PATH)
    async def play_event(request: Request):
        if request.headers.get('origin') != 'https://game.example.invalid':
            return JSONResponse({'error': 'origin_not_allowed'}, status_code=403)
        if request.headers.get('content-type', '').split(';', 1)[0].strip().lower() != 'application/json':
            return JSONResponse({'error': 'unsupported_media_type'}, status_code=415)
        length = request.headers.get('content-length', '')
        if request.headers.get('transfer-encoding') or not length.isascii() or not length.isdecimal():
            return JSONResponse({'error': 'invalid_request'}, status_code=400)
        if len(length) > 4 or int(length) > MAX_BODY:
            return JSONResponse({'error': 'body_too_large'}, status_code=413)
        try:
            ip = ipaddress.ip_address(request.headers.get('x-gunner-client-ip', ''))
        except ValueError:
            return JSONResponse({'error': 'invalid_request'}, status_code=400)
        network = str(ipaddress.ip_network(f'{ip}/64', strict=False)) if ip.version == 6 else str(ip)
        if not play_limiter.allow(network):
            return JSONResponse({'error': 'rate_limited'}, status_code=429, headers={'Retry-After': '60'})
        raw = bytearray()
        async for chunk in request.stream():
            if len(raw) + len(chunk) > MAX_BODY:
                return JSONResponse({'error': 'body_too_large'}, status_code=413)
            raw.extend(chunk)
        if len(raw) != int(length):
            return JSONResponse({'error': 'invalid_request'}, status_code=400)
        try:
            value = parse_play(raw)
        except (ValueError, UnicodeError, RecursionError):
            return JSONResponse({'error': 'invalid_request'}, status_code=400)
        try:
            await run_in_threadpool(plays.record, ip, value)
        except Conflict:
            return JSONResponse({'error': 'run_conflict'}, status_code=409)
        return Response(status_code=204)

    return application


app = create_app()
