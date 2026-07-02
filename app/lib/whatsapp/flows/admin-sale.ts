import { getModels, getUsers } from '@/app/lib/queries';
import { matchesModel, sizeStockOf, fmtSize } from '@/app/lib/domain';
import { getExchangeRate } from '@/app/lib/exchange-rate';
import { saleSchema, parseOrThrow } from '@/app/lib/schemas';
import { recordSale, NotEnoughStockError } from '@/app/lib/inventory';
import { uyu, fmtDate, todayISO } from '@/app/lib/format';
import type { ModelWithStats } from '@/app/lib/domain';
import type { ConversationData, IncomingMessage, StepResult } from '../types';
import { MSG, modelSummary, modelRowTitle } from '../messages';

// Guided sale registration for admins. Mirrors the web sale form
// (components/screens/sale-form.tsx) field-for-field and, on confirm, calls the
// same recordSale primitive the web action uses — so bot and web sales are
// identical downstream (FIFO pick, atomic status flip, cache invalidation).

const MAX_LIST = 10; // WhatsApp interactive list row cap

export async function adminSaleStep(
  step: string,
  data: ConversationData,
  msg: IncomingMessage,
  adminUserId: string,
): Promise<StepResult> {
  const sale = data.sale ?? {};

  switch (step) {
    case 'start':
      return { step: 'pick_model', data: { sale: {} }, replies: [{ kind: 'text', body: MSG.admin.greet }] };

    case 'pick_model': {
      // Tapped a model row → move on to size selection.
      const picked = idFrom(msg.replyId, 'model');
      if (picked) {
        const model = (await inStockModels()).find((m) => m.id === picked);
        if (!model) return reprompt('pick_model', MSG.admin.greet, data);
        return askSize(model, { ...sale, modelId: model.id, modelLabel: modelSummary(model) });
      }
      // Otherwise treat the text as a search query.
      const q = msg.text;
      if (!q) return reprompt('pick_model', MSG.admin.greet, data);
      const matches = (await inStockModels()).filter((m) => matchesModel(m, q));
      if (matches.length === 0) return reprompt('pick_model', MSG.admin.noModels(q), data);
      if (matches.length > MAX_LIST) return reprompt('pick_model', MSG.admin.tooMany(q), data);
      return {
        step: 'pick_model',
        data,
        replies: [
          {
            kind: 'list',
            body: MSG.admin.pickModel,
            button: 'Ver modelos',
            sections: [
              { rows: matches.map((m) => ({ id: `model:${m.id}`, title: modelRowTitle(m), description: `${m.stock} en stock` })) },
            ],
          },
        ],
      };
    }

    case 'pick_size': {
      const size = idFrom(msg.replyId, 'size');
      if (!size) return reprompt('pick_size', MSG.notUnderstood, data);
      return { step: 'ask_qty', data: { sale: { ...sale, size } }, replies: [{ kind: 'text', body: MSG.admin.askQty(await sizeStock(sale.modelId!, size)) }] };
    }

    case 'ask_qty': {
      const avail = await sizeStock(sale.modelId!, sale.size!);
      const qty = parseInt(msg.text, 10);
      if (!Number.isInteger(qty) || qty <= 0 || qty > avail) {
        return reprompt('ask_qty', MSG.admin.badQty(avail), data);
      }
      return { step: 'ask_price', data: { sale: { ...sale, quantity: String(qty) } }, replies: [{ kind: 'text', body: MSG.admin.askPrice }] };
    }

    case 'ask_price': {
      const price = parseFloat(msg.text.replace(',', '.'));
      if (!(price > 0)) return reprompt('ask_price', MSG.admin.badPrice, data);
      return {
        step: 'ask_date',
        data: { sale: { ...sale, price: String(price) } },
        replies: [{ kind: 'buttons', body: `${MSG.admin.askDate}\n(o escribí AAAA-MM-DD)`, buttons: [{ id: 'date:today', title: 'Hoy' }] }],
      };
    }

    case 'ask_date': {
      const date = msg.replyId === 'date:today' || msg.text.toLowerCase() === 'hoy' ? todayISO() : msg.text.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
        return reprompt('ask_date', MSG.admin.badDate, data);
      }
      return {
        step: 'ask_method',
        data: { sale: { ...sale, date } },
        replies: [
          {
            kind: 'list',
            body: MSG.admin.pickMethod,
            button: 'Elegir método',
            sections: [
              {
                rows: [
                  ...METHOD_ROWS,
                  { id: 'method:none', title: 'Sin especificar' },
                ],
              },
            ],
          },
        ],
      };
    }

    case 'ask_method': {
      const method = idFrom(msg.replyId, 'method');
      if (!method) return reprompt('ask_method', MSG.notUnderstood, data);
      const users = await getUsers();
      return {
        step: 'ask_collector',
        data: { sale: { ...sale, method: method === 'none' ? undefined : method } },
        replies: [
          {
            kind: 'list',
            body: MSG.admin.pickCollector,
            button: '¿Quién cobró?',
            sections: [{ rows: users.map((u) => ({ id: `user:${u.id}`, title: u.alias })) }],
          },
        ],
      };
    }

    case 'ask_collector': {
      const collectedByUserId = idFrom(msg.replyId, 'user');
      if (!collectedByUserId) return reprompt('ask_collector', MSG.notUnderstood, data);
      const next = { ...sale, collectedByUserId };
      return {
        step: 'confirm',
        data: { sale: next },
        replies: [{ kind: 'buttons', body: confirmText(next), buttons: [{ id: 'confirm:yes', title: 'Confirmar' }, { id: 'confirm:no', title: 'Cancelar' }] }],
      };
    }

    case 'confirm': {
      if (msg.replyId !== 'confirm:yes') {
        return { step: 'start', data: {}, replies: [{ kind: 'text', body: MSG.cancelled }] };
      }
      return finalizeSale(sale, adminUserId);
    }

    default:
      return { step: 'start', data: {}, replies: [{ kind: 'text', body: MSG.admin.greet }] };
  }
}

