/**
 * Detox runs the real app on a real device/emulator, so it needs a native
 * binary — Expo Go cannot host it. The android/ project is generated on demand
 * with `expo prebuild` (see the e2e:prebuild script) and is not committed;
 * @config-plugins/detox injects the native test harness during that step.
 *
 * iOS configurations are intentionally absent: building them requires Xcode,
 * so they cannot be produced or run on Windows. Add them alongside these when
 * a macOS runner is available.
 */
const AVD_NAME = process.env.DETOX_AVD_NAME ?? 'Medium_Phone';

/**
 * Detox's documented Windows form is `cd android && gradlew.bat`, which relies
 * on cmd.exe resolving an executable from the current directory. That is
 * disabled on hardened Windows installs (NoDefaultCurrentDirectoryInExePath)
 * and fails with "'gradlew.bat' is not recognized". Passing an explicit path
 * plus Gradle's -p project-dir flag avoids the cd entirely and is correct under
 * both cmd.exe (which Detox always uses on Windows) and sh.
 */
const gradle = process.platform === 'win32' ? 'android\\gradlew.bat' : './android/gradlew';

module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 240000,
    },
  },
  apps: {
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      testBinaryPath:
        'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
      // Scope to :app:. The bare assembleAndroidTest also builds androidTest
      // variants for every library module, and react-native-screens' variant
      // trips a duplicate libfbjni.so merge. Detox only needs the app's two
      // APKs, and :app:assembleAndroidTest depends on the libraries' *main*
      // variants, so it sidesteps that entirely.
      build: `${gradle} -p android :app:assembleDebug :app:assembleAndroidTest -DtestBuildType=debug`,
      reversePorts: [
        8081, // Metro, for the debug build's JS bundle
      ],
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      testBinaryPath:
        'android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk',
      build: `${gradle} -p android :app:assembleRelease :app:assembleAndroidTest -DtestBuildType=release`,
    },
  },
  devices: {
    emulator: {
      type: 'android.emulator',
      device: { avdName: AVD_NAME },
    },
    attached: {
      // A physical device or an already-running emulator, by adb id.
      type: 'android.attached',
      device: { adbName: process.env.DETOX_ADB_NAME ?? '.*' },
    },
  },
  configurations: {
    'android.emu.debug': { device: 'emulator', app: 'android.debug' },
    'android.emu.release': { device: 'emulator', app: 'android.release' },
    'android.attached.debug': { device: 'attached', app: 'android.debug' },
  },
};
