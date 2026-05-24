/**
 * Shallow equality comparison for objects.
 * Compares own enumerable properties by reference/value (===).
 */

export function shallowEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}
