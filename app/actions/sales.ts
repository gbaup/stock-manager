'use server';

import { redirect } from 'next/navigation';
import { getCurrentUserId } from '@/app/lib/auth';
import {
  saleSchema, saleEditSchema, saleSwapSchema, parseOrThrow,
  type SaleEditFormValues, type SaleSwapFormValues,
} from '@/app/lib/schemas';
import {
  recordSale, NotEnoughStockError,
  cancelSale as cancelSaleInventory,
  updateSaleDetails, swapSaleItem,
} from '@/app/lib/inventory';

type SaleInput = {
  size: string;
  price: string;
  quantity: string;
  date: string;
  method?: string;
  description?: string;
  collectedByUserId?: string;
};

async function executeSale(modelId: string, data: SaleInput): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) redirect('/login');

  parseOrThrow(saleSchema, data);

  const qty = parseInt(data.quantity, 10);
  const priceUyu = parseFloat(data.price);
  const saleDate = new Date(data.date);

  try {
    await recordSale(
      {
        modelId,
        size: data.size,
        priceUyu,
        date: saleDate,
        method: data.method?.trim().toLowerCase() || null,
        description: data.description?.trim().toLowerCase() || null,
        collectedByUserId: data.collectedByUserId || null,
      },
      qty,
      userId,
    );
  } catch (e) {
    if (e instanceof NotEnoughStockError) throw new Error('Stock insuficiente');
    throw e;
  }
}

export async function createSaleFromHome(
  modelId: string,
  data: SaleInput & { collectedByUserId: string },
) {
  await executeSale(modelId, data);
  // No redirect: recordSale already calls updateTag(models/saldos), so the
  // /home route re-renders with fresh data. The client resets the form itself
  // (QuickSaleForm.resetForm) — redirecting here would throw NEXT_REDIRECT,
  // which the caller's try/catch would swallow as a bogus save error.
}

export async function createSale(modelId: string, data: SaleInput, opts?: { skipRedirect?: boolean }) {
  await executeSale(modelId, data);
  if (opts?.skipRedirect) return;
  redirect('/');
}

export async function updateSale(saleId: string, data: SaleEditFormValues) {
  const userId = await getCurrentUserId();
  if (!userId) redirect('/login');

  parseOrThrow(saleEditSchema, data);

  await updateSaleDetails(saleId, {
    priceUyu: parseFloat(data.price),
    date: new Date(data.date),
    method: data.method?.trim().toLowerCase() || null,
    description: data.description?.trim().toLowerCase() || null,
    collectedByUserId: data.collectedByUserId || null,
  });
}

export async function cancelSale(saleId: string) {
  const userId = await getCurrentUserId();
  if (!userId) redirect('/login');

  await cancelSaleInventory(saleId);
}

export async function swapSale(saleId: string, data: SaleSwapFormValues) {
  const userId = await getCurrentUserId();
  if (!userId) redirect('/login');

  parseOrThrow(saleSwapSchema, data);

  try {
    await swapSaleItem(saleId, {
      modelId: data.modelId,
      size: data.size,
      priceUyu: parseFloat(data.price),
    });
  } catch (e) {
    if (e instanceof NotEnoughStockError) throw new Error('Stock insuficiente');
    throw e;
  }
}
