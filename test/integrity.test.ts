import { describe, expect, it } from 'vitest';
import { computeHash, verifyIntegrity, wrapWithIntegrity } from '../src/integrity';
import { buildCanonicalSpec, parseAgentVizArgs, renderAgentVizSpec } from '../src/cli';

// A trivial deterministic renderer used to exercise integrity in isolation
// from the real chart renderers. It returns the spec's `body` field verbatim
// (or empty string), so test fixtures can produce predictable bodies without
// reaching into cli-viz.
const stubRenderer = (spec: unknown): string => {
  if (spec && typeof spec === 'object' && 'body' in spec) {
    const body = (spec as { body?: unknown }).body;
    if (typeof body === 'string') return body;
  }
  return '';
};

describe('integrity sentinel', () => {
  it('wraps output with markers, version, chart, spec, and hash', () => {
    const wrapped = wrapWithIntegrity('chart body line 1\nchart body line 2', {
      chart: 'line',
      version: '9.9.9',
      spec: { body: 'chart body line 1\nchart body line 2' },
    });
    expect(wrapped).toMatch(/^‹‹‹agentviz\/9\.9\.9 chart:line sha256:[a-f0-9]{64} spec:[A-Za-z0-9+/=]+›››\n/);
    expect(wrapped).toContain('chart body line 1\nchart body line 2');
    expect(wrapped.endsWith('\n‹‹‹/agentviz›››')).toBe(true);
  });

  it('verify returns OK for an unmodified marker block (with rerender)', () => {
    const wrapped = wrapWithIntegrity('body', {
      chart: 'bar',
      version: '0.0.1',
      spec: { body: 'body' },
    });
    const result = verifyIntegrity(wrapped, stubRenderer);
    expect(result.status).toBe('ok');
    expect(result.chart).toBe('bar');
    expect(result.version).toBe('0.0.1');
  });

  it('verify reports TAMPERED when body inside the block is edited', () => {
    const wrapped = wrapWithIntegrity('original body', {
      chart: 'line',
      version: '1.0.0',
      spec: { body: 'original body' },
    });
    const tampered = wrapped.replace('original body', 'edited body');
    const result = verifyIntegrity(tampered, stubRenderer);
    expect(result.status).toBe('tampered');
    expect(result.expectedHash).not.toBe(result.actualHash);
  });

  it('verify reports TAMPERED when the hash itself is edited', () => {
    const wrapped = wrapWithIntegrity('body', {
      chart: 'line',
      version: '1.0.0',
      spec: { body: 'body' },
    });
    const tampered = wrapped.replace(/sha256:([a-f0-9])/, (_match, ch) => `sha256:${ch === 'a' ? 'b' : 'a'}`);
    const result = verifyIntegrity(tampered, stubRenderer);
    expect(result.status).toBe('tampered');
  });

  it('verify reports TAMPERED when embedded spec is edited (hash mismatches)', () => {
    const wrapped = wrapWithIntegrity('body', {
      chart: 'line',
      version: '1.0.0',
      spec: { body: 'body' },
    });
    const fakeSpecB64 = Buffer.from(JSON.stringify({ body: 'something else' }), 'utf8').toString('base64');
    const tampered = wrapped.replace(/spec:[A-Za-z0-9+/=]+›››/, `spec:${fakeSpecB64}›››`);
    const result = verifyIntegrity(tampered, stubRenderer);
    expect(result.status).toBe('tampered');
  });

  it('verify reports TAMPERED on a recomputed-hash forgery (the P1 forgery scenario from codex review)', () => {
    // Simulate the codex-flagged attack: attacker edits the body, recomputes
    // the sha256 hash the same way the wrapper does, replaces the hash in
    // the block. The hash check alone would pass. The required re-render
    // step catches it: the embedded spec still says `{ body: 'original
    // body' }`, so re-rendering produces 'original body' which does not
    // match the forged body.
    const original = wrapWithIntegrity('original body', {
      chart: 'line',
      version: '1.0.0',
      spec: { body: 'original body' },
    });
    const editedBody = 'forged body — operator should not trust this';
    const newHash = computeHash({
      body: editedBody,
      chart: 'line',
      spec: { body: 'original body' },
      version: '1.0.0',
    });
    const forged = original
      .replace('original body', editedBody)
      .replace(/sha256:[a-f0-9]{64}/, `sha256:${newHash}`);
    const result = verifyIntegrity(forged, stubRenderer);
    expect(result.status).toBe('tampered');
    expect(result.reason).toMatch(/re-rendered body/);
  });

  it('verify reports no-marker when no agentviz block is present', () => {
    const result = verifyIntegrity('just a plain string, no marker here', stubRenderer);
    expect(result.status).toBe('no-marker');
  });

  it('verify reports malformed on a truncated header', () => {
    const result = verifyIntegrity('‹‹‹agentviz/1.0.0 chart:line and then nothing', stubRenderer);
    expect(result.status).toBe('malformed');
  });

  it('verify reports TAMPERED when a trailing blank line is added inside the block', () => {
    // Tightened newline handling — adding/removing blank lines inside the
    // block must be detected, not silently normalized away.
    const wrapped = wrapWithIntegrity('body', {
      chart: 'line',
      version: '1.0.0',
      spec: { body: 'body' },
    });
    // Inject an extra trailing newline before the close marker.
    const tampered = wrapped.replace('\n‹‹‹/agentviz›››', '\n\n‹‹‹/agentviz›››');
    // The body now ends with a newline that wasn't there at hash time, so
    // the body-slice will be 'body\n' instead of 'body', and the hash will
    // mismatch (caught at the hash step, before rerender).
    const result = verifyIntegrity(tampered, stubRenderer);
    expect(result.status).toBe('tampered');
  });

  it('verify surfaces byte counts for content outside the block', () => {
    const wrapped = wrapWithIntegrity('body', {
      chart: 'line',
      version: '1.0.0',
      spec: { body: 'body' },
    });
    const withSurrounding = `leading prose\n${wrapped}\ntrailing prose`;
    const result = verifyIntegrity(withSurrounding, stubRenderer);
    expect(result.status).toBe('ok');
    expect(result.leadingContentLength).toBeGreaterThan(0);
    expect(result.trailingContentLength).toBeGreaterThan(0);
  });

  it('computeHash is stable across key ordering in spec', () => {
    const a = computeHash({ chart: 'line', version: '1', spec: { a: 1, b: 2 }, body: 'x' });
    const b = computeHash({ chart: 'line', version: '1', spec: { b: 2, a: 1 }, body: 'x' });
    expect(a).toBe(b);
  });

  it('computeHash is stable across nested key ordering in spec', () => {
    const a = computeHash({
      chart: 'line',
      version: '1',
      spec: { options: { width: 80, footer: 'q' }, series: [{ a: 1, b: 2 }] },
      body: 'x',
    });
    const b = computeHash({
      chart: 'line',
      version: '1',
      spec: { series: [{ b: 2, a: 1 }], options: { footer: 'q', width: 80 } },
      body: 'x',
    });
    expect(a).toBe(b);
  });
});

