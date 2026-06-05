import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/app/lib/auth';

const protectedPrefixes = ['/inventory', '/purchases', '/dashboard'];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((p) => path.startsWith(p));

  if (isProtected) {
    const session = await decrypt(request.cookies.get('session')?.value);
    if (!session?.userId) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Redirect root to inventory
  if (path === '/') {
    return NextResponse.redirect(new URL('/inventory', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public).*)'],
};
