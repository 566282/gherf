const CSRF_STORAGE_KEY = 'investpro.csrf.token';
const SESSION_STORAGE_KEY = 'investpro.session.id';
const RATE_LIMIT_WINDOW_CACHE = new Map<string, number[]>();

export function sanitizePlainText(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>`]/g, '')
    .trim();
}

export function sanitizeEmail(value: string): string {
  return sanitizePlainText(value).toLowerCase();
}

export function sanitizeSearchTerm(value: string): string {
  return sanitizePlainText(value)
    .replace(/[^a-z0-9@._\-\s]/gi, '')
    .slice(0, 64);
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined' || typeof crypto === 'undefined') {
    return 'server';
  }

  const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated = crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}

export function getOrCreateCsrfToken(): string {
  if (typeof window === 'undefined' || typeof crypto === 'undefined') {
    return 'server';
  }

  const existing = window.sessionStorage.getItem(CSRF_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  window.sessionStorage.setItem(CSRF_STORAGE_KEY, generated);
  return generated;
}

export function rotateCsrfToken(): string {
  if (typeof window === 'undefined' || typeof crypto === 'undefined') {
    return 'server';
  }

  const generated = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  window.sessionStorage.setItem(CSRF_STORAGE_KEY, generated);
  return generated;
}

export function getDeviceFingerprintInput(): string {
  if (typeof navigator === 'undefined' || typeof Intl === 'undefined') {
    return 'unknown-device';
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const language = navigator.language ?? 'en';
  const platform = navigator.platform ?? 'unknown';
  const userAgent = navigator.userAgent ?? 'unknown';

  return [platform, language, timezone, userAgent].join('|');
}

export async function sha256Hex(value: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return value;
  }

  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function enforceLocalRateLimit(scope: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entries = RATE_LIMIT_WINDOW_CACHE.get(scope) ?? [];
  const active = entries.filter((timestamp) => now - timestamp < windowMs);

  if (active.length >= limit) {
    RATE_LIMIT_WINDOW_CACHE.set(scope, active);
    return false;
  }

  active.push(now);
  RATE_LIMIT_WINDOW_CACHE.set(scope, active);
  return true;
}

export function clearSecuritySessionState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(CSRF_STORAGE_KEY);
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}
