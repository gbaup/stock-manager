export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { getModelById, getTeams } from '@/app/lib/queries';
import { ModelForm } from '@/components/screens/model-form';

export default async function EditModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [model, teams] = await Promise.all([getModelById(id), getTeams()]);
  if (!model) notFound();
  return <ModelForm initial={model} teams={teams} />;
}
