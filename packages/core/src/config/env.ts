export function requireEnv(name: string, hint?: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}${hint ? ` — ${hint}` : ""}`);
  }

  return value;
}

export function optionalIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${raw}`);
  }

  return parsed;
}

// Strict so "10ms" or "0" fails at startup, not later at runtime; parseInt would accept both.
export function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw new Error(`Environment variable ${name} must be a positive integer, got: ${raw}`);
  }

  return Number(raw);
}
