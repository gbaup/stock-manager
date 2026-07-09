'use server';

import { redirect } from 'next/navigation';
import { getCurrentUserId } from '@/app/lib/auth';
import { getModelById } from '@/app/lib/queries';

export async function fetchModelDetail(id: string) {
  const userId = await getCurrentUserId();
  if (!userId) redirect('/login');

  return getModelById(id);
}
