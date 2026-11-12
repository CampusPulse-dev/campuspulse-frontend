import { describe, expect, it } from 'vitest';
import { isOptimizableImage, mediaHosts } from './media';

describe('media allowlist', () => {
  it('parses a comma-separated host list', () => {
    expect(mediaHosts(' media.campuspulse.ng, CDN.example.com ,')).toEqual([
      'media.campuspulse.ng',
      'cdn.example.com',
    ]);
  });

  it('optimizes only https URLs on allowlisted hosts', () => {
    const hosts = ['media.campuspulse.ng'];
    expect(isOptimizableImage('https://media.campuspulse.ng/a.jpg', hosts)).toBe(true);
    expect(isOptimizableImage('http://media.campuspulse.ng/a.jpg', hosts)).toBe(false);
    expect(isOptimizableImage('https://evil.example/a.jpg', hosts)).toBe(false);
    expect(isOptimizableImage('not a url', hosts)).toBe(false);
  });

  it('optimizes our own static paths but not protocol-relative URLs', () => {
    expect(isOptimizableImage('/demo/events/a.webp', [])).toBe(true);
    expect(isOptimizableImage('//evil.example/a.jpg', [])).toBe(false);
    expect(isOptimizableImage('/\\evil.example/a.jpg', [])).toBe(false);
  });
});
