'use server';

import { redirect } from 'next/navigation';
import { getCurrentUserId } from '@/app/lib/auth';
import { reserveSchema, saleEditSchema, parseOrThrow, type SaleEditFormValues } from '@/app/lib/schemas';
import {
  reserveItems, NotEnoughStockError, ReservationResolvedError,
  releaseReservation as releaseReservationInventory,
  sellReservedItem as sellReservedItemInventory,
} from '@/app/lib/inventory';

type ReserveInput = {
  size: string;
  quantity: string;
  note?: string;
};

export async function reserveStock(modelId: string, data: ReserveInput) {
  const userId = await getCurrentUserId();
  if (!userId) redirect('/login');

  parseOrThrow(reserveSchema, data);

  try {
    await reserveItems(modelId, data.size, parseInt(data.quantity, 10), data.note?.trim() || null);
  } catch (e) {
    if (e instanceof NotEnoughStockError) throw new Error('Stock insuficiente');
    throw e;
  }
}

export async function releaseReservation(itemId: string) {
  const userId = await getCurrentUserId();
  if (!userId) redirect('/login');

  await releaseReservationInventory(itemId);
}

export async function sellReservedItem(itemId: string, data: SaleEditFormValues) {
  const userId = await getCurrentUserId();
  if (!userId) redirect('/login');

  parseOrThrow(saleEditSchema, data);

  try {
    await sellReservedItemInventory(
      itemId,
      {
        priceUyu: parseFloat(data.price),
        date: new Date(data.date),
        method: data.method?.trim().toLowerCase() || null,
        description: data.description?.trim().toLowerCase() || null,
        collectedByUserId: data.collectedByUserId || null,
      },
      userId,
    );
  } catch (e) {
    if (e instanceof ReservationResolvedError) throw new Error(e.message);
    throw e;
  }
}
