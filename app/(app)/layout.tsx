import { Suspense } from 'react';
import { Sidebar } from '@/components/ui/chrome';
import { getTransitCount } from '@/app/lib/queries';

// The desktop sidebar lives in the layout so it stays mounted across
// navigations — including while a route's loading.tsx skeleton is shown.
// Mutations that change the transit count call updateTag, and the server
// action refresh re-renders this layout with the new badge.
async function AppSidebar() {
  const transitCount = await getTransitCount();
  return <Sidebar transitCount={transitCount} />;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      {/* The fallback must not read the pathname (Sidebar uses usePathname,
          which is dynamic on routes like /inventory/[id]), so it's an empty
          shell. It only shows on a hard load; client navigations keep the
          layout — and the real sidebar — mounted. */}
      <Suspense fallback={<aside className="sidebar" aria-hidden />}>
        <AppSidebar />
      </Suspense>
      {children}
    </div>
  );
}
