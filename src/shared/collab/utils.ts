/**
 * Collaboration Utilities
 * @module shared/collab/utils
 */

/**
 * Generate a memorable 6-digit session code
 * Uses alternating consonants and vowels for readability
 */
export function generateSessionCode(): string {
  const consonants = 'BCDFGHJKLMNPQRSTVWXZ';
  const vowels = 'AEIOUY';
  const numbers = '0123456789';
  
  let code = '';
  
  // Format: XX-XX-XX (e.g., BA-RE-42)
  for (let i = 0; i < 2; i++) {
    code += consonants[Math.floor(Math.random() * consonants.length)];
    code += vowels[Math.floor(Math.random() * vowels.length)];
  }
  code += numbers[Math.floor(Math.random() * numbers.length)];
  code += numbers[Math.floor(Math.random() * numbers.length)];
  
  return code;
}

/**
 * Format session code for display (BA-RE-42)
 */
export function formatSessionCode(code: string): string {
  if (code.length !== 6) return code;
  return `${code.slice(0, 2)}-${code.slice(2, 4)}-${code.slice(4)}`;
}

/**
 * Validate session code format
 */
export function isValidSessionCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code.toUpperCase());
}

/**
 * Normalize session code (uppercase, remove dashes)
 */
export function normalizeSessionCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Generate a display name from a user agent
 */
export function generateDisplayName(): string {
  const adjectives = [
    'Swift', 'Bright', 'Clever', 'Bold', 'Calm', 'Eager', 'Gentle', 'Happy',
    'Jolly', 'Kind', 'Lively', 'Proud', 'Silly', 'Witty', 'Zesty', 'Brave',
  ];
  const nouns = [
    'Coder', 'Debugger', 'Profiler', 'Builder', 'Hacker', 'Maker', 'Creator',
    'Dev', 'Engineer', 'Architect', 'Wizard', 'Ninja', 'Pilot', 'Captain',
  ];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adj} ${noun}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
