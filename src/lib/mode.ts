/** Deliberate build-time selection. Live failures never become fixture success. */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
// TODO(S1-02): replace with real JWT session once S1-02 lands.
export const DEV_AUTH_MODE = !DEMO_MODE && process.env.NEXT_PUBLIC_DEV_AUTH === 'true';
export const DATA_MODE = DEMO_MODE ? 'demo' : 'live';

const DEV_AUTH_STORAGE_KEY = 'cp_dev_auth_email_v1';

// TODO(S1-02): remove getDevAuthEmail / setDevAuthEmail when X-Dev-User auth is retired.
export function getDevAuthEmail(): string | null {
  if (!DEV_AUTH_MODE || typeof window === 'undefined') return null;
  const raw = localStorage.getItem(DEV_AUTH_STORAGE_KEY)?.trim().toLowerCase();
  return raw ? raw : null;
}

export function setDevAuthEmail(email: string | null): void {
  if (typeof window === 'undefined') return;
  if (!email) {
    localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(DEV_AUTH_STORAGE_KEY, email.trim().toLowerCase());
}

export function safeNext(value: string | null): string {
  return value &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes(String.fromCharCode(92)) &&
    !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : '/';
}
