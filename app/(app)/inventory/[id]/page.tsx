import { notFound } from 'next/navigation';
import { getModelById, getTransitCount } from '@/app/lib/queries';
import { ModelDetailScreen } from '@/components/screens/model-detail';

export default async function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [model, transitCount] = await Promise.all([getModelById(id), getTransitCount()]);
  if (!model) notFound();
  return <ModelDetailScreen model={model} transitCount={transitCount} />;
}
