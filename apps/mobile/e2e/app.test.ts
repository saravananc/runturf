import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

/**
 * Device tests. Everything here is something the jest-expo suite cannot prove,
 * because it mocks the native layer:
 *
 *   - the release bundle actually boots on a device (not just bundles)
 *   - real networking from the device to the API
 *   - AsyncStorage genuinely persisting across a process restart
 *   - react-native-maps and expo-location loading as native modules
 *   - React Navigation driving real screens
 *
 * Requires the API to be reachable at the emulator's host alias
 * (http://10.0.2.2:4000 by default) and the demo account to exist.
 *
 * Synchronization strategy: the Map screen keeps the UI thread busy, so the app
 * rarely reports "idle" and Detox's automatic wait crawls or times out there.
 * We therefore turn synchronization OFF before any step that lands on the map,
 * and poll with waitFor(...).withTimeout() instead. It stays ON while typing
 * credentials, because the Sign-in button only enables once onChangeText has
 * propagated — and that propagation is exactly what synchronization waits for.
 * launchApp re-enables synchronization, so map-bound relaunches disable it again.
 */

const DEMO = { username: 'demo', password: 'demo1234' };
const T = 60000; // generous: crosses the network / waits out map rendering

/** Enter credentials (sync ON so the button enables), then submit into the map. */
async function signIn() {
  await waitFor(element(by.id('login-username'))).toBeVisible().withTimeout(T);
  await element(by.id('login-username')).typeText(DEMO.username);
  await element(by.id('login-password')).typeText(DEMO.password);
  // The submit navigates to the map, which never idles — stop synchronising so
  // the tap returns immediately instead of blocking on the map.
  await device.disableSynchronization();
  await element(by.id('login-submit')).tap();
  await waitFor(element(by.text('Territory map'))).toBeVisible().withTimeout(T);
}

describe('RunTurf on a device', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      delete: true, // start from a clean install: no leftover session
      permissions: { location: 'inuse' },
    });
  });

  it('boots to the sign-in screen', async () => {
    // If the native bundle failed to load, nothing below would render at all.
    await waitFor(element(by.text('RunTurf'))).toBeVisible().withTimeout(T);
    await detoxExpect(element(by.id('login-submit'))).toBeVisible();
  });

  it('rejects bad credentials with the server’s message', async () => {
    // Login screen only (no map), so synchronization stays on: typing enables
    // the button and the tap waits out the API round-trip.
    await element(by.id('login-username')).typeText(DEMO.username);
    await element(by.id('login-password')).typeText('wrong-password');
    await element(by.id('login-submit')).tap();

    // Proves the device really reached the API and surfaced its 401 body. Assert
    // existence, not visibility: the error renders just above the button, where
    // the soft keyboard overlaps it.
    await waitFor(element(by.text('Invalid username or password'))).toExist().withTimeout(T);
  });

  it('signs in against the live API and lands on the map', async () => {
    await device.launchApp({ newInstance: true, delete: true, permissions: { location: 'inuse' } });
    await signIn();

    // The map screen mounts react-native-maps; a broken native module crashes here.
    await waitFor(element(by.text('Run through a cell to claim it'))).toBeVisible().withTimeout(T);
  });

  it('keeps the session across a cold restart', async () => {
    // AsyncStorage is mocked in the unit suite, so this is the only place the
    // real native persistence is exercised: relaunch without reinstalling and
    // the runner should still be signed in.
    await device.launchApp({ newInstance: true });
    await device.disableSynchronization(); // relaunch re-enabled it; the map needs it off

    await waitFor(element(by.text('Territory map'))).toBeVisible().withTimeout(T);
    await detoxExpect(element(by.id('login-submit'))).not.toBeVisible();
  });

  it('navigates the tab bar to real screens', async () => {
    await element(by.id('tab-History')).tap();
    await waitFor(element(by.text('RUNS'))).toBeVisible().withTimeout(T);

    await element(by.id('tab-Rank')).tap();
    await waitFor(element(by.text('Who owns the most turf?'))).toBeVisible().withTimeout(T);

    await element(by.id('tab-Profile')).tap();
    await waitFor(element(by.id('profile-signout'))).toBeVisible().withTimeout(T);
  });

  it('shows the runner’s own stats on the profile', async () => {
    await waitFor(element(by.text('@demo'))).toBeVisible().withTimeout(T);
    await waitFor(element(by.text('LEVEL'))).toBeVisible().withTimeout(T);
  });

  it('opens the recorder with location permission granted', async () => {
    await element(by.id('tab-Record')).tap();

    // With permission granted at launch, the recorder resolves a fix and swaps
    // the placeholder for the map plus its Start control.
    await waitFor(element(by.text('▶  Start run'))).toBeVisible().withTimeout(T);
    await waitFor(element(by.text('DISTANCE'))).toBeVisible().withTimeout(T);
  });

  it('signs out and forgets the session', async () => {
    await element(by.id('tab-Profile')).tap();
    await waitFor(element(by.id('profile-signout'))).toBeVisible().withTimeout(T);
    await element(by.id('profile-signout')).tap();
    // The alert becomes the focused window, so its "Sign out" button is the
    // only match in the active root — not a second index behind the profile.
    await waitFor(element(by.text('Sign out'))).toBeVisible().withTimeout(T);
    await element(by.text('Sign out')).tap(); // confirm in the alert

    await waitFor(element(by.id('login-submit'))).toBeVisible().withTimeout(T);

    // And the sign-out must survive a restart, i.e. storage really was cleared.
    await device.launchApp({ newInstance: true });
    await waitFor(element(by.id('login-submit'))).toBeVisible().withTimeout(T);
  });
});