// ---- helpers ----

const METHOD_ROWS = (['Efectivo', 'Transferencia', 'MercadoPago', 'MercadoLibre'] as const).map((m) => ({
  id: `method:${m}`,
  title: m,
}));

async function inStockModels(): Promise<ModelWithStats[]> {
  return (await getModels()).filter((m) => m.stock > 0);
}

async function sizeStock(modelId: string, size: string): Promise<number> {
  const model = (await getModels()).find((m) => m.id === modelId);
  return model ? sizeStockOf(model)[size] ?? 0 : 0;
}

function askSize(model: ModelWithStats, sale: ConversationData['sale']): StepResult {
  return {
    step: 'pick_size',
    data: { sale },
    replies: [
      {
        kind: 'list',
        body: MSG.admin.pickSize,
        button: 'Elegir talle',
        sections: [
          {
            rows: model.availableBySize.map((s) => ({
              id: `size:${s.size}`,
              title: `${fmtSize(s.size)} (${s.count})`,
            })),
          },
        ],
      },
    ],
  };
}

function confirmText(sale: NonNullable<ConversationData['sale']>): string {
  const qty = parseInt(sale.quantity ?? '1', 10);
  const total = qty * parseFloat(sale.price ?? '0');
  return [
    MSG.admin.confirmTitle,
    `📦 ${sale.modelLabel}`,
    `📏 Talle: ${fmtSize(sale.size ?? '')}`,
    `🔢 Cantidad: ${qty}`,
    `💵 Precio c/u: ${uyu(parseFloat(sale.price ?? '0'))}` + (qty > 1 ? ` (total ${uyu(total)})` : ''),
    `📅 Fecha: ${fmtDate(sale.date ?? '')}`,
    sale.method ? `💳 Cobro: ${sale.method}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

async function finalizeSale(sale: NonNullable<ConversationData['sale']>, adminUserId: string): Promise<StepResult> {
  const draft = {
    size: sale.size ?? '',
    price: sale.price ?? '',
    quantity: sale.quantity ?? '',
    date: sale.date ?? '',
    method: sale.method,
    collectedByUserId: sale.collectedByUserId ?? '',
  };
  parseOrThrow(saleSchema, draft);

  const qty = parseInt(draft.quantity, 10);
  const priceUyu = parseFloat(draft.price);
  const exchangeRate = await getExchangeRate();
  const saleDate = new Date(draft.date);

  try {
    for (let i = 0; i < qty; i++) {
      await recordSale(
        {
          modelId: sale.modelId!,
          size: draft.size,
          priceUyu,
          exchangeRate,
          date: saleDate,
          method: draft.method?.trim().toLowerCase() || null,
          description: null,
          collectedByUserId: draft.collectedByUserId || null,
        },
        adminUserId,
      );
    }
  } catch (e) {
    if (e instanceof NotEnoughStockError) {
      return { step: 'start', data: {}, replies: [{ kind: 'text', body: MSG.admin.noStock }] };
    }
    throw e;
  }

  return { step: 'start', data: {}, replies: [{ kind: 'text', body: MSG.admin.saved(qty) }] };
}

// Extracts the value from a reply id like "model:<uuid>"; null if prefix mismatches.
function idFrom(replyId: string | null, prefix: string): string | null {
  if (!replyId) return null;
  const p = `${prefix}:`;
  return replyId.startsWith(p) ? replyId.slice(p.length) : null;
}

function reprompt(step: string, body: string, data: ConversationData): StepResult {
  return { step, data, replies: [{ kind: 'text', body }] };
}
