import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import MapView, { Polygon, Polyline, UrlTile, type Region } from 'react-native-maps';
import { colors, font, radius, space, type } from './theme';

/**
 * RunTurf mobile — Night Turf design system.
 * Set EXPO_PUBLIC_API_URL to your machine's LAN address on a physical device,
 * e.g. EXPO_PUBLIC_API_URL=http://192.168.1.20:4000
 * (10.0.2.2 reaches the host from the Android emulator.)
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';

interface Point {
  lat: number;
  lng: number;
  t: number;
  acc?: number;
}

interface CellFeature {
  id: string;
  coords: { latitude: number; longitude: number }[];
  color: string;
  mine: boolean;
}

interface RunReport {
  run: {
    distanceM: number;
    durationS: number;
    avgPaceSPerKm: number | null;
    cellsCaptured: number;
    cellsStolen: number;
  };
  xpGained: number;
  coinsGained: number;
  newAchievements: { code: string; title: string; description: string; icon: string }[];
  personalBests: string[];
  stats: { level: number; streakDays: number };
}

function haversineM(a: Point, b: Point): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const fmtDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
const fmtDuration = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};
const fmtPace = (sPerKm: number | null) => {
  if (!sPerKm || !Number.isFinite(sPerKm)) return '–';
  return `${Math.floor(sPerKm / 60)}:${String(Math.round(sPerKm % 60)).padStart(2, '0')}`;
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');

  if (!fontsLoaded) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {token ? (
        <MainScreen token={token} userId={userId} onLogout={() => setToken(null)} />
      ) : (
        <LoginScreen
          onAuth={(t, uid) => {
            setToken(t);
            setUserId(uid);
          }}
        />
      )}
    </View>
  );
}

/* ---------- shared controls ---------- */

function Btn({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const base =
    variant === 'primary'
      ? styles.btnPrimary
      : variant === 'danger'
        ? styles.btnDanger
        : styles.btnGhost;
  const textStyle =
    variant === 'primary'
      ? styles.btnPrimaryText
      : variant === 'danger'
        ? styles.btnDangerText
        : styles.btnGhostText;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        base,
        style,
        pressed && { transform: [{ scale: 0.96 }] },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[styles.btnText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.ink3}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[styles.input, focused && { borderColor: colors.volt }, props.style]}
    />
  );
}

/* ---------- login ---------- */

