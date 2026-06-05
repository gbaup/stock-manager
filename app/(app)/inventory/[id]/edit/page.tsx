export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { getModelById } from '@/app/lib/queries';
import { ModelForm } from '@/components/screens/model-form';

export default async function EditModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await getModelById(id);
  if (!model) notFound();
  return <ModelForm initial={model} />;
}
