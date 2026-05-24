import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { NextResponse } from 'next/server';

const JWT_SECRET = process.env.NEXTAUTH_SECRET!;

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_])[A-Za-z\d@$!%*?&\-_]+$/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const { email, password, name } = parsed.data;

    // Check for duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: {
            code: 'DUPLICATE_EMAIL',
            message: 'An account with this email already exists',
          },
        },
        { status: 409 },
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Sign JWT for extension clients
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    return NextResponse.json(
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 },
    );
  }
}
