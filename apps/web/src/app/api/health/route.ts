import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HealthCheck {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: 'connected' | 'disconnected';
  };
  checks: {
    liveness: boolean;
    readiness: boolean;
  };
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const checks: HealthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? '1.0.0',
    services: { database: 'connected' },
    checks: { liveness: true, readiness: true },
  };

  // Check for liveness probe (lightweight — just check if the process is alive)
  const url = new URL(request.url);
  const probe = url.searchParams.get('probe');

  if (probe === 'liveness') {
    return NextResponse.json({ status: 'ok', timestamp: checks.timestamp });
  }

  // Readiness probe — check all dependencies
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 3000)),
    ]);
  } catch {
    checks.services.database = 'disconnected';
    checks.status = 'unhealthy';
    checks.checks.readiness = false;
  }

  // Add response time header
  const responseTime = Date.now() - startTime;

  if (checks.status === 'unhealthy') {
    return NextResponse.json(
      { ...checks, responseTimeMs: responseTime },
      { status: 503, headers: { 'X-Response-Time': `${responseTime}ms` } },
    );
  }

  return NextResponse.json(
    { ...checks, responseTimeMs: responseTime },
    { headers: { 'X-Response-Time': `${responseTime}ms` } },
  );
}
