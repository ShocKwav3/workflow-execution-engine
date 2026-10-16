import { afterEach, describe, expect, it, vi } from "vitest";
import { PG_POOL_DEFAULTS, loadPgPoolConfig } from "@/db/config.js";

const requiredEnv = {
  PGHOST: "localhost",
  PGDATABASE: "workflow_db",
  PGUSER: "workflow",
  PGPASSWORD: "secret",
};

function stubRequiredEnv(): void {
  for (const [key, value] of Object.entries(requiredEnv)) {
    vi.stubEnv(key, value);
  }

  vi.stubEnv("PGSSLMODE", undefined);
  vi.stubEnv("PGSSLROOTCERT", undefined);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadPgPoolConfig", () => {
  it("throws when a required environment variable is missing", () => {
    stubRequiredEnv();
    vi.stubEnv("PGDATABASE", undefined);

    const load = () => loadPgPoolConfig();

    expect(load).toThrow("Missing required environment variable: PGDATABASE");
  });

  it("loads required values and applies defaults for optional pool settings", () => {
    stubRequiredEnv();

    const config = loadPgPoolConfig();

    expect(config.host).toBe("localhost");
    expect(config.database).toBe("workflow_db");
    expect(config.user).toBe("workflow");
    expect(config.password).toBe("secret");
    expect(config.port).toBe(PG_POOL_DEFAULTS.port);
    expect(config.max).toBe(PG_POOL_DEFAULTS.max);
    expect(config.min).toBe(PG_POOL_DEFAULTS.min);
    expect(config.idleTimeoutMillis).toBe(PG_POOL_DEFAULTS.idleTimeoutMillis);
    expect(config.connectionTimeoutMillis).toBe(PG_POOL_DEFAULTS.connectionTimeoutMillis);
    expect(config.maxLifetimeSeconds).toBe(PG_POOL_DEFAULTS.maxLifetimeSeconds);
  });

  it("respects overridden optional pool settings", () => {
    stubRequiredEnv();
    vi.stubEnv("PG_POOL_MAX", "20");
    vi.stubEnv("PG_POOL_MIN", "5");

    const config = loadPgPoolConfig();

    expect(config.max).toBe(20);
    expect(config.min).toBe(5);
  });

  it("throws when an optional numeric environment variable is not a number", () => {
    stubRequiredEnv();
    vi.stubEnv("PG_POOL_MAX", "not-a-number");

    const load = () => loadPgPoolConfig();

    expect(load).toThrow("Environment variable PG_POOL_MAX must be an integer, got: not-a-number");
  });

  describe("ssl", () => {
    it("disables TLS when no TLS variable is set", () => {
      stubRequiredEnv();

      const config = loadPgPoolConfig();

      expect(config.ssl).toEqual({ mode: "disable" });
    });

    it("disables TLS when PGSSLMODE is disable", () => {
      stubRequiredEnv();
      vi.stubEnv("PGSSLMODE", "disable");

      const config = loadPgPoolConfig();

      expect(config.ssl).toEqual({ mode: "disable" });
    });

    it("loads verify-full with the root certificate path", () => {
      stubRequiredEnv();
      vi.stubEnv("PGSSLMODE", "verify-full");
      vi.stubEnv("PGSSLROOTCERT", "/certs/ca.pem");

      const config = loadPgPoolConfig();

      expect(config.ssl).toEqual({ mode: "verify-full", rootCertPath: "/certs/ca.pem" });
    });

    it("throws when verify-full has no root certificate path", () => {
      stubRequiredEnv();
      vi.stubEnv("PGSSLMODE", "verify-full");

      const load = () => loadPgPoolConfig();

      expect(load).toThrow(
        "Missing required environment variable: PGSSLROOTCERT — required when PGSSLMODE=verify-full",
      );
    });

    it("throws when PGSSLMODE is not a supported mode", () => {
      stubRequiredEnv();
      vi.stubEnv("PGSSLMODE", "require");

      const load = () => loadPgPoolConfig();

      expect(load).toThrow(
        'Environment variable PGSSLMODE must be "disable" or "verify-full", got: require',
      );
    });

    it("throws when PGSSLROOTCERT is set without verify-full", () => {
      stubRequiredEnv();
      vi.stubEnv("PGSSLROOTCERT", "/certs/ca.pem");

      const load = () => loadPgPoolConfig();

      expect(load).toThrow("PGSSLROOTCERT is set but PGSSLMODE is not verify-full");
    });
  });
});
