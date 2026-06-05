# Contributing to charts 📊

Thanks for helping out. charts is terminal charts agents can show humans. Contributions come from
both humans and coding agents, and the rules are the same for both.

## The short version

1. Open an issue for anything non-trivial before writing code.
2. Branch off `main`. Never commit to `main` directly.
3. Make one focused change.
4. Run the tests (`npm test`) — they must be green.
5. Open a pull request describing **what** changed, **why**, and **how you
   verified it**.
6. **Stop there.** A maintainer reviews and merges. Contributors do not
   self-merge.

## Setup

```sh
git clone https://github.com/astaub/charts.git
cd charts
npm install
npm test
```

## Pull requests

- **One concern per PR.** A bug fix and a refactor are two PRs.
- **Tests required.** New behavior ships with a test; a bug fix ships with a
  test that would have caught it.
- **Conventional commits** for the subject line: `feat:`, `fix:`, `docs:`,
  `refactor:`, `test:`, `chore:`.
- **No drive-by reformatting.** Keep the diff to the change.
- **Green CI.** PRs that don't pass tests aren't reviewed until they do.

## Code conventions

- **JSON-first.** Commands speak JSON for programmatic callers; human text is a
  rendering layer.
- **Structured errors** with a stable code and a remediation hint — never a raw
  crash.
- **No hidden path/credential defaults.** Take them from a flag or env var and
  fail loudly when missing.
- **Match the surrounding code** — naming, idioms, comment density.

## Reporting bugs

Open an issue with: what you ran, what you expected, what happened, and your OS
+ `charts` version. A minimal reproduction is the fastest path to a fix.

## License

By contributing you agree your contribution is licensed under the MIT
license that covers this project. See [LICENSE](LICENSE).
