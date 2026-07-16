import { describe, expect, it } from 'vitest';
import {
  cellKey,
  cellSizeM,
  cellToBBox,
  cellsInBBox,
  cellsOnPath,
  haversineM,
  latLngToCell,
  pathDistanceM,
  tileToLatLng,
} from './grid.js';

describe('latLngToCell', () => {
  it('matches known slippy tile for Greenwich at zoom 18', () => {
    // lat 51.4779, lng 0.0015 (Royal Observatory) — verified with standard tile formula
    const c = latLngToCell({ lat: 51.4779, lng: 0.0015 }, 18);
    expect(c).toEqual({ x: 131073, y: 87204 });
  });

  it('maps the origin to the middle tile', () => {
    const c = latLngToCell({ lat: 0, lng: 0 }, 18);
    expect(c).toEqual({ x: 2 ** 17, y: 2 ** 17 });
  });

  it('round-trips: cell bbox contains the original point', () => {
    const p = { lat: 13.0827, lng: 80.2707 }; // Chennai
    const c = latLngToCell(p);
    const b = cellToBBox(c);
    expect(p.lat).toBeGreaterThanOrEqual(b.south);
    expect(p.lat).toBeLessThanOrEqual(b.north);
    expect(p.lng).toBeGreaterThanOrEqual(b.west);
    expect(p.lng).toBeLessThanOrEqual(b.east);
  });

  it('clamps extreme latitudes instead of producing invalid tiles', () => {
    const c = latLngToCell({ lat: 89.9, lng: 0 }, 18);
    expect(c.y).toBeGreaterThanOrEqual(0);
  });
});

describe('tileToLatLng / cellToBBox', () => {
  it('north-west corner of middle tile is the origin', () => {
    const p = tileToLatLng(2 ** 17, 2 ** 17, 18);
    expect(p.lat).toBeCloseTo(0, 6);
    expect(p.lng).toBeCloseTo(0, 6);
  });

  it('bbox is ordered west<east, south<north', () => {
    const b = cellToBBox({ x: 190000, y: 120000 });
    expect(b.west).toBeLessThan(b.east);
    expect(b.south).toBeLessThan(b.north);
  });
});

describe('haversineM / pathDistanceM', () => {
  it('computes ~157km for 1 degree diagonal at equator', () => {
    const d = haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 1 });
    expect(d).toBeGreaterThan(156000);
    expect(d).toBeLessThan(158000);
  });

  it('returns 0 for identical points and sums segments', () => {
    const a = { lat: 13.05, lng: 80.25 };
    expect(haversineM(a, a)).toBe(0);
    const b = { lat: 13.06, lng: 80.25 };
    const c = { lat: 13.07, lng: 80.25 };
    const total = pathDistanceM([a, b, c]);
    expect(total).toBeCloseTo(haversineM(a, b) + haversineM(b, c), 6);
  });
});

describe('cellsOnPath', () => {
  it('single point yields exactly its cell', () => {
    const p = { lat: 13.0827, lng: 80.2707 };
    const cells = cellsOnPath([p]);
    expect(cells).toEqual([latLngToCell(p)]);
  });

  it('includes intermediate cells between sparse GPS fixes', () => {
    // Two points ~5 cells apart horizontally; the straight line must include
    // every column crossed, not just the endpoints.
    const zoom = 18;
    const a = { lat: 13.05, lng: 80.25 };
    const cellA = latLngToCell(a, zoom);
    const bMid = { lat: (cellToBBox({ x: cellA.x + 5, y: cellA.y }, zoom).south + cellToBBox({ x: cellA.x + 5, y: cellA.y }, zoom).north) / 2, lng: (cellToBBox({ x: cellA.x + 5, y: cellA.y }, zoom).west + cellToBBox({ x: cellA.x + 5, y: cellA.y }, zoom).east) / 2 };
    const cells = cellsOnPath([a, bMid], zoom);
    const keys = new Set(cells.map(cellKey));
    for (let dx = 0; dx <= 5; dx++) {
      expect(keys.has(`${cellA.x + dx}:${cellA.y}`)).toBe(true);
    }
  });

  it('deduplicates cells visited twice (out-and-back run)', () => {
    const a = { lat: 13.05, lng: 80.25 };
    const b = { lat: 13.055, lng: 80.255 };
    const once = cellsOnPath([a, b]);
    const outAndBack = cellsOnPath([a, b, a]);
    expect(outAndBack.length).toBe(once.length);
  });

  it('returns empty for empty path', () => {
    expect(cellsOnPath([])).toEqual([]);
  });
});

describe('cellsInBBox', () => {
  it('covers the viewport and respects the cap', () => {
    const b = { west: 80.25, south: 13.05, east: 80.26, north: 13.06 };
    const cells = cellsInBBox(b);
    expect(cells.length).toBeGreaterThan(0);
    const capped = cellsInBBox({ west: 60, south: 0, east: 90, north: 30 }, 18, 100);
    expect(capped.length).toBe(100);
  });
});

describe('cellSizeM', () => {
  it('is ~150m at zoom 18 near the equator', () => {
    const s = cellSizeM(0, 18);
    expect(s).toBeGreaterThan(140);
    expect(s).toBeLessThan(160);
  });
});
