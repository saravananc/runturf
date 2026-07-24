import { act, render, screen, waitFor } from '@testing-library/react-native';
import { renderHook } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { get } from '../../api';
import { MapScreen, useTerritory } from '../MapScreen';

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
const mockPerms = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPos = Location.getCurrentPositionAsync as jest.Mock;

const cell = (x: number, y: number, ownerId: string, color = '#3b82f6') => ({
  properties: { x, y, ownerId, color },
  geometry: {
    coordinates: [
      [
        [80.27, 13.04],
        [80.271, 13.04],
        [80.271, 13.041],
        [80.27, 13.041],
      ],
    ],
  },
});

const REGION = { latitude: 13.04, longitude: 80.27, latitudeDelta: 0.01, longitudeDelta: 0.01 };

beforeEach(() => {
  jest.clearAllMocks();
  mockPerms.mockResolvedValue({ status: 'granted' });
  mockPos.mockResolvedValue({ coords: { latitude: 13.04, longitude: 80.27 } });
  mockGet.mockResolvedValue({ features: [] });
});

describe('MapScreen', () => {
  it('waits for a location, then renders the map and its banner', async () => {
    let resolvePos: (v: unknown) => void = () => {};
    mockPos.mockReturnValue(new Promise((r) => (resolvePos = r)));

    render(<MapScreen />);
    expect(screen.getByText('Waiting for location…')).toBeTruthy();
    expect(screen.getByText('Territory map')).toBeTruthy(); // banner always visible

    await act(async () => {
      resolvePos({ coords: { latitude: 13.04, longitude: 80.27 } });
    });
    await waitFor(() => expect(screen.queryByText('Waiting for location…')).toBeNull());
    expect(screen.getByTestId('MapView')).toBeTruthy();
  });

  it('still shows a map when location permission is refused', async () => {
    mockPerms.mockResolvedValue({ status: 'denied' });

    render(<MapScreen />);
    await waitFor(() => expect(screen.getByTestId('MapView')).toBeTruthy());
    expect(mockPos).not.toHaveBeenCalled(); // no position request without permission
  });

  it('renders a polygon per territory cell, flagging the runner’s own', async () => {
    mockGet.mockResolvedValue({
      features: [cell(1, 1, 'u1'), cell(2, 2, 'u2', '#ef4444')],
    });

    render(<MapScreen />);
    await waitFor(() => expect(screen.getAllByTestId('Polygon')).toHaveLength(2));

    const [mine, theirs] = screen.getAllByTestId('Polygon');
    // Own cells are filled more strongly (alpha 73 vs 40).
    expect(mine.props.fillColor).toBe('#3b82f673');
    expect(theirs.props.fillColor).toBe('#ef444440');
  });

  it('points the tile layer at OpenStreetMap', async () => {
    render(<MapScreen />);
    await waitFor(() => expect(screen.getByTestId('UrlTile')).toBeTruthy());
    expect(screen.getByTestId('UrlTile').props.urlTemplate).toBe(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
  });
});

describe('useTerritory', () => {
  it('requests the bbox derived from the region', async () => {
    const { result } = renderHook(() => useTerritory('u1'));
    await act(async () => {
      await result.current.load(REGION);
    });

    // Compare parsed numbers: the halved deltas are floating point, so the
    // serialised string carries digits like 13.034999999999998.
    const query = Object.fromEntries(
      new URLSearchParams((mockGet.mock.calls[0][0] as string).split('?')[1]),
    );
    expect(Number(query.west)).toBeCloseTo(80.265, 6);
    expect(Number(query.east)).toBeCloseTo(80.275, 6);
    expect(Number(query.south)).toBeCloseTo(13.035, 6);
    expect(Number(query.north)).toBeCloseTo(13.045, 6);
  });

  it('coalesces overlapping loads so panning cannot stampede the API', async () => {
    let release: (v: unknown) => void = () => {};
    mockGet.mockReturnValue(new Promise((r) => (release = r)));

    const { result } = renderHook(() => useTerritory('u1'));
    await act(async () => {
      void result.current.load(REGION);
      void result.current.load(REGION); // second call while the first is in flight
      release({ features: [] });
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('keeps the previous overlay when a refresh fails', async () => {
    mockGet.mockResolvedValueOnce({ features: [cell(1, 1, 'u1')] });
    const { result } = renderHook(() => useTerritory('u1'));
    await act(async () => {
      await result.current.load(REGION);
    });
    expect(result.current.cells).toHaveLength(1);

    mockGet.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current.load(REGION);
    });
    // Blanking the map on a transient error would look like lost territory.
    expect(result.current.cells).toHaveLength(1);
  });

  it('converts GeoJSON lng/lat pairs into map coordinates', async () => {
    mockGet.mockResolvedValue({ features: [cell(7, 9, 'u1')] });
    const { result } = renderHook(() => useTerritory('u1'));
    await act(async () => {
      await result.current.load(REGION);
    });

    expect(result.current.cells[0].id).toBe('7:9');
    expect(result.current.cells[0].mine).toBe(true);
    expect(result.current.cells[0].coords[0]).toEqual({ latitude: 13.04, longitude: 80.27 });
  });
});
