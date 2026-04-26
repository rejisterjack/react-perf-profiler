/**
 * PKCE helpers for Google OAuth (public client, no client secret in extension).
 * @module shared/cloud/googlePkce
 */

function base64UrlEncode(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let binary = '';
  for (const byte of u8) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * RFC 7636 code_verifier: 43–128 char URL-safe string.
 */
export function generateCodeVerifier(): string {
  const random = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(random.buffer);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}
