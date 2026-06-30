import { z } from 'zod';

export function parseOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Datos inválidos');
  return result.data;
}

const saleFields = {
  price: z.string().refine((v) => parseFloat(v) > 0, 'Ingresá un precio válido'),
  quantity: z.string().refine((v) => parseInt(v, 10) > 0, 'Debe ser mayor a 0'),
  date: z.string().min(1, 'Requerido'),
  method: z.string().optional(),
  description: z.string().optional(),
  collectedByUserId: z.string().uuid('¿Quién cobró?'),
};

export const saleSchema = z.object(saleFields);

export const makeSaleSchema = (stock: number) =>
  z.object({
    ...saleFields,
    quantity: z
      .string()
      .refine((v) => parseInt(v, 10) > 0, 'Debe ser mayor a 0')
      .refine((v) => parseInt(v, 10) <= stock, `Solo hay ${stock} en stock`),
  });

export type SaleFormValues = z.infer<ReturnType<typeof makeSaleSchema>>;

export const gastoSchema = z.object({
  title: z.string().min(1, 'Requerido'),
  amount: z.string().refine((v) => parseFloat(v) > 0, 'Ingresá un monto válido'),
  currency: z.enum(['UYU', 'USD']),
  paidByUserId: z.string().uuid('¿Quién pagó?'),
  date: z.string().min(1, 'Requerido'),
});

export type GastoFormValues = z.infer<typeof gastoSchema>;

export const arrivalSchema = z
  .object({
    arrivalDate: z.string().min(1, 'Requerido'),
    trackingNumber: z.string().optional(),
    shippingRateUsd: z.string().optional(),
    weight: z.string().optional(),
    shippingPaidByUserId: z.string().optional().transform((v) => v || undefined).pipe(z.string().uuid().optional()),
    itemIds: z.array(z.string().uuid()).min(1, 'Marcá al menos un item'),
  });

export type ArrivalFormValues = z.infer<typeof arrivalSchema>;

export const conversionSchema = z
  .object({
    fromUserId: z.string().uuid('Seleccioná el origen'),
    fromCur: z.enum(['UYU', 'USD']),
    toUserId: z.string().uuid('Seleccioná el destino'),
    toCur: z.enum(['UYU', 'USD']),
    fromAmount: z.string().refine((v) => parseFloat(v) > 0, 'Ingresá un monto válido'),
    rate: z.string().optional(),
    date: z.string().min(1, 'Requerido'),
  })
  .refine(
    (data) => !(data.fromUserId === data.toUserId && data.fromCur === data.toCur),
    { message: 'El origen y el destino no pueden ser la misma cuenta', path: ['toUserId'] }
  )
  .refine(
    (data) => {
      if (data.fromCur === data.toCur) return true;
      return (parseFloat(data.rate ?? '') || 0) > 0;
    },
    { message: 'Ingresá el tipo de cambio', path: ['rate'] }
  );

export type ConversionFormValues = z.infer<typeof conversionSchema>;

const numericOptional = z
  .string()
  .optional()
  .refine((v) => v === undefined || v === '' || !isNaN(parseFloat(v)), 'Monto inválido');

export const ajusteSchema = z
  .object({
    userId: z.string().uuid('Seleccioná el socio'),
    amountUyu: numericOptional,
    amountUsd: numericOptional,
    date: z.string().min(1, 'Requerido'),
    note: z.string().optional(),
  })
  .refine(
    (data) => {
      const uyu = parseFloat(data.amountUyu ?? '') || 0;
      const usd = parseFloat(data.amountUsd ?? '') || 0;
      return uyu !== 0 || usd !== 0;
    },
    { message: 'Ingresá al menos un monto', path: ['amountUyu'] }
  );

export type AjusteFormValues = z.infer<typeof ajusteSchema>;

export const modelSchema = z.object({
  teamId: z.string().min(1, 'Requerido'),
  season: z
    .string()
    .min(1, 'Requerido')
    .regex(/^\d{4}(\/\d{2})?$/, 'Formato inválido. Usá YYYY o YYYY/YY (ej: 2006 o 2007/08)'),
  version: z.string(),
  type: z.string(),
  sleeve: z.string(),
  color: z.string(),
  number: z.string().optional(),
  player: z.string().optional(),
  description: z.string().optional(),
  photos: z.array(z.object({
    url: z.string().min(1),
    publicId: z.string(),
  })),
});

export type ModelFormValues = z.infer<typeof modelSchema>;

const purchaseItemSchema = z.object({
  modelId: z.string().min(1, 'Elegí un producto'),
  size: z.string().min(1, 'Elegí un talle'),
  basePriceUsd: z.string().optional(),
  quantity: z.number().int().min(1),
});

export const purchaseSchema = z
  .object({
    purchaseDate: z.string().min(1, 'Requerido'),
    supplier: z.string().optional(),
    description: z.string().optional(),
    supplierPayments: z.record(z.string().uuid(), numericOptional).optional(),
    items: z.array(purchaseItemSchema).min(1, 'Agregá al menos un item'),
  });

export type PurchaseFormValues = z.infer<typeof purchaseSchema>;
