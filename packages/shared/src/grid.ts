/**
 * Territory grid math built on Web-Mercator slippy tiles.
 * A territory cell is the tile (x, y) at TERRITORY_ZOOM.
 */

export const TERRITORY_ZOOM = 18;

/**
 * Territory decays: a captured cell you don't revisit within this many days
 * reverts to neutral. Running through your own cell refreshes it, so active turf
 * never fades — which is what makes "defend your turf" a real mechanic.
 */
export const TERRITORY_DECAY_DAYS = 14;

/**
 * Steal protection: a cell captured within this many minutes cannot be stolen by
 * another runner. Fresh turf gets a grace period, so a capture isn't instantly
 * undone by whoever runs the same street next.
 */
export const CAPTURE_PROTECTION_MINUTES = 30;

export interface Cell {
  x: number;
  y: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TrackPoint extends LatLng {
  /** ms since epoch */
  t: number;
  /** GPS accuracy in meters, if known */
  acc?: number;
}

const EARTH_RADIUS_M = 6371008.8;
const MAX_LAT = 85.05112878; // Web-Mercator clamp

function clampLat(lat: number): number {
  return Math.min(MAX_LAT, Math.max(-MAX_LAT, lat));
}

/** Slippy-tile coordinates (fractional) for a lat/lng at a zoom level. */
export function latLngToTileFloat(p: LatLng, zoom: number = TERRITORY_ZOOM): { x: number; y: number } {
  const n = 2 ** zoom;
  const latRad = (clampLat(p.lat) * Math.PI) / 180;
  const x = ((p.lng + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

/** The territory cell containing a point. */
export function latLngToCell(p: LatLng, zoom: number = TERRITORY_ZOOM): Cell {
  const { x, y } = latLngToTileFloat(p, zoom);
  const n = 2 ** zoom;
  return {
    x: Math.min(n - 1, Math.max(0, Math.floor(x))),
    y: Math.min(n - 1, Math.max(0, Math.floor(y))),
  };
}

/** North-west corner of a tile. */
export function tileToLatLng(x: number, y: number, zoom: number = TERRITORY_ZOOM): LatLng {
  const n = 2 ** zoom;
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return { lat: (latRad * 180) / Math.PI, lng };
}

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Geographic bounding box of a cell. */
export function cellToBBox(cell: Cell, zoom: number = TERRITORY_ZOOM): BBox {
  const nw = tileToLatLng(cell.x, cell.y, zoom);
  const se = tileToLatLng(cell.x + 1, cell.y + 1, zoom);
  return { west: nw.lng, south: se.lat, east: se.lng, north: nw.lat };
}

/** GeoJSON Polygon ring for a cell (closed, counter-clockwise). */
export function cellToPolygon(cell: Cell, zoom: number = TERRITORY_ZOOM): number[][] {
  const b = cellToBBox(cell, zoom);
  return [
    [b.west, b.south],
    [b.east, b.south],
    [b.east, b.north],
    [b.west, b.north],
    [b.west, b.south],
  ];
}

/** Cells intersecting a bbox (viewport queries). Capped to protect the server. */
export function cellsInBBox(bbox: BBox, zoom: number = TERRITORY_ZOOM, cap = 20000): Cell[] {
  const min = latLngToCell({ lat: bbox.north, lng: bbox.west }, zoom);
  const max = latLngToCell({ lat: bbox.south, lng: bbox.east }, zoom);
  const cells: Cell[] = [];
  for (let x = min.x; x <= max.x; x++) {
    for (let y = min.y; y <= max.y; y++) {
      cells.push({ x, y });
      if (cells.length >= cap) return cells;
    }
  }
  return cells;
}

export function cellKey(c: Cell): string {
  return `${c.x}:${c.y}`;
}

/** Haversine distance in meters. */
export function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total path distance in meters. */
export function pathDistanceM(points: LatLng[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversineM(points[i - 1], points[i]);
  return d;
}

/**
 * All cells a path passes through, in first-visit order.
 * Walks each segment in tile space using a DDA-style traversal so cells
 * crossed between GPS fixes are included even when fixes are sparse.
 */
export function cellsOnPath(points: LatLng[], zoom: number = TERRITORY_ZOOM): Cell[] {
  const seen = new Set<string>();
  const out: Cell[] = [];
  const push = (c: Cell) => {
    const k = cellKey(c);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  };

  if (points.length === 0) return out;
  push(latLngToCell(points[0], zoom));

  for (let i = 1; i < points.length; i++) {
    const a = latLngToTileFloat(points[i - 1], zoom);
    const b = latLngToTileFloat(points[i], zoom);
    // Sample the segment finely enough to never skip a cell: step < half a tile.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 2));
    for (let s = 1; s <= steps; s++) {
      const fx = a.x + ((b.x - a.x) * s) / steps;
      const fy = a.y + ((b.y - a.y) * s) / steps;
      const n = 2 ** zoom;
      push({
        x: Math.min(n - 1, Math.max(0, Math.floor(fx))),
        y: Math.min(n - 1, Math.max(0, Math.floor(fy))),
      });
    }
  }
  return out;
}

/** Approximate cell edge length in meters at a latitude. */
export function cellSizeM(lat: number, zoom: number = TERRITORY_ZOOM): number {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}
