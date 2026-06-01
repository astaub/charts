# agentviz Extraction

`open-source/agentviz/` is the monorepo staging folder for the future
`@staub/agentviz` package.

Roadmap reference: `plans/2026-05-14-oss-extraction-roadmap.md`.

## Phase 1 Target

Create a private GitHub repository that contains only this package and its
generic examples. Do not make the repository public and do not publish to npm in
Phase 1.

[ANDREW Q] Confirm the GitHub organization before repo creation.

## Copy Path

From the monorepo root:

```sh
mkdir -p ../agentviz-private
rsync -a \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  open-source/agentviz/ ../agentviz-private/
```

Then initialize the destination as a private repo after the GitHub organization
is confirmed:

```sh
cd ../agentviz-private
git init
git add .
git commit -m "Initial agentviz extraction"
```

Create the remote only as a private repository. Do not rely on interactive
defaults.

## Pre-Extraction Checklist

- `package.json` names `@staub/agentviz`.
- `LICENSE` is MIT.
- `README.md` is customer-agnostic.
- Examples are synthetic and source-shaped only.
- `bun run typecheck`, `bun run test`, and `bun run build` pass from the
  extracted folder.
- Scrub terms are supplied by the caller before any public launch gate.
