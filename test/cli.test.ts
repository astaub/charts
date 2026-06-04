import { describe, expect, it } from 'vitest';
import { parseAgentVizArgs, renderAgentVizSpec } from '../src/cli';

describe('agentviz cli renderer', () => {
  it('renders a line chart with attached filters from a JSON spec', () => {
    const output = renderAgentVizSpec({
      title: 'Activation',
      chart: 'line',
      series: [
        {
          label: 'Page views',
          points: [
            { label: 'Mon', value: 12 },
            { label: 'Tue', value: 20 },
          ],
        },
        {
          label: 'Published profile',
          points: [
            { label: 'Mon', value: 2 },
            { label: 'Tue', value: 5 },
          ],
        },
      ],
      filters: [
        { scope: 'event', field: '$pageview' },
        { scope: 'property', field: '$current_url', operator: 'contains', value: '/setups/founders' },
      ],
      suggested_filters: [
        { scope: 'cohort', field: 'company_age_hours', operator: '<=', value: 24, reason: 'first-day activation' },
      ],
    }, undefined, 72);

    expect(output).toContain('Activation');
    expect(output).toContain('Legend: ● Page views ◆ Published profile');
    expect(output).toContain('Filters');
    expect(output).toContain('property: $current_url contains /setups/founders');
    expect(output).toContain('Suggested filters');
    expect(output).toContain('company_age_hours <= 24 - first-day activation');
  });

  it('lets the command choose the chart when the spec omits it', () => {
    const output = renderAgentVizSpec({
      steps: [
        { label: 'Visited', count: 120 },
        { label: 'Paid', count: 18 },
      ],
    }, 'funnel', 64);

    expect(output).toContain('Visited');
    expect(output).toContain('Paid');
    expect(output).toContain('18');
    expect(output).toContain('15%');
  });

  it('parses chart, file, and width arguments', () => {
    expect(parseAgentVizArgs(['line', 'chart.json', '--width', '96'])).toEqual({
      chart: 'line',
      file: 'chart.json',
      width: 96,
    });
  });

  it('parses a single --vline flag with at and label', () => {
    expect(parseAgentVizArgs(['line', '--vline', 'at=Feb,label=launch'])).toEqual({
      chart: 'line',
      vlines: [{ at: 'Feb', label: 'launch' }],
    });
  });

  it('parses repeated --vline flags in order', () => {
    expect(
      parseAgentVizArgs([
        'line',
        '--vline',
        'at=Feb,label=launch',
        '--vline',
        'at=Apr,label=update,position=below',
      ]),
    ).toEqual({
      chart: 'line',
      vlines: [
        { at: 'Feb', label: 'launch' },
        { at: 'Apr', label: 'update', position: 'below' },
      ],
    });
  });

  it('parses --shade with pattern and label', () => {
    expect(parseAgentVizArgs(['line', '--shade', 'from=Jan,to=Feb,label=pre-launch,pattern=gray'])).toEqual({
      chart: 'line',
      shades: [{ from: 'Jan', to: 'Feb', label: 'pre-launch', pattern: 'gray' }],
    });
  });

  it('parses --footer with quoted text containing spaces', () => {
    expect(parseAgentVizArgs(['line', '--footer', 'queried 2026-05-18 from prod'])).toEqual({
      chart: 'line',
      footer: 'queried 2026-05-18 from prod',
    });
  });

  it('parses --xaxis-labels skip:3 into a skipEvery object', () => {
    expect(parseAgentVizArgs(['line', '--xaxis-labels', 'skip:3'])).toEqual({
      chart: 'line',
      xAxisLabels: { skipEvery: 3 },
    });
  });

  it('parses --xaxis-labels stagger as a string strategy', () => {
    expect(parseAgentVizArgs(['line', '--xaxis-labels', 'stagger'])).toEqual({
      chart: 'line',
      xAxisLabels: 'stagger',
    });
  });

  it('parses --linestyle step into a lineStyle string', () => {
    expect(parseAgentVizArgs(['line', '--linestyle', 'step'])).toEqual({
      chart: 'line',
      lineStyle: 'step',
    });
  });

  it('parses --linestyle=markers-only with the equals form', () => {
    expect(parseAgentVizArgs(['line', '--linestyle=markers-only'])).toEqual({
      chart: 'line',
      lineStyle: 'markers-only',
    });
  });

  it('rejects unknown --linestyle values', () => {
    expect(() => parseAgentVizArgs(['line', '--linestyle', 'curve'])).toThrowError(
      /--linestyle must be linear\|step\|markers-only/,
    );
  });

  it('rejects unknown --vline position values', () => {
    expect(() => parseAgentVizArgs(['line', '--vline', 'at=Feb,position=sideways'])).toThrowError(
      /position must be above\|below/,
    );
  });

  it('renders a line chart with vline, shade, and footer overrides from CLI flags', () => {
    const output = renderAgentVizSpec(
      {
        chart: 'line',
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
      },
      undefined,
      72,
      {
        vlines: [{ at: 'Feb', label: 'launch' }],
        shades: [{ from: 'Jan', to: 'Feb', label: 'pre', pattern: 'gray' }],
        footer: 'queried 2026-05-18',
      },
    );

    expect(output).toContain('launch');
    expect(output).toContain('░');
    expect(output).toContain('Shaded:');
    expect(output).toContain('queried 2026-05-18');
  });

  it('lets CLI overrides win over JSON spec line options', () => {
    const output = renderAgentVizSpec(
      {
        chart: 'line',
        series: [
          {
            label: 'rate',
            points: [
              { label: 'Jan', value: 1 },
              { label: 'Feb', value: 2 },
            ],
          },
        ],
        footer: 'json footer',
      },
      undefined,
      72,
      { footer: 'cli footer' },
    );

    expect(output).toContain('cli footer');
    expect(output).not.toContain('json footer');
  });
});
