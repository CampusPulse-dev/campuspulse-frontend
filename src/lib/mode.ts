/** Deliberate build-time selection. Live failures never become fixture success. */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
export const DATA_MODE = DEMO_MODE ? 'demo' : 'live';
export function safeNext(value: string | null): string {
  return value &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes(String.fromCharCode(92)) &&
    !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : '/';
}
