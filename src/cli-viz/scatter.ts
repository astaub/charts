const DEFAULT_WIDTH = 80;
const NARROW_WIDTH = 54;
const MIN_WIDTH = 32;
const MAX_GRID_POINTS = 35;
const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const AXIS_CHARS = new Set(['|', '-', '+']);

export type ScatterValueFormat = 'number' | 'percent';

export interface ScatterPlotPoint {
  label: string;
  x: number;
  y: number;
}

export interface ScatterQuadrantLabels {
  topRight?: string;
  topLeft?: string;
  bottomRight?: string;
  bottomLeft?: string;
}

export interface ScatterPlotOptions {
  width?: number;
  xLabel?: string;
  yLabel?: string;
  xFormat?: ScatterValueFormat;
  yFormat?: ScatterValueFormat;
  xThreshold?: number;
  yThreshold?: number;
  quadrantLabels?: ScatterQuadrantLabels;
  includeTable?: boolean;
}

interface CleanPoint {
  id: string;
  label: string;
  x: number;
  y: number;
}

export function renderScatterPlot(points: ScatterPlotPoint[], options: ScatterPlotOptions = {}): string {
  const width = clampWidth(options.width);
  const cleanPoints = points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point, index) => ({
      id: pointId(index),
      label: sanitizeText(point.label),
      x: numeric(point.x),
      y: numeric(point.y),
    }));

  if (cleanPoints.length === 0) return 'No scatter plot data.';

  const xLabel = sanitizeText(options.xLabel ?? 'X');
  const yLabel = sanitizeText(options.yLabel ?? 'Y');
  const xFormat = options.xFormat ?? 'number';
  const yFormat = options.yFormat ?? 'number';
  const xThreshold = Number.isFinite(options.xThreshold) ? numeric(options.xThreshold) : median(cleanPoints.map((point) => point.x));
  const yThreshold = Number.isFinite(options.yThreshold) ? numeric(options.yThreshold) : median(cleanPoints.map((point) => point.y));
  const includeTable = options.includeTable !== false;
  const renderContext = { width, xLabel, yLabel, xFormat, yFormat, xThreshold, yThreshold, options };

  if (width < NARROW_WIDTH || cleanPoints.length > MAX_GRID_POINTS) {
    return renderScatterBlocks(cleanPoints, renderContext);
  }

  const xRange = expandedRange(cleanPoints.map((point) => point.x), xThreshold, xFormat);
  const yRange = expandedRange(cleanPoints.map((point) => point.y), yThreshold, yFormat);
  const yTicks = [yRange.max, midpoint(yRange.min, yRange.max), yRange.min];
  const yTickWidth = Math.max(...yTicks.map((tick) => visualWidth(formatValue(tick, yFormat))));
  const plotWidth = Math.max(20, width - yTickWidth - 3);
  const plotHeight = width >= 72 ? 10 : 8;
  const grid = makeGrid(plotHeight, plotWidth, ' ');
  const xReferenceColumn = valueToColumn(xThreshold, xRange.min, xRange.max, plotWidth);
  const yReferenceRow = valueToRow(yThreshold, yRange.min, yRange.max, plotHeight);

  for (let row = 0; row < plotHeight; row += 1) {
    grid[row]![xReferenceColumn] = '|';
  }
  for (let column = 0; column < plotWidth; column += 1) {
    grid[yReferenceRow]![column] = '-';
  }
  grid[yReferenceRow]![xReferenceColumn] = '+';

  for (const point of cleanPoints) {
    const row = valueToRow(point.y, yRange.min, yRange.max, plotHeight);
    const column = valueToColumn(point.x, xRange.min, xRange.max, plotWidth);
    const current = grid[row]![column] ?? ' ';
    grid[row]![column] = current.trim() && !AXIS_CHARS.has(current) ? '*' : point.id;
  }

  const lines: string[] = [fitLine(yLabel, width)];
  for (let row = 0; row < plotHeight; row += 1) {
    const tick = tickForRow(row, plotHeight, yTicks, yFormat);
    lines.push(`${padCell(tick, yTickWidth, 'right')} |${grid[row]!.join('')}`);
  }

  const bottomAxis = `${repeat(' ', yTickWidth)} +${repeat('-', plotWidth)}`;
  lines.push(fitLine(bottomAxis, width));
  lines.push(fitLine(`${repeat(' ', yTickWidth + 2)}${formatValue(xRange.min, xFormat)}${centerAxisLabel(xLabel, plotWidth, formatValue(xRange.min, xFormat), formatValue(xRange.max, xFormat))}${formatValue(xRange.max, xFormat)}`, width));

  if (includeTable) {
    lines.push('');
    lines.push(...renderCoordinateTable(cleanPoints, renderContext));
  }

  return lines.map((line) => fitLine(line, width).trimEnd()).join('\n');
}

