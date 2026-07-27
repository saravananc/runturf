import { TERRITORY_DECAY_DAYS } from '@runturf/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Polygon, UrlTile, type Region } from 'react-native-maps';
import { useAuth } from '../AuthContext';
import { get } from '../api';
import { colors, font, radius, space, type } from '../theme';

export interface CellFeature {
  id: string;
  coords: { latitude: number; longitude: number }[];
  color: string;
  mine: boolean;
  /** 1 = just captured, → 0 near the decay cutoff. */
  freshness: number;
}

interface TerritoryFC {
  features: {
    properties: { x: number; y: number; color: string; ownerId: string; freshness?: number };
    geometry: { coordinates: number[][][] };
  }[];
}

/** Two-digit hex alpha, faded by freshness (floored so aging turf stays visible). */
function fillAlpha(base: number, freshness: number): string {
  const a = base * (0.4 + 0.6 * Math.max(0, Math.min(1, freshness)));
  return Math.round(a * 255)
    .toString(16)
    .padStart(2, '0');
}

/** Fetches territory for a viewport and maps it to polygons. */
export function useTerritory(userId: string | undefined) {
  const [cells, setCells] = useState<CellFeature[]>([]);
  const inFlight = useRef(false);

  const load = useCallback(
    async (r: Region) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const west = r.longitude - r.longitudeDelta / 2;
        const east = r.longitude + r.longitudeDelta / 2;
        const south = r.latitude - r.latitudeDelta / 2;
        const north = r.latitude + r.latitudeDelta / 2;
        const fc = await get<TerritoryFC>(
          `/territory?west=${west}&south=${south}&east=${east}&north=${north}`,
        );
        setCells(
          fc.features.map((f) => ({
            id: `${f.properties.x}:${f.properties.y}`,
            color: f.properties.color,
            mine: f.properties.ownerId === userId,
            freshness: f.properties.freshness ?? 1,
            coords: f.geometry.coordinates[0].map(([lng, lat]) => ({
              latitude: lat,
              longitude: lng,
            })),
          })),
        );
      } catch {
        // Transient failure: keep the last overlay rather than blanking the map.
      } finally {
        inFlight.current = false;
      }
    },
    [userId],
  );

  return { cells, load };
}

export function TerritoryPolygons({ cells }: { cells: CellFeature[] }) {
  return (
    <>
      {cells.map((c) => (
        <Polygon
          key={c.id}
          coordinates={c.coords}
          fillColor={`${c.color}${fillAlpha(c.mine ? 0.45 : 0.25, c.freshness)}`}
          strokeColor={c.color}
          strokeWidth={1}
        />
      ))}
    </>
  );
}

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export function MapScreen() {
  const { user } = useAuth();
  const { cells, load } = useTerritory(user?.id);
  const [region, setRegion] = useState<Region | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Fall back to a sensible default so the map still renders.
        setRegion({ latitude: 13.0475, longitude: 80.2824, latitudeDelta: 0.02, longitudeDelta: 0.02 });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();
  }, []);

  useEffect(() => {
    if (region) load(region);
  }, [region, load]);

  return (
    <View style={s.flex}>
      {region ? (
        <MapView
          style={s.flex}
          initialRegion={region}
          onRegionChangeComplete={(r) => {
            setRegion(r);
            load(r);
          }}
          showsUserLocation
        >
          <UrlTile urlTemplate={OSM_TILE_URL} maximumZ={19} />
          <TerritoryPolygons cells={cells} />
        </MapView>
      ) : (
        <View style={s.center}>
          <Text style={s.waiting}>Waiting for location…</Text>
        </View>
      )}

      <View style={s.banner} pointerEvents="none">
        <Text style={s.bannerTitle}>Territory map</Text>
        <Text style={s.bannerHint}>Run through a cell to claim it</Text>
        <Text style={s.bannerNote}>Turf fades after {TERRITORY_DECAY_DAYS} days — run it to defend it</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.base },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  waiting: { fontFamily: font.regular, fontSize: type.small, color: colors.ink2 },
  banner: {
    position: 'absolute',
    top: space(3),
    left: space(3),
    backgroundColor: colors.glass,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space(3.5),
    paddingVertical: space(2.5),
  },
  bannerTitle: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  bannerHint: { fontFamily: font.regular, fontSize: type.caption, color: colors.ink2 },
  bannerNote: { fontFamily: font.regular, fontSize: type.caption, color: colors.ink3 },
});
