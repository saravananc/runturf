import { useCallback } from 'react';
// Type-only: keeps the 780 kB maplibre bundle out of this module's import graph,
// so it loads when a map actually mounts rather than on first paint.
import type maplibregl from 'maplibre-gl';
import { get } from '../api/client';
import { useAuth } from '../auth/AuthContext';

/**
 * Attaches the territory overlay to a MapLibre map: cells in the viewport are
 * fetched as GeoJSON and rendered as translucent fills in each owner's color.
 * Refreshes on pan/zoom (debounced via moveend).
 */
export function useTerritoryOverlay() {
  const { user } = useAuth();

  const attach = useCallback(
    (map: maplibregl.Map) => {
      map.addSource('territory', { type: 'geojson', data: emptyFC() });
      map.addLayer({
        id: 'territory-fill',
        type: 'fill',
        source: 'territory',
        paint: {
          'fill-color': ['get', 'color'],
          // Base opacity by ownership, faded by freshness so aging turf visibly
          // dims toward the decay cutoff (floored at 40% so it stays legible).
          'fill-opacity': [
            '*',
            ['case', ['==', ['get', 'ownerId'], user?.id ?? ''], 0.45, 0.25],
            ['+', 0.4, ['*', 0.6, ['coalesce', ['get', 'freshness'], 1]]],
          ],
        },
      });
      map.addLayer({
        id: 'territory-line',
        type: 'line',
        source: 'territory',
        paint: { 'line-color': ['get', 'color'], 'line-width': 1, 'line-opacity': 0.6 },
      });

      let cancelled = false;
      async function refresh() {
        const b = map.getBounds();
        try {
          const fc = await get<GeoJSON.FeatureCollection>(
            `/territory?west=${b.getWest()}&south=${b.getSouth()}&east=${b.getEast()}&north=${b.getNorth()}`,
          );
          if (cancelled) return;
          (map.getSource('territory') as maplibregl.GeoJSONSource | undefined)?.setData(fc);
        } catch {
          /* viewport too large or transient error — skip this refresh */
        }
      }
      refresh();
      map.on('moveend', refresh);
      return () => {
        cancelled = true;
        map.off('moveend', refresh);
      };
    },
    [user?.id],
  );

  return { attach };
}

function emptyFC(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}
