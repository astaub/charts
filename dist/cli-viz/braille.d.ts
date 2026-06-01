export declare class BrailleCanvas {
    readonly cols: number;
    readonly rows: number;
    /** Dot-space dimensions: width = 2·cols, height = 4·rows. */
    readonly dotWidth: number;
    readonly dotHeight: number;
    private readonly cells;
    constructor(cols: number, rows: number);
    /** Set the dot at dot-space (x, y). Out-of-range coordinates are ignored. */
    set(x: number, y: number): void;
    /** Set every dot along the segment (x0,y0)→(x1,y1) via Bresenham. */
    line(x0: number, y0: number, x1: number, y1: number): void;
    /** Render the canvas as `rows` strings of braille characters (blank cell → space). */
    toRows(): string[];
}
