import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { get, post } from '../../api';
import { HistoryScreen } from '../HistoryScreen';

/**
 * Runtime coverage for the GPX import path, which bundling and endpoint checks
 * cannot prove: picker -> file read -> POST -> report modal.
 */

jest.mock('../../api');
jest.mock('expo-document-picker');
jest.mock('expo-file-system');
jest.mock('@react-navigation/native', () => ({
  // Run the focus callback once on mount, like a focused screen would.
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

const mockGet = get as jest.MockedFunction<typeof get>;
const mockPost = post as jest.MockedFunction<typeof post>;
const mockPick = DocumentPicker.getDocumentAsync as jest.MockedFunction<
  typeof DocumentPicker.getDocumentAsync
>;
const mockRead = FileSystem.readAsStringAsync as jest.MockedFunction<
  typeof FileSystem.readAsStringAsync
>;

const GPX = '<?xml version="1.0"?><gpx version="1.1"><trk><trkseg/></trk></gpx>';

const REPORT = {
  run: {
    id: 'r1',
    startedAt: '2026-07-20T05:30:00.000Z',
    durationS: 232,
    distanceM: 382,
    avgPaceSPerKm: 607,
    cellsCaptured: 4,
    cellsStolen: 0,
    xpGained: 48,
  },
  xpGained: 48,
  coinsGained: 8,
  newAchievements: [],
  personalBests: [],
  perksApplied: [],
  stats: {
    xp: 887,
    level: 4,
    coins: 22,
    streakDays: 1,
    lastRunDate: '2026-07-20',
    totalRuns: 8,
    totalDistanceM: 5023,
    cellsOwned: 29,
  },
};

const STATS = REPORT.stats;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(path === '/runs' ? [] : STATS),
  );
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

async function renderScreen() {
  render(<HistoryScreen />);
  await waitFor(() => expect(screen.getByText('History')).toBeTruthy());
}

it('imports a picked GPX file and shows the run report', async () => {
  mockPick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///cache/morning.gpx', name: 'morning.gpx', size: 120, mimeType: 'application/gpx+xml' }],
  } as never);
  mockRead.mockResolvedValue(GPX);
  mockPost.mockResolvedValue(REPORT as never);

  await renderScreen();
  fireEvent.press(screen.getByText(/Import GPX/));

  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/runs/import', { gpx: GPX }));
  expect(mockRead).toHaveBeenCalledWith('file:///cache/morning.gpx');

  // The report modal is the user-visible confirmation that the import landed.
  await waitFor(() => expect(screen.getByText('RUN COMPLETE')).toBeTruthy()); // <Label> uppercases
  expect(screen.getByText('382 m')).toBeTruthy();
});

it('does nothing when the picker is cancelled', async () => {
  mockPick.mockResolvedValue({ canceled: true, assets: null } as never);

  await renderScreen();
  fireEvent.press(screen.getByText(/Import GPX/));

  await waitFor(() => expect(mockPick).toHaveBeenCalled());
  expect(mockRead).not.toHaveBeenCalled();
  expect(mockPost).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('surfaces a rejected import instead of failing silently', async () => {
  mockPick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///cache/bad.gpx', name: 'bad.gpx', size: 10, mimeType: 'text/xml' }],
  } as never);
  mockRead.mockResolvedValue('not a gpx file');
  mockPost.mockRejectedValue(new Error('That run has already been imported'));

  await renderScreen();
  fireEvent.press(screen.getByText(/Import GPX/));

  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith('Import failed', 'That run has already been imported'),
  );
});
