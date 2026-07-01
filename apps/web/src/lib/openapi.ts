/**
 * Hand-authored OpenAPI 3.1 spec for the React Perf Profiler web API.
 *
 * Why hand-authored (not auto-generated): the routes are Next.js route
 * handlers, not Express/Fastify, so we can't introspect them with
 * `swagger-jsdoc` or similar tooling without adding a build step. Hand-
 * authoring keeps the spec in sync with the contract types in
 * `packages/profile-contract` and is easier to review.
 *
 * Served at `/api/openapi.json` (see route at app/api/openapi.json/route.ts)
 * and linked from the docs. Validates with `swagger-cli` in CI.
 */

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'React Perf Profiler API',
    version: '1.0.0',
    description:
      'First-party REST API for the React Perf Profiler. Authenticates extension and CLI clients via JWT bearer tokens issued by `/api/auth/login` and `/api/auth/register`.',
    license: { name: 'MIT', url: 'https://opensource.org/license/mit/' },
  },
  servers: [
    { url: 'https://reactperfprofiler.com', description: 'Production' },
    { url: 'http://localhost:7394', description: 'Local development' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: {},
              requestId: {
                type: 'string',
                description: 'Quote this when reporting errors to support.',
              },
            },
          },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          expiresIn: { type: 'integer', example: 900, description: 'Access token TTL in seconds.' },
          tokenType: { type: 'string', example: 'Bearer' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string', format: 'email' },
              name: { type: 'string' },
            },
          },
        },
      },
      Profile: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          name: { type: 'string' },
          data: {
            type: 'array',
            description: 'Array of CommitData per packages/profile-contract.',
            items: {},
          },
          metadata: { type: 'object' },
          isPublic: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/api/auth/register': {
      post: {
        summary: 'Create an account',
        tags: ['auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: {
                    type: 'string',
                    minLength: 12,
                    description:
                      'Must contain uppercase, lowercase, number, and special character.',
                  },
                  name: { type: 'string', maxLength: 100 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Account created; tokens issued.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          '400': {
            description: 'Validation error.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '409': {
            description: 'Email already in use.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Sign in',
        tags: ['auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Tokens issued.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          '401': {
            description: 'Invalid credentials.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        summary: 'Exchange a refresh token for new access + refresh tokens',
        tags: ['auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Rotated tokens.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          '401': {
            description: 'Invalid refresh token.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/profiles': {
      get: {
        summary: 'List profiles',
        tags: ['profiles'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
          {
            name: 'cursor',
            in: 'query',
            schema: { type: 'string' },
            description: 'Profile id from a previous response.nextCursor.',
          },
        ],
        responses: {
          '200': {
            description: 'A page of profiles.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    profiles: { type: 'array', items: { $ref: '#/components/schemas/Profile' } },
                    nextCursor: { type: 'string', nullable: true },
                    hasMore: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Upload a profile',
        tags: ['profiles'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'data'],
                properties: {
                  name: { type: 'string', maxLength: 200 },
                  data: {
                    type: 'array',
                    description: 'Array of CommitData per packages/profile-contract.',
                    items: {},
                  },
                  analysis: { description: 'Optional pre-computed AnalysisResult.' },
                  metadata: { type: 'object' },
                  isPublic: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Profile stored.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { profile: { $ref: '#/components/schemas/Profile' } },
                },
              },
            },
          },
          '400': {
            description: 'Validation error.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Authentication required.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '413': {
            description: 'Payload exceeds the 10 MB limit.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/profiles/{id}': {
      get: {
        summary: 'Fetch a single profile',
        tags: ['profiles'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'The profile.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { profile: { $ref: '#/components/schemas/Profile' } },
                },
              },
            },
          },
          '403': {
            description: 'Forbidden (private profile owned by another user).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Not found.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
      delete: {
        summary: 'Delete a profile (owner only)',
        tags: ['profiles'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Deleted.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { success: { type: 'boolean' } } },
              },
            },
          },
          '403': {
            description: 'Only the owner can delete.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Not found.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/health': {
      get: {
        summary: 'Liveness & readiness probe',
        tags: ['ops'],
        responses: {
          '200': {
            description: 'Service health.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
                    timestamp: { type: 'string', format: 'date-time' },
                    uptime: { type: 'number' },
                    services: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
