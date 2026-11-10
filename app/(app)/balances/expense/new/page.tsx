import { getUsers } from '@/app/lib/queries';
import { GastoForm } from '@/components/screens/gasto-form';

export default async function GastoNewPage() {
  const users = await getUsers();
  return <GastoForm users={users} />;
}
