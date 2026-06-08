'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import { gastoSchema } from '@/app/lib/schemas';
import { getCurrentUserId } from '@/app/lib/auth';

export async function createExpense(data: {
  title: string;
  amount: string;
  currency: string;
  paidByUserId: string;
  date: string;
}) {
  if (!gastoSchema.safeParse(data).success) throw new Error('Invalid expense data');

  const userId = await getCurrentUserId();
  if (!userId) redirect('/login');

  await prisma.expense.create({
    data: {
      title: data.title.trim().toLowerCase(),
      amount: parseFloat(data.amount),
      currency: data.currency,
      paidByUserId: data.paidByUserId,
      date: new Date(data.date),
      userId,
    },
  });

  revalidatePath('/saldos');
  redirect('/saldos');
}
