import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isMeliAuthorized, normalizeSize, findUserByMeliId, findModelIdsByListing, linkListing } from '@/app/lib/meli';
import { recordMeliOrder, NotEnoughStockError, type SaleIntent } from '@/app/lib/inventory';
import { invalidateSaleFromRoute } from '@/app/lib/cache-tags';

const bodySchema = z.object({
  orderId: z.string().min(1).max(30),
  sellerId: z.string().min(1),
  date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida'),
  items: z.array(z.object({
    meliItemId: z.string().min(1).max(20),
    // Set only when a human confirmed the AI's guess; it is then saved as the
    // listing's link so the next order resolves on its own.
    modelId: z.string().uuid().optional(),
    size: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
  })).min(1),
}).superRefine((body, ctx) => {
  // The same listing can't be linked to two different models in one order.
  const seen = new Map<string, string | undefined>();
  for (const it of body.items) {
    if (it.modelId && seen.get(it.meliItemId) && seen.get(it.meliItemId) !== it.modelId) {
      ctx.addIssue({ code: 'custom', message: `Modelos en conflicto para ${it.meliItemId}` });
    }
    if (it.modelId) seen.set(it.meliItemId, it.modelId);
  }
});

export async function POST(request: Request) {
  if (!isMeliAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detail: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const { orderId, sellerId, date, items } = parsed.data;

  const user = await findUserByMeliId(sellerId);
  if (!user) return NextResponse.json({ error: 'seller_not_mapped', sellerId }, { status: 422 });

  const linked = await findModelIdsByListing(items.map((i) => i.meliItemId));
  const resolved = items.map((it) => ({ ...it, resolvedModelId: it.modelId ?? linked.get(it.meliItemId) }));

  // Nothing is recorded unless every line resolves to a model.
  const unmatched = resolved.filter((it) => !it.resolvedModelId).map((it) => it.meliItemId);
  if (unmatched.length > 0) return NextResponse.json({ error: 'unmatched', unmatched }, { status: 422 });

  const saleDate = new Date(date);
  const lines = resolved.map((it) => ({
    quantity: it.quantity,
    intent: {
      modelId: it.resolvedModelId!,
      size: normalizeSize(it.size),
      priceUyu: it.unitPrice,
      date: saleDate,
      method: 'mercadolibre',
      description: `meli #${orderId}`,
      collectedByUserId: user.id,
    } satisfies SaleIntent,
  }));

  try {
    const result = await recordMeliOrder(orderId, lines, user.id);
    // Runs on alreadyRecorded too: a retry after a failed link/invalidation
    // must still repair both. Links are best-effort (the sale is already
    // committed) and only written once the sale went through, so a rejected
    // order doesn't persist a guess.
    invalidateSaleFromRoute();
    const links = new Map(resolved.filter((it) => it.modelId).map((it) => [it.meliItemId, it.modelId!]));
    const outcomes = await Promise.allSettled([...links].map(([itemId, modelId]) => linkListing(itemId, modelId)));
    for (const o of outcomes) if (o.status === 'rejected') console.error('meli: could not save listing link', o.reason);
    return NextResponse.json({ ok: true, alreadyRecorded: result.alreadyRecorded, sales: result.saleIds.length });
  } catch (e) {
    if (e instanceof NotEnoughStockError) return NextResponse.json({ error: 'not_enough_stock' }, { status: 409 });
    throw e;
  }
}
