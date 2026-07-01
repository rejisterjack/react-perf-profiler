import { NextResponse } from 'next/server';
import { openApiDocument } from '@/lib/openapi';

/**
 * Serves the OpenAPI 3.1 spec for the React Perf Profiler API at
 * `/api/openapi.json`. Linked from the docs and consumable by Swagger UI,
 * Postman, etc.
 */
export async function GET() {
  return NextResponse.json(openApiDocument, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
