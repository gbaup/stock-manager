'use server';

import { getModelById } from '@/app/lib/queries';

export async function fetchModelDetail(id: string) {
  return getModelById(id);
}
