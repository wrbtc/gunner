# Optional local score backend

`fixture_server.py` serves `game/` on loopback and forwards only the same-origin
`/gunner/api/scores` route to an in-process FastAPI application. It creates
disposable SQLite databases. Stop the process to discard them. This is a local
development tool, not a public hosting configuration.

GET scores returns `{ "scope": "shared", "verification": "player-submitted",
"rows": [] }`, with up to ten ranked entries. POST accepts exactly `submissionId`
(lowercase UUIDv4), `initials` (three uppercase ASCII letters/digits), and `score`
(integer 0–999999999). New saves return 201; identical retries return 200; changing
a payload under the same ID returns 409. Scores are player-submitted and do not
prove gameplay. Tests cover validation, retry, limits and database failures.

The backend source also includes optional play-event storage and the read-only
`private_stats.py` CLI. Browser telemetry is disabled in this public snapshot and
the local fixture does not expose that route. No existing data or keys are
included. Statistics code creates a new random local key when a temporary
database is initialized; it does not recover or contact any existing installation.

Direct application defaults use `backend/data/` (ignored by Git). If adapting
this for hosting, configure your own exact origins and trusted proxy boundary;
`X-Gunner-Client-IP` must never be accepted as a trusted arbitrary public header.
The reserved `*.example.invalid` origins are examples, not live endpoints.
