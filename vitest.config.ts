import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['tests/setup.ts'] } },
      { test: { name: 'integration', environment: 'node', include: ['tests/integration/**/*.test.ts'], testTimeout: 20000 } },
      { test: { name: 'rules', environment: 'node', include: ['tests/rules/**/*.test.ts'], testTimeout: 20000, hookTimeout: 20000 } },
    ],
  },
});
