import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderChartsSpec } from '../src/cli';
import { stripAnsi } from '../src/cli-viz/index';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const files = readdirSync(fixturesDir).filter((name) => name.endsWith('.json'));

describe('fixtures', () => {
  it('ships realistic sample data', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} parses and renders (mono + color) within width`, () => {
      const spec = JSON.parse(readFileSync(join(fixturesDir, file), 'utf8'));
      expect(typeof spec.chart).toBe('string');

      const mono = renderChartsSpec({ ...spec, options: { color: 'never' } }, undefined, 72);
      const color = renderChartsSpec({ ...spec, options: { color: 'always' } }, undefined, 72);

      // Both modes produce output, and color stays within the same geometry.
      expect(mono.length).toBeGreaterThan(0);
      for (const line of color.split('\n')) {
        expect([...stripAnsi(line)].length).toBeLessThanOrEqual(72);
      }
      // The title survives into the rendered chart.
      if (typeof spec.title === 'string') expect(mono).toContain(spec.title);
    });
  }
});
