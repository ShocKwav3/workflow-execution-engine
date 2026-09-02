import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RabbitMQContainer } from "@testcontainers/rabbitmq";

// One Postgres + one RabbitMQ container for the whole test run — each worker gets its own
// Postgres database inside the shared container (see startTestDatabase in testDatabase.ts).
// RabbitMQ needs no per-worker equivalent: topology declaration is cheap and idempotent, so every
// worker can safely share the same broker/vhost. Both containers start concurrently — neither
// depends on the other, and starting them sequentially would just add their boot times together.
export default async function setup() {
  const [postgresContainer, rabbitmqContainer] = await Promise.all([
    new PostgreSqlContainer(`postgres:${process.env.POSTGRES_VERSION ?? "16"}`).start(),
    new RabbitMQContainer(`rabbitmq:${process.env.RABBITMQ_VERSION ?? "4.3"}`).start(),
  ]);

  process.env.TEST_PG_HOST = postgresContainer.getHost();
  process.env.TEST_PG_PORT = String(postgresContainer.getPort());
  process.env.TEST_PG_ADMIN_DATABASE = postgresContainer.getDatabase();
  process.env.TEST_PG_USER = postgresContainer.getUsername();
  process.env.TEST_PG_PASSWORD = postgresContainer.getPassword();

  process.env.TEST_RABBITMQ_URL = rabbitmqContainer.getAmqpUrl();

  return async () => {
    await Promise.all([postgresContainer.stop(), rabbitmqContainer.stop()]);
  };
}
