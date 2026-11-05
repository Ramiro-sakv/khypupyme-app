import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.khypupyme.beta', appName: 'KhypuPyme Beta', webDir: 'dist-android',
  server: { androidScheme: 'http', hostname: 'localhost' },
  android: { allowMixedContent: false },
};
export default config;
