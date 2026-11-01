import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { springGentle, springSnappy, fadeInUp } from './motion';

const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const manifest = JSON.parse(
  readFileSync(join(process.cwd(), 'public/manifest.webmanifest'), 'utf8'),
) as { icons: { src: string }[] };

describe('design tokens', () => {
  // Measured from the Figma brand identity board (node 200:3523).
  it.each([
    ['lavender', '#e0aaff'],
    ['purple', '#5a189a'],
    ['ink', '#10002b'],
  ])('defines the brand %s as %s', (name, hex) => {
    expect(tokens).toContain(`--cp-${name}: ${hex}`);
  });

  it('defines a colour for each of the five PRD categories', () => {
    for (const c of ['social', 'performance', 'academic', 'sports', 'club']) {
      expect(tokens).toContain(`--color-category-${c}:`);
      expect(tokens).toContain(`--cat-${c}:`);
    }
  });

  it('defines semantic status tokens for scanner and RSVP states', () => {
    for (const status of ['success', 'warning', 'danger']) {
      expect(tokens).toContain(`--status-${status}:`);
      expect(tokens).toContain(`--status-${status}-bg:`);
    }
  });

  it('defines the JetBrains Mono data font token with safe fallback', () => {
    expect(tokens).toContain('--font-mono: var(--font-jetbrains-mono, ui-monospace)');
  });

  it('falls back safely when the commercial display font is absent', () => {
    // A bare var(--font-goodly) would invalidate the whole declaration
    // when the font is not installed, silently killing all typography.
    expect(tokens).toContain('var(--font-goodly, var(--font-inter))');
  });

  it('supports an explicit dark theme as well as the system preference', () => {
    expect(tokens).toContain("[data-theme='dark']");
    expect(tokens).toContain('prefers-color-scheme: dark');
  });

  it('wires brand icons in manifest.webmanifest', () => {
    expect(manifest.icons.length).toBeGreaterThan(0);
    expect(manifest.icons[0]?.src).toBe('/brand/logo.svg');
  });

  it('exports Framer Motion spring and fade presets using GPU-safe transforms', () => {
    expect(springSnappy.type).toBe('spring');
    expect(springGentle.type).toBe('spring');
    expect(fadeInUp.hidden).toMatchObject({ opacity: 0, y: 12 });
    expect(fadeInUp.visible).toMatchObject({ opacity: 1, y: 0 });
  });
});
