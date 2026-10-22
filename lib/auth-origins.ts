// Permit explicit loopback origins only when the configured app itself is local.
// Production deployments continue to trust their configured origin exclusively.
export function authOrigins(baseURL: string | undefined): string[] {
  if (!baseURL) return [];
  const origin = new URL(baseURL).origin;
  const hostname = new URL(baseURL).hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') return [origin];
  return [...new Set([
    origin,
    'http://localhost:9000',
    'http://127.0.0.1:9000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ])];
}
