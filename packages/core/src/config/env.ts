export function requireEnv(name: string, hint?: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}${hint ? ` — ${hint}` : ""}`);
  }

  return value;
}
