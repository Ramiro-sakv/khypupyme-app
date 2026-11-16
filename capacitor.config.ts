import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.khypupyme.beta', appName: 'KhypuPyme Beta', webDir: 'dist-android',
  server: { androidScheme: ['hosted', 'render-pilot'].includes(process.env.VITE_SERVICE_PROFILE ?? '') ? 'https' : 'http', hostname: 'localhost' },
  android: { allowMixedContent: false },
};
export default config;
