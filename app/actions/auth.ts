'use server'

import { PrismaClient } from '@prisma/client';
import { createSession, verifyPassword } from '@/app/lib/auth';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { PrismaPg } from '@prisma/adapter-pg';


const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1, 'Password is required'),
});

export async function login(prevState: any, formData: FormData) {
    const result = loginSchema.safeParse(Object.fromEntries(formData));

    if (!result.success) {
        return {
            errors: result.error.flatten().fieldErrors,
        };
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        return {
            message: 'Invalid credentials',
        };
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
        return {
            message: 'Invalid credentials',
        };
    }

    await createSession(user.id.toString());
    redirect('/dashboard');
}
