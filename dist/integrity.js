import { createHash } from 'node:crypto';
const OPEN_MARKER = '‹‹‹agentviz';
const CLOSE_MARKER = '‹‹‹/agentviz›››';
const MARKER_END = '›››';
export function computeHash(input) {
    const payload = JSON.stringify({
        version: input.version,
        chart: input.chart,
        spec: sortKeys(input.spec),
        body: input.body,
    });
    return createHash('sha256').update(payload).digest('hex');
}
export function wrapWithIntegrity(body, input) {
    // Strip exactly one trailing newline if present — `renderAgentVizSpec`
    // returns a body without one, but `cli.ts` adds one when writing to
    // stdout. We canonicalize to "no trailing newline inside the block."
    const normalizedBody = body.endsWith('\n') ? body.slice(0, -1) : body;
    const hash = computeHash({
        chart: input.chart,
        spec: input.spec,
        version: input.version,
        body: normalizedBody,
    });
    const specB64 = Buffer.from(JSON.stringify(sortKeys(input.spec)), 'utf8').toString('base64');
    const openLine = `${OPEN_MARKER}/${input.version} chart:${input.chart} sha256:${hash} spec:${specB64}${MARKER_END}`;
    return `${openLine}\n${normalizedBody}\n${CLOSE_MARKER}`;
}
export function verifyIntegrity(text, rerender) {
    const openIdx = text.indexOf(OPEN_MARKER);
    if (openIdx < 0) {
        return { status: 'no-marker', reason: 'no agentviz marker block found' };
    }
    const headerEnd = text.indexOf(MARKER_END, openIdx + OPEN_MARKER.length);
    if (headerEnd < 0) {
        return { status: 'malformed', reason: 'open marker is missing its terminator' };
    }
    const closeIdx = text.indexOf(CLOSE_MARKER, headerEnd);
    if (closeIdx < 0) {
        return { status: 'malformed', reason: 'close marker not found' };
    }
    const header = text.slice(openIdx + OPEN_MARKER.length, headerEnd);
    const bodyRaw = text.slice(headerEnd + MARKER_END.length, closeIdx);
    // Strip exactly the single newline that `wrapWithIntegrity` inserts after
    // the header, and exactly the single newline that precedes the close
    // marker. Do NOT collapse arbitrary trailing newlines — that would let an
    // attacker add/remove blank lines undetected.
    if (!bodyRaw.startsWith('\n')) {
        return { status: 'malformed', reason: 'body does not start with the expected newline after header' };
    }
    if (!bodyRaw.endsWith('\n')) {
        return { status: 'malformed', reason: 'body does not end with the expected newline before close marker' };
    }
    const body = bodyRaw.slice(1, -1);
    const parsed = parseHeader(header);
    if (!parsed.ok) {
        return { status: 'malformed', reason: parsed.reason };
    }
    let spec;
    try {
        const decoded = Buffer.from(parsed.specB64, 'base64').toString('utf8');
        spec = JSON.parse(decoded);
    }
    catch (error) {
        return { status: 'malformed', reason: `spec is not valid base64-encoded JSON: ${error.message}` };
    }
    const expectedHash = computeHash({
        chart: parsed.chart,
        spec,
        version: parsed.version,
        body,
    });
    if (expectedHash !== parsed.hash) {
        return {
            status: 'tampered',
            reason: 'hash mismatch — body, spec, version, chart, or hash has been edited',
            chart: parsed.chart,
            version: parsed.version,
            expectedHash,
            actualHash: parsed.hash,
        };
    }
    // Re-render from the embedded spec and compare byte-exactly to the body.
    // Without this step the marker only proves internal consistency; anyone
    // with `sha256sum` can fabricate a block. Re-rendering proves the body
    // is what agentviz would produce for the embedded spec.
    let rerendered;
    try {
        rerendered = rerender(spec);
    }
    catch (error) {
        return {
            status: 'tampered',
            reason: `embedded spec failed to re-render: ${error.message}`,
            chart: parsed.chart,
            version: parsed.version,
            expectedHash,
            actualHash: parsed.hash,
        };
    }
    const normalizedRerendered = rerendered.endsWith('\n') ? rerendered.slice(0, -1) : rerendered;
    if (normalizedRerendered !== body) {
        return {
            status: 'tampered',
            reason: 're-rendered body from embedded spec does not match block body — chart was hand-edited',
            chart: parsed.chart,
            version: parsed.version,
            expectedHash,
            actualHash: parsed.hash,
        };
    }
    // Surface any content outside the block so operators do not assume the
    // whole input was verified. The block itself verifies OK either way.
    const leadingContentLength = openIdx;
    const trailingContentLength = text.length - (closeIdx + CLOSE_MARKER.length);
    return {
        status: 'ok',
        chart: parsed.chart,
        version: parsed.version,
        expectedHash,
        actualHash: parsed.hash,
        leadingContentLength,
        trailingContentLength,
    };
}
function parseHeader(header) {
    // Header shape: `/<version> chart:<chart> sha256:<hash> spec:<base64>`
    if (!header.startsWith('/')) {
        return { ok: false, reason: 'header must start with /<version>' };
    }
    const tokens = header.slice(1).split(/\s+/).filter((token) => token.length > 0);
    if (tokens.length < 4) {
        return { ok: false, reason: 'header is missing required fields (version chart sha256 spec)' };
    }
    const version = tokens[0];
    let chart;
    let hash;
    let specB64;
    for (let i = 1; i < tokens.length; i += 1) {
        const token = tokens[i];
        if (token.startsWith('chart:')) {
            chart = token.slice('chart:'.length);
        }
        else if (token.startsWith('sha256:')) {
            hash = token.slice('sha256:'.length);
        }
        else if (token.startsWith('spec:')) {
            specB64 = token.slice('spec:'.length);
        }
    }
    if (!chart)
        return { ok: false, reason: 'header missing chart:<kind>' };
    if (!hash)
        return { ok: false, reason: 'header missing sha256:<hex>' };
    if (!specB64)
        return { ok: false, reason: 'header missing spec:<base64>' };
    return { ok: true, version, chart, hash, specB64 };
}
function sortKeys(value) {
    if (Array.isArray(value))
        return value.map((item) => sortKeys(item));
    if (value !== null && typeof value === 'object') {
        const sorted = {};
        for (const key of Object.keys(value).sort()) {
            sorted[key] = sortKeys(value[key]);
        }
        return sorted;
    }
    return value;
}
export const __test__ = { OPEN_MARKER, CLOSE_MARKER, MARKER_END };
