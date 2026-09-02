import { PostgreSqlContainer } from "@testcontainers/postgresql";

// One Postgres container for the whole test run — each worker gets its own database inside it
// (see startTestDatabase in testDatabase.ts), instead of every test file booting its own container.
export default async function setup() {
  const container = await new PostgreSqlContainer(
    `postgres:${process.env.POSTGRES_VERSION ?? "16"}`,
  ).start();

  process.env.TEST_PG_HOST = container.getHost();
  process.env.TEST_PG_PORT = String(container.getPort());
  process.env.TEST_PG_ADMIN_DATABASE = container.getDatabase();
  process.env.TEST_PG_USER = container.getUsername();
  process.env.TEST_PG_PASSWORD = container.getPassword();

  return async () => {
    await container.stop();
  };
}
