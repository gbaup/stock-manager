'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';

export async function createExpense(data: {
  title: string;
  amount: string;
  currency: string;
  paidBy: string;
  date: string;
}) {
  await prisma.expense.create({
    data: {
      title: data.title.trim().toLowerCase(),
      amount: parseFloat(data.amount),
      currency: data.currency,
      paidBy: data.paidBy.trim().toLowerCase(),
      date: new Date(data.date),
    },
  });

  revalidatePath('/saldos');
  redirect('/saldos');
}
