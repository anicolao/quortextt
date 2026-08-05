export interface BrowserLocation {
  readonly origin: string;
}

/**
 * Resolve the multiplayer server without exposing the production-only port.
 * Deployed builds use Nginx and local development uses Vite's proxy, so the
 * default is the browser's current origin in both environments.
 */
export function resolveServerUrl(
  configuredUrl: string | undefined,
  location: BrowserLocation = window.location,
): string {
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');
  return location.origin;
}
