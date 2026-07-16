import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Polygon, Polyline, UrlTile, type Region } from 'react-native-maps';

/**
 * RunTurf mobile scaffold: login, live run recording, territory overlay.
 * Set EXPO_PUBLIC_API_URL to your machine's LAN address when testing on a
 * physical device, e.g. EXPO_PUBLIC_API_URL=http://192.168.1.20:4000
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

function haversineM(a: Point, b: Point): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');

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

function LoginScreen({ onAuth }: { onAuth: (token: string, userId: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(path: 'login' | 'register') {
    setBusy(true);
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
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.login}>
      <Text style={styles.logo}>🏃🗺️</Text>
      <Text style={styles.title}>RunTurf</Text>
      <Text style={styles.subtitle}>Run. Capture territory. Defend your turf.</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={styles.primaryBtn} disabled={busy} onPress={() => submit('login')}>
        <Text style={styles.primaryBtnText}>{busy ? '…' : 'Sign in'}</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={() => submit('register')}>
        <Text style={styles.linkText}>Create account</Text>
      </Pressable>
    </View>
  );
}

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
          if (prev.length > 0) setDistanceM((d) => d + haversineM(prev[prev.length - 1], p));
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
      Alert.alert(
        'Run complete! 🎉',
        `${(body.run.distanceM / 1000).toFixed(2)} km\n` +
          `Captured ${body.run.cellsCaptured} cells (${body.run.cellsStolen} stolen)\n` +
          `+${body.xpGained} XP, +${body.coinsGained} coins` +
          (body.newAchievements.length > 0
            ? `\nUnlocked: ${body.newAchievements.map((a: { title: string }) => a.title).join(', ')}`
            : ''),
      );
      if (region) loadTerritory(region);
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Network error');
    }
  }

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
            <Polyline
              coordinates={points.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
              strokeColor="#34d399"
              strokeWidth={4}
            />
          )}
        </MapView>
      ) : (
        <View style={styles.center}>
          <Text style={styles.subtitle}>Waiting for location…</Text>
        </View>
      )}

      <View style={styles.hud}>
        <Text style={styles.hudText}>
          {distanceM >= 1000 ? `${(distanceM / 1000).toFixed(2)} km` : `${Math.round(distanceM)} m`}
        </Text>
      </View>

      <View style={styles.controls}>
        {recording ? (
          <Pressable style={[styles.roundBtn, styles.stopBtn]} onPress={finishRun}>
            <Text style={styles.roundBtnText}>⏹ Finish</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.roundBtn, styles.startBtn]} onPress={startRun}>
            <Text style={styles.roundBtnText}>▶ Start run</Text>
          </Pressable>
        )}
        <Pressable onPress={onLogout}>
          <Text style={styles.linkText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  login: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  logo: { fontSize: 44, textAlign: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: 'white', textAlign: 'center' },
  subtitle: { color: '#94a3b8', textAlign: 'center', marginBottom: 16 },
  input: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    color: 'white',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  linkText: { color: '#94a3b8', textAlign: 'center', padding: 10 },
  hud: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  hudText: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  controls: { position: 'absolute', bottom: 40, alignSelf: 'center', alignItems: 'center', gap: 6 },
  roundBtn: { borderRadius: 999, paddingHorizontal: 34, paddingVertical: 16 },
  startBtn: { backgroundColor: '#10b981' },
  stopBtn: { backgroundColor: '#ef4444' },
  roundBtnText: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
});
