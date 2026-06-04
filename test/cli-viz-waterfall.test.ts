import { describe, expect, it } from 'vitest';
import { renderWaterfallChart } from '../src/cli-viz/waterfall';

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/;

describe('waterfall cli-viz primitive', () => {
  it('renders a funnel dropoff waterfall with exact values', () => {
    const output = renderWaterfallChart([
      { label: 'Acquired', value: 662, kind: 'start' },
      { label: 'Lost before qualification', value: 272, kind: 'negative' },
      { label: 'Lost before activation', value: 228, kind: 'negative' },
      { label: 'Launched', value: 162, kind: 'end' },
    ], { width: 88 });

    expect(output).toMatchInlineSnapshot(`
      "╭──────────────────────────────────────────────────────────────────────────────────────╮
      │ Step                       Value  Change  Total  Bar                                 │
      │                                                                                      │
      │ Acquired                     662   start    662  ███████████████████████████████████ │
      │ Lost before qualification    272    -272    390  |                   ░░░░░░░░░░░░░░░ │
      │ Lost before activation       228    -228    162  |       ░░░░░░░░░░░░░               │
      │ Launched                     162     end    162  █████████                           │
      ╰──────────────────────────────────────────────────────────────────────────────────────╯"
    `);
    expect(output).toContain('662');
    expect(output).toContain('-272');
    expect(output).toContain('162');
    expect(output).not.toMatch(ANSI_PATTERN);
  });

  it('renders positive and negative month-over-month contributions', () => {
    const output = renderWaterfallChart([
      { label: 'March launched', value: 66, kind: 'start' },
      { label: 'BD referral lift', value: 14, kind: 'positive' },
      { label: 'Organic softness', value: 9, kind: 'negative' },
      { label: 'Founder referrals', value: 6, kind: 'positive' },
      { label: 'April launched', value: 77, kind: 'end' },
    ], { width: 92 });

    expect(output).toContain('+14');
    expect(output).toContain('-9');
    expect(output).toContain('+6');
    expect(output).toContain('April launched');

    for (const line of output.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(92);
    }
  });

  it('infers negative changes from negative values when kind is omitted', () => {
    const output = renderWaterfallChart([
      { label: 'Visitors', value: 12000, kind: 'start' },
      { label: 'Signup dropoff', value: -7600 },
      { label: 'Qualified companies', value: 4400, kind: 'end' },
    ], { width: 88 });

    expect(output).toContain('-7,600');
    expect(output).toContain('4,400');
    expect(output).not.toContain('19,600');
  });

  it('renders negative start and end totals as spans from zero', () => {
    const output = renderWaterfallChart([
      { label: 'Start debt', value: -100, kind: 'start' },
      { label: 'Recovered', value: 50, kind: 'positive' },
      { label: 'Ending debt', value: -50, kind: 'end' },
    ], { width: 80 });

    const startLine = output.split('\n').find((line) => line.includes('Start debt')) ?? '';
    const endLine = output.split('\n').find((line) => line.includes('Ending debt')) ?? '';

    expect(startLine).toContain('██████████');
    expect(endLine).toContain('██████████');
    expect(startLine).toContain('-100');
    expect(endLine).toContain('-50');
  });

  it('keeps block labels within width after item numbers become multi-digit', () => {
    const output = renderWaterfallChart(
      Array.from({ length: 12 }, (_, index) => ({
        label: `abcdefghijklmnopqrstuvwxyz0123456789-${index}`,
        value: 1,
        kind: index === 0 ? 'start' : 'positive',
      })),
      { width: 32 },
    );

    for (const line of output.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  it('drops non-finite steps instead of coercing them to zero', () => {
    const output = renderWaterfallChart([
      { label: 'Start', value: 10, kind: 'start' },
      { label: 'Invalid computed step', value: Number.NaN, kind: 'negative' },
      { label: 'End', value: 10, kind: 'end' },
    ], { width: 80 });

    expect(output).toContain('Start');
    expect(output).toContain('End');
    expect(output).not.toContain('Invalid computed step');
  });

  it('uses a narrow block fallback without losing exact numbers', () => {
    const output = renderWaterfallChart([
      { label: 'Acquired from a very long source label', value: 123456789012345, kind: 'start' },
      { label: 'Disqualified', value: 34567890123456, kind: 'negative' },
      { label: 'Qualified', value: 88888898888889, kind: 'end' },
    ], { width: 36 });

    expect(output).toMatchInlineSnapshot(`
      "1. Acquired from a very long source~
      value: 123,456,789,012,345
      change: start
      total: 123,456,789,012,345
      █ start 123,456,789,012,345

      2. Disqualified
      value: 34,567,890,123,456
      change: -34,567,890,123,456
      total: 88,888,898,888,889
      ░ 123,456,789,012,345 to
      88,888,898,888,889

      3. Qualified
      value: 88,888,898,888,889
      change: end
      total: 88,888,898,888,889
      █ end 88,888,898,888,889"
    `);

    for (const line of output.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(36);
    }
  });

  it('sanitizes ansi, control characters, and markup-looking labels', () => {
    const output = renderWaterfallChart([
      { label: '\u001B[31m<script>alert(1)</script>\nAcquired', value: 10, kind: 'start' },
      { label: 'Lost\r\nbefore\tactivation', value: 4, kind: 'negative' },
      { label: 'Done', value: 6, kind: 'end' },
    ], { width: 72 });

    expect(output).not.toMatch(ANSI_PATTERN);
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('</script>');
    expect(output).not.toContain('\nAcquired');
    expect(output).toContain('scriptalert(1)/script Acquired');
    expect(output).toContain('Lost before activation');
  });

  it('handles empty data and clamps tiny widths', () => {
    expect(renderWaterfallChart([], { width: 80 })).toBe('No waterfall data.');

    const output = renderWaterfallChart([
      { label: 'Start', value: 1, kind: 'start' },
      { label: 'End', value: 1, kind: 'end' },
    ], { width: 8 });

    for (const line of output.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });
});
