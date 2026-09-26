import { RedisContainer } from "@testcontainers/redis";

export default async function setup() {
  const redisContainer = await new RedisContainer(
    `redis:${process.env.REDIS_VERSION ?? "8.10.2"}`,
  ).start();

  process.env.TEST_REDIS_URL = redisContainer.getConnectionUrl();

  return async () => {
    await redisContainer.stop();
  };
}
