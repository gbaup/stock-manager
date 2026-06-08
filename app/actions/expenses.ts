'use server';

import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import { gastoSchema, parseOrThrow } from '@/app/lib/schemas';
import { getCurrentUserId } from '@/app/lib/auth';

export async function createExpense(data: {
  title: string;
  amount: string;
  currency: string;
  paidByUserId: string;
  date: string;
}) {
  parseOrThrow(gastoSchema, data);

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

  updateTag('saldos');
  redirect('/saldos');
}
