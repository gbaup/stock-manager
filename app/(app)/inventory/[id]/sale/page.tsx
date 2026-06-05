export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { getModelById } from '@/app/lib/queries';
import { SaleForm } from '@/components/screens/sale-form';

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await getModelById(id);
  if (!model) notFound();
  return <SaleForm model={model} stock={model.stock} />;
}
