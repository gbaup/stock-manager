import { redirect } from 'next/navigation';
import { getCurrentUserId } from '@/app/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect('/login');
  return <div className="app-shell">{children}</div>;
}
