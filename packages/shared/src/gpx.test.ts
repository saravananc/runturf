import { describe, expect, it } from 'vitest';
import { GpxParseError, parseGpx } from './gpx.js';

/** Mirrors the shape the API's own GPX export produces. */
function exportedGpx(points: { lat: number; lng: number; t: number }[]): string {
  const trkpts = points
    .map(
      (p) =>
        `      <trkpt lat="${p.lat}" lon="${p.lng}"><time>${new Date(p.t).toISOString()}</time></trkpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunTurf" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>RunTurf run</name><trkseg>
${trkpts}
  </trkseg></trk>
</gpx>`;
}

const T0 = Date.parse('2026-07-20T06:00:00.000Z');

describe('parseGpx', () => {
  it('round-trips our own GPX export', () => {
    const original = [
      { lat: 13.05, lng: 80.25, t: T0 },
      { lat: 13.051, lng: 80.2505, t: T0 + 10_000 },
      { lat: 13.052, lng: 80.251, t: T0 + 20_000 },
    ];
    const parsed = parseGpx(exportedGpx(original));
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ lat: 13.05, lng: 80.25, t: T0 });
    expect(parsed[2].t).toBe(T0 + 20_000);
  });

  it('handles multi-line trkpt bodies with extra elements', () => {
    const xml = `<gpx version="1.1"><trk><trkseg>
      <trkpt lat="51.5" lon="-0.12">
        <ele>15.2</ele>
        <time>2026-07-20T06:00:00Z</time>
        <extensions><hr>142</hr></extensions>
      </trkpt>
      <trkpt lat="51.501" lon="-0.121">
        <ele>15.8</ele>
        <time>2026-07-20T06:00:05Z</time>
      </trkpt>
    </trkseg></trk></gpx>`;
    const parsed = parseGpx(xml);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].lat).toBeCloseTo(51.5, 5);
    expect(parsed[1].lng).toBeCloseTo(-0.121, 5);
  });

  it('accepts attributes in either order and single quotes', () => {
    const xml = `<gpx><trkseg>
      <trkpt lon='9.1' lat='45.4'><time>2026-07-20T06:00:00Z</time></trkpt>
      <trkpt lat="45.401" lon="9.101"><time>2026-07-20T06:00:03Z</time></trkpt>
    </trkseg></gpx>`;
    const parsed = parseGpx(xml);
    expect(parsed[0]).toMatchObject({ lat: 45.4, lng: 9.1 });
    expect(parsed).toHaveLength(2);
  });

  it('sorts out-of-order points so timestamps are non-decreasing', () => {
    const xml = exportedGpx([
      { lat: 1, lng: 1, t: T0 + 20_000 },
      { lat: 1.001, lng: 1, t: T0 },
      { lat: 1.002, lng: 1, t: T0 + 10_000 },
    ]);
    const parsed = parseGpx(xml);
    expect(parsed.map((p) => p.t)).toEqual([T0, T0 + 10_000, T0 + 20_000]);
  });

  it('skips points with invalid coordinates', () => {
    const xml = `<gpx><trkseg>
      <trkpt lat="999" lon="0"><time>2026-07-20T06:00:00Z</time></trkpt>
      <trkpt lat="10" lon="10"><time>2026-07-20T06:00:01Z</time></trkpt>
      <trkpt lat="10.001" lon="10"><time>2026-07-20T06:00:05Z</time></trkpt>
    </trkseg></gpx>`;
    expect(parseGpx(xml)).toHaveLength(2);
  });

  it('rejects a non-GPX document', () => {
    expect(() => parseGpx('<html><body>nope</body></html>')).toThrow(GpxParseError);
    expect(() => parseGpx('')).toThrow(GpxParseError);
  });

  it('rejects a GPX with no track points', () => {
    expect(() => parseGpx('<gpx version="1.1"><wpt lat="1" lon="1"/></gpx>')).toThrow(
      /No track points/,
    );
  });

  it('explains when timestamps are missing', () => {
    const xml = `<gpx><trkseg>
      <trkpt lat="1" lon="1"/>
      <trkpt lat="1.001" lon="1"/>
    </trkseg></gpx>`;
    expect(() => parseGpx(xml)).toThrow(/no timestamps/i);
  });

  it('rejects a single-point track', () => {
    const xml = exportedGpx([{ lat: 1, lng: 1, t: T0 }]);
    expect(() => parseGpx(xml)).toThrow(/at least two/i);
  });
});