describe('agentviz cli integrity flag', () => {
  it('parses --integrity', () => {
    expect(parseAgentVizArgs(['line', 'chart.json', '--integrity'])).toEqual({
      chart: 'line',
      file: 'chart.json',
      integrity: true,
    });
  });

  it('parses the verify subcommand with a file path', () => {
    expect(parseAgentVizArgs(['verify', 'out.txt'])).toEqual({
      verify: true,
      file: 'out.txt',
    });
  });

  it('parses the verify subcommand without a file path', () => {
    expect(parseAgentVizArgs(['verify'])).toEqual({ verify: true });
  });

  it('renderAgentVizSpec without --integrity is byte-identical to prior behavior', () => {
    const spec = {
      chart: 'funnel' as const,
      steps: [
        { label: 'Visited', count: 120 },
        { label: 'Paid', count: 18 },
      ],
    };
    const plain = renderAgentVizSpec(spec, undefined, 64);
    const explicit = renderAgentVizSpec(spec, undefined, 64, {}, { integrity: false });
    expect(explicit).toBe(plain);
    expect(plain.startsWith('‹‹‹agentviz')).toBe(false);
  });

  it('renderAgentVizSpec with integrity:true wraps the output in a verifiable marker block', () => {
    const spec = {
      chart: 'funnel' as const,
      steps: [
        { label: 'Visited', count: 120 },
        { label: 'Paid', count: 18 },
      ],
    };
    const wrapped = renderAgentVizSpec(spec, undefined, 64, {}, { integrity: true, version: '9.9.9' });
    expect(wrapped.startsWith('‹‹‹agentviz/9.9.9 chart:funnel sha256:')).toBe(true);
    expect(wrapped.endsWith('‹‹‹/agentviz›››')).toBe(true);
    // Verify with the real renderer must pass — re-rendering the embedded
    // spec produces a byte-exact match of the body inside the block.
    const verified = verifyIntegrity(wrapped, (s) => renderAgentVizSpec(s));
    expect(verified.status).toBe('ok');
    expect(verified.chart).toBe('funnel');
  });

  it('round-trips a line chart with line-style overrides through wrap + rerender-verify', () => {
    const spec = {
      chart: 'line' as const,
      series: [
        {
          label: 'rate',
          points: [
            { label: 'Jan', value: 1 },
            { label: 'Feb', value: 2 },
            { label: 'Mar', value: 3 },
          ],
        },
      ],
    };
    const wrapped = renderAgentVizSpec(
      spec,
      undefined,
      72,
      { vlines: [{ at: 'Feb', label: 'launch' }], footer: 'queried 2026-05-19' },
      { integrity: true, version: '0.1.3' },
    );
    const verified = verifyIntegrity(wrapped, (s) => renderAgentVizSpec(s));
    expect(verified.status).toBe('ok');
  });

  it('detects hand-editing the visible chart body produced through renderAgentVizSpec', () => {
    const spec = {
      chart: 'line' as const,
      series: [
        {
          label: 'rate',
          points: [
            { label: 'Jan', value: 1 },
            { label: 'Feb', value: 2 },
          ],
        },
      ],
    };
    const wrapped = renderAgentVizSpec(spec, undefined, 72, {}, { integrity: true, version: '0.1.3' });
    // Simulate the 2026-05-18 incident: agent adds an arrow annotation
    // inside the chart body. The hash must catch this.
    const fakeEdited = wrapped.replace('Legend', '← FEED-AS-HOME Legend');
    const result = verifyIntegrity(fakeEdited, (s) => renderAgentVizSpec(s));
    expect(result.status).toBe('tampered');
  });

  it('detects the full forgery attack against renderAgentVizSpec output', () => {
    // Realistic scenario: agent runs `agentviz line --integrity`, gets a
    // valid block, then hand-edits the body AND recomputes the hash using
    // the same hash routine. Without rerender this passes; with rerender,
    // the embedded spec re-renders to the original body and mismatch is
    // caught.
    const spec = {
      chart: 'line' as const,
      series: [
        { label: 'rate', points: [{ label: 'Jan', value: 1 }, { label: 'Feb', value: 2 }] },
      ],
    };
    const wrapped = renderAgentVizSpec(spec, undefined, 72, {}, { integrity: true, version: '0.1.3' });
    const specMatch = wrapped.match(/spec:([A-Za-z0-9+/=]+)›››/);
    expect(specMatch).not.toBeNull();
    const specB64 = specMatch![1];
    const embeddedSpec = JSON.parse(Buffer.from(specB64, 'base64').toString('utf8'));
    const headerEnd = wrapped.indexOf('›››');
    const bodyStart = headerEnd + 3 + 1; // past '›››' + newline
    const closeIdx = wrapped.indexOf('\n‹‹‹/agentviz›››');
    const originalBody = wrapped.slice(bodyStart, closeIdx);
    const forgedBody = originalBody.replace(/Jan/, 'FAKE');
    const forgedHash = computeHash({
      body: forgedBody,
      chart: 'line',
      spec: embeddedSpec,
      version: '0.1.3',
    });
    const forged = wrapped
      .replace(originalBody, forgedBody)
      .replace(/sha256:[a-f0-9]{64}/, `sha256:${forgedHash}`);
    // A pass-through stub renderer (which just returns the spec's claimed
    // body verbatim) would still accept the forgery because the embedded
    // spec was not changed, only the visible body and the hash. The real
    // renderer re-renders from the spec and produces the original body,
    // which does not match the forged body.
    const result = verifyIntegrity(forged, (s) => renderAgentVizSpec(s));
    expect(result.status).toBe('tampered');
  });
});

describe('buildCanonicalSpec', () => {
  it('produces a self-contained spec that re-renders to the same body', () => {
    const spec = {
      title: 'My chart',
      series: [
        { label: 'a', points: [{ label: 'x', value: 1 }, { label: 'y', value: 2 }] },
      ],
    };
    const body1 = renderAgentVizSpec(spec, 'line', 72, { footer: 'q' });
    const canonical = buildCanonicalSpec(spec as never, 'line', 72, { footer: 'q' });
    // Passing the canonical spec back through renderAgentVizSpec without
    // any chartHint/cliWidth/lineOverrides must produce the same body.
    const body2 = renderAgentVizSpec(canonical);
    expect(body2).toBe(body1);
  });
});