function renderScatterBlocks(
  points: CleanPoint[],
  context: {
    width: number;
    xLabel: string;
    yLabel: string;
    xFormat: ScatterValueFormat;
    yFormat: ScatterValueFormat;
    xThreshold: number;
    yThreshold: number;
    options: ScatterPlotOptions;
  },
): string {
  return points
    .flatMap((point, index) => {
      const prefix = `${index + 1}. `;
      return [
        ...(index > 0 ? [''] : []),
        `${prefix}${truncateLine(point.label, context.width - visualWidth(prefix))}`,
        ...wrapIndentedLine(`${context.xLabel}: ${formatValue(point.x, context.xFormat)}`, context.width),
        ...wrapIndentedLine(`${context.yLabel}: ${formatValue(point.y, context.yFormat)}`, context.width),
        ...wrapIndentedLine(`quadrant: ${quadrantLabel(point, context.xThreshold, context.yThreshold, context.options)}`, context.width),
      ];
    })
    .join('\n');
}

function renderCoordinateTable(
  points: CleanPoint[],
  context: {
    width: number;
    xLabel: string;
    yLabel: string;
    xFormat: ScatterValueFormat;
    yFormat: ScatterValueFormat;
    xThreshold: number;
    yThreshold: number;
    options: ScatterPlotOptions;
  },
): string[] {
  const labelWidth = Math.min(24, Math.max(6, longest(points.map((point) => point.label))));
  const xValues = points.map((point) => formatValue(point.x, context.xFormat));
  const yValues = points.map((point) => formatValue(point.y, context.yFormat));
  const xWidth = Math.max(visualWidth(context.xLabel), ...xValues.map(visualWidth));
  const yWidth = Math.max(visualWidth(context.yLabel), ...yValues.map(visualWidth));
  const quadrantHeader = 'Quadrant';
  const quadrantValues = points.map((point) => quadrantLabel(point, context.xThreshold, context.yThreshold, context.options));
  const remaining = context.width - labelWidth - xWidth - yWidth - 8;
  if (remaining < 8) {
    return renderScatterBlocks(points, context).split('\n');
  }
  const quadrantWidth = Math.max(8, Math.min(Math.max(visualWidth(quadrantHeader), longest(quadrantValues)), remaining));

  const lines = [
    [
      padCell('ID', 2, 'left'),
      padCell('Label', labelWidth, 'left'),
      padCell(context.xLabel, xWidth, 'right'),
      padCell(context.yLabel, yWidth, 'right'),
      padCell(quadrantHeader, quadrantWidth, 'left'),
    ].join('  '),
    [
      repeat('-', 2),
      repeat('-', labelWidth),
      repeat('-', xWidth),
      repeat('-', yWidth),
      repeat('-', quadrantWidth),
    ].join('  '),
  ];

  for (const point of points) {
    lines.push(
      [
        padCell(point.id, 2, 'left'),
        padCell(point.label, labelWidth, 'left'),
        padCell(formatValue(point.x, context.xFormat), xWidth, 'right'),
        padCell(formatValue(point.y, context.yFormat), yWidth, 'right'),
        padCell(quadrantLabel(point, context.xThreshold, context.yThreshold, context.options), quadrantWidth, 'left'),
      ].join('  '),
    );
  }

  return lines;
}

function quadrantLabel(point: CleanPoint, xThreshold: number, yThreshold: number, options: ScatterPlotOptions): string {
  const highX = point.x >= xThreshold;
  const highY = point.y >= yThreshold;
  const labels = options.quadrantLabels ?? {};
  if (highX && highY) return sanitizeText(labels.topRight ?? 'high x / high y');
  if (!highX && highY) return sanitizeText(labels.topLeft ?? 'low x / high y');
  if (highX && !highY) return sanitizeText(labels.bottomRight ?? 'high x / low y');
  return sanitizeText(labels.bottomLeft ?? 'low x / low y');
}

function expandedRange(values: number[], threshold: number, format: ScatterValueFormat): { min: number; max: number } {
  let min = Math.min(...values, threshold);
  let max = Math.max(...values, threshold);
  if (min === max) {
    const delta = Math.max(format === 'percent' ? 0.01 : 1, Math.abs(min) * 0.1);
    min -= delta;
    max += delta;
  }
  const padding = (max - min) * 0.08;
  return { min: min - padding, max: max + padding };
}

function valueToColumn(value: number, min: number, max: number, width: number): number {
  if (max === min) return 0;
  const normalized = (value - min) / (max - min);
  return Math.max(0, Math.min(width - 1, Math.round(normalized * (width - 1))));
}

