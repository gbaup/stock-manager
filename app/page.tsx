import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserId } from '@/app/lib/auth';

async function AuthRedirect() {
  const userId = await getCurrentUserId();
  redirect(userId ? '/home' : '/public');
  return null;
}

export default function Home() {
  return (
    <Suspense>
      <AuthRedirect />
    </Suspense>
  );
}
