import { notFound } from 'next/navigation';
import { getBatchById, getUsers } from '@/app/lib/queries';
import { getRate } from '@/app/lib/exchange-rate';
import { ArrivalForm } from '@/components/screens/arrival-form';

export default async function ArrivalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [batch, users, rate] = await Promise.all([getBatchById(id), getUsers(), getRate()]);
  if (!batch || batch.status === 'arrived') notFound();
  return <ArrivalForm batch={batch} users={users} rate={rate} />;
}
