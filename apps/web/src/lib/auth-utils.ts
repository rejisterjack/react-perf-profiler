import { auth } from './auth';
import jwt from 'jsonwebtoken';

/**
 * Helper to get user from either a JWT Bearer token or a NextAuth session.
 * Checks Bearer token first (cheap verify) before falling back to NextAuth (DB call).
 *
 * Accepts two token shapes:
 *  - New short-lived access tokens ({ kind: 'access' }, 15 min TTL)
 *  - Legacy long-lived tokens issued before the refresh-token rollout
 *    (no `kind` claim, 7 d TTL). These continue to validate until they
 *    naturally expire; new clients should use the access/refresh flow.
 */
export async function getAuthUser(request: Request): Promise<{ id: string; email: string } | null> {
  // Try JWT Bearer token first (cheap — no DB query)
  const header = request.headers.get('authorization');
  if (header?.startsWith('Bearer ')) {
    try {
      const token = header.slice(7);
      const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
        sub?: string;
        id?: string; // legacy claim
        email?: string;
        kind?: string;
      };

      // Reject refresh tokens presented as access tokens.
      if (payload.kind === 'refresh') {
        return null;
      }

      const id = payload.sub ?? payload.id;
      if (id && payload.email) {
        return { id, email: payload.email };
      }
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
