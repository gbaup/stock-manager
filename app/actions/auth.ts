'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import { createSession, deleteSession, verifyPassword } from '@/app/lib/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(_prev: unknown, formData: FormData) {
  const result = loginSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  const { email, password } = result.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { message: 'Credenciales inválidas' };
  }

  await createSession(user.id);
  redirect('/inventory');
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}
