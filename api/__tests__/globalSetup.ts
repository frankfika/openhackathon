import { execSync } from 'node:child_process';
import { Client } from 'pg';

const DEFAULT_TEST_DATABASE_URL =
  'postgresql://postgres:postgrespassword@localhost:5432/openhackathon_test?schema=public';
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;
const ADMIN_DATABASE_URL =
  process.env.PG_ADMIN_URL || 'postgresql://postgres:postgrespassword@localhost:5432/postgres';

function getDatabaseName(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  return parsed.pathname.replace(/^\//, '');
}

export default async function globalSetup() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;

  const dbName = getDatabaseName(TEST_DATABASE_URL);
  const escapedDbName = dbName.replace(/"/g, '""');

  const client = new Client({ connectionString: ADMIN_DATABASE_URL });

  try {
    await client.connect();

    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);

    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE "${escapedDbName}"`);
      console.log(`Created test database: ${dbName}`);
    }
  } finally {
    await client.end();
  }

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
    },
    stdio: 'inherit',
  });

  console.log(`Test database schema synced: ${dbName}`);
}
