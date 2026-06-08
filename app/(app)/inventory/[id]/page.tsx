export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { getModelById, getTransitCount } from '@/app/lib/queries';
import { fetchExchangeRate } from '@/app/lib/exchange-rate';
import { ModelDetailScreen } from '@/components/screens/model-detail';

export default async function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [model, transitCount, rate] = await Promise.all([getModelById(id), getTransitCount(), fetchExchangeRate()]);
  if (!model) notFound();
  return <ModelDetailScreen model={model} transitCount={transitCount} usdRate={rate.compra} />;
}
