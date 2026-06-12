import { notFound } from 'next/navigation';
import { getModelById, getUsers } from '@/app/lib/queries';
import { getExchangeRate } from '@/app/lib/exchange-rate';
import { SaleForm } from '@/components/screens/sale-form';

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [model, usdRate, users] = await Promise.all([getModelById(id), getExchangeRate(), getUsers()]);
  if (!model) notFound();
  return <SaleForm model={model} stock={model.stock} usdRate={usdRate} users={users} />;
}
