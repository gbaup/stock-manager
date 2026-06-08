import { getUsers } from '@/app/lib/queries';
import { ConversionForm } from '@/components/screens/conversion-form';

export default async function ConversionNewPage() {
  const users = await getUsers();
  return <ConversionForm users={users} />;
}
