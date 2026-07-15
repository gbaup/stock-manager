import { notFound } from 'next/navigation';
import { getBatchById, getModels, getUsers } from '@/app/lib/queries';
import { getRate } from '@/app/lib/exchange-rate';
import { PurchaseEditForm } from '@/components/screens/purchase-edit-form';

export default async function PurchaseEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [batch, models, users, rate] = await Promise.all([
    getBatchById(id), getModels(), getUsers(), getRate(),
  ]);
  if (!batch) notFound();
  return <PurchaseEditForm batch={batch} models={models} users={users} rate={rate} />;
}
