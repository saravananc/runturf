import type { RunPointInput } from './types.js';

/**
 * Minimal GPX 1.1 track parser.
 *
 * Deliberately regex-based rather than a full XML parser: we only need
 * `<trkpt lat lon>` and its `<time>`, and this keeps the shared package
 * dependency-free (it is consumed by the API, the web app and React Native).
 * Anything it cannot understand raises a clear error rather than guessing.
 */

export class GpxParseError extends Error {}

const TRKPT_RE = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>|<trkpt\b([^>]*)\/>/gi;
const LAT_RE = /\blat\s*=\s*["']([^"']+)["']/i;
const LON_RE = /\blon\s*=\s*["']([^"']+)["']/i;
const TIME_RE = /<time>\s*([^<\s]+)\s*<\/time>/i;

/** Upper bound so a hostile or huge file cannot exhaust memory. */
const MAX_POINTS = 100_000;

/**
 * Extracts timestamped track points from a GPX document, in file order.
 * Throws GpxParseError when the file has no track points or lacks the
 * timestamps we need to compute duration and pace.
 */
export function parseGpx(xml: string): RunPointInput[] {
  if (!xml || !/<gpx\b/i.test(xml)) {
    throw new GpxParseError('That does not look like a GPX file');
  }

  const points: RunPointInput[] = [];
  let missingTime = 0;

  TRKPT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TRKPT_RE.exec(xml)) !== null) {
    // Group 1/2 = paired tag with body; group 3 = self-closing (no time).
    const attrs = match[1] ?? match[3] ?? '';
    const body = match[2] ?? '';

    const lat = Number(attrs.match(LAT_RE)?.[1]);
    const lon = Number(attrs.match(LON_RE)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;

    const timeText = body.match(TIME_RE)?.[1];
    if (!timeText) {
      missingTime++;
      continue;
    }
    const t = Date.parse(timeText);
    if (!Number.isFinite(t)) {
      missingTime++;
      continue;
    }

    points.push({ lat, lng: lon, t });
    if (points.length > MAX_POINTS) {
      throw new GpxParseError('That GPX file has too many track points');
    }
  }

  if (points.length === 0) {
    throw new GpxParseError(
      missingTime > 0
        ? 'This GPX has no timestamps, so pace and duration cannot be computed'
        : 'No track points found in that GPX file',
    );
  }
  if (points.length < 2) {
    throw new GpxParseError('A run needs at least two track points');
  }

  // Devices occasionally emit points out of order; the run pipeline requires
  // non-decreasing timestamps.
  points.sort((a, b) => a.t - b.t);
  return points;
}
