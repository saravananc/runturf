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
 */

const DEMO = { username: 'demo', password: 'demo1234' };

async function signIn() {
  await element(by.id('login-username')).typeText(DEMO.username);
  await element(by.id('login-password')).typeText(DEMO.password);
  await element(by.id('login-submit')).tap();
  await detoxExpect(element(by.text('Territory map'))).toBeVisible();
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
    await detoxExpect(element(by.text('RunTurf'))).toBeVisible();
    await detoxExpect(element(by.id('login-submit'))).toBeVisible();
  });

  it('rejects bad credentials with the server’s message', async () => {
    await element(by.id('login-username')).typeText(DEMO.username);
    await element(by.id('login-password')).typeText('wrong-password');
    await element(by.id('login-submit')).tap();

    // Proves the device really reached the API and surfaced its 401 body.
    await detoxExpect(element(by.text('Invalid credentials'))).toBeVisible();
  });

  it('signs in against the live API and lands on the map', async () => {
    await device.launchApp({ newInstance: true, delete: true, permissions: { location: 'inuse' } });
    await signIn();

    // The map screen mounts react-native-maps; a broken native module crashes here.
    await detoxExpect(element(by.text('Run through a cell to claim it'))).toBeVisible();
  });

  it('keeps the session across a cold restart', async () => {
    // AsyncStorage is mocked in the unit suite, so this is the only place the
    // real native persistence is exercised.
    await device.launchApp({ newInstance: true });

    await detoxExpect(element(by.text('Territory map'))).toBeVisible();
    await detoxExpect(element(by.id('login-submit'))).not.toBeVisible();
  });

  it('navigates the tab bar to real screens', async () => {
    await element(by.id('tab-History')).tap();
    await detoxExpect(element(by.text('RUNS'))).toBeVisible();

    await element(by.id('tab-Rank')).tap();
    await detoxExpect(element(by.text('Who owns the most turf?'))).toBeVisible();

    await element(by.id('tab-Profile')).tap();
    await detoxExpect(element(by.id('profile-signout'))).toBeVisible();
  });

  it('shows the runner’s own stats on the profile', async () => {
    await detoxExpect(element(by.text('@demo'))).toBeVisible();
    await detoxExpect(element(by.text('LEVEL'))).toBeVisible();
  });

  it('opens the recorder with location permission granted', async () => {
    await element(by.id('tab-Record')).tap();

    // With permission granted at launch, the recorder resolves a fix and swaps
    // the placeholder for the map plus its Start control.
    await waitFor(element(by.text('▶  Start run')))
      .toBeVisible()
      .withTimeout(30000);
    await detoxExpect(element(by.text('DISTANCE'))).toBeVisible();
  });

  it('signs out and forgets the session', async () => {
    await element(by.id('tab-Profile')).tap();
    await element(by.id('profile-signout')).tap();
    await element(by.text('Sign out')).atIndex(1).tap(); // confirm in the alert

    await detoxExpect(element(by.id('login-submit'))).toBeVisible();

    // And the sign-out must survive a restart, i.e. storage really was cleared.
    await device.launchApp({ newInstance: true });
    await detoxExpect(element(by.id('login-submit'))).toBeVisible();
  });
});
