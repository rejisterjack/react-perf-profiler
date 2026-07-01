/**
 * Prisma seed script — creates a demo user so a freshly-provisioned database
 * can be exercised end-to-end without signing up.
 *
 * Run with: `bunx prisma db seed` (configured in apps/web/package.json).
 *
 * Override the demo credentials via env if you want to set them in prod-like
 * environments (the script refuses to run unless NODE_ENV !== 'production').
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Skipping seed in production.');
    return;
  }

  const email = process.env.SEED_USER_EMAIL ?? 'demo@reactperfprofiler.com';
  const password = process.env.SEED_USER_PASSWORD ?? 'DemoPassword-12345';

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Demo User',
      password: hashed,
    },
    select: { id: true, email: true, name: true },
  });

  console.log(`Seeded demo user: ${user.email} (${user.id})`);
  console.log('Login with:');
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
