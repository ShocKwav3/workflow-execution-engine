// One logical Redis database per Vitest worker, so parallel test files never share queue keys.
const REDIS_DATABASE_COUNT = 16;

export function testRedisUrl(): string {
  const url = process.env.TEST_REDIS_URL;

  if (!url) {
    throw new Error("TEST_REDIS_URL is not set; is the Redis globalSetup configured?");
  }

  const poolId = Number(process.env.VITEST_POOL_ID ?? "1");

  return `${url}/${poolId % REDIS_DATABASE_COUNT}`;
}
