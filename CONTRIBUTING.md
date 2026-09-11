# Contributing releases

Changes may be proposed through pull requests. Production releases must land on
`main`, advance the numeric version in `package.json`, and regenerate
`SOURCE-MANIFEST.json` to cover every file under `game/` exactly.

Use the neutral Git identity below for every release commit so public history
does not expose personal attribution:

```text
Gunner contributors <contributors@users.noreply.github.com>
```

The `Gunner CI` workflow must pass before a production request is submitted.
It runs the JavaScript and Python contracts, verifies the complete game
manifest, and rejects personal filesystem paths. Production promotion is a
separate restricted operation; repository access alone grants no server access.