function LoginScreen({ onAuth }: { onAuth: (token: string, userId: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(path: 'login' | 'register') {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Request failed');
      onAuth(body.accessToken, body.user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.login}>
      <View style={styles.mark}>
        <Text style={styles.markGlyph}>⚡</Text>
      </View>
      <Text style={styles.title}>RunTurf</Text>
      <Text style={styles.subtitle}>Run. Capture territory. Defend your turf.</Text>
      <View style={{ height: space(6) }} />
      <Input
        placeholder="Username"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Btn label={busy ? 'One sec…' : 'Sign in'} disabled={busy} onPress={() => submit('login')} />
      <Pressable disabled={busy} onPress={() => submit('register')}>
        <Text style={styles.linkText}>Create account</Text>
      </Pressable>
    </View>
  );
}

/* ---------- main ---------- */

function MainScreen({
  token,
  userId,
  onLogout,
}: {
  token: string;
  userId: string;
  onLogout: () => void;
}) {
  const [region, setRegion] = useState<Region | null>(null);
  const [cells, setCells] = useState<CellFeature[]>([]);
  const [recording, setRecording] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [distanceM, setDistanceM] = useState(0);
  const [elapsedS, setElapsedS] = useState(0);
  const [report, setReport] = useState<RunReport | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const startedAtRef = useRef<Date | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location required', 'RunTurf needs location access to record runs.');
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
    return () => watchRef.current?.remove();
  }, []);

  async function loadTerritory(r: Region) {
    try {
      const west = r.longitude - r.longitudeDelta / 2;
      const east = r.longitude + r.longitudeDelta / 2;
      const south = r.latitude - r.latitudeDelta / 2;
      const north = r.latitude + r.latitudeDelta / 2;
      const res = await fetch(
        `${API_URL}/territory?west=${west}&south=${south}&east=${east}&north=${north}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const fc = await res.json();
      setCells(
        fc.features.map(
          (f: {
            properties: { x: number; y: number; color: string; ownerId: string };
            geometry: { coordinates: number[][][] };
          }) => ({
            id: `${f.properties.x}:${f.properties.y}`,
            color: f.properties.color,
            mine: f.properties.ownerId === userId,
            coords: f.geometry.coordinates[0].map(([lng, lat]) => ({
              latitude: lat,
              longitude: lng,
            })),
          }),
        ),
      );
    } catch {
      // transient network failure — keep last overlay
    }
  }

  async function startRun() {
    setPoints([]);
    setDistanceM(0);
    setElapsedS(0);
    startedAtRef.current = new Date();
    setRecording(true);
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
      (pos) => {
        const p: Point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: pos.timestamp,
          acc: pos.coords.accuracy ?? undefined,
        };
        setPoints((prev) => {
          const next = [...prev, p];
          if (prev.length > 0) {
            setDistanceM((d) => d + haversineM(prev[prev.length - 1], p));
            setElapsedS(Math.round((p.t - next[0].t) / 1000));
          }
          return next;
        });
      },
    );
  }

  async function finishRun() {
    watchRef.current?.remove();
    watchRef.current = null;
    setRecording(false);
    if (points.length < 2 || !startedAtRef.current) return;
    try {
      const res = await fetch(`${API_URL}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ startedAt: startedAtRef.current.toISOString(), points }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to save run');
      setReport(body as RunReport);
      if (region) loadTerritory(region);
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Network error');
    }
  }

  const livePace = distanceM >= 50 && elapsedS > 0 ? elapsedS / (distanceM / 1000) : null;

  return (
    <View style={styles.flex}>
      {region ? (
        <MapView
          style={styles.flex}
          initialRegion={region}
          onRegionChangeComplete={(r) => {
            setRegion(r);
            loadTerritory(r);
          }}
          showsUserLocation
        >
          <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
          {cells.map((c) => (
            <Polygon
              key={c.id}
              coordinates={c.coords}
              fillColor={`${c.color}${c.mine ? '73' : '40'}`}
              strokeColor={c.color}
              strokeWidth={1}
            />
          ))}
          {points.length > 1 && (
            <>
              <Polyline
                coordinates={points.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
                strokeColor="rgba(173, 235, 46, 0.25)"
                strokeWidth={10}
              />
              <Polyline
                coordinates={points.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
                strokeColor={colors.volt}
                strokeWidth={4}
              />
            </>
          )}
        </MapView>
      ) : (
        <View style={styles.center}>
          <Text style={styles.subtitle}>Waiting for location…</Text>
        </View>
      )}

      {/* HUD */}
      <View style={styles.hud}>
        <View style={styles.hudRow}>
          <HudStat label="Distance" value={fmtDistance(distanceM)} primary />
          <View style={styles.hudDivider} />
          <HudStat label="Time" value={fmtDuration(elapsedS)} />
          <View style={styles.hudDivider} />
          <HudStat label="Pace" value={fmtPace(livePace)} />
        </View>
        {recording && <RecIndicator />}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {recording ? (
          <Btn label="⏹  Finish" variant="danger" onPress={finishRun} style={styles.bigBtn} />
        ) : (
          <Btn label="▶  Start run" onPress={startRun} style={styles.bigBtn} />
        )}
        <Pressable onPress={onLogout}>
          <Text style={styles.linkText}>Sign out</Text>
        </Pressable>
      </View>

      {report && <ReportModal report={report} onClose={() => setReport(null)} />}
    </View>
  );
}

function HudStat({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <View style={styles.hudStat}>
      <Text style={styles.hudLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.hudValue, primary && { color: colors.volt, fontSize: 21 }]}>
        {value}
      </Text>
    </View>
  );
}

function RecIndicator() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.recRow}>
      <Animated.View style={[styles.recDot, { opacity: pulse }]} />
      <Text style={styles.hudLabel}>RECORDING</Text>
    </View>
  );
}

/* ---------- run report ---------- */

