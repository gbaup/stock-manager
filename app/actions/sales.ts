'use server';

import { redirect } from 'next/navigation';
import { getCurrentUserId } from '@/app/lib/auth';
import { saleSchema, parseOrThrow } from '@/app/lib/schemas';
import { recordSale, NotEnoughStockError } from '@/app/lib/inventory';
import { prisma } from '@/app/lib/prisma';

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

  const available = await prisma.inventoryItem.count({
    where: { catalogProductId: modelId, size: data.size, status: 'available', shipmentId: { not: null } },
  });
  if (available < qty) throw new Error('Stock insuficiente');

  for (let i = 0; i < qty; i++) {
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
        userId,
      );
    } catch (e) {
      if (e instanceof NotEnoughStockError) throw new Error('Stock insuficiente');
      throw e;
    }
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
