#!/usr/bin/env node
// scripts/db-seed-dev.mjs
// Intentionally a no-op.
//
// OpenHackathon has no prisma/seed.ts on purpose — see docs/setup-wizard.md §3
// (commit 35dd59e removed prisma/seed.ts, prisma/ensure-dev-users.ts, and
// prisma/dev-users.ts in 2026-06-20). The dev DB already carries the
// canonical demo dataset, and new dev users should be created via the API
// or Prisma Studio, not by re-introducing a hardcoded password script.
//
// This file exists so `npm run db:seed:dev` does not fail with
// "Cannot find module"; it just prints this message and exits 0.

console.log('[db:seed:dev] intentionally no-op — see docs/setup-wizard.md');
console.log('[db:seed:dev] dev users are created via POST /api/users (admin token)');
console.log('[db:seed:dev] or via `npx prisma studio` for one-off inspection');
process.exit(0);
