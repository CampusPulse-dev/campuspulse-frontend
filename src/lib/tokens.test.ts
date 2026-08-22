import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

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
    }
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
});
