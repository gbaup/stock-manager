import { z } from 'zod';

const saleFields = {
  price: z.string().refine((v) => parseFloat(v) > 0, 'Ingresá un precio válido'),
  quantity: z.string().refine((v) => parseInt(v, 10) > 0, 'Debe ser mayor a 0'),
  date: z.string().min(1, 'Requerido'),
  method: z.string().optional(),
  description: z.string().optional(),
  collectedBy: z.string().min(1, '¿Quién cobró?'),
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
  paidBy: z.string().min(1, '¿Quién pagó?'),
  date: z.string().min(1, 'Requerido'),
});

export type GastoFormValues = z.infer<typeof gastoSchema>;

export const arrivalSchema = z
  .object({
    arrivalDate: z.string().min(1, 'Requerido'),
    shippingPriceUsd: z.string().optional(),
    shippingPriceUyu: z.string().optional(),
    weight: z.string().optional(),
    shippingPaidBy: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasShipping =
        (parseFloat(data.shippingPriceUsd ?? '') || 0) > 0 ||
        (parseFloat(data.shippingPriceUyu ?? '') || 0) > 0;
      return !hasShipping || !!data.shippingPaidBy;
    },
    { message: '¿Quién pagó el envío?', path: ['shippingPaidBy'] }
  );

export type ArrivalFormValues = z.infer<typeof arrivalSchema>;

export const conversionSchema = z
  .object({
    fromPerson: z.enum(['Caja', 'Bauer']),
    fromCur: z.enum(['UYU', 'USD']),
    toPerson: z.enum(['Caja', 'Bauer']),
    toCur: z.enum(['UYU', 'USD']),
    fromAmount: z.string().refine((v) => parseFloat(v) > 0, 'Ingresá un monto válido'),
    rate: z.string().optional(),
    date: z.string().min(1, 'Requerido'),
  })
  .refine(
    (data) => !(data.fromPerson === data.toPerson && data.fromCur === data.toCur),
    { message: 'El origen y el destino no pueden ser la misma cuenta', path: ['toPerson'] }
  )
  .refine(
    (data) => {
      if (data.fromCur === data.toCur) return true;
      return (parseFloat(data.rate ?? '') || 0) > 0;
    },
    { message: 'Ingresá el tipo de cambio', path: ['rate'] }
  );

export type ConversionFormValues = z.infer<typeof conversionSchema>;

export const modelSchema = z.object({
  teamId: z.string().min(1, 'Requerido'),
  season: z.string().min(1, 'Requerido'),
  version: z.string(),
  type: z.string(),
  sleeve: z.string(),
  color: z.string(),
  number: z.string().optional(),
  player: z.string().optional(),
  description: z.string().optional(),
  photos: z.array(z.string()),
});

export type ModelFormValues = z.infer<typeof modelSchema>;

const purchaseItemSchema = z.object({
  modelId: z.string().min(1, 'Elegí un producto'),
  size: z.string().min(1, 'Elegí un talle'),
  basePriceUsd: z.string().optional(),
});

export const purchaseSchema = z
  .object({
    purchaseDate: z.string().min(1, 'Requerido'),
    supplier: z.string().optional(),
    trackingNumber: z.string().optional(),
    description: z.string().optional(),
    supplierPaidBy: z.string().optional(),
    items: z.array(purchaseItemSchema).min(1, 'Agregá al menos un item'),
  })
  .refine(
    (data) => {
      const totalUsd = data.items.reduce(
        (s, it) => s + (parseFloat(it.basePriceUsd ?? '') || 0),
        0
      );
      return totalUsd === 0 || !!data.supplierPaidBy;
    },
    { message: '¿Quién pagó al proveedor?', path: ['supplierPaidBy'] }
  );

export type PurchaseFormValues = z.infer<typeof purchaseSchema>;
