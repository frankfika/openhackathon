/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['api/__tests__/**/*.test.ts'],
    setupFiles: ['./api/__tests__/setup.ts'],
    globalSetup: ['./api/__tests__/globalSetup.ts'],
    hookTimeout: 120000,
    env: {
      TEST_DATABASE_URL: 'postgresql://postgres:postgrespassword@localhost:5432/openhackathon_test?schema=public',
      DATABASE_URL: 'postgresql://postgres:postgrespassword@localhost:5432/openhackathon_test?schema=public',
      AUTH_DISABLED: 'true',
    },
    testTimeout: 30000,
  },
})
