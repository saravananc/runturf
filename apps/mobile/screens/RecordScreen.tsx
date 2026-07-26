import type { RunReport } from '@runturf/shared';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert, Animated, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline, UrlTile, type Region } from 'react-native-maps';
import { useAuth } from '../AuthContext';
import { track } from '../analytics';
import { post } from '../api';
import { Btn, Label } from '../components/ui';
import { formatDistance, formatDuration, formatPace } from '../format';
import { colors, font, radius, space, type } from '../theme';
import { useRecorder } from '../useRecorder';
import { OSM_TILE_URL, TerritoryPolygons, useTerritory } from './MapScreen';
import { RunReportModal } from '../components/RunReportModal';

export function RecordScreen() {
  const { user } = useAuth();
  const rec = useRecorder();
  const { cells, load } = useTerritory(user?.id);
  const [region, setRegion] = useState<Region | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const last = rec.points[rec.points.length - 1];

  // Follow the runner while recording.
  useEffect(() => {
    if (last) {
      setRegion((r) =>
        r ? { ...r, latitude: last.lat, longitude: last.lng } : r,
      );
    }
  }, [last]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      const r = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      };
      setRegion(r);
      load(r);
    })();
  }, [load]);

  async function onStart() {
    const ok = await rec.start();
    if (!ok) {
      Alert.alert('Location required', 'RunTurf needs location access to record runs.');
    }
  }

  async function onFinish() {
    const { pausedMs } = rec.finish();
    if (rec.points.length < 2 || !rec.startedAt) {
      rec.reset();
      Alert.alert('Run too short', 'We need at least two GPS points to save a run.');
      return;
    }
    setSubmitting(true);
    try {
      const rep = await post<RunReport>('/runs', {
        startedAt: rec.startedAt.toISOString(),
        points: rec.points,
        pausedMs,
      });
      setReport(rep);
      track('run_submitted', {
        distanceM: rep.run.distanceM,
        cellsCaptured: rep.run.cellsCaptured,
        cellsStolen: rep.run.cellsStolen,
      });
      if (region) load(region);
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  const livePace =
    rec.distanceM >= 50 && rec.elapsedS > 0 ? rec.elapsedS / (rec.distanceM / 1000) : null;
  const active = rec.status === 'recording' || rec.status === 'paused';
  const route = rec.points.map((p) => ({ latitude: p.lat, longitude: p.lng }));

  return (
    <View style={s.flex}>
      {region ? (
        <MapView style={s.flex} region={region} showsUserLocation>
          <UrlTile urlTemplate={OSM_TILE_URL} maximumZ={19} />
          <TerritoryPolygons cells={cells} />
          {route.length > 1 && (
            <>
              <Polyline coordinates={route} strokeColor="rgba(173,235,46,0.25)" strokeWidth={10} />
              <Polyline coordinates={route} strokeColor={colors.volt} strokeWidth={4} />
            </>
          )}
        </MapView>
      ) : (
        <View style={s.center}>
          <Text style={s.waiting}>Waiting for location…</Text>
        </View>
      )}

      <View style={s.hud}>
        <View style={s.hudRow}>
          <HudStat label="Distance" value={formatDistance(rec.distanceM)} primary />
          <View style={s.divider} />
          <HudStat label="Time" value={formatDuration(rec.elapsedS)} />
          <View style={s.divider} />
          <HudStat label="Pace" value={`${formatPace(livePace)}/km`} />
        </View>
        {active && <StatusPill paused={rec.status === 'paused'} />}
      </View>

      <View style={s.controls}>
        {!active ? (
          <Btn label="▶  Start run" onPress={onStart} style={s.bigBtn} />
        ) : (
          <View style={s.controlRow}>
            {rec.status === 'recording' ? (
              <Btn label="⏸  Pause" variant="ghost" onPress={rec.pause} style={s.bigBtn} />
            ) : (
              <Btn label="▶  Resume" onPress={rec.resume} style={s.bigBtn} />
            )}
            <Btn
              label={submitting ? 'Saving…' : '⏹  Finish'}
              variant="danger"
              disabled={submitting}
              onPress={onFinish}
              style={s.bigBtn}
            />
          </View>
        )}
      </View>

      {report && (
        <RunReportModal
          report={report}
          onClose={() => {
            setReport(null);
            rec.reset();
          }}
        />
      )}
    </View>
  );
}

function HudStat({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Label>{label}</Label>
      <Text style={[s.hudValue, primary && { color: colors.volt, fontSize: 21 }]}>{value}</Text>
    </View>
  );
}

function StatusPill({ paused }: { paused: boolean }) {
  const pulse = useState(() => new Animated.Value(1))[0];
  useEffect(() => {
    if (paused) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [paused, pulse]);

  return (
    <View style={s.statusRow}>
      <Animated.View
        style={[s.dot, { opacity: pulse, backgroundColor: paused ? colors.gold : colors.ember }]}
      />
      <Label>{paused ? 'Paused' : 'Recording'}</Label>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.base },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  waiting: { fontFamily: font.regular, fontSize: type.small, color: colors.ink2 },
  hud: {
    position: 'absolute',
    top: space(3),
    alignSelf: 'center',
    backgroundColor: colors.glass,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space(5),
    paddingVertical: space(3),
  },
  hudRow: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
  divider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.10)' },
  hudValue: {
    fontFamily: font.extrabold,
    fontSize: 18,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(1.5),
    marginTop: space(1.5),
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  controls: { position: 'absolute', bottom: space(6), alignSelf: 'center', alignItems: 'center' },
  controlRow: { flexDirection: 'row', gap: space(2.5) },
  bigBtn: { borderRadius: radius.pill, paddingHorizontal: space(7), paddingVertical: space(4) },
});
