import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.khypupyme.beta', appName: 'KhypuPyme Beta', webDir: 'dist-android',
  server: { androidScheme: process.env.VITE_SERVICE_PROFILE === 'hosted' ? 'https' : 'http', hostname: 'localhost' },
  android: { allowMixedContent: false },
};
export default config;
