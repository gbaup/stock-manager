import { notFound } from 'next/navigation';
import { getBatchById, getUsers } from '@/app/lib/queries';
import { ArrivalForm } from '@/components/screens/arrival-form';

export default async function ArrivalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [batch, users] = await Promise.all([getBatchById(id), getUsers()]);
  if (!batch || batch.status === 'arrived') notFound();
  return <ArrivalForm batch={batch} users={users} />;
}