function ReportModal({ report, onClose }: { report: RunReport; onClose: () => void }) {
  const { run, stats } = report;
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <ScrollView contentContainerStyle={{ padding: space(6) }}>
            <Text style={styles.reportLabel}>RUN COMPLETE</Text>
            <Text style={styles.reportHero}>{fmtDistance(run.distanceM)}</Text>
            <Text style={styles.reportSub}>
              Lv {stats.level} · +{report.xpGained} XP
            </Text>

            <View style={styles.reportGrid}>
              <ReportCell label="Time" value={fmtDuration(run.durationS)} />
              <ReportCell label="Pace" value={`${fmtPace(run.avgPaceSPerKm)}/km`} />
              <ReportCell label="Coins" value={`+${report.coinsGained}`} color={colors.gold} />
              <ReportCell label="Captured" value={String(run.cellsCaptured)} color={colors.volt} />
              <ReportCell label="Stolen" value={String(run.cellsStolen)} color={colors.ember} />
              <ReportCell label="Streak" value={`${stats.streakDays}d`} color={colors.ember} />
            </View>

            {report.personalBests.length > 0 && (
              <View style={styles.pbStrip}>
                <Text style={styles.pbText}>🏅 New personal best — {report.personalBests.join(', ')}</Text>
              </View>
            )}

            {report.newAchievements.map((a) => (
              <View key={a.code} style={styles.achieveRow}>
                <Text style={{ fontSize: 24 }}>{a.icon}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.achieveTitle}>{a.title}</Text>
                  <Text style={styles.achieveDesc}>{a.description}</Text>
                </View>
              </View>
            ))}

            <Btn label="Nice!" onPress={onClose} style={{ marginTop: space(5) }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ReportCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.reportCell}>
      <Text style={styles.hudLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.reportCellValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  login: { flex: 1, justifyContent: 'center', padding: space(6), gap: space(3) },
  mark: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: radius.card,
    backgroundColor: colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.volt,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  markGlyph: { fontSize: 32 },
  title: {
    fontFamily: font.extrabold,
    fontSize: type.display,
    color: colors.ink,
    textAlign: 'center',
    marginTop: space(3),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: type.small,
    color: colors.ink2,
    textAlign: 'center',
  },

  input: {
    borderRadius: radius.ctl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.elev1,
    paddingHorizontal: space(3.5),
    paddingVertical: space(3),
    color: colors.ink,
    fontFamily: font.regular,
    fontSize: type.body,
  },
  errorText: {
    fontFamily: font.medium,
    fontSize: type.small,
    color: colors.ember,
    textAlign: 'center',
  },
  linkText: {
    fontFamily: font.medium,
    fontSize: type.small,
    color: colors.ink2,
    textAlign: 'center',
    padding: space(2.5),
  },

  btn: {
    borderRadius: radius.ctl,
    paddingVertical: space(3.25),
    paddingHorizontal: space(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: font.bold, fontSize: type.body },
  btnPrimary: {
    backgroundColor: colors.volt,
    shadowColor: colors.volt,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  btnPrimaryText: { color: colors.base },
  btnGhost: {
    backgroundColor: colors.elev2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  btnGhostText: { color: colors.ink2 },
  btnDanger: {
    backgroundColor: colors.ember,
    shadowColor: colors.ember,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  btnDangerText: { color: '#ffffff' },
  bigBtn: { borderRadius: radius.pill, paddingHorizontal: space(9), paddingVertical: space(4) },

  hud: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    backgroundColor: colors.glass,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space(5),
    paddingVertical: space(3),
  },
  hudRow: { flexDirection: 'row', alignItems: 'center', gap: space(5) },
  hudDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.10)' },
  hudStat: { alignItems: 'center' },
  hudLabel: {
    fontFamily: font.semibold,
    fontSize: type.label,
    letterSpacing: 0.9,
    color: colors.ink3,
  },
  hudValue: {
    fontFamily: font.extrabold,
    fontSize: 18,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(1.5),
    marginTop: space(1.5),
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ember },

  controls: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    alignItems: 'center',
    gap: space(1.5),
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 30, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(4),
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '88%',
    backgroundColor: colors.elev2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  reportLabel: {
    fontFamily: font.semibold,
    fontSize: type.label,
    letterSpacing: 0.9,
    color: colors.ink3,
    textAlign: 'center',
  },
  reportHero: {
    fontFamily: font.extrabold,
    fontSize: 40,
    color: colors.volt,
    textAlign: 'center',
    marginTop: space(2),
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  reportSub: {
    fontFamily: font.semibold,
    fontSize: type.small,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: space(1),
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space(2),
    marginTop: space(5),
  },
  reportCell: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: colors.elev3,
    borderRadius: radius.ctl,
    paddingVertical: space(2.5),
    alignItems: 'center',
    gap: 2,
  },
  reportCellValue: {
    fontFamily: font.bold,
    fontSize: type.body,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  pbStrip: {
    backgroundColor: 'rgba(173, 235, 46, 0.10)',
    borderRadius: radius.ctl,
    padding: space(3),
    marginTop: space(4),
  },
  pbText: {
    fontFamily: font.bold,
    fontSize: type.small,
    color: colors.volt,
    textAlign: 'center',
  },
  achieveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: 'rgba(255, 197, 61, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 197, 61, 0.25)',
    borderRadius: radius.ctl,
    padding: space(3),
    marginTop: space(2.5),
  },
  achieveTitle: { fontFamily: font.bold, fontSize: type.small, color: colors.gold },
  achieveDesc: { fontFamily: font.regular, fontSize: type.caption, color: colors.ink2 },
});
