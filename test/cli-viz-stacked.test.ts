import { describe, expect, it } from 'vitest';
import { renderStackedBarChart } from '../src/cli-viz/stacked';

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/;

const sourceMix = [
  {
    label: 'Jan',
    segments: [
      { key: 'organic', label: 'Organic', value: 120 },
      { key: 'bd_referral', label: 'BD referral', value: 90 },
      { key: 'founder_referral', label: 'Founder referral', value: 30 },
    ],
  },
  {
    label: 'Feb',
    segments: [
      { key: 'organic', label: 'Organic', value: 100 },
      { key: 'bd_referral', label: 'BD referral', value: 150 },
      { key: 'founder_referral', label: 'Founder referral', value: 50 },
    ],
  },
  {
    label: 'Mar',
    segments: [
      { key: 'organic', label: 'Organic', value: 80 },
      { key: 'bd_referral', label: 'BD referral', value: 220 },
      { key: 'founder_referral', label: 'Founder referral', value: 100 },
    ],
  },
];

describe('stacked CLI bar chart', () => {
  it('renders source mix over time with counts and shares', () => {
    expect(renderStackedBarChart(sourceMix, {
      title: 'Source Mix Over Time',
      width: 108,
      segmentOrder: ['organic', 'bd_referral', 'founder_referral'],
    })).toMatchInlineSnapshot(`
      "╭─ Source Mix Over Time ───────────────────────────────────────────────────────────────────────────────────╮
      │ Legend: A Organic B BD referral C Founder referral                                                       │
      │                                                                                                          │
      │                                                                                                    Total │
      │                                                                                                          │
      │ Jan     AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBCCCCCCCCCCC    240 │
      │ Feb     AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBCCCCCCCCCCCCCCC    300 │
      │ Mar     AAAAAAAAAAAAAAAAAABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBCCCCCCCCCCCCCCCCCCCCCC    400 │
      ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────╯"
    `);
  });

  it('falls back to narrow transcript-safe blocks', () => {
    expect(renderStackedBarChart(sourceMix, {
      width: 42,
      segmentOrder: ['organic', 'bd_referral', 'founder_referral'],
    })).toMatchInlineSnapshot(`
      "1. Jan
       total: 240
       Organic: 120 (50%)
       BD referral: 90 (38%)
       Founder referral: 30 (13%)
       mix: AAAAAAAAAAAAAAAABBBBBBBBBBBBCCCC

      2. Feb
       total: 300
       Organic: 100 (33%)
       BD referral: 150 (50%)
       Founder referral: 50 (17%)
       mix: AAAAAAAAAAABBBBBBBBBBBBBBBBCCCCC

      3. Mar
       total: 400
       Organic: 80 (20%)
       BD referral: 220 (55%)
       Founder referral: 100 (25%)
       mix: AAAAAABBBBBBBBBBBBBBBBBBCCCCCCCC"
    `);
  });

  it('keeps lines within width and does not emit ANSI by default', () => {
    const output = renderStackedBarChart(sourceMix, { width: 64 });

    expect(output).not.toMatch(ANSI_PATTERN);
    for (const line of output.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(64);
    }
  });

  it('keeps block labels within width after item numbers become multi-digit', () => {
    const output = renderStackedBarChart(
      Array.from({ length: 12 }, (_, index) => ({
        label: `abcdefghijklmnopqrstuvwxyz0123456789-${index}`,
        segments: [{ key: 'organic', label: 'Organic', value: 1 }],
      })),
      { width: 32 },
    );

    for (const line of output.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  it('handles explicit totals, missing segments, zero totals, and empty input', () => {
    const output = renderStackedBarChart([
      {
        label: 'Apr',
        total: 500,
        segments: [
          { key: 'organic', label: 'Organic', value: 125 },
          { key: 'bd_referral', label: 'BD referral', value: 75 },
        ],
      },
      {
        label: 'May',
        total: 0,
        segments: [
          { key: 'organic', label: 'Organic', value: 0 },
        ],
      },
    ], { width: 88, segmentOrder: ['organic', 'bd_referral'] });

    // Wide view shows the colored stacked bar + total; the May bucket has a
    // zero total so its bar is all track (░). Exact per-segment shares live in
    // the narrow block view (covered above).
    expect(output).toContain('500');
    expect(output.split('\n').find((line) => line.includes('Apr'))).toContain('░');
    expect(output.split('\n').find((line) => line.includes('May'))).toContain('░░░░░░░░░░░░░░░░');
    expect(renderStackedBarChart([], { width: 54 })).toBe('No stacked bar chart data.');
  });

  it('drops non-finite segment values instead of coercing them to zero', () => {
    const output = renderStackedBarChart([
      {
        label: 'Apr',
        segments: [
          { key: 'bad', label: 'Invalid computed segment', value: Number.NaN },
          { key: 'organic', label: 'Organic', value: 25 },
        ],
      },
    ], { width: 88 });

    expect(output).toContain('Organic');
    expect(output).not.toContain('Invalid computed segment');
  });

  it('uses a segment label as the runtime key when an untyped caller omits key', () => {
    const output = renderStackedBarChart([
      {
        label: 'Apr',
        segments: [
          { label: 'BD referral', value: 25 },
        ],
      },
    ] as any, { width: 72 });

    expect(output).toContain('BD referral');
    // Single full segment → the bar is one color across the full width.
    expect(output).toContain('AAAA');
  });

  it('sanitizes terminal controls and html-looking labels', () => {
    const output = renderStackedBarChart([
      {
        label: '<script>\u001B[31mJan',
        segments: [
          { key: 'organic', label: '<Organic>\u0007', value: 10 },
        ],
      },
    ], { width: 72 });

    expect(output).not.toMatch(ANSI_PATTERN);
    expect(output).not.toContain('<');
    expect(output).not.toContain('>');
    expect(output).not.toContain('\u0007');
    expect(output).toContain('scriptJan');
    expect(output).toContain('Organic');
  });
});
