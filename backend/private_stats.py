#!/usr/bin/env python3
"""Internal SSH/CLI report only. Never mount this as an HTTP route."""
import argparse
from contextlib import closing
import json
from pathlib import Path
import sqlite3


def report(path):
    with closing(sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)) as db:
        db.row_factory = sqlite3.Row
        totals = dict(db.execute('''SELECT count(*) AS gamesStarted,
            count(DISTINCT ip_key) AS uniqueIPs,
            coalesce(sum(outcome='win'),0) AS wins,
            coalesce(sum(outcome='loss'),0) AS losses,
            coalesce(sum(outcome IS NULL),0) AS unfinishedOrStillPlaying,
            round(coalesce(sum(active_ms),0)/1000.0,1) AS activePlaySeconds,
            round(avg(CASE WHEN outcome IS NOT NULL THEN score END),1) AS averageFinishedScore,
            max(score) AS highestObservedScore,
            min(started_at) AS firstRecordedGame, max(last_seen) AS lastReportAt
            FROM plays''').fetchone())
        daily = [dict(row) for row in db.execute('''SELECT substr(started_at,1,10) AS dayUTC,
            count(*) AS gamesStarted, count(DISTINCT ip_key) AS uniqueIPs,
            coalesce(sum(outcome='win'),0) AS wins, coalesce(sum(outcome='loss'),0) AS losses,
            round(sum(active_ms)/1000.0,1) AS activePlaySeconds
            FROM plays GROUP BY dayUTC ORDER BY dayUTC DESC LIMIT 90''')]
    return {'scope': 'internal-only', 'identity': 'Distinct IPs using server-keyed hashes; not exact people. No tracking cookies or persistent browser IDs.',
            'measurement': 'Client-reported games, deduplicated by temporary run ID. Active visible unpaused time includes the opening. Checkpoints every 30 active seconds and on exit; lost reports can undercount. Daily cohorts use first receipt in UTC. Unfinished includes closed tabs and ongoing games. Automated QA clients are excluded by the game; this is not fraud-proof.',
            'totals': totals, 'daily': daily}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', default='./backend/data/plays.sqlite3')
    args = parser.parse_args()
    print(json.dumps(report(args.db), indent=2))
