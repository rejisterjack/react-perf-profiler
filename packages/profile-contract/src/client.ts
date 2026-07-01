/**
 * Lightweight typed client for the React Perf Profiler web API.
 *
 * Used by the browser extension (and the CLI) to upload profiles to a user's
 * account. Pure-fetch — no React, no DOM dependencies beyond `fetch` and
 * `localStorage`, which are available in extension service workers, browsers,
 * and Node 18+.
 *
 * Token lifecycle:
 *   1. The user signs in via `login()` (email/password) and receives an
 *      access token (15 min) and a refresh token (30 d).
 *   2. The client persists both tokens via the configured `storage`.
 *   3. When an access token expires, the client transparently refreshes it
 *      using the stored refresh token. If the refresh fails, callers receive
 *      an `UNAUTHORIZED` error and should prompt the user to sign in again.
 */

import type {
  ProfileMetadata,
  ProfileRecord,
  ProfileUploadRequest,
  ProfileUploadResponse,
} from './types.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthSession {
  tokens: AuthTokens;
  user: { id: string; email: string; name: string };
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export class ProfileApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    status: number,
    opts?: { requestId?: string; details?: unknown },
  ) {
    super(message);
    this.name = 'ProfileApiError';
    this.code = code;
    this.status = status;
    this.requestId = opts?.requestId;
    this.details = opts?.details;
  }
}

/** Pluggable token storage. Defaults to localStorage in browsers. */
export interface TokenStorage {
  get(): AuthTokens | null;
  set(tokens: AuthTokens): void;
  clear(): void;
}

const STORAGE_KEY = 'rpp:tokens';

const browserStorage: TokenStorage = {
  get() {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthTokens;
    } catch {
      return null;
    }
  },
  set(tokens) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  },
  clear() {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  },
};

export interface ProfileClientConfig {
  /** Base URL of the web API, e.g. `https://reactperfprofiler.com`. */
  baseUrl: string;
  /** Custom fetch (e.g. for extension service workers). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Custom token storage. Defaults to localStorage. */
  storage?: TokenStorage;
  /** Optional request timeout in ms. */
  timeoutMs?: number;
}

export class ProfileClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly storage: TokenStorage;
  private readonly timeoutMs?: number;
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor(config: ProfileClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    this.storage = config.storage ?? browserStorage;
    this.timeoutMs = config.timeoutMs;
  }

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  async signUp(email: string, password: string, name: string): Promise<AuthSession> {
    const session = await this.request<AuthSession>('POST', '/api/auth/register', {
      email,
      password,
      name,
    });
    this.storage.set(session.tokens);
    return session;
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const session = await this.request<AuthSession>('POST', '/api/auth/login', { email, password });
    this.storage.set(session.tokens);
    return session;
  }

  /** Sign out locally. (Server-side revocation is a Phase 5 follow-up.) */
  signOut(): void {
    this.storage.clear();
  }

  /** True if a (possibly-expired) refresh token is present. */
  isAuthenticated(): boolean {
    return this.storage.get() !== null;
  }

  // -------------------------------------------------------------------------
  // Profiles
  // -------------------------------------------------------------------------

  async uploadProfile(payload: ProfileUploadRequest): Promise<ProfileUploadResponse> {
    return this.request<ProfileUploadResponse>('POST', '/api/profiles', payload, { auth: true });
  }

  async listProfiles(opts?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ profiles: ProfileRecord[]; nextCursor: string | null; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.cursor) params.set('cursor', opts.cursor);
    const query = params.toString();
    return this.request('GET', `/api/profiles${query ? `?${query}` : ''}`, undefined, {
      auth: true,
    });
  }

  async getProfile(id: string): Promise<{ profile: ProfileRecord }> {
    return this.request('GET', `/api/profiles/${id}`, undefined, { auth: true });
  }

  async deleteProfile(id: string): Promise<void> {
    await this.request('DELETE', `/api/profiles/${id}`, undefined, { auth: true });
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * Refresh the access token using the stored refresh token. Multiple
   * concurrent callers share the same in-flight refresh to avoid storms.
   */
  private async refresh(): Promise<AuthTokens> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      const current = this.storage.get();
      if (!current?.refreshToken) {
        throw new ProfileApiError('UNAUTHORIZED', 'No refresh token', 401);
      }
      try {
        const body = (await this.request<{
          accessToken: string;
          refreshToken: string;
          expiresIn: number;
        }>('POST', '/api/auth/refresh', { refreshToken: current.refreshToken })) as AuthTokens;
        this.storage.set(body);
        return body;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    opts: { auth?: boolean } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (opts.auth) {
      const tokens = this.storage.get();
      if (!tokens?.accessToken) {
        throw new ProfileApiError('UNAUTHORIZED', 'Not authenticated', 401);
      }
      headers.Authorization = `Bearer ${tokens.accessToken}`;
    }

    const doFetch = (authHeader?: string): Promise<Response> => {
      if (authHeader) headers.Authorization = authHeader;
      return this.fetchImpl(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: this.timeoutMs ? AbortSignal.timeout(this.timeoutMs) : undefined,
      });
    };

    let response = await doFetch();

    // If the access token expired, refresh once and retry.
    if (response.status === 401 && opts.auth) {
      try {
        const refreshed = await this.refresh();
        response = await doFetch(`Bearer ${refreshed.accessToken}`);
      } catch (err) {
        this.storage.clear();
        throw err;
      }
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as {
        error?: ApiError;
      };
      const e = errorBody.error ?? {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      };
      throw new ProfileApiError(e.code, e.message, response.status, {
        requestId: e.requestId,
        details: e.details,
      });
    }

    // 204 / empty body
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  }
}

// Re-export the metadata type so callers don't need a second import.
export type { ProfileMetadata };
