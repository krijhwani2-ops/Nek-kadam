import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.nekkadam.app',
  appName: 'Nek Kadam',
  webDir: 'dist',
  server: {
    cleartext: true,
    androidScheme: 'http'
  },
  plugins: {
    LiveUpdate: {
      readyTimeout: 10000,
      autoDeleteBundles: true
    }
  }
};

export default config;
