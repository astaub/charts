# Contributing agents & humans — charts 📊

beautiful charts inside your CLI

This is a **public, open-source repository.** Both humans and coding agents
read this file. It is the operating contract for anyone — person or agent —
proposing a change. It is intentionally short; the full rules live in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Governance (read first)

- **Contributors propose; maintainers merge.** Everyone — including agents
  working autonomously — lands work through a pull request. **No one
  self-merges.** The maintainer (`@astaub`) reviews and merges. An agent that
  finishes its work opens a PR and **stops**.
- **One concern per PR.** Small, reviewable, single-purpose. Split unrelated
  changes.
- **Never push to `main`.** Branch, commit, push the branch, open a PR. No
  force-push to shared branches.
- **Tests gate the PR.** A PR with red tests is not ready. Run the suite below
  before you open it.
- **Discuss large changes first.** Open an issue describing the change before
  writing a big diff, so direction is agreed before code exists.

## What this project is

`charts` is terminal charts agents can show humans. It is written in **TypeScript** and
is **agent-native**: it reads a JSON chart spec (stdin or a file) and emits
deterministic, transcript-safe terminal output — no network calls, no hidden
state — so an agent can render evidence directly into a CLI transcript.

## Build & test

```sh
npm install
npm run build
npm test
```

A change is not ready to propose until `npm test` is green locally.

## Conventions

- **JSON in, deterministic text out.** The contract is a JSON chart spec on the
  input side; the same spec renders the same bytes every time. An `--integrity`
  marker block lets a reader verify a chart was actually produced by `charts`.
- **Structured failures.** Errors print a clear `charts: <message>` to stderr and
  exit non-zero — never a raw stack trace.
- **No hidden defaults for paths/credentials.** A public core never guesses a
  filesystem path or secret — take it from a flag or an environment variable
  and fail loudly when it is missing.
- **Conventional commits.** `feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
  `chore:`. The subject line says what changed and why it matters.
- **Keep the diff matched to the surrounding code** — its naming, comment
  density, and idioms. Don't reformat unrelated lines.
- **dist policy: `dist/` is committed so `npm i github:astaub/charts` and git+ssh monorepo consumption work with no build step; rebuild with `npm run build` after editing `src/`.**

## Project layout

```
src/ · dist/ (built, committed) · test/ · examples/ · fixtures/ · scripts/qa-gallery.sh · docs/screenshots/
```

## For autonomous agents specifically

- Read this file and `CONTRIBUTING.md` before editing.
- Make the change on a branch, run `npm test`, then open a PR with a clear
  body (what changed, why, how it was verified) and **stop**. Do not merge,
  do not deploy, do not push to `main`.
- If the change is large or ambiguous, open an issue first and wait.
- Leave unrelated dirty work untouched.

## License

`charts` is MIT-licensed. By contributing you agree your contribution
is licensed under the same terms. See [LICENSE](LICENSE).
