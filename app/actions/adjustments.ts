'use server';

import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import { ajusteSchema, parseOrThrow } from '@/app/lib/schemas';
import { getCurrentUserId } from '@/app/lib/auth';

export async function createAdjustment(data: {
  userId: string;
  amountUyu?: string;
  amountUsd?: string;
  date: string;
  note?: string;
}) {
  parseOrThrow(ajusteSchema, data);

  const loggedBy = await getCurrentUserId();
  if (!loggedBy) redirect('/login');

  await prisma.adjustment.create({
    data: {
      userId: data.userId,
      amountUyu: parseFloat(data.amountUyu ?? '') || 0,
      amountUsd: parseFloat(data.amountUsd ?? '') || 0,
      date: new Date(data.date),
      note: data.note?.trim().toLowerCase() || null,
      loggedByUserId: loggedBy,
    },
  });

  updateTag('saldos');
  redirect('/saldos');
}
