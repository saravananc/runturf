import type maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';

export const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  onMap?: (map: maplibregl.Map) => void | (() => void);
  className?: string;
}

/**
 * Thin MapLibre wrapper: mounts a map, hands the instance to `onMap`.
 *
 * MapLibre (~780 kB) is imported dynamically rather than at module scope, so the
 * app shell paints before the map engine has downloaded. (Its stylesheet stays in
 * styles.css — it is small and shared.)
 */
export function MapView({ center = [80.2824, 13.0475], zoom = 15, onMap, className }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onMapRef = useRef(onMap);
  onMapRef.current = onMap;

  useEffect(() => {
    let map: maplibregl.Map | undefined;
    let cleanup: void | (() => void);
    // The component can unmount while the chunk is still in flight.
    let cancelled = false;

    (async () => {
      const { default: maplibre } = await import('maplibre-gl');
      if (cancelled || !containerRef.current) return;

      map = new maplibre.Map({
        container: containerRef.current,
        style: OSM_STYLE,
        center,
        zoom,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      map.on('load', () => {
        cleanup = onMapRef.current?.(map!);
      });
    })();

    return () => {
      cancelled = true;
      cleanup?.();
      map?.remove();
    };
    // center/zoom are initial values only; the map manages its own camera after mount
  }, []);

  return <div ref={containerRef} className={className ?? 'h-full w-full'} />;
}
