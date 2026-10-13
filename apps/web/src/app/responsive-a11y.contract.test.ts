import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const globalStyles = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');
const marketingStyles = readFileSync(new URL('./marketing.css', import.meta.url), 'utf8');

describe('responsive and accessibility style contract', () => {
  it('keeps app layouts covered from desktop through phone breakpoints', () => {
    expect(globalStyles).toContain('@media (max-width: 1023px)');
    expect(globalStyles).toContain('@media (max-width: 700px)');
    expect(globalStyles).toContain('env(safe-area-inset-bottom');
    expect(marketingStyles).toContain('@media (max-width: 1024px)');
    expect(marketingStyles).toContain('@media (max-width: 760px)');
    expect(marketingStyles).toContain('@media (max-width: 480px)');
  });

  it('keeps keyboard focus and reduced-motion protections enabled', () => {
    expect(globalStyles).toContain('button:focus-visible');
    expect(globalStyles).toContain("[role='button']:focus-visible");
    expect(globalStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(marketingStyles).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
