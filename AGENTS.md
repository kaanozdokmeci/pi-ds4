# Agent Instructions

- This repository is Kaan's fork of `mitsuhiko/pi-ds4`, a Pi provider for local antirez/ds4
  models. Pi installs it as a git package; it is not published to npm. `origin` is the fork.
  Never push to `upstream`.
- Keep the Pi peer ranges open (`*`). Type-check against the Pi version pinned in
  `devDependencies`, and check every new Pi release against the fork.
- Keep upstream's formatting: tabs and a print width of 120, set in `.oxfmtrc.json`.
- Run `mise run init` after cloning and `mise run check` before committing. It runs
  `hk check --all --check`, `npm test`, and `npm audit`.
- Use Conventional Commits.
- Mark an intentionally ignored error with a narrow lint suppression that explains why, as the
  existing best-effort catches do.
- Keep tests in `test/*.test.ts`.
