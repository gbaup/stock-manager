export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { getBatchById } from '@/app/lib/queries';
import { ArrivalForm } from '@/components/screens/arrival-form';

export default async function ArrivalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await getBatchById(id);
  if (!batch || batch.status === 'arrived') notFound();
  return <ArrivalForm batch={batch} />;
}
