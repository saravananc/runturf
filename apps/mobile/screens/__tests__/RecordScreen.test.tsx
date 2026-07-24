import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { get, post } from '../../api';
import { RecordScreen } from '../RecordScreen';

/**
 * Drives the real useRecorder through the mocked GPS stream, so this covers the
 * recorder maths (moving time, pause accounting, distance) as the screen uses
 * it — not a stubbed hook.
 */

jest.mock('../../api');
jest.mock('react-native-maps');
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: { BestForNavigation: 6 },
}));
jest.mock('../../AuthContext', () => ({
  useAuth: () => ({ user: require('../../test-utils').alice }),
}));

const mockGet = get as jest.MockedFunction<typeof get>;
const mockPost = post as jest.MockedFunction<typeof post>;
const mockPerms = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPos = Location.getCurrentPositionAsync as jest.Mock;
const mockWatch = Location.watchPositionAsync as jest.Mock;

/** Feeds fixes into whatever callback the recorder registered. */
let emit: ((pos: unknown) => void) | null = null;

const fix = (lat: number, lng: number, t: number, accuracy = 5) => ({
  coords: { latitude: lat, longitude: lng, accuracy },
  timestamp: t,
});

const T0 = Date.parse('2026-07-24T06:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  emit = null;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockPerms.mockResolvedValue({ status: 'granted' });
  mockPos.mockResolvedValue({ coords: { latitude: 13.04, longitude: 80.27 } });
  mockGet.mockResolvedValue({ features: [] });
  mockWatch.mockImplementation(async (_opts: unknown, cb: (p: unknown) => void) => {
    emit = cb;
    return { remove: jest.fn() };
  });
});

async function renderRecording() {
  render(<RecordScreen />);
  await waitFor(() => expect(screen.getByText('▶  Start run')).toBeTruthy());
  await act(async () => {
    fireEvent.press(screen.getByText('▶  Start run'));
  });
  await waitFor(() => expect(mockWatch).toHaveBeenCalled());
}

const send = async (...fixes: unknown[]) => {
  for (const f of fixes) {
    await act(async () => {
      emit!(f);
    });
  }
};

it('waits for a location before drawing the map', async () => {
  let resolvePos: (v: unknown) => void = () => {};
  mockPos.mockReturnValue(new Promise((r) => (resolvePos = r)));

  render(<RecordScreen />);
  expect(screen.getByText('Waiting for location…')).toBeTruthy();

  await act(async () => {
    resolvePos({ coords: { latitude: 13.04, longitude: 80.27 } });
  });
  await waitFor(() => expect(screen.queryByText('Waiting for location…')).toBeNull());
});

it('loads territory for the initial viewport', async () => {
  render(<RecordScreen />);
  await waitFor(() =>
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/territory?west=')),
  );
});

it('tracks distance and moving time as fixes arrive', async () => {
  await renderRecording();
  // ~111 m apart at this latitude, 60 s apart.
  await send(fix(13.04, 80.27, T0), fix(13.041, 80.27, T0 + 60_000));

  await waitFor(() => expect(screen.getByText('1:00')).toBeTruthy());
  expect(screen.getByText(/^1\d\d m$/)).toBeTruthy(); // ~111 m
  expect(screen.getByText('RECORDING')).toBeTruthy();
});

it('ignores fixes with poor accuracy', async () => {
  await renderRecording();
  await send(fix(13.04, 80.27, T0), fix(13.05, 80.27, T0 + 60_000, 500));

  // The inaccurate jump must not land: still a single point, so no elapsed time.
  await waitFor(() => expect(screen.getByText('0:00')).toBeTruthy());
  expect(screen.getByText('0 m')).toBeTruthy();
});

it('excludes paused time from the clock, in the GPS timebase', async () => {
  await renderRecording();
  await send(fix(13.04, 80.27, T0), fix(13.041, 80.27, T0 + 60_000));
  await waitFor(() => expect(screen.getByText('1:00')).toBeTruthy());

  fireEvent.press(screen.getByText('⏸  Pause'));
  await waitFor(() => expect(screen.getByText('PAUSED')).toBeTruthy());

  // A fix arriving while paused is dropped entirely.
  await send(fix(13.042, 80.27, T0 + 90_000));
  expect(screen.getByText('1:00')).toBeTruthy();

  fireEvent.press(screen.getByText('▶  Resume'));
  // Resume 5 minutes later in GPS time: only the 60 s gap after resuming counts.
  await send(fix(13.042, 80.27, T0 + 360_000), fix(13.043, 80.27, T0 + 420_000));

  // Span 420 s minus 300 s paused = 120 s of moving time.
  await waitFor(() => expect(screen.getByText('2:00')).toBeTruthy());
});

it('submits the run with its paused milliseconds and shows the report', async () => {
  await renderRecording();
  await send(fix(13.04, 80.27, T0), fix(13.041, 80.27, T0 + 60_000));

  fireEvent.press(screen.getByText('⏸  Pause'));
  await waitFor(() => expect(screen.getByText('PAUSED')).toBeTruthy());
  fireEvent.press(screen.getByText('▶  Resume'));
  await send(fix(13.042, 80.27, T0 + 360_000));

  mockPost.mockResolvedValue({
    run: {
      id: 'r1',
      startedAt: new Date(T0).toISOString(),
      durationS: 60,
      distanceM: 222,
      avgPaceSPerKm: 270,
      cellsCaptured: 3,
      cellsStolen: 0,
      xpGained: 34,
    },
    xpGained: 34,
    coinsGained: 6,
    newAchievements: [],
    personalBests: [],
    perksApplied: [],
    stats: require('../../test-utils').stats,
  } as never);

  await act(async () => {
    fireEvent.press(screen.getByText('⏹  Finish'));
  });

  await waitFor(() => expect(mockPost).toHaveBeenCalled());
  const [path, body] = mockPost.mock.calls[0] as [string, { points: unknown[]; pausedMs: number }];
  expect(path).toBe('/runs');
  expect(body.points).toHaveLength(3);
  expect(body.pausedMs).toBe(300_000); // the paused gap, not wall-clock

  await waitFor(() => expect(screen.getByText('RUN COMPLETE')).toBeTruthy());
});

it('refuses to save a run with too few points', async () => {
  await renderRecording();
  await send(fix(13.04, 80.27, T0)); // one point only

  await act(async () => {
    fireEvent.press(screen.getByText('⏹  Finish'));
  });

  expect(Alert.alert).toHaveBeenCalledWith(
    'Run too short',
    'We need at least two GPS points to save a run.',
  );
  expect(mockPost).not.toHaveBeenCalled();
});

it('tells the runner when location permission is refused', async () => {
  render(<RecordScreen />);
  await waitFor(() => expect(screen.getByText('▶  Start run')).toBeTruthy());

  mockPerms.mockResolvedValue({ status: 'denied' });
  await act(async () => {
    fireEvent.press(screen.getByText('▶  Start run'));
  });

  expect(Alert.alert).toHaveBeenCalledWith(
    'Location required',
    'RunTurf needs location access to record runs.',
  );
});
