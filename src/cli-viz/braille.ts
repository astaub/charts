// Braille canvas — sub-character-cell plotting.
//
// Each terminal cell maps to a 2×4 grid of braille dots (Unicode block
// U+2800–U+28FF), so a W×H grid of cells addresses 2W×4H dots — roughly 8×
// the resolution of block-character plotting at the same width. This is what
// lets the line chart draw smooth, dense curves (the asciichart aesthetic)
// without leaving the terminal or emitting images.
//
// The canvas is geometry only: callers map data coordinates to dot
// coordinates and read back rows of braille characters. No color, no axis —
// the line chart owns those.

const BRAILLE_BASE = 0x2800;

// Dot bit values by [dotRow 0..3 (top→bottom)][dotCol 0..1 (left→right)].
const DOT_BITS: ReadonlyArray<ReadonlyArray<number>> = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];

export class BrailleCanvas {
  readonly cols: number;
  readonly rows: number;
  /** Dot-space dimensions: width = 2·cols, height = 4·rows. */
  readonly dotWidth: number;
  readonly dotHeight: number;
  private readonly cells: Uint8Array;

  constructor(cols: number, rows: number) {
    this.cols = Math.max(1, Math.floor(cols));
    this.rows = Math.max(1, Math.floor(rows));
    this.dotWidth = this.cols * 2;
    this.dotHeight = this.rows * 4;
    this.cells = new Uint8Array(this.cols * this.rows);
  }

  /** Set the dot at dot-space (x, y). Out-of-range coordinates are ignored. */
  set(x: number, y: number): void {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.dotWidth || py >= this.dotHeight) return;
    const cx = px >> 1;
    const cy = py >> 2;
    const bit = DOT_BITS[py & 3]?.[px & 1] ?? 0;
    const index = cy * this.cols + cx;
    const current = this.cells[index] ?? 0;
    this.cells[index] = current | bit;
  }

  /** Set every dot along the segment (x0,y0)→(x1,y1) via Bresenham. */
  line(x0: number, y0: number, x1: number, y1: number): void {
    let ax = Math.round(x0);
    let ay = Math.round(y0);
    const bx = Math.round(x1);
    const by = Math.round(y1);
    const dx = Math.abs(bx - ax);
    const dy = -Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1;
    const sy = ay < by ? 1 : -1;
    let err = dx + dy;
    // Bounded by the dot grid perimeter; the guard prevents any pathological loop.
    for (let guard = 0; guard <= this.dotWidth + this.dotHeight + 4; guard += 1) {
      this.set(ax, ay);
      if (ax === bx && ay === by) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        ax += sx;
      }
      if (e2 <= dx) {
        err += dx;
        ay += sy;
      }
    }
  }

  /** Render the canvas as `rows` strings of braille characters (blank cell → space). */
  toRows(): string[] {
    const out: string[] = [];
    for (let cy = 0; cy < this.rows; cy += 1) {
      let line = '';
      for (let cx = 0; cx < this.cols; cx += 1) {
        const mask = this.cells[cy * this.cols + cx] ?? 0;
        line += mask === 0 ? ' ' : String.fromCodePoint(BRAILLE_BASE + mask);
      }
      out.push(line.replace(/\s+$/u, ''));
    }
    return out;
  }
}
