# Security Policy 📊

`charts` is a terminal-rendering library: it takes a JSON spec and returns a
string. It makes **no network calls**, reads **no files at runtime**, and runs
**no shell** — so the attack surface is small. Still, output flows into
terminals, logs, and chat transcripts, so we take handling of untrusted input
seriously.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately through GitHub's
[**Report a vulnerability**](https://github.com/astaub/charts/security/advisories/new)
form (Security → Advisories). That keeps the report confidential while we work a
fix. Please include:

- what you observed (and what you expected),
- a minimal spec or input that reproduces it,
- the `@staub/charts` version (or commit SHA) and your Node version.

We aim to acknowledge a report within a few days and to ship a fix or mitigation
as fast as the severity warrants. We'll credit you in the release notes unless
you'd rather stay anonymous.

## What counts

In scope — things `charts` is responsible for:

- **Terminal-escape injection**: untrusted labels/values smuggling raw ANSI or
  control sequences into the rendered output (charts strips control characters
  and ANSI from caller-supplied text — a gap here is a bug).
- A crafted spec that causes a crash, hang, or unbounded memory/CPU use.

Out of scope:

- How a *consumer* displays our output (e.g. a terminal emulator that
  mis-handles a glyph we legitimately emit).
- Vulnerabilities in dependencies — report those upstream (tell us too if they
  affect `charts`).

## Supported versions

`charts` is pre-1.0; only the latest release on `main` receives security fixes.
