import { describe, it, expect } from 'vitest';
import { generateCodeChallenge, generateCodeVerifier } from '@/shared/cloud/googlePkce';

describe('googlePkce', () => {
  it('generates verifier in RFC 7636 length range', () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
  });

  it('produces deterministic challenge for a fixed verifier', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const c1 = await generateCodeChallenge(verifier);
    const c2 = await generateCodeChallenge(verifier);
    expect(c1).toBe(c2);
    expect(c1.length).toBeGreaterThan(0);
    expect(c1).not.toContain('+');
    expect(c1).not.toContain('/');
  });
});
