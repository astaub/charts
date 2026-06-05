import { afterEach, describe, expect, it } from 'vitest';
import {
  CATEGORICAL,
  DEFAULT_THEME,
  applyTheme,
  categorical,
  getTheme,
  listThemes,
  ramp,
  registerTheme,
  resolveTheme,
  setAppearance,
  setTheme,
  type Palette,
} from '../src/cli-viz/theme';

// The brand theme system: `staub` (sunset-on-ocean) is the default so any
// render is on-brand; `classic` (blue family) is preserved and selectable;
// palettes are overridable via setTheme / registerTheme.

const STAUB_CORAL = { r: 255, g: 111, b: 97 }; // staub dark categorical[0]
const CLASSIC_BLUE = { r: 61, g: 110, b: 255 }; // classic dark categorical[0]

afterEach(() => {
  // Restore the brand default so state never leaks between tests.
  setTheme('staub');
  setAppearance('dark');
});

describe('theme registry — staub default + overridable palettes', () => {
  it('defaults to the staub theme', () => {
    expect(DEFAULT_THEME).toBe('staub');
    expect(getTheme()).toBe('staub');
  });

  it('the default dark palette leads with Staub coral (sunset-on-ocean)', () => {
    setTheme('staub');
    setAppearance('dark');
    expect(categorical(0)).toEqual(STAUB_CORAL);
    // CATEGORICAL (back-compat export) reflects the default theme's dark set.
    expect(CATEGORICAL[0]).toEqual(STAUB_CORAL);
  });

  it('the default ramp runs warm coral → cool ocean', () => {
    setTheme('staub');
    setAppearance('dark');
    const warm = ramp(0); // coral end
    const cool = ramp(1); // ocean end
    expect(warm.r).toBeGreaterThan(cool.r); // coral is much redder than ocean
    expect(cool.b).toBeGreaterThan(warm.b); // ocean is much bluer than coral
  });

  it('classic is preserved and selectable', () => {
    setTheme('classic');
    setAppearance('dark');
    expect(getTheme()).toBe('classic');
    expect(categorical(0)).toEqual(CLASSIC_BLUE);
  });

  it('applyTheme resets an unset/unknown name to the staub default', () => {
    setTheme('classic');
    expect(applyTheme(undefined)).toBe('staub');
    expect(getTheme()).toBe('staub');
    setTheme('classic');
    expect(applyTheme('nope')).toBe('staub'); // unknown falls back, never throws
  });

  it('resolveTheme falls back to the default for unknown names', () => {
    expect(resolveTheme('staub')).toBe('staub');
    expect(resolveTheme('classic')).toBe('classic');
    expect(resolveTheme(undefined)).toBe('staub');
    expect(resolveTheme('made-up')).toBe('staub');
  });

  it('listThemes includes both built-ins', () => {
    const themes = listThemes();
    expect(themes).toContain('staub');
    expect(themes).toContain('classic');
  });

  it('registerTheme adds an overriding palette that setTheme can select', () => {
    const mono = { r: 10, g: 10, b: 10 };
    const flat: Palette = {
      accent: mono,
      muted: mono,
      track: mono,
      ink: mono,
      text: mono,
      positive: mono,
      negative: mono,
      warn: mono,
      rampStops: [mono, mono],
      heatStops: [mono, mono],
      categorical: [mono],
    };
    registerTheme('test-mono', { dark: flat, light: flat });
    expect(listThemes()).toContain('test-mono');
    setTheme('test-mono');
    setAppearance('dark');
    expect(categorical(0)).toEqual(mono);
  });
});
