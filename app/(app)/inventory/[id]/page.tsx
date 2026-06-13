import { notFound } from 'next/navigation';
import { getModelById, getTransitCount } from '@/app/lib/queries';
import { getExchangeRate } from '@/app/lib/exchange-rate';
import { ModelDetailScreen } from '@/components/screens/model-detail';

export default async function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [model, transitCount, usdRate] = await Promise.all([getModelById(id), getTransitCount(), getExchangeRate()]);
  if (!model) notFound();
  return <ModelDetailScreen model={model} transitCount={transitCount} usdRate={usdRate} />;
}
