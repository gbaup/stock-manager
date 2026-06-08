'use server';

import { z } from 'zod';
import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import { parseOrThrow } from '@/app/lib/schemas';
import { getCurrentUserId } from '@/app/lib/auth';

const conversionActionSchema = z.object({
  fromUserId: z.string().uuid(),
  fromCur: z.enum(['UYU', 'USD']),
  toUserId: z.string().uuid(),
  toCur: z.enum(['UYU', 'USD']),
  fromAmount: z.number().finite().positive(),
  rate: z.number().finite().min(0),
  toAmount: z.number().finite().positive(),
  date: z.string().min(1),
});

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
  parseOrThrow(conversionActionSchema, data);

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

  updateTag('saldos');
  redirect('/saldos');
}
