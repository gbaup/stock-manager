import { notFound } from 'next/navigation';
import { getBatchById, getModels, getTeams, getUsers } from '@/app/lib/queries';
import { getRate } from '@/app/lib/exchange-rate';
import { PurchaseEditForm } from '@/components/screens/purchase-edit-form';

export default async function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [batch, models, users, rate, teams] = await Promise.all([
    getBatchById(id),
    getModels(),
    getUsers(),
    getRate(),
    getTeams(),
  ]);
  if (!batch) notFound();
  // Keyed by version: after a save, revisiting remounts with the new values
  // instead of restoring the kept-alive form's stale defaults.
  return <PurchaseEditForm key={batch.updatedAt} batch={batch} models={models} users={users} rate={rate} teams={teams} />;
}
