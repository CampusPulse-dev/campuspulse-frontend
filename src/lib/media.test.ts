import { describe, expect, it } from 'vitest';
import { imageSource, isOptimizableImage, mediaHosts, sameSiteImage } from './media';

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

  it('turns absolute URLs on our own site into optimizable paths', () => {
    const site = 'https://campuspulse.ng';
    expect(sameSiteImage('https://campuspulse.ng/demo/a.webp?v=2', site)).toBe('/demo/a.webp?v=2');
    expect(sameSiteImage('https://campuspulse.ng.evil.example/a.webp', site)).toBe(
      'https://campuspulse.ng.evil.example/a.webp',
    );
    expect(sameSiteImage('http://campuspulse.ng/a.webp', site)).toBe(
      'http://campuspulse.ng/a.webp',
    );
    expect(sameSiteImage('/demo/a.webp', site)).toBe('/demo/a.webp');
    expect(imageSource('https://evil.example/a.jpg', [])).toEqual({
      src: 'https://evil.example/a.jpg',
      unoptimized: true,
    });
  });
});
