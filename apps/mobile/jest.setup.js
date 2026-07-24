// AsyncStorage is a native module, so it is null under Jest. Its maintainers
// ship a JS mock for exactly this; api.ts imports it at module load, which any
// test touching the API client would otherwise trip over.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
