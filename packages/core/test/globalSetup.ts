import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RabbitMQContainer } from "@testcontainers/rabbitmq";

// One Postgres + one RabbitMQ container for the whole test run — each worker gets its own
// Postgres database inside the shared container (see startTestDatabase in testDatabase.ts).
// RabbitMQ needs no per-worker equivalent: topology declaration is cheap and idempotent, so every
// worker can safely share the same broker/vhost.
export default async function setup() {
  const postgresContainer = await new PostgreSqlContainer(
    `postgres:${process.env.POSTGRES_VERSION ?? "16"}`,
  ).start();

  process.env.TEST_PG_HOST = postgresContainer.getHost();
  process.env.TEST_PG_PORT = String(postgresContainer.getPort());
  process.env.TEST_PG_ADMIN_DATABASE = postgresContainer.getDatabase();
  process.env.TEST_PG_USER = postgresContainer.getUsername();
  process.env.TEST_PG_PASSWORD = postgresContainer.getPassword();

  const rabbitmqContainer = await new RabbitMQContainer(
    `rabbitmq:${process.env.RABBITMQ_VERSION ?? "4.3"}`,
  ).start();

  process.env.TEST_RABBITMQ_URL = rabbitmqContainer.getAmqpUrl();

  return async () => {
    await postgresContainer.stop();
    await rabbitmqContainer.stop();
  };
}
