import { auth } from './auth';
import jwt from 'jsonwebtoken';

/**
 * Helper to get user from either JWT Bearer token or NextAuth session.
 * Checks Bearer token first (cheap verify) before falling back to NextAuth (DB call).
 */
export async function getAuthUser(
  request: Request,
): Promise<{ id: string; email: string } | null> {
  // Try JWT Bearer token first (cheap — no DB query)
  const header = request.headers.get('authorization');
  if (header?.startsWith('Bearer ')) {
    try {
      const token = header.slice(7);
      const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
        id: string;
        email: string;
      };
      return { id: payload.id, email: payload.email };
    } catch {
      // Token invalid or expired — fall through
    }
  }

  // Fall back to NextAuth session (may query DB)
  const session = await auth();
  if (session?.user) {
    const u = session.user as { id?: string; email?: string };
    if (u.id && u.email) {
      return { id: u.id, email: u.email };
    }
  }

  return null;
}