function valueToRow(value: number, min: number, max: number, height: number): number {
  if (max === min) return 0;
  const normalized = (value - min) / (max - min);
  return Math.max(0, Math.min(height - 1, Math.round((1 - normalized) * (height - 1))));
}

function tickForRow(row: number, plotHeight: number, ticks: number[], format: ScatterValueFormat): string {
  if (row === 0) return formatValue(ticks[0] ?? 0, format);
  if (row === Math.floor(plotHeight / 2)) return formatValue(ticks[1] ?? 0, format);
  if (row === plotHeight - 1) return formatValue(ticks[2] ?? 0, format);
  return '';
}

function centerAxisLabel(label: string, width: number, left: string, right: string): string {
  const available = Math.max(1, width - visualWidth(left) - visualWidth(right));
  const text = truncateLine(` ${label} `, available);
  const leftPad = Math.max(0, Math.floor((available - visualWidth(text)) / 2));
  const rightPad = Math.max(0, available - visualWidth(text) - leftPad);
  return `${repeat(' ', leftPad)}${text}${repeat(' ', rightPad)}`;
}

function makeGrid(rows: number, columns: number, value: string): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => value));
}

function pointId(index: number): string {
  if (index < 9) return String(index + 1);
  return String.fromCharCode(65 + ((index - 9) % 26));
}

function formatValue(value: number, format: ScatterValueFormat): string {
  if (format === 'percent') return formatPercent(value);
  return formatNumber(value);
}

function midpoint(min: number, max: number): number {
  return min + (max - min) / 2;
}

function median(values: number[]): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function padCell(value: string, width: number, align: 'left' | 'right'): string {
  const text = truncateLine(sanitizeText(value), width);
  const padding = repeat(' ', Math.max(0, width - visualWidth(text)));
  return align === 'right' ? `${padding}${text}` : `${text}${padding}`;
}

function fitLine(value: string, width: number): string {
  return truncateLine(value, width);
}

function truncateLine(value: string, width: number): string {
  const text = stripAnsi(value)
    .replace(/\r?\n/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .trimEnd();
  if (visualWidth(text) <= width) return text;
  if (width <= 1) return takeDisplayWidth(text, Math.max(0, width));
  return `${takeDisplayWidth(text, width - 1)}~`;
}

function wrapLine(value: string, width: number): string[] {
  const text = sanitizeText(value);
  if (visualWidth(text) <= width) return [text];

  const lines: string[] = [];
  let remaining = text;
  while (visualWidth(remaining) > width) {
    const hardSlice = takeDisplayWidth(remaining, width);
    const lastSpace = hardSlice.lastIndexOf(' ');
    const breakAt = lastSpace > Math.floor(width / 2) ? lastSpace : hardSlice.length;
    const line = hardSlice.slice(0, breakAt).trimEnd();
    lines.push(line);
    remaining = remaining.slice(hardSlice.slice(0, breakAt).length).trimStart();
  }
  if (remaining.length > 0) lines.push(remaining);
  return lines;
}

function wrapIndentedLine(value: string, width: number): string[] {
  return wrapLine(value, Math.max(1, width - 3)).map((line) => `   ${line}`);
}

function takeDisplayWidth(value: string, width: number): string {
  let used = 0;
  let output = '';
  for (const char of value) {
    const charWidth = charDisplayWidth(char);
    if (used + charWidth > width) break;
    used += charWidth;
    output += char;
  }
  return output;
}

function visualWidth(value: string): number {
  let width = 0;
  for (const char of stripAnsi(value)) width += charDisplayWidth(char);
  return width;
}

function charDisplayWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (code === 0) return 0;
  if (code < 32 || (code >= 0x7f && code < 0xa0)) return 0;
  if (code >= 0x300 && code <= 0x36f) return 0;
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2329 && code <= 0x232a) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  ) {
    return 2;
  }
  return 1;
}

function sanitizeText(value: string): string {
  return stripAnsi(value)
    .replace(/\r?\n/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/[|`]/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '');
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(value);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  const normalized = Math.abs(value) > 1 ? value / 100 : value;
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: normalized > 0 && normalized < 0.1 ? 1 : 0,
    style: 'percent',
  }).format(normalized);
}

function numeric(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function longest(values: string[]): number {
  return Math.max(0, ...values.map(visualWidth));
}

function repeat(value: string, count: number): string {
  return value.repeat(Math.max(0, count));
}

function clampWidth(width: number | undefined): number {
  if (width === undefined) return DEFAULT_WIDTH;
  return Math.max(MIN_WIDTH, Math.floor(width));
}
