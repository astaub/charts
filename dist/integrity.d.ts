export interface IntegrityWrapInput {
    chart: string;
    version: string;
    spec: unknown;
}
export interface VerifyResult {
    status: 'ok' | 'tampered' | 'no-marker' | 'malformed';
    reason?: string;
    chart?: string;
    version?: string;
    expectedHash?: string;
    actualHash?: string;
    trailingContentLength?: number;
    leadingContentLength?: number;
}
export type RendererCallback = (spec: unknown) => string;
export declare function computeHash(input: {
    chart: string;
    spec: unknown;
    version: string;
    body: string;
}): string;
export declare function wrapWithIntegrity(body: string, input: IntegrityWrapInput): string;
export declare function verifyIntegrity(text: string, rerender: RendererCallback): VerifyResult;
export declare const __test__: {
    OPEN_MARKER: string;
    CLOSE_MARKER: string;
    MARKER_END: string;
};
