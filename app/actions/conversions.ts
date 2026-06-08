'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import { getCurrentUserId } from '@/app/lib/auth';

export async function createConversion(data: {
  fromUserId: string;
  fromCur: 'UYU' | 'USD';
  toUserId: string;
  toCur: 'UYU' | 'USD';
  fromAmount: number;
  rate: number;
  toAmount: number;
  date: string;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect('/login');

  await prisma.conversion.create({
    data: {
      date: new Date(data.date),
      fromUserId: data.fromUserId,
      fromCur: data.fromCur,
      toUserId: data.toUserId,
      toCur: data.toCur,
      fromAmount: data.fromAmount,
      rate: data.rate,
      toAmount: data.toAmount,
      userId,
    },
  });

  revalidatePath('/saldos');
  redirect('/saldos');
}
