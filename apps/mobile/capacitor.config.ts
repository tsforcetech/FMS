import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sharaco.facilityos',
  appName: 'FacilityOS',
  webDir: 'dist',
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
  ios: { contentInset: 'automatic' },
  plugins: {
    SplashScreen: { launchShowDuration: 0 },
  },
};
export default config;
