import { PostgreSqlContainer } from "@testcontainers/postgresql";

export default async function setup() {
  const postgresContainer = await new PostgreSqlContainer(
    `postgres:${process.env.POSTGRES_VERSION ?? "16"}`,
  ).start();

  process.env.TEST_PG_HOST = postgresContainer.getHost();
  process.env.TEST_PG_PORT = String(postgresContainer.getPort());
  process.env.TEST_PG_ADMIN_DATABASE = postgresContainer.getDatabase();
  process.env.TEST_PG_USER = postgresContainer.getUsername();
  process.env.TEST_PG_PASSWORD = postgresContainer.getPassword();

  return async () => {
    await postgresContainer.stop();
  };
}
