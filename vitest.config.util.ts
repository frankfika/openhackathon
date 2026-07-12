/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Unit-test config for the pure-Node util tests in `api/utils/__tests__/`.
 *
 * These are deliberately kept OUT of `vitest.config.api.ts` because:
 *   1. They don't need a Postgres test DB (no Prisma client required).
 *   2. They run much faster (~3s vs ~17s) when isolated.
 *   3. They cover implementation details of `api/utils/*` (sanitize,
 *      siwe, fetch-with-retry, prompts) that the integration tests
 *      can also exercise but where the unit-level contract is clearer
 *      when isolated.
 *
 * The same env vars as `vitest.config.api.ts` are wired in (with
 * safe defaults) so the import order doesn't matter when both
 * configs are run back-to-back.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['api/utils/__tests__/**/*.test.ts'],
    env: {
      TEST_DATABASE_URL: 'postgresql://postgres:postgrespassword@localhost:5432/openhackathon_test?schema=public',
      DATABASE_URL: 'postgresql://postgres:postgrespassword@localhost:5432/openhackathon_test?schema=public',
      AUTH_DISABLED: 'true',
    },
  },
});
