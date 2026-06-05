# charts 📊

The operating contract for this repository lives in **[AGENTS.md](AGENTS.md)** —
the open, agent-agnostic format read by Claude Code, Codex, Cursor, Gemini CLI,
and other coding agents. Read it before making any change.

Key rules (full text in AGENTS.md):

- Contributors propose via PR; **no one self-merges**. Open a PR and stop.
- Never push to `main`. Branch, run the tests, open a PR.
- Build & test: `npm test` must be green before proposing.
- JSON chart spec in, deterministic terminal output out; failures print `charts: …` and exit non-zero.

This file is a thin pointer so Claude Code picks up the contract automatically.
Everything else is in [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
