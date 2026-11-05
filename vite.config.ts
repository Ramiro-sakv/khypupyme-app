import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  build: { outDir: process.env.VITE_EMULATOR_PROFILE === 'test' ? 'dist-test' : 'dist' },
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
