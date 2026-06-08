export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { getModelById } from '@/app/lib/queries';
import { fetchExchangeRate } from '@/app/lib/exchange-rate';
import { SaleForm } from '@/components/screens/sale-form';

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [model, rate] = await Promise.all([getModelById(id), fetchExchangeRate()]);
  if (!model) notFound();
  return <SaleForm model={model} stock={model.stock} usdRate={rate.compra} />;
}
