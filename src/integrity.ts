import { createHash } from 'node:crypto';

// Tamper-evident marker block for rendered charts output. The agent cannot
// produce a valid block without actually running charts, because verify
// (a) recomputes the sha256 hash from the embedded spec + version + chart +
// body and rejects mismatches, AND (b) re-renders the body from the embedded
// spec and rejects any difference. Without a server-side signing key, this
// is the strongest available guarantee: the body inside the block is the
// byte-exact output charts would produce for the embedded spec.

export interface IntegrityWrapInput {
  chart: string;
  version: string;
  // Full original spec for this chart. Stored verbatim inside the marker so
  // verify can independently re-render and compare to the body.
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

// Renderer callback type. CLI injects the real renderer; tests can inject a
// stub. The callback must produce the body exactly as it appeared inside
// the marker block (no trailing newline). The single wrapper newline added
// by `wrapWithIntegrity` is the only normalization performed at verify time.
//
// Required, not optional: hashes alone do not defend against forgery,
// because an attacker who edits the body can recompute the sha256 with any
// hashing tool and replace it in the block. The re-render check (the body
// inside the block must match what charts would produce for the embedded
// spec) is what closes the forgery hole. The library does not bundle a
// default renderer because doing so would force a circular dependency
// between this module and `cli.ts`; consumers (including the bundled CLI
// at `charts verify`) must pass one explicitly.
export type RendererCallback = (spec: unknown) => string;

const OPEN_MARKER = '‹‹‹charts';
const CLOSE_MARKER = '‹‹‹/charts›››';
const MARKER_END = '›››';

export function computeHash(input: {
  chart: string;
  spec: unknown;
  version: string;
  body: string;
}): string {
  const payload = JSON.stringify({
    version: input.version,
    chart: input.chart,
    spec: sortKeys(input.spec),
    body: input.body,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function wrapWithIntegrity(body: string, input: IntegrityWrapInput): string {
  // Strip exactly one trailing newline if present — `renderChartsSpec`
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

export function verifyIntegrity(text: string, rerender: RendererCallback): VerifyResult {
  const openIdx = text.indexOf(OPEN_MARKER);
  if (openIdx < 0) {
    return { status: 'no-marker', reason: 'no charts marker block found' };
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

  let spec: unknown;
  try {
    const decoded = Buffer.from(parsed.specB64, 'base64').toString('utf8');
    spec = JSON.parse(decoded);
  } catch (error) {
    return { status: 'malformed', reason: `spec is not valid base64-encoded JSON: ${(error as Error).message}` };
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
  // is what charts would produce for the embedded spec.
  let rerendered: string;
  try {
    rerendered = rerender(spec);
  } catch (error) {
    return {
      status: 'tampered',
      reason: `embedded spec failed to re-render: ${(error as Error).message}`,
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

interface ParsedHeader {
  ok: true;
  version: string;
  chart: string;
  hash: string;
  specB64: string;
}
interface ParsedHeaderError {
  ok: false;
  reason: string;
}

function parseHeader(header: string): ParsedHeader | ParsedHeaderError {
  // Header shape: `/<version> chart:<chart> sha256:<hash> spec:<base64>`
  if (!header.startsWith('/')) {
    return { ok: false, reason: 'header must start with /<version>' };
  }
  const tokens = header.slice(1).split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length < 4) {
    return { ok: false, reason: 'header is missing required fields (version chart sha256 spec)' };
  }
  const version = tokens[0];
  let chart: string | undefined;
  let hash: string | undefined;
  let specB64: string | undefined;
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.startsWith('chart:')) {
      chart = token.slice('chart:'.length);
    } else if (token.startsWith('sha256:')) {
      hash = token.slice('sha256:'.length);
    } else if (token.startsWith('spec:')) {
      specB64 = token.slice('spec:'.length);
    }
  }
  if (!chart) return { ok: false, reason: 'header missing chart:<kind>' };
  if (!hash) return { ok: false, reason: 'header missing sha256:<hex>' };
  if (!specB64) return { ok: false, reason: 'header missing spec:<base64>' };
  return { ok: true, version, chart, hash, specB64 };
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortKeys(item));
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export const __test__ = { OPEN_MARKER, CLOSE_MARKER, MARKER_END };
